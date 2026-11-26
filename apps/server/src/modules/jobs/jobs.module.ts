import { Module } from '@nestjs/common';
import { PlatformModule } from '../../platform/platform.module';
import { JobsService } from './jobs.service';

@Module({
  imports: [PlatformModule],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
