import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { sign } from 'jsonwebtoken';
import { DatabaseService } from '../../platform/database.service';
import { SERVER_CONFIG, ServerConfig } from '../../platform/server-config';
import { AuthenticatedUser, isUuid, UserRole } from '../tenancy/types';
import { verifyPassword } from './password';

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface LoginUserRow {
  id: string;
  tenant_id: string;
  name: string;
  role: UserRole;
  password_hash: string | null;
}

interface SessionRow {
  id: string;
  tenant_id: string;
  user_id: string;
  device_id: string;
  expires_at: Date;
  revoked_at: Date | null;
}

interface SessionListRow {
  id: string;
  device_id: string;
  created_at: Date;
  last_used_at: Date | null;
  expires_at: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  sessionId: string;
  user: {
    id: string;
    tenantId: string;
    role: UserRole;
    name: string;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly database: DatabaseService,
    @Inject(SERVER_CONFIG) private readonly config: ServerConfig,
  ) {}

  async login(input: {
    phone?: unknown;
    password?: unknown;
    tenantId?: unknown;
    deviceId?: unknown;
  }): Promise<AuthTokens> {
    const phone = typeof input.phone === 'string' ? input.phone.trim() : '';
    const password = typeof input.password === 'string' ? input.password : '';
    if (!phone || !password) {
      throw new BadRequestException('Phone and password are required');
    }

    let tenantId: string | null = null;
    if (input.tenantId !== undefined && input.tenantId !== null && input.tenantId !== '') {
      if (!isUuid(input.tenantId)) {
        throw new BadRequestException('Malformed tenant id');
      }
      tenantId = input.tenantId;
    }

    const users = await this.database.query<LoginUserRow>(
      'SELECT * FROM auth_find_user($1, $2)',
      [phone, tenantId],
    );
    if (users.rows.length === 0) {
      throw new UnauthorizedException('Invalid phone or password');
    }
    if (users.rows.length > 1) {
      throw new BadRequestException('tenantId is required for this phone');
    }

    let user = users.rows[0];
    if (!verifyPassword(password, user.password_hash)) {
      throw new UnauthorizedException('Invalid phone or password');
    }

    const deviceId =
      typeof input.deviceId === 'string' && input.deviceId.trim().length > 0
        ? input.deviceId.trim()
        : 'unknown';
    const refreshToken = randomBytes(32).toString('hex');
    const refreshHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    const sessionId = await this.database.withTenant(user.tenant_id, user.id, async (client) => {
      // Lock the user before inserting a session to serialize password resets and disables.
      const locked = await client.query<LoginUserRow>(
        'SELECT id, tenant_id, name, role, password_hash FROM users WHERE id = $1 AND tenant_id = $2 AND active FOR UPDATE', [user.id, user.tenant_id]);
      if (!locked.rows[0] || !verifyPassword(password, locked.rows[0].password_hash)) throw new UnauthorizedException('Invalid phone or password');
      user = locked.rows[0];
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO auth_sessions (tenant_id, user_id, device_id, refresh_token_hash, expires_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [user.tenant_id, user.id, deviceId, refreshHash, expiresAt],
      );
      const id = inserted.rows[0].id;
      await client.query(
        `INSERT INTO audit_events (tenant_id, user_id, entity, entity_id, action, after)
         VALUES ($1, $2, 'auth_session', $3, 'auth.sign_in', $4)`,
        [user.tenant_id, user.id, id, JSON.stringify({ deviceId })],
      );
      return id;
    });

    return this.buildTokens(user, sessionId, refreshToken);
  }

  async refresh(refreshToken: unknown): Promise<AuthTokens> {
    if (typeof refreshToken !== 'string' || refreshToken.length === 0) {
      throw new BadRequestException('Refresh token is required');
    }

    const sessions = await this.database.query<SessionRow>(
      'SELECT * FROM auth_find_session($1)',
      [hashToken(refreshToken)],
    );
    const session = sessions.rows[0];
    if (!session || session.revoked_at !== null || session.expires_at.getTime() <= Date.now()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const nextRefreshToken = randomBytes(32).toString('hex');
    const nextRefreshHash = hashToken(nextRefreshToken);
    const presentedHash = hashToken(refreshToken);

    const user = await this.database.withTenant(
      session.tenant_id,
      session.user_id,
      async (client) => {
        // Keep the user → session lock order consistent with administrative writes.
        const users = await client.query<LoginUserRow>(
          'SELECT id, tenant_id, name, role, password_hash FROM users WHERE id = $1 AND tenant_id = $2 AND active FOR UPDATE',
          [session.user_id, session.tenant_id],
        );
        const found = users.rows[0];
        if (!found) throw new UnauthorizedException('Invalid refresh token');
        const rotated = await client.query(
          `UPDATE auth_sessions SET refresh_token_hash = $1, last_used_at = now()
           WHERE id = $2 AND refresh_token_hash = $3 AND revoked_at IS NULL AND expires_at > now()`,
          [nextRefreshHash, session.id, presentedHash],
        );
        if (rotated.rowCount === 0) throw new UnauthorizedException('Invalid refresh token');

        await client.query(
          `INSERT INTO audit_events (tenant_id, user_id, entity, entity_id, action, after)
           VALUES ($1, $2, 'auth_session', $3, 'auth.refresh', $4)`,
          [session.tenant_id, session.user_id, session.id, JSON.stringify({ deviceId: session.device_id })],
        );
        return found;
      },
    );

    return this.buildTokens(user, session.id, nextRefreshToken);
  }

  async logout(user: AuthenticatedUser): Promise<void> {
    await this.database.withTenant(user.tenantId, user.id, async (client) => {
      await client.query(
        'UPDATE auth_sessions SET revoked_at = now() WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL',
        [user.sessionId, user.id],
      );
      await client.query(
        `INSERT INTO audit_events (tenant_id, user_id, entity, entity_id, action)
         VALUES ($1, $2, 'auth_session', $3, 'auth.sign_out')`,
        [user.tenantId, user.id, user.sessionId],
      );
    });
  }

  async listSessions(user: AuthenticatedUser) {
    return this.database.withTenant(user.tenantId, user.id, async (client) => {
      const sessions = await client.query<SessionListRow>(
        `SELECT id, device_id, created_at, last_used_at, expires_at
         FROM auth_sessions
         WHERE user_id = $1 AND revoked_at IS NULL
         ORDER BY created_at DESC`,
        [user.id],
      );
      return sessions.rows.map((row) => ({
        id: row.id,
        deviceId: row.device_id,
        createdAt: row.created_at,
        lastUsedAt: row.last_used_at,
        expiresAt: row.expires_at,
      }));
    });
  }

  async revokeSession(user: AuthenticatedUser, sessionId: unknown): Promise<void> {
    if (!isUuid(sessionId)) {
      throw new BadRequestException('Malformed session id');
    }

    await this.database.withTenant(user.tenantId, user.id, async (client) => {
      const sessions = await client.query<SessionRow>(
        'SELECT id, tenant_id, user_id, device_id, expires_at, revoked_at FROM auth_sessions WHERE id = $1',
        [sessionId],
      );
      const session = sessions.rows[0];
      if (!session) {
        throw new NotFoundException('Session not found');
      }
      if (session.user_id !== user.id && user.role !== 'owner') {
        throw new ForbiddenException('Session revocation denied');
      }
      if (session.tenant_id !== user.tenantId) {
        throw new ForbiddenException('Session revocation denied');
      }

      if (session.revoked_at === null) {
        await client.query('UPDATE auth_sessions SET revoked_at = now() WHERE id = $1', [sessionId]);
      }
      await client.query(
        `INSERT INTO audit_events (tenant_id, user_id, entity, entity_id, action, after)
         VALUES ($1, $2, 'auth_session', $3, 'auth.session_revoked', $4)`,
        [user.tenantId, user.id, sessionId, JSON.stringify({ revokedUserId: session.user_id })],
      );
    });
  }

  private buildTokens(user: LoginUserRow, sessionId: string, refreshToken: string): AuthTokens {
    const accessToken = sign(
      { sub: user.id, tenantId: user.tenant_id, role: user.role, sid: sessionId },
      this.config.jwtSecret,
      { algorithm: 'HS256', expiresIn: ACCESS_TOKEN_TTL_SECONDS },
    );

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      sessionId,
      user: {
        id: user.id,
        tenantId: user.tenant_id,
        role: user.role,
        name: user.name,
      },
    };
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}