import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../tenancy/auth.guard';
import { AuthenticatedRequest } from '../tenancy/types';
import { ExpensesService } from './expenses.service';

@Controller()
@UseGuards(AuthGuard)
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get('expense-categories')
  listCategories(@Req() request: AuthenticatedRequest) {
    return this.expenses.listCategories(request.user!);
  }

  @Post('expense-categories')
  createCategory(@Req() request: AuthenticatedRequest, @Body() body: Record<string, unknown>) {
    return this.expenses.createCategory(request.user!, body ?? {});
  }

  @Patch('expense-categories/:id')
  updateCategory(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.expenses.updateCategory(request.user!, id, body ?? {});
  }

  @Post('expenses')
  record(@Req() request: AuthenticatedRequest, @Body() body: Record<string, unknown>) {
    return this.expenses.recordExpense(request.user!, body ?? {});
  }

  @Get('expenses')
  list(@Req() request: AuthenticatedRequest, @Query() query: Record<string, unknown>) {
    return this.expenses.listExpenses(request.user!, query.warehouseId as string, query);
  }

  @Get('expenses/:id')
  get(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.expenses.getExpense(request.user!, id);
  }
}