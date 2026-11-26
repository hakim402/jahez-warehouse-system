import { Module } from '@nestjs/common';
import { PlatformModule } from '../../platform/platform.module';
import { ReceivingModule } from '../receiving/receiving.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [PlatformModule, TenancyModule, ReceivingModule],
  controllers: [SyncController],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}