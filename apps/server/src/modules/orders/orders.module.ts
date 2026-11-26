import { Module } from '@nestjs/common';
import { PlatformModule } from '../../platform/platform.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [PlatformModule, TenancyModule, RealtimeModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
