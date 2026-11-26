import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { recordAudit } from '../../platform/audit';
import { DatabaseService } from '../../platform/database.service';
import { RealtimeService } from '../realtime/realtime.service';
import { recordWarehouseChange, WarehouseChange } from '../sync/warehouse-change';
import { AuthenticatedUser, isOfficeRole, isUuid } from '../tenancy/types';

interface FindingRow {
  id: string;
  receipt_id: string;
  receipt_line_id: string | null;
  order_line_id: string | null;
  type: string;
  expected: string | null;
  actual: string | null;
  status: 'open' | 'resolved';
  resolved_by: string | null;
  note: string | null;
  warehouse_id: string;
}

@Injectable()
export class FindingsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly realtime: RealtimeService,
  ) {}

  async list(user: AuthenticatedUser, status: unknown) {
    if (!isOfficeRole(user.role)) throw new ForbiddenException('Finding access denied');
    if (status !== undefined && status !== 'open' && status !== 'resolved') {
      throw new BadRequestException('Status must be open or resolved');
    }
    return this.database.withTenant(user.tenantId, user.id, async (client) => {
      const result = await client.query<FindingRow>(
        `SELECT f.*, r.warehouse_id FROM findings f JOIN receipts r ON r.id = f.receipt_id
         WHERE ($1::text IS NULL OR f.status = $1) ORDER BY f.created_at DESC, f.id`,
        [status ?? null],
      );
      return result.rows.map(toFinding);
    });
  }

  async resolve(user: AuthenticatedUser, id: string, input: Record<string, unknown>) {
    if (!isOfficeRole(user.role)) throw new ForbiddenException('Finding resolution denied');
    if (!isUuid(id)) throw new BadRequestException('Malformed finding id');
    if (input.status !== 'resolved') throw new BadRequestException('Status must be resolved');
    if (input.note !== undefined && typeof input.note !== 'string') {
      throw new BadRequestException('Note must be text');
    }
    const note = typeof input.note === 'string' ? input.note.trim() || null : null;

    const { finding, change } = await this.database.withTenant(user.tenantId, user.id, async (client) => {
      const result = await client.query<FindingRow>(
        `SELECT f.*, r.warehouse_id FROM findings f JOIN receipts r ON r.id = f.receipt_id
         WHERE f.id = $1 FOR UPDATE OF f`,
        [id],
      );
      const before = result.rows[0];
      if (!before) throw new NotFoundException('Finding not found');
      if (before.status === 'resolved') return { finding: toFinding(before), change: null };

      const updated = await client.query<Omit<FindingRow, 'warehouse_id'>>(
        `UPDATE findings SET status = 'resolved', resolved_by = $2, note = COALESCE($3, note), version = version + 1
         WHERE id = $1 RETURNING *`,
        [id, user.id, note],
      );
      if (!updated.rows[0]) throw new ForbiddenException('Finding resolution denied');
      const after = toFinding({ ...updated.rows[0], warehouse_id: before.warehouse_id });
      await recordAudit(client, {
        tenantId: user.tenantId, userId: user.id, warehouseId: before.warehouse_id,
        entity: 'finding', entityId: before.id, action: 'finding.resolve', before: toFinding(before), after,
      });
      const change: WarehouseChange = {
        tenantId: user.tenantId, warehouseId: before.warehouse_id, entity: 'finding', entityId: before.id,
        action: 'finding.resolved',
        payload: { id: before.id, receiptId: before.receipt_id, warehouseId: before.warehouse_id, status: 'resolved' },
      };
      await recordWarehouseChange(client, change);
      return { finding: after, change };
    });
    if (change) this.realtime.publish(change);
    return finding;
  }
}

function toFinding(row: FindingRow) {
  return {
    id: row.id,
    receiptId: row.receipt_id,
    warehouseId: row.warehouse_id,
    receiptLineId: row.receipt_line_id,
    orderLineId: row.order_line_id,
    type: row.type,
    expected: row.expected === null ? null : Number(row.expected),
    actual: row.actual === null ? null : Number(row.actual),
    status: row.status,
    resolvedBy: row.resolved_by,
    note: row.note,
  };
}
