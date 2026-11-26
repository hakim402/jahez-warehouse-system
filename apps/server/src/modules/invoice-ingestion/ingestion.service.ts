import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../platform/database.service';
import { recordAudit } from '../../platform/audit';
import { ExpensesService } from '../expenses/expenses.service';
import { JobsService } from '../jobs/jobs.service';
import { OrdersService } from '../orders/orders.service';
import { TenancyService } from '../tenancy/tenancy.service';
import { AuthenticatedUser, isOfficeRole, isUuid } from '../tenancy/types';
import {
  DraftLine, ImportKind, InvoiceDraft, emptyDraft, field, unreviewedLowConfidencePaths,
} from './ingestion.types';

const QUEUE = 'invoice.extract';
const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const PURPOSE_BY_KIND: Record<ImportKind, string> = { purchase: 'invoice_source', expense: 'expense_invoice' };
const HEADER_FIELDS = Object.keys(emptyDraft().header) as (keyof InvoiceDraft['header'])[];
const LINE_FIELDS: (keyof Omit<DraftLine, 'productId'>)[] = [
  'description', 'brand', 'size', 'cartons', 'qtyPerCarton', 'unitPrice', 'amount', 'cbm',
];

@Injectable()
export class IngestionService {
  constructor(
    private readonly database: DatabaseService,
    private readonly tenancy: TenancyService,
    private readonly jobs: JobsService,
    private readonly orders: OrdersService,
    private readonly expenses: ExpensesService,
  ) {}

  async createImport(user: AuthenticatedUser, input: Record<string, unknown>, kind: ImportKind) {
    this.requireOffice(user);
    const warehouseId = requireUuid(input.warehouseId, 'Warehouse id');
    const fileId = requireUuid(input.fileId, 'File id');
    const membership = await this.tenancy.findWarehouseAccess(user.id, warehouseId, user.tenantId);
    if (!membership) throw new ForbiddenException('Warehouse access denied');

    const row = await this.database.withTenant(user.tenantId, user.id, async (client) => {
      const file = await client.query(
        'SELECT id, purpose, warehouse_id FROM files WHERE id = $1',
        [fileId],
      );
      if (file.rowCount === 0) throw new NotFoundException('Source file not found');
      if (file.rows[0].warehouse_id !== warehouseId) throw new BadRequestException('Source file is in a different warehouse');
      if (file.rows[0].purpose !== PURPOSE_BY_KIND[kind]) {
        throw new BadRequestException(`A ${kind} import requires a ${PURPOSE_BY_KIND[kind]} file`);
      }
      const inserted = await client.query(
        `INSERT INTO invoice_imports (tenant_id, warehouse_id, kind, source_file_id, requested_by, created_by)
         VALUES ($1, $2, $3, $4, $5, $5) RETURNING *`,
        [user.tenantId, warehouseId, kind, fileId, user.id],
      );
      const record = toImport(inserted.rows[0]);
      await recordAudit(client, {
        tenantId: user.tenantId, userId: user.id, warehouseId, entity: 'import',
        entityId: record.id, action: 'invoice.import.created', after: { kind, fileId },
      });
      return record;
    });

    try {
      await this.jobs.send(QUEUE, { importId: row.id, tenantId: user.tenantId, requestedBy: user.id }, row.id);
    } catch {
      await this.markUnsendable(user, row.id);
      throw new ConflictException('Import could not be queued');
    }
    return row;
  }

  async listImports(user: AuthenticatedUser, warehouseId: string) {
    this.requireOffice(user);
    const warehouse = requireUuid(warehouseId, 'Warehouse id');
    const membership = await this.tenancy.findWarehouseAccess(user.id, warehouse, user.tenantId);
    if (!membership) throw new ForbiddenException('Warehouse access denied');
    return this.database.withTenant(user.tenantId, user.id, async (client) => {
      const result = await client.query(
        `SELECT * FROM invoice_imports WHERE warehouse_id = $1 ORDER BY created_at DESC, id DESC LIMIT 100`,
        [warehouse],
      );
      return { warehouseId: warehouse, imports: result.rows.map(toImport) };
    });
  }

  async getImport(user: AuthenticatedUser, id: string) {
    this.requireOffice(user);
    const importId = requireUuid(id, 'Import id');
    return this.database.withTenant(user.tenantId, user.id, (client) => this.loadImport(client, importId));
  }

  async patchImport(user: AuthenticatedUser, id: string, input: Record<string, unknown>) {
    this.requireOffice(user);
    const importId = requireUuid(id, 'Import id');
    return this.database.withTenant(user.tenantId, user.id, async (client) => {
      const existing = await client.query('SELECT * FROM invoice_imports WHERE id = $1 FOR UPDATE', [importId]);
      if (existing.rowCount === 0) throw new NotFoundException('Import not found');
      if (existing.rows[0].status !== 'draft') throw new BadRequestException('Only a drafted import can be reviewed');
      const draft = mergeDraft(existing.rows[0].draft as InvoiceDraft, input);
      await client.query('UPDATE invoice_imports SET draft = $1 WHERE id = $2', [JSON.stringify(draft), importId]);
      await recordAudit(client, {
        tenantId: user.tenantId, userId: user.id, warehouseId: existing.rows[0].warehouse_id,
        entity: 'import', entityId: importId, action: 'invoice.import.reviewed',
      });
      return toImport({ ...existing.rows[0], draft });
    });
  }

  async commitImport(user: AuthenticatedUser, id: string) {
    this.requireOffice(user);
    const importId = requireUuid(id, 'Import id');

    return this.database.withTenant(user.tenantId, user.id, async () => {
      // Lock review and commit together with the delegated order or expense transaction.
      const prepared = await this.database.withTenant(user.tenantId, user.id, async (client) => {
        const existing = await client.query('SELECT * FROM invoice_imports WHERE id = $1 FOR UPDATE', [importId]);
        if (existing.rowCount === 0) throw new NotFoundException('Import not found');
        const row = existing.rows[0];
        if (row.status === 'committed') return { already: true as const, entityId: row.committed_entity_id, kind: row.kind };
        if (row.status !== 'draft') throw new BadRequestException('Import is not ready to commit');
        const draft = row.draft as InvoiceDraft;
        const unreviewed = unreviewedLowConfidencePaths(draft);
        if (unreviewed.length > 0) {
          throw new ConflictException({ message: 'Resolve uncertain fields before committing', fields: unreviewed });
        }
        const file = await client.query('SELECT content_type FROM files WHERE id = $1', [row.source_file_id]);
        const contentType = file.rows[0]?.content_type ?? '';
        return { already: false as const, importId, kind: row.kind as ImportKind, warehouseId: row.warehouse_id, sourceFileId: row.source_file_id, draft, contentType };
      });

      if (prepared.already) {
        return { status: 'committed', [prepared.kind === 'expense' ? 'expenseId' : 'orderId']: prepared.entityId };
      }

      // Nested service calls reuse the identity-scoped transaction.
      let entityId: string;
      if (prepared.kind === 'purchase') {
        entityId = await this.commitPurchase(user, prepared as any);
      } else {
        entityId = await this.commitExpense(user, prepared as any);
      }

      // 3. Mark the import committed.
      await this.database.withTenant(user.tenantId, user.id, async (client) => {
        await client.query(
          "UPDATE invoice_imports SET status = 'committed', committed_entity_id = $1 WHERE id = $2",
          [entityId, importId],
        );
        await recordAudit(client, {
          tenantId: user.tenantId, userId: user.id, warehouseId: (prepared as any).warehouseId,
          entity: 'import', entityId: importId, action: 'invoice.import.committed',
          after: { kind: prepared.kind, entityId },
        });
      });
      return { status: 'committed', [prepared.kind === 'expense' ? 'expenseId' : 'orderId']: entityId };
    });
  }

  private async commitPurchase(user: AuthenticatedUser, p: { warehouseId: string; sourceFileId: string; draft: InvoiceDraft; contentType: string }): Promise<string> {
    const supplierId = p.draft.review?.supplierId;
    const customerId = p.draft.review?.customerId;
    if (!isUuid(supplierId) || !isUuid(customerId)) {
      throw new BadRequestException('Resolve supplierId and customerId before committing a purchase');
    }
    const lines = p.draft.lines.map((line) => {
      if (!isUuid(line.productId)) throw new BadRequestException('Resolve a productId for every line before committing');
      return {
        productId: line.productId, brand: line.brand.value, size: line.size.value,
        cartons: line.cartons.value, qtyPerCarton: line.qtyPerCarton.value,
        unitPrice: line.unitPrice.value, amount: line.amount.value, cbm: line.cbm.value,
      };
    });
    const order = await this.orders.createDraft(user, {
      warehouseId: p.warehouseId, supplierId, customerId,
      orderDate: p.draft.header.orderDate.value, currency: p.draft.header.currency.value,
      deposit: p.draft.header.deposit.value, totalAmount: p.draft.header.totalAmount.value,
      lines, source: p.contentType === XLSX_CONTENT_TYPE ? 'excel' : 'photo',
      sourceFileUrl: `/api/v1/files/${p.sourceFileId}/content`,
    });
    return (order as { id: string }).id;
  }

  private async commitExpense(user: AuthenticatedUser, p: { importId: string; warehouseId: string; sourceFileId: string; draft: InvoiceDraft }): Promise<string> {
    const categoryId = p.draft.review?.categoryId;
    if (!isUuid(categoryId)) throw new BadRequestException('Resolve categoryId before committing an expense');
    const amount = p.draft.header.amount.value;
    const expenseDate = p.draft.header.expenseDate.value;
    if (amount === null || !expenseDate) throw new BadRequestException('Amount and expense date are required to commit');
    const expense = await this.expenses.recordExpense(user, {
      clientOperationId: p.importId, warehouseId: p.warehouseId, amount,
      currency: p.draft.header.currency.value ?? 'USD', expenseDate, categoryId,
      customerId: p.draft.review?.customerId ?? undefined, invoiceFileId: p.sourceFileId,
    });
    return (expense as { id: string }).id;
  }

  private async loadImport(client: import('pg').PoolClient, importId: string) {
    const result = await client.query('SELECT * FROM invoice_imports WHERE id = $1', [importId]);
    if (result.rowCount === 0) throw new NotFoundException('Import not found');
    return toImport(result.rows[0]);
  }

  private async markUnsendable(user: AuthenticatedUser, importId: string) {
    await this.database
      .withTenant(user.tenantId, user.id, (client) =>
        client.query("UPDATE invoice_imports SET status = 'failed', error = 'Queue unavailable' WHERE id = $1", [importId]),
      )
      .catch(() => undefined);
  }

  private requireOffice(user: AuthenticatedUser) {
    if (!isOfficeRole(user.role)) throw new ForbiddenException('Invoice ingestion is restricted to the owner and trader');
  }
}

function toImport(row: any) {
  const draft = (row.draft ?? {}) as InvoiceDraft;
  return {
    id: row.id,
    warehouseId: row.warehouse_id,
    kind: row.kind,
    status: row.status,
    provider: row.provider ?? null,
    sourceFileId: row.source_file_id,
    committedEntityId: row.committed_entity_id ?? null,
    error: row.error ?? null,
    draft,
    unreviewedFields: row.status === 'draft' ? unreviewedLowConfidencePaths(draft) : [],
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  };
}

/** Overlays trader edits onto the stored draft; any field the trader sets becomes fully confident. */
function mergeDraft(base: InvoiceDraft, input: Record<string, unknown>): InvoiceDraft {
  const draft: InvoiceDraft = base && base.header ? base : emptyDraft();
  const header = input.header;
  if (header && typeof header === 'object') {
    for (const [key, value] of Object.entries(header as Record<string, unknown>)) {
      if ((HEADER_FIELDS as string[]).includes(key)) {
        (draft.header as any)[key] = field(value as never, 1, 'trader');
      }
    }
  }
  if (Array.isArray(input.lines)) {
    draft.lines = (input.lines as Record<string, unknown>[]).map((raw, index) => {
      const existing = draft.lines[index] ?? blankLine();
      const line: DraftLine = { ...existing };
      for (const key of LINE_FIELDS) {
        if (raw[key] !== undefined) (line[key] as any) = field(raw[key] as never, 1, 'trader');
      }
      if (raw.productId !== undefined) line.productId = isUuid(raw.productId) ? raw.productId : null;
      return line;
    });
  }
  const review = input.review;
  if (review && typeof review === 'object') {
    const r = review as Record<string, unknown>;
    draft.review = draft.review ?? {};
    if (r.supplierId !== undefined) draft.review.supplierId = isUuid(r.supplierId) ? r.supplierId : null;
    if (r.customerId !== undefined) draft.review.customerId = isUuid(r.customerId) ? r.customerId : null;
    if (r.categoryId !== undefined) draft.review.categoryId = isUuid(r.categoryId) ? r.categoryId : null;
    if (Array.isArray(r.reviewedFields)) {
      const set = new Set([...(draft.review.reviewedFields ?? []), ...(r.reviewedFields as string[])]);
      draft.review.reviewedFields = [...set];
    }
  }
  return draft;
}

function blankLine(): DraftLine {
  return {
    description: field<string>(null, 0), brand: field<string>(null, 0), size: field<string>(null, 0),
    cartons: field<number>(null, 0), qtyPerCarton: field<number>(null, 0), unitPrice: field<number>(null, 0),
    amount: field<number>(null, 0), cbm: field<number>(null, 0), productId: null,
  };
}

function requireUuid(value: unknown, label: string): string {
  if (!isUuid(value)) throw new BadRequestException(`${label} is required and must be a UUID`);
  return value.toLowerCase();
}
