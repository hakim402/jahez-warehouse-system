import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../tenancy/auth.guard';
import { AuthenticatedRequest } from '../tenancy/types';
import { ReceivingService } from './receiving.service';

@Controller('receipts')
@UseGuards(AuthGuard)
export class ReceivingController {
  constructor(private readonly receiving: ReceivingService) {}

  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  confirm(@Req() request: AuthenticatedRequest, @Body() body: Record<string, unknown>) {
    return this.receiving.confirmReceipt(request.user!, body ?? {});
  }

  @Get(':id')
  get(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.receiving.getReceipt(request.user!, id);
  }
}