import { Module } from '@nestjs/common';
import { PlatformModule } from '../../platform/platform.module';
import { AuthGuard } from './auth.guard';
import { SessionAuthService } from './session-auth.service';
import { TenancyService } from './tenancy.service';
import { WarehouseAccessGuard } from './warehouse-access.guard';
import { WarehousesController } from './warehouses.controller';

@Module({
  imports: [PlatformModule],
  controllers: [WarehousesController],
  providers: [TenancyService, SessionAuthService, AuthGuard, WarehouseAccessGuard],
  exports: [TenancyService, SessionAuthService, AuthGuard, WarehouseAccessGuard],
})
export class TenancyModule {}
