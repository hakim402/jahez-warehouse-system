import { Module } from '@nestjs/common';
import { PlatformModule } from '../../platform/platform.module';
import { JobsModule } from '../jobs/jobs.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { ExportJobRunner } from './export-job.runner';
import { ExportsController } from './exports.controller';
import { ExportsService } from './exports.service';

@Module({
  imports: [PlatformModule, TenancyModule, JobsModule],
  controllers: [ExportsController],
  providers: [ExportsService, ExportJobRunner],
  exports: [ExportsService],
})
export class ExportsModule {}
