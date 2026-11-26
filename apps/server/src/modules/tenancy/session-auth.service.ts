import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { verify } from 'jsonwebtoken';
import { DatabaseService } from '../../platform/database.service';
import { SERVER_CONFIG, ServerConfig } from '../../platform/server-config';
import { AuthenticatedUser, isUserRole, isUuid, UserRole } from './types';

export interface AuthenticatedSession {
  user: AuthenticatedUser;
  expiresAt: number;
}

interface ActiveSessionRow {
  revoked_at: Date | null;
  expires_at: Date;
  role: UserRole;
  warehouse_id: string | null;
}

@Injectable()
export class SessionAuthService {
  constructor(
    @Inject(SERVER_CONFIG) private readonly config: ServerConfig,
    private readonly database: DatabaseService,
  ) {}

  async authenticate(token: unknown): Promise<AuthenticatedSession> {
    if (typeof token !== 'string' || token.length === 0) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const payload = this.verifyToken(token);
    if (
      typeof payload === 'string' || !isUuid(payload.sub) || !isUuid(payload.tenantId) ||
      !isUuid(payload.sid) || !isUserRole(payload.role) ||
      typeof payload.exp !== 'number' || !Number.isSafeInteger(payload.exp)
    ) {
      throw new UnauthorizedException('Invalid bearer token');
    }

    const session = {
      user: { id: payload.sub, tenantId: payload.tenantId, sessionId: payload.sid, role: payload.role },
      expiresAt: payload.exp * 1000,
    };
    const current = await this.revalidate(session);
    return { ...session, user: current.user };
  }

  async revalidate({ user, expiresAt }: AuthenticatedSession, warehouseId: string | null = null) {
    if (expiresAt <= Date.now()) throw new UnauthorizedException('Access token expired');

    const result = await this.database.withTenant(user.tenantId, user.id, (client) =>
      client.query<ActiveSessionRow>(
        `SELECT s.revoked_at, s.expires_at, u.role,
                CASE WHEN $4::uuid IS NOT NULL AND app_has_warehouse_access($4::uuid)
                     THEN $4::uuid END AS warehouse_id
         FROM auth_sessions s
         JOIN users u ON u.id = s.user_id AND u.tenant_id = s.tenant_id
         WHERE s.id = $1 AND s.user_id = $2 AND s.tenant_id = $3`,
        [user.sessionId, user.id, user.tenantId, warehouseId],
      ),
    );
    const row = result.rows[0];
    const now = Date.now();
    if (!row || row.revoked_at !== null || row.expires_at.getTime() <= now || expiresAt <= now) {
      throw new UnauthorizedException('Session is no longer active');
    }
    return { user: { ...user, role: row.role }, warehouseId: row.warehouse_id };
  }

  private verifyToken(token: string) {
    try {
      return verify(token, this.config.jwtSecret, { algorithms: ['HS256'] });
    } catch {
      throw new UnauthorizedException('Invalid bearer token');
    }
  }
}
