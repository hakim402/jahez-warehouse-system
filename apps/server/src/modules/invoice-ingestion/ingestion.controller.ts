import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../tenancy/auth.guard';
import { AuthenticatedRequest } from '../tenancy/types';
import { IngestionService } from './ingestion.service';

@Controller()
@UseGuards(AuthGuard)
export class IngestionController {
  constructor(private readonly ingestion: IngestionService) {}

  @Post('orders/extract')
  extractOrder(@Req() request: AuthenticatedRequest, @Body() body: Record<string, unknown>) {
    return this.ingestion.createImport(request.user!, body ?? {}, 'purchase');
  }

  @Post('expenses/extract')
  extractExpense(@Req() request: AuthenticatedRequest, @Body() body: Record<string, unknown>) {
    return this.ingestion.createImport(request.user!, body ?? {}, 'expense');
  }

  @Get('imports')
  list(@Req() request: AuthenticatedRequest, @Query('warehouseId') warehouseId: string) {
    return this.ingestion.listImports(request.user!, warehouseId);
  }

  @Get('imports/:id')
  get(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.ingestion.getImport(request.user!, id);
  }

  @Patch('imports/:id')
  patch(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.ingestion.patchImport(request.user!, id, body ?? {});
  }

  @Post('imports/:id/commit')
  commit(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.ingestion.commitImport(request.user!, id);
  }
}
