import { Module } from '@nestjs/common';
import { TenancyModule } from '../tenancy/tenancy.module';
import { RealtimeService } from './realtime.service';

@Module({
  imports: [TenancyModule],
  providers: [RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeModule {}
