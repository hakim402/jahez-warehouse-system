import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../../platform/database.service';
import { StorageService } from '../../platform/storage.service';
import { JobsService } from '../jobs/jobs.service';
import { buildWorkbook } from './reports/excel';
import { REPORTS, ReportKind } from './reports/registry';

const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const QUEUE = 'export.excel';

interface ExportJobData {
  exportJobId: string;
  tenantId: string;
  requestedBy: string;
}

/**
 * Executes queued Excel exports on the worker. The handler runs inside the requesting user's tenant
 * context, so RLS and office-only policies scope every report query exactly as an interactive read
 * would. Generation is idempotent: a completed job is never reprocessed and the object key is
 * stable, so a retry overwrites the same file rather than creating a duplicate.
 */
@Injectable()
export class ExportJobRunner implements OnModuleInit {
  private readonly logger = new Logger(ExportJobRunner.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly storage: StorageService,
    private readonly jobs: JobsService,
  ) {}

  onModuleInit(): void {
    this.jobs.register(QUEUE, (data) => this.run(data as unknown as ExportJobData));
  }

  private async run(data: ExportJobData): Promise<void> {
    const { exportJobId, tenantId, requestedBy } = data;
    try {
      await this.database.withTenant(tenantId, requestedBy, async (client) => {
        const existing = await client.query(
          'SELECT id, kind, warehouse_id, filters, status FROM export_jobs WHERE id = $1',
          [exportJobId],
        );
        if (existing.rowCount === 0) return;
        const job = existing.rows[0];
        // Terminal guard: a retried or duplicated delivery of a finished job does nothing.
        if (job.status === 'completed') return;

        await client.query("UPDATE export_jobs SET status = 'processing' WHERE id = $1", [exportJobId]);

        const definition = REPORTS[job.kind as ReportKind];
        const sheet = await definition.build(client, job.warehouse_id, job.filters ?? {});
        const buffer = await buildWorkbook(sheet);

        const provider = this.storage.writeProvider;
        const objectKey = `exports/${tenantId}/${job.warehouse_id}/${exportJobId}.xlsx`;
        await provider.put(objectKey, buffer, XLSX_CONTENT_TYPE);

        const fileName = `${definition.label.toLowerCase().replace(/\s+/g, '-')}-${exportJobId.slice(0, 8)}.xlsx`;
        await client.query(
          `UPDATE export_jobs
             SET status = 'completed', storage_provider = $1, object_key = $2, file_name = $3,
                 size_bytes = $4, error = NULL, completed_at = now()
           WHERE id = $5`,
          [provider.driver, objectKey, fileName, buffer.length, exportJobId],
        );
      });
    } catch (error) {
      // Record the failure in a separate transaction so it survives the rollback of the failed run.
      const message = error instanceof Error ? error.message.slice(0, 200) : 'Export failed';
      await this.database
        .withTenant(tenantId, requestedBy, (client) =>
          client.query(
            "UPDATE export_jobs SET status = 'failed', error = $1 WHERE id = $2 AND status <> 'completed'",
            [message, exportJobId],
          ),
        )
        .catch(() => this.logger.warn('Could not record export failure'));
      // Rethrow so pg-boss applies its retry/backoff policy.
      throw error;
    }
  }
}
