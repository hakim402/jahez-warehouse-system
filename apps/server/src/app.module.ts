import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { FilesModule } from './modules/files/files.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { OrdersModule } from './modules/orders/orders.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { ReceivingModule } from './modules/receiving/receiving.module';
import { SyncModule } from './modules/sync/sync.module';
import { TenancyModule } from './modules/tenancy/tenancy.module';
import { PlatformModule } from './platform/platform.module';

@Module({
  imports: [PlatformModule, TenancyModule, AuthModule, CatalogModule, FilesModule, InventoryModule, OrdersModule, ReceivingModule, SyncModule, RealtimeModule],
  controllers: [HealthController],
})
export class AppModule {}
