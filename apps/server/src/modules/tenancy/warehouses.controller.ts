import { Controller, ForbiddenException, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { AuthenticatedRequest } from './types';
import { WarehouseAccessGuard } from './warehouse-access.guard';

@Controller('warehouses')
export class WarehousesController {
  @Get(':id')
  @UseGuards(AuthGuard, WarehouseAccessGuard)
  get(@Req() request: AuthenticatedRequest) {
    const membership = request.membership;
    if (!membership) {
      throw new ForbiddenException('Warehouse access denied');
    }
    return membership.warehouse;
  }
}