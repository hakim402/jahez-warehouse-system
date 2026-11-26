import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Readable } from 'node:stream';
import { DatabaseService } from '../../platform/database.service';
import { recordAudit } from '../../platform/audit';
import { StorageService } from '../../platform/storage.service';
import { JobsService } from '../jobs/jobs.service';
import { TenancyService } from '../tenancy/tenancy.service';
import { AuthenticatedUser, isOfficeRole, isUuid } from '../tenancy/types';
import { parseFilters } from './reports/filters';
import { isReportKind, REPORTS, ReportKind } from './reports/registry';

const QUEUE = 'export.excel';
const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@Injectable()
export class ExportsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly storage: StorageService,
    private readonly tenancy: TenancyService,
    private readonly jobs: JobsService,
  ) {}

  async createExport(user: AuthenticatedUser, input: Record<string, unknown>) {
    this.requireOffice(user);
    const kind = input.kind;
    if (!isReportKind(kind)) throw new BadRequestException('Unknown report kind');
    const definition = REPORTS[kind as ReportKind];
    const warehouseId = requireUuid(input.warehouseId, 'Warehouse id');
    const filters = parseFilters(input.filters);
    if (definition.requiresOrder && !filters.orderId) {
      throw new BadRequestException(`${definition.label} requires filters.orderId`);
    }
    const membership = await this.tenancy.findWarehouseAccess(user.id, warehouseId, user.tenantId);
    if (!membership) throw new ForbiddenException('Warehouse access denied');

    const job = await this.database.withTenant(user.tenantId, user.id, async (client) => {
      const inserted = await client.query(
        `INSERT INTO export_jobs (tenant_id, warehouse_id, kind, filters, requested_by, created_by)
         VALUES ($1, $2, $3, $4, $5, $5) RETURNING *`,
        [user.tenantId, warehouseId, kind, JSON.stringify(filters), user.id],
      );
      const row = toExport(inserted.rows[0]);
      await recordAudit(client, {
        tenantId: user.tenantId, userId: user.id, warehouseId, entity: 'export',
        entityId: row.id, action: 'export.created', after: { kind, filters },
      });
      return row;
    });

    // Enqueue after commit so the worker only ever sees a persisted job row.
    try {
      await this.jobs.send(QUEUE, { exportJobId: job.id, tenantId: user.tenantId, requestedBy: user.id }, job.id);
    } catch (error) {
      await this.markUnsendable(user, job.id);
      throw new ConflictException('Export could not be queued');
    }
    return job;
  }

  async listExports(user: AuthenticatedUser, warehouseId: string) {
    this.requireOffice(user);
    const warehouse = requireUuid(warehouseId, 'Warehouse id');
    const membership = await this.tenancy.findWarehouseAccess(user.id, warehouse, user.tenantId);
    if (!membership) throw new ForbiddenException('Warehouse access denied');
    return this.database.withTenant(user.tenantId, user.id, async (client) => {
      const result = await client.query(
        `SELECT * FROM export_jobs WHERE warehouse_id = $1
         ORDER BY created_at DESC, id DESC LIMIT 100`,
        [warehouse],
      );
      return { warehouseId: warehouse, exports: result.rows.map(toExport) };
    });
  }

  async getExport(user: AuthenticatedUser, id: string) {
    this.requireOffice(user);
    const exportId = requireUuid(id, 'Export id');
    return this.database.withTenant(user.tenantId, user.id, (client) => this.loadExport(client, exportId));
  }

  /** Streams the generated workbook. Office-only and RLS-scoped; 409 until the job completes. */
  async downloadExport(user: AuthenticatedUser, id: string): Promise<{ stream: Readable; fileName: string; contentType: string }> {
    this.requireOffice(user);
    const exportId = requireUuid(id, 'Export id');
    const job = await this.database.withTenant(user.tenantId, user.id, (client) => this.loadExport(client, exportId));
    if (job.status !== 'completed' || !job.storageProvider || !job.objectKey) {
      throw new ConflictException(job.status === 'failed' ? 'Export failed' : 'Export is not ready yet');
    }
    const stream = await this.storage.providerFor(job.storageProvider).get(job.objectKey);
    return { stream, fileName: job.fileName ?? `${exportId}.xlsx`, contentType: XLSX_CONTENT_TYPE };
  }

  private async loadExport(client: import('pg').PoolClient, exportId: string) {
    const result = await client.query('SELECT * FROM export_jobs WHERE id = $1', [exportId]);
    if (result.rowCount === 0) throw new NotFoundException('Export not found');
    return toExport(result.rows[0]);
  }

  private async markUnsendable(user: AuthenticatedUser, exportId: string) {
    await this.database
      .withTenant(user.tenantId, user.id, (client) =>
        client.query("UPDATE export_jobs SET status = 'failed', error = 'Queue unavailable' WHERE id = $1", [exportId]),
      )
      .catch(() => undefined);
  }

  private requireOffice(user: AuthenticatedUser) {
    if (!isOfficeRole(user.role)) throw new ForbiddenException('Exports are restricted to the owner and trader');
  }
}

function toExport(row: any) {
  return {
    id: row.id,
    warehouseId: row.warehouse_id,
    kind: row.kind,
    filters: row.filters,
    status: row.status,
    fileName: row.file_name ?? null,
    sizeBytes: row.size_bytes === null || row.size_bytes === undefined ? null : Number(row.size_bytes),
    storageProvider: row.storage_provider ?? null,
    objectKey: row.object_key ?? null,
    error: row.error ?? null,
    completedAt: row.completed_at instanceof Date ? row.completed_at.toISOString() : row.completed_at ?? null,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  };
}

function requireUuid(value: unknown, label: string): string {
  if (!isUuid(value)) throw new BadRequestException(`${label} is required and must be a UUID`);
  return value.toLowerCase();
}
