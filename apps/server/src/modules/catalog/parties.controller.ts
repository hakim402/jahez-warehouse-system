import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../tenancy/auth.guard';
import { AuthenticatedRequest, isOfficeRole } from '../tenancy/types';
import { CatalogService } from './catalog.service';

@Controller('parties')
@UseGuards(AuthGuard)
export class PartiesController {
  constructor(private readonly catalog: CatalogService) {}

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() body: Record<string, unknown>) {
    this.assertOffice(request);
    return this.catalog.createParty(request.user!, body ?? {});
  }

  @Get()
  list(@Req() request: AuthenticatedRequest, @Query('type') type?: string) {
    this.assertOffice(request);
    return this.catalog.listParties(request.user!, type);
  }

  @Get(':id')
  get(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    this.assertOffice(request);
    return this.catalog.getParty(request.user!, id);
  }

  @Patch(':id')
  update(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    this.assertOffice(request);
    return this.catalog.updateParty(request.user!, id, body ?? {});
  }

  private assertOffice(request: AuthenticatedRequest) {
    if (!isOfficeRole(request.user?.role)) {
      throw new ForbiddenException('Catalog access denied');
    }
  }
}