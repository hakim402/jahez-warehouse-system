import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { TenancyService } from './tenancy.service';
import { AuthenticatedRequest } from './types';
import { WarehouseAccessGuard } from './warehouse-access.guard';

@Controller('warehouses')
export class WarehousesController {
  constructor(private readonly tenancy: TenancyService) {}

  @Get(':id')
  @UseGuards(AuthGuard, WarehouseAccessGuard)
  get(@Req() request: AuthenticatedRequest) {
    const membership = request.membership;
    if (!membership) {
      throw new ForbiddenException('Warehouse access denied');
    }
    return membership.warehouse;
  }

  @Patch(':id')
  @UseGuards(AuthGuard, WarehouseAccessGuard)
  async update(@Req() request: AuthenticatedRequest, @Body() body: { name?: unknown }) {
    const membership = request.membership;
    if (!membership) {
      throw new ForbiddenException('Warehouse access denied');
    }
    if (membership.role === 'worker') {
      throw new ForbiddenException('Warehouse write access denied');
    }
    if (typeof body?.name !== 'string' || body.name.trim().length === 0) {
      throw new BadRequestException('Warehouse name is required');
    }
    return this.tenancy.updateWarehouse(membership, body.name.trim());
  }
}