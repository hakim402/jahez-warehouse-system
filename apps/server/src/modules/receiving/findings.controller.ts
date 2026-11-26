import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../tenancy/auth.guard';
import { AuthenticatedRequest } from '../tenancy/types';
import { FindingsService } from './findings.service';

@Controller('findings')
@UseGuards(AuthGuard)
export class FindingsController {
  constructor(private readonly findings: FindingsService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest, @Query('status') status?: string) {
    return this.findings.list(request.user!, status);
  }

  @Patch(':id')
  resolve(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.findings.resolve(request.user!, id, body ?? {});
  }
}
