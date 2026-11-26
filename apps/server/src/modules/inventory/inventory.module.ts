import { Module } from '@nestjs/common';
import { PlatformModule } from '../../platform/platform.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { AdjustmentsService } from './adjustments.service';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

@Module({
  imports: [PlatformModule, TenancyModule, RealtimeModule],
  controllers: [InventoryController],
  providers: [InventoryService, AdjustmentsService],
  exports: [InventoryService],
})
export class InventoryModule {}