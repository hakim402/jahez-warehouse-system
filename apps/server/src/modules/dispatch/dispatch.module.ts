import { Module } from '@nestjs/common';
import { PlatformModule } from '../../platform/platform.module';
import { InventoryModule } from '../inventory/inventory.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { DispatchController } from './dispatch.controller';
import { DispatchService } from './dispatch.service';

@Module({
  imports: [PlatformModule, TenancyModule, InventoryModule, RealtimeModule],
  controllers: [DispatchController],
  providers: [DispatchService],
  exports: [DispatchService],
})
export class DispatchModule {}