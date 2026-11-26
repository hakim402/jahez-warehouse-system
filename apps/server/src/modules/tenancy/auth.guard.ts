import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtPayload, verify } from 'jsonwebtoken';
import { DatabaseService } from '../../platform/database.service';
import { SERVER_CONFIG, ServerConfig } from '../../platform/server-config';
import { AuthenticatedRequest, isUserRole, isUuid } from './types';

interface SessionRow {
  revoked_at: Date | null;
  expires_at: Date;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(SERVER_CONFIG) private readonly config: ServerConfig,
    private readonly database: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    let payload: JwtPayload;
    try {
      const decoded = verify(header.slice(7).trim(), this.config.jwtSecret, {
        algorithms: ['HS256'],
      });
      if (typeof decoded === 'string') {
        throw new Error('Unexpected token payload');
      }
      payload = decoded;
    } catch {
      throw new UnauthorizedException('Invalid bearer token');
    }

    const userId = payload.sub;
    const tenantId = payload.tenantId;
    const sessionId = payload.sid;
    if (
      typeof userId !== 'string' ||
      typeof tenantId !== 'string' ||
      typeof sessionId !== 'string' ||
      !isUuid(userId) ||
      !isUuid(tenantId) ||
      !isUuid(sessionId) ||
      !isUserRole(payload.role)
    ) {
      throw new UnauthorizedException('Invalid bearer token');
    }

    const session = await this.database.withTenant(tenantId, userId, (client) =>
      client.query<SessionRow>('SELECT revoked_at, expires_at FROM auth_sessions WHERE id = $1', [
        sessionId,
      ]),
    );
    const row = session.rows[0];
    if (!row || row.revoked_at !== null || row.expires_at.getTime() <= Date.now()) {
      throw new UnauthorizedException('Session is no longer active');
    }

    request.user = {
      id: userId,
      tenantId,
      role: payload.role,
      sessionId,
    };
    return true;
  }
}