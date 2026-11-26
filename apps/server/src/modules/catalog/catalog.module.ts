import { Module } from '@nestjs/common';
import { PlatformModule } from '../../platform/platform.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { CatalogService } from './catalog.service';
import { PartiesController } from './parties.controller';
import { ProductsController } from './products.controller';

@Module({
  imports: [PlatformModule, TenancyModule],
  controllers: [PartiesController, ProductsController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}