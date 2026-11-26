import { BadRequestException, Body, Controller, ForbiddenException, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../tenancy/auth.guard';
import { AuthenticatedRequest, isUuid } from '../tenancy/types';
import { WarehouseAccessGuard } from '../tenancy/warehouse-access.guard';
import { AdjustmentsService } from './adjustments.service';
import { InventoryService, StockFilters } from './inventory.service';

@Controller('stock')
@UseGuards(AuthGuard)
export class InventoryController {
  constructor(
    private readonly inventory: InventoryService,
    private readonly adjustments: AdjustmentsService,
  ) {}

  @Get()
  @UseGuards(WarehouseAccessGuard)
  balances(@Req() request: AuthenticatedRequest, @Query() query: Record<string, unknown>) {
    return this.inventory.listBalances(this.membership(request), filters(query));
  }

  @Get('movements')
  @UseGuards(WarehouseAccessGuard)
  movements(@Req() request: AuthenticatedRequest, @Query() query: Record<string, unknown>) {
    return this.inventory.listMovements(this.membership(request), filters(query), query.limit, query.cursor);
  }

  @Get('age')
  @UseGuards(WarehouseAccessGuard)
  age(@Req() request: AuthenticatedRequest, @Query() query: Record<string, unknown>) {
    return this.inventory.listAge(this.membership(request), filters(query));
  }

  @Post('adjustments')
  recordAdjustment(@Req() request: AuthenticatedRequest, @Body() body: Record<string, unknown>) {
    return this.adjustments.recordAdjustment(request.user!, body ?? {});
  }

  private membership(request: AuthenticatedRequest) {
    if (!request.membership) throw new ForbiddenException('Warehouse access denied');
    return request.membership;
  }
}

function filters(query: Record<string, unknown>): StockFilters {
  return {
    customerMark: filterValue(query.customerMark, 'customerMark'),
    customerId: filterValue(query.customerId, 'customerId', true),
    supplierId: filterValue(query.supplierId, 'supplierId', true),
    brand: filterValue(query.brand, 'brand'),
    productId: filterValue(query.productId, 'productId', true),
  };
}

function filterValue(value: unknown, name: string, uuid = false): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || (uuid && !isUuid(value))) {
    throw new BadRequestException(`${name} must be a single ${uuid ? 'UUID' : 'text value'}`);
  }
  return value || undefined;
}
