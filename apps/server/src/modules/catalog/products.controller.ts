import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../tenancy/auth.guard';
import { AuthenticatedRequest, isOfficeRole } from '../tenancy/types';
import { CatalogService } from './catalog.service';

@Controller('products')
@UseGuards(AuthGuard)
export class ProductsController {
  constructor(private readonly catalog: CatalogService) {}

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() body: Record<string, unknown>) {
    this.assertOffice(request);
    return this.catalog.createProduct(request.user!, body ?? {});
  }

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    this.assertOffice(request);
    return this.catalog.listProducts(request.user!);
  }

  @Get(':id')
  get(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    this.assertOffice(request);
    return this.catalog.getProduct(request.user!, id);
  }

  @Patch(':id')
  update(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    this.assertOffice(request);
    return this.catalog.updateProduct(request.user!, id, body ?? {});
  }

  private assertOffice(request: AuthenticatedRequest) {
    if (!isOfficeRole(request.user?.role)) {
      throw new ForbiddenException('Catalog access denied');
    }
  }
}