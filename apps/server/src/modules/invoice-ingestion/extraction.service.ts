import { Inject, Injectable } from '@nestjs/common';
import { SERVER_CONFIG, ServerConfig } from '../../platform/server-config';
import { ImportKind, InvoiceDraft } from './ingestion.types';
import { getProvider } from './ingestion.providers';
import { parseXlsx } from './ingestion.xlsx';

const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@Injectable()
export class ExtractionService {
  constructor(@Inject(SERVER_CONFIG) private readonly config: ServerConfig) {}

  /**
   * Routes an uploaded invoice to the right extractor: spreadsheets are parsed directly (no network),
   * everything else (photos, scans, PDFs) goes to the configured regional vision provider.
   */
  async extract(buffer: Buffer, contentType: string, kind: ImportKind): Promise<{ draft: InvoiceDraft; provider: string }> {
    if (contentType === XLSX_CONTENT_TYPE) {
      return { draft: await parseXlsx(buffer), provider: 'xlsx' };
    }
    const provider = getProvider(this.config.invoiceAi);
    return { draft: await provider.extract({ buffer, contentType, kind }), provider: provider.name };
  }
}
