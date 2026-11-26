import { Body, Controller, Get, Param, Post, Query, Req, Res, StreamableFile, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '../tenancy/auth.guard';
import { AuthenticatedRequest } from '../tenancy/types';
import { ExportsService } from './exports.service';

@Controller('exports')
@UseGuards(AuthGuard)
export class ExportsController {
  constructor(private readonly exports: ExportsService) {}

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() body: Record<string, unknown>) {
    return this.exports.createExport(request.user!, body ?? {});
  }

  @Get()
  list(@Req() request: AuthenticatedRequest, @Query('warehouseId') warehouseId: string) {
    return this.exports.listExports(request.user!, warehouseId);
  }

  @Get(':id')
  get(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.exports.getExport(request.user!, id);
  }

  @Get(':id/file')
  async download(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.exports.downloadExport(request.user!, id);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    return new StreamableFile(file.stream);
  }
}
