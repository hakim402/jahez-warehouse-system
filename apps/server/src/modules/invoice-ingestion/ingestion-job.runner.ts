import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Readable } from 'node:stream';
import { DatabaseService } from '../../platform/database.service';
import { StorageService } from '../../platform/storage.service';
import { JobsService } from '../jobs/jobs.service';
import { ExtractionService } from './extraction.service';
import { ImportKind } from './ingestion.types';

const QUEUE = 'invoice.extract';

interface IngestJobData {
  importId: string;
  tenantId: string;
  requestedBy: string;
}

/**
 * Runs queued invoice extraction on the worker inside the requesting user's tenant context, so RLS and
 * office-only policies scope every read. Retry-safe: a drafted or committed import is never reprocessed,
 * and failures are recorded in a separate transaction so they survive the rollback.
 */
@Injectable()
export class IngestionJobRunner implements OnModuleInit {
  private readonly logger = new Logger(IngestionJobRunner.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly storage: StorageService,
    private readonly extraction: ExtractionService,
    private readonly jobs: JobsService,
  ) {}

  onModuleInit(): void {
    this.jobs.register(QUEUE, (data) => this.run(data as unknown as IngestJobData));
  }

  private async run(data: IngestJobData): Promise<void> {
    const { importId, tenantId, requestedBy } = data;
    try {
      await this.database.withTenant(tenantId, requestedBy, async (client) => {
        const existing = await client.query(
          'SELECT id, kind, status, source_file_id FROM invoice_imports WHERE id = $1',
          [importId],
        );
        if (existing.rowCount === 0) return;
        const row = existing.rows[0];
        if (row.status === 'draft' || row.status === 'committed') return;

        await client.query("UPDATE invoice_imports SET status = 'processing' WHERE id = $1", [importId]);

        const file = await client.query(
          'SELECT provider, object_key, content_type FROM files WHERE id = $1',
          [row.source_file_id],
        );
        if (file.rowCount === 0) throw new Error('Source file is missing');
        const buffer = await toBuffer(await this.storage.providerFor(file.rows[0].provider).get(file.rows[0].object_key));
        const { draft, provider } = await this.extraction.extract(buffer, file.rows[0].content_type, row.kind as ImportKind);

        await client.query(
          "UPDATE invoice_imports SET status = 'draft', provider = $1, draft = $2, error = NULL WHERE id = $3",
          [provider, JSON.stringify(draft), importId],
        );
      });
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 200) : 'Extraction failed';
      await this.database
        .withTenant(tenantId, requestedBy, (client) =>
          client.query(
            "UPDATE invoice_imports SET status = 'failed', error = $1 WHERE id = $2 AND status NOT IN ('draft', 'committed')",
            [message, importId],
          ),
        )
        .catch(() => this.logger.warn('Could not record ingestion failure'));
      throw error;
    }
  }
}

async function toBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}
