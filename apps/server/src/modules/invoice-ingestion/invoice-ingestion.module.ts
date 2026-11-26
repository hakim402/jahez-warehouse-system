import { Module } from '@nestjs/common';
import { PlatformModule } from '../../platform/platform.module';
import { ExpensesModule } from '../expenses/expenses.module';
import { JobsModule } from '../jobs/jobs.module';
import { OrdersModule } from '../orders/orders.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { ExtractionService } from './extraction.service';
import { IngestionJobRunner } from './ingestion-job.runner';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';

@Module({
  imports: [PlatformModule, TenancyModule, JobsModule, OrdersModule, ExpensesModule],
  controllers: [IngestionController],
  providers: [ExtractionService, IngestionService, IngestionJobRunner],
  exports: [IngestionService],
})
export class InvoiceIngestionModule {}
