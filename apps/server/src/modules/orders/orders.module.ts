import { Module } from '@nestjs/common';
import { PlatformModule } from '../../platform/platform.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [PlatformModule, TenancyModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}