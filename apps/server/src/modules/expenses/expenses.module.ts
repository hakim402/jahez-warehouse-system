import { Module } from '@nestjs/common';
import { PlatformModule } from '../../platform/platform.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';

@Module({
  imports: [PlatformModule, TenancyModule, RealtimeModule],
  controllers: [ExpensesController],
  providers: [ExpensesService],
  exports: [ExpensesService],
})
export class ExpensesModule {}