import { Body, Controller, ForbiddenException, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../tenancy/auth.guard';
import { AuthenticatedRequest } from '../tenancy/types';
import { WarehouseAccessGuard } from '../tenancy/warehouse-access.guard';
import { SyncService } from './sync.service';

@Controller('sync')
@UseGuards(AuthGuard)
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Post('push')
  push(@Req() request: AuthenticatedRequest, @Body() body: Record<string, unknown>) {
    return this.sync.push(request.user!, body ?? {});
  }

  @Get('pull')
  @UseGuards(WarehouseAccessGuard)
  pull(@Req() request: AuthenticatedRequest, @Query('cursor') cursor?: string) {
    const membership = request.membership;
    if (!membership) throw new ForbiddenException('Warehouse access denied');
    return this.sync.pull(membership, cursor);
  }
}