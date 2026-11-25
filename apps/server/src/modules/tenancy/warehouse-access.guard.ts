import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { TenancyService } from './tenancy.service';
import { AuthenticatedRequest } from './types';

@Injectable()
export class WarehouseAccessGuard implements CanActivate {
  constructor(private readonly tenancy: TenancyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Missing authenticated user');
    }

    const warehouseId =
      request.params?.id ??
      request.params?.warehouseId ??
      request.query?.warehouseId ??
      request.headers['x-warehouse-id'];
    if (typeof warehouseId !== 'string' || warehouseId.length === 0) {
      throw new BadRequestException('Warehouse id is required');
    }

    const access = await this.tenancy.findWarehouseAccess(user.id, warehouseId);
    if (!access || access.tenantId !== user.tenantId) {
      throw new ForbiddenException('Warehouse access denied');
    }

    request.membership = access;
    return true;
  }
}