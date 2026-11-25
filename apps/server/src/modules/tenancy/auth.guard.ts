import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtPayload, verify } from 'jsonwebtoken';
import { SERVER_CONFIG, ServerConfig } from '../../platform/server-config';
import { AuthenticatedRequest, isUserRole } from './types';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(SERVER_CONFIG) private readonly config: ServerConfig) {}

  canActivate(context: ExecutionContext): boolean {
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

    if (
      typeof payload.sub !== 'string' ||
      typeof payload.tenantId !== 'string' ||
      !isUserRole(payload.role)
    ) {
      throw new UnauthorizedException('Invalid bearer token');
    }

    request.user = {
      id: payload.sub,
      tenantId: payload.tenantId,
      role: payload.role,
    };
    return true;
  }
}