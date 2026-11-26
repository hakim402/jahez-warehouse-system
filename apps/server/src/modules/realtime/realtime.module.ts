import { Module } from '@nestjs/common';
import { PlatformModule } from '../../platform/platform.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { RealtimeService } from './realtime.service';

@Module({
  imports: [TenancyModule, PlatformModule],
  providers: [RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeModule {}
