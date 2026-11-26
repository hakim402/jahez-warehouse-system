import { Module } from '@nestjs/common';
import { PlatformModule } from '../../platform/platform.module';
import { InventoryModule } from '../inventory/inventory.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { FindingsController } from './findings.controller';
import { FindingsService } from './findings.service';
import { ReceivingController } from './receiving.controller';
import { ReceivingService } from './receiving.service';

@Module({
  imports: [PlatformModule, TenancyModule, InventoryModule, RealtimeModule],
  controllers: [ReceivingController, FindingsController],
  providers: [ReceivingService, FindingsService],
  exports: [ReceivingService],
})
export class ReceivingModule {}
