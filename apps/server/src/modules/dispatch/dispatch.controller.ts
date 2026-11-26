import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../tenancy/auth.guard';
import { AuthenticatedRequest } from '../tenancy/types';
import { DispatchService } from './dispatch.service';

@Controller('dispatches')
@UseGuards(AuthGuard)
export class DispatchController {
  constructor(private readonly dispatches: DispatchService) {}

  @Post()
  confirm(@Req() request: AuthenticatedRequest, @Body() body: Record<string, unknown>) {
    return this.dispatches.confirmDispatch(request.user!, body ?? {});
  }

  @Get()
  list(@Req() request: AuthenticatedRequest, @Query() query: Record<string, unknown>) {
    return this.dispatches.listDispatches(request.user!, query.warehouseId as string, query.customerId);
  }

  @Get(':id')
  get(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.dispatches.getDispatch(request.user!, id);
  }
}