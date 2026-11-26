import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import { AuthGuard } from '../tenancy/auth.guard';
import { AuthenticatedRequest } from '../tenancy/types';
import { WarehouseAccessGuard } from '../tenancy/warehouse-access.guard';
import { FilesService } from './files.service';

@Controller('files')
@UseGuards(AuthGuard)
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Post()
  @UseGuards(WarehouseAccessGuard)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } }))
  upload(
    @Req() request: AuthenticatedRequest,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    const membership = request.membership;
    if (!membership) throw new ForbiddenException('Warehouse access denied');
    return this.files.upload(request.user!, membership, body ?? {}, file);
  }

  @Get()
  @UseGuards(WarehouseAccessGuard)
  list(@Req() request: AuthenticatedRequest, @Query() query: Record<string, string>) {
    const membership = request.membership;
    if (!membership) throw new ForbiddenException('Warehouse access denied');
    return this.files.list(membership, query ?? {});
  }

  @Get(':id')
  get(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.files.getMetadata(request.user!, id);
  }

  @Get(':id/content')
  async content(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Res() response: Response) {
    const { row, stream } = await this.files.download(request.user!, id);
    const disposition = row.content_type.startsWith('image/') ? 'inline' : 'attachment';
    response.setHeader('Content-Type', row.content_type);
    response.setHeader('Content-Length', row.size_bytes);
    response.setHeader('Content-Disposition', `${disposition}; filename="${row.id}"`);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'private, no-store');
    stream.on('error', () => response.destroy());
    stream.pipe(response);
  }
}