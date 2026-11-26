import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../tenancy/auth.guard';
import { AuthenticatedRequest, isOfficeRole } from '../tenancy/types';
import { WarehouseAccessGuard } from '../tenancy/warehouse-access.guard';
import { OrdersService } from './orders.service';

@Controller('orders')
@UseGuards(AuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get('awaiting')
  @UseGuards(WarehouseAccessGuard)
  awaiting(@Req() request: AuthenticatedRequest) {
    const membership = request.membership;
    if (!membership) throw new ForbiddenException('Warehouse access denied');
    return this.orders.awaitingQueue(membership);
  }

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() body: Record<string, unknown>) {
    this.assertOffice(request);
    return this.orders.createDraft(request.user!, body ?? {});
  }

  @Get()
  list(@Req() request: AuthenticatedRequest, @Query('warehouseId') warehouseId?: string) {
    this.assertOffice(request);
    return this.orders.listOrders(request.user!, warehouseId);
  }

  @Get(':id')
  get(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    this.assertOffice(request);
    return this.orders.getOrder(request.user!, id);
  }

  @Patch(':id')
  edit(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    this.assertOffice(request);
    return this.orders.editDraft(request.user!, id, body ?? {});
  }

  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  confirm(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    this.assertOffice(request);
    return this.orders.confirm(request.user!, id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    this.assertOffice(request);
    return this.orders.cancel(request.user!, id);
  }

  private assertOffice(request: AuthenticatedRequest) {
    if (!isOfficeRole(request.user?.role)) {
      throw new ForbiddenException('Order management access denied');
    }
  }
}