import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PoolClient } from 'pg';
import { DatabaseService } from '../../platform/database.service';
import { recordAudit } from '../../platform/audit';
import { InventoryService } from '../inventory/inventory.service';
import { RealtimeService } from '../realtime/realtime.service';
import { recordWarehouseChange, WarehouseChange } from '../sync/warehouse-change';
import { TenancyService } from '../tenancy/tenancy.service';
import { AuthenticatedUser, isUuid } from '../tenancy/types';

const MAX_QUANTITY = 2_147_483_647;

interface DispatchLineInput {
  supplierId: string | null;
  brand: string | null;
  productId: string | null;
  cartons: number;
}

interface LotRow {
  receipt_line_id: string;
  received_cartons: number;
  received_qty: number | null;
  received_cbm: string | null;
  weight_kg: string | null;
  remaining: string;
}

interface Allocation {
  receiptLineId: string;
  cartons: number;
  qty: number | null;
  cbm: number | null;
  weightKg: number | null;
}

@Injectable()
export class DispatchService {
  constructor(
    private readonly database: DatabaseService,
    private readonly tenancy: TenancyService,
    private readonly inventory: InventoryService,
    private readonly realtime: RealtimeService,
  ) {}

  async confirmDispatch(user: AuthenticatedUser, input: Record<string, unknown>) {
    const operationId = requireUuid(input.clientOperationId, 'Client operation id');
    const warehouseId = requireUuid(input.warehouseId, 'Warehouse id');
    const customerId = requireUuid(input.customerId, 'Customer id');
    const destination = optionalText(input.destination);
    const dispatchedAt = optionalTimestamp(input.dispatchedAt);
    const lines = normalizeLines(input.lines);
    const requestHash = createHash('sha256')
      .update(JSON.stringify({ warehouseId, customerId, destination, dispatchedAt: dispatchedAt?.toISOString() ?? null, lines }))
      .digest('hex');

    const membership = await this.tenancy.findWarehouseAccess(user.id, warehouseId, user.tenantId);
    if (!membership) throw new ForbiddenException('Warehouse access denied');

    const { response, change } = await this.database.withTenant(user.tenantId, user.id, async (client) => {
      const claimed = await client.query(
        `INSERT INTO client_operations (tenant_id, operation_id, user_id, warehouse_id, kind, request_hash, created_by)
         VALUES ($1, $2, $3, $4, 'dispatch.confirm', $5, $3)
         ON CONFLICT (tenant_id, operation_id) DO NOTHING
         RETURNING id`,
        [user.tenantId, operationId, user.id, warehouseId, requestHash],
      );
      if (claimed.rowCount === 0) {
        const existing = await client.query<{ response: Record<string, unknown> | null }>(
          `SELECT response FROM client_operations
           WHERE operation_id = $1 AND user_id = $2 AND warehouse_id = $3
             AND kind = 'dispatch.confirm' AND request_hash = $4`,
          [operationId, user.id, warehouseId, requestHash],
        );
        const response = existing.rows[0]?.response;
        if (!response) throw new ConflictException('Client operation is already recorded for a different request');
        return { response, change: null };
      }

      // Serialize stock drawdowns per warehouse so concurrent dispatches can never overdraw the ledger.
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
        `jahez.stock:${user.tenantId}:${warehouseId}`,
      ]);

      const customer = await client.query("SELECT id FROM parties WHERE id = $1 AND type = 'customer'", [customerId]);
      if (customer.rowCount === 0) throw new BadRequestException('Customer not found');

      const lotsByLine: LotRow[][] = [];
      const shortages: Array<{ line: number; available: number; requested: number; shortage: number }> = [];
      for (const [index, line] of lines.entries()) {
        const lots = await this.loadLots(client, warehouseId, customerId, line);
        lotsByLine.push(lots);
        const group = await client.query<{ available: string }>(
          `SELECT COALESCE(SUM(cartons), 0) AS available FROM stock_movements
           WHERE warehouse_id = $1 AND customer_id IS NOT DISTINCT FROM $2
             AND supplier_id IS NOT DISTINCT FROM $3 AND brand IS NOT DISTINCT FROM $4
             AND product_id IS NOT DISTINCT FROM $5`,
          [warehouseId, customerId, line.supplierId, line.brand, line.productId],
        );
        const available = Math.min(Number(group.rows[0].available),
          lots.reduce((sum, lot) => sum + Math.max(0, Number(lot.remaining)), 0));
        if (line.cartons > available) {
          shortages.push({ line: index, available, requested: line.cartons, shortage: line.cartons - available });
        }
      }
      if (shortages.length > 0) {
        throw new ConflictException({ message: 'Insufficient stock for dispatch', shortages });
      }

      const counter = await client.query<{ next_value: string }>(
        `INSERT INTO document_counters (tenant_id, kind, next_value)
         VALUES ($1, 'dispatch', 1)
         ON CONFLICT (tenant_id, kind)
         DO UPDATE SET next_value = document_counters.next_value + 1
         RETURNING next_value`,
        [user.tenantId],
      );
      const dispatchNo = `DSP-${String(counter.rows[0].next_value).padStart(6, '0')}`;

      const inserted = await client.query(
        `INSERT INTO dispatches
           (tenant_id, warehouse_id, dispatch_no, customer_id, destination, dispatched_at, dispatched_by, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'confirmed', $7)
         RETURNING *`,
        [user.tenantId, warehouseId, dispatchNo, customerId, destination, dispatchedAt ?? new Date(), user.id],
      );
      const dispatch = inserted.rows[0];

      for (const [index, line] of lines.entries()) {
        const allocations = allocateFifo(lotsByLine[index], line.cartons);
        const totals = allocationTotals(allocations);
        const savedLine = await client.query<{ id: string }>(
          `INSERT INTO dispatch_lines
             (tenant_id, dispatch_id, supplier_id, brand, product_id, cartons, qty, cbm, weight_kg, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id`,
          [
            user.tenantId, dispatch.id, line.supplierId, line.brand, line.productId,
            line.cartons, totals.qty, totals.cbm, totals.weightKg, user.id,
          ],
        );
        const movementIds = await this.inventory.postDispatchMovements(client, {
          tenantId: user.tenantId,
          userId: user.id,
          warehouseId,
          dispatchId: dispatch.id,
          customerId,
          allocations: allocations.map((allocation) => ({
            receiptLineId: allocation.receiptLineId,
            supplierId: line.supplierId,
            brand: line.brand,
            productId: line.productId,
            cartons: allocation.cartons,
            qty: allocation.qty,
            cbm: allocation.cbm,
          })),
        });
        for (const [allocationIndex, allocation] of allocations.entries()) {
          await client.query(
            `INSERT INTO dispatch_allocations
               (tenant_id, dispatch_line_id, receipt_line_id, stock_movement_id, cartons, created_by)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [user.tenantId, savedLine.rows[0].id, allocation.receiptLineId, movementIds[allocationIndex], allocation.cartons, user.id],
          );
        }
      }

      const response = await this.loadDispatchResponse(client, dispatch.id);
      await client.query(
        'UPDATE client_operations SET response = $1 WHERE operation_id = $2',
        [JSON.stringify(response), operationId],
      );
      await recordAudit(client, {
        tenantId: user.tenantId,
        userId: user.id,
        warehouseId,
        entity: 'dispatch',
        entityId: dispatch.id,
        action: 'dispatch.confirm',
        after: response,
      });
      const change: WarehouseChange = {
        tenantId: user.tenantId, warehouseId, entity: 'dispatch', entityId: dispatch.id,
        action: 'dispatch.confirmed', payload: response,
      };
      await recordWarehouseChange(client, change);
      return { response, change };
    });
    if (change) this.realtime.publish(change);
    return response;
  }

  async listDispatches(user: AuthenticatedUser, warehouseId: string, customerId: unknown) {
    const warehouse = requireUuid(warehouseId, 'Warehouse id');
    const customer = optionalUuid(customerId);
    const membership = await this.tenancy.findWarehouseAccess(user.id, warehouse, user.tenantId);
    if (!membership) throw new ForbiddenException('Warehouse access denied');
    return this.database.withTenant(user.tenantId, user.id, async (client) => {
      const params: unknown[] = [warehouse];
      let customerClause = '';
      if (customer) {
        params.push(customer);
        customerClause = `AND d.customer_id = $${params.length}`;
      }
      const result = await client.query(
        `SELECT d.id, d.dispatch_no, d.customer_id, c.name AS customer_name, c.shipping_mark AS customer_mark,
                d.destination, d.dispatched_at, d.dispatched_by,
                COALESCE(SUM(dl.cartons), 0) AS cartons, SUM(dl.cbm) AS cbm, SUM(dl.weight_kg) AS weight_kg
         FROM dispatches d
         LEFT JOIN parties c ON c.id = d.customer_id
         LEFT JOIN dispatch_lines dl ON dl.dispatch_id = d.id
         WHERE d.warehouse_id = $1 ${customerClause}
         GROUP BY d.id, c.name, c.shipping_mark
         ORDER BY d.dispatched_at DESC, d.id DESC
         LIMIT 200`,
        params,
      );
      return {
        warehouseId: warehouse,
        dispatches: result.rows.map((row) => ({
          id: row.id,
          dispatchNo: row.dispatch_no,
          customerId: row.customer_id,
          customerName: row.customer_name,
          customerMark: row.customer_mark,
          destination: row.destination,
          dispatchedAt: row.dispatched_at instanceof Date ? row.dispatched_at.toISOString() : row.dispatched_at,
          dispatchedBy: row.dispatched_by,
          cartons: Number(row.cartons),
          cbm: toNumber(row.cbm),
          weightKg: toNumber(row.weight_kg),
        })),
      };
    });
  }

  async getDispatch(user: AuthenticatedUser, id: string) {
    const dispatchId = requireUuid(id, 'Dispatch id');
    return this.database.withTenant(user.tenantId, user.id, (client) => this.loadDispatchResponse(client, dispatchId));
  }

  private async loadLots(client: PoolClient, warehouseId: string, customerId: string, line: DispatchLineInput) {
    const result = await client.query<LotRow>(
      `SELECT rm.receipt_line_id, rm.cartons AS received_cartons, rm.qty AS received_qty, rm.cbm AS received_cbm,
              rl.weight_kg,
              rm.cartons + COALESCE((
                SELECT SUM(m2.cartons) FROM stock_movements m2
                WHERE m2.receipt_line_id = rm.receipt_line_id AND m2.kind <> 'receipt'
              ), 0) AS remaining
       FROM stock_movements rm
       JOIN receipt_lines rl ON rl.id = rm.receipt_line_id
       JOIN receipts r ON r.id = rl.receipt_id
       WHERE rm.kind = 'receipt' AND rm.warehouse_id = $1
         AND rm.customer_id IS NOT DISTINCT FROM $2
         AND rm.supplier_id IS NOT DISTINCT FROM $3
         AND rm.brand IS NOT DISTINCT FROM $4
         AND rm.product_id IS NOT DISTINCT FROM $5
       ORDER BY r.received_at, rm.receipt_line_id`,
      [warehouseId, customerId, line.supplierId, line.brand, line.productId],
    );
    return result.rows;
  }

  // The packing list doubles as the dispatch record: lines, totals, and the receipt lots each carton left from.
  private async loadDispatchResponse(client: PoolClient, dispatchId: string) {
    const dispatches = await client.query(
      `SELECT d.*, c.name AS customer_name, c.shipping_mark AS customer_mark
       FROM dispatches d LEFT JOIN parties c ON c.id = d.customer_id
       WHERE d.id = $1`,
      [dispatchId],
    );
    const dispatch = dispatches.rows[0];
    if (!dispatch) throw new NotFoundException('Dispatch not found');
    const lines = await client.query(
      `SELECT dl.*, p.name_ar, p.name_en, p.name_cn, p.model_no, s.name AS supplier_name
       FROM dispatch_lines dl
       LEFT JOIN products p ON p.id = dl.product_id
       LEFT JOIN parties s ON s.id = dl.supplier_id
       WHERE dl.dispatch_id = $1 ORDER BY dl.created_at, dl.id`,
      [dispatchId],
    );
    const allocations = await client.query(
      `SELECT da.dispatch_line_id, da.receipt_line_id, da.cartons, r.receipt_no, r.received_at
       FROM dispatch_allocations da
       JOIN dispatch_lines dl ON dl.id = da.dispatch_line_id
       JOIN receipt_lines rl ON rl.id = da.receipt_line_id
       JOIN receipts r ON r.id = rl.receipt_id
       WHERE dl.dispatch_id = $1 ORDER BY r.received_at, da.receipt_line_id`,
      [dispatchId],
    );
    const byLine = new Map<string, typeof allocations.rows>();
    for (const allocation of allocations.rows) {
      const list = byLine.get(allocation.dispatch_line_id) ?? [];
      list.push(allocation);
      byLine.set(allocation.dispatch_line_id, list);
    }
    return {
      id: dispatch.id,
      dispatchNo: dispatch.dispatch_no,
      warehouseId: dispatch.warehouse_id,
      status: dispatch.status,
      customerId: dispatch.customer_id,
      customerName: dispatch.customer_name,
      customerMark: dispatch.customer_mark,
      destination: dispatch.destination,
      dispatchedAt: dispatch.dispatched_at instanceof Date ? dispatch.dispatched_at.toISOString() : dispatch.dispatched_at,
      dispatchedBy: dispatch.dispatched_by,
      lines: lines.rows.map((line) => ({
        id: line.id,
        supplierId: line.supplier_id,
        supplierName: line.supplier_name,
        brand: line.brand,
        productId: line.product_id,
        product: { nameAr: line.name_ar, nameEn: line.name_en, nameCn: line.name_cn, modelNo: line.model_no },
        cartons: line.cartons,
        qty: line.qty,
        cbm: toNumber(line.cbm),
        weightKg: toNumber(line.weight_kg),
        allocations: (byLine.get(line.id) ?? []).map((allocation) => ({
          receiptLineId: allocation.receipt_line_id,
          receiptNo: allocation.receipt_no,
          receivedAt: allocation.received_at instanceof Date ? allocation.received_at.toISOString() : allocation.received_at,
          cartons: allocation.cartons,
        })),
      })),
      totals: {
        cartons: lines.rows.reduce((sum, line) => sum + line.cartons, 0),
        cbm: sumOrNull(lines.rows.map((line) => toNumber(line.cbm))),
        weightKg: sumOrNull(lines.rows.map((line) => toNumber(line.weight_kg))),
      },
    };
  }
}

// FIFO by receipt date keeps the oldest goods moving and preserves the lot link for stock age.
function allocateFifo(lots: LotRow[], cartons: number): Allocation[] {
  const allocations: Allocation[] = [];
  let needed = cartons;
  for (const lot of lots) {
    if (needed === 0) break;
    const remaining = Number(lot.remaining);
    if (remaining <= 0) continue;
    const taken = Math.min(remaining, needed);
    needed -= taken;
    const share = taken / lot.received_cartons;
    allocations.push({
      receiptLineId: lot.receipt_line_id,
      cartons: taken,
      qty: lot.received_qty === null ? null : Math.round(lot.received_qty * share),
      cbm: lot.received_cbm === null ? null : Number((Number(lot.received_cbm) * share).toFixed(6)),
      weightKg: lot.weight_kg === null ? null : Number((Number(lot.weight_kg) * share).toFixed(3)),
    });
  }
  if (needed > 0) throw new ConflictException('Insufficient stock for dispatch');
  return allocations;
}

function allocationTotals(allocations: Allocation[]) {
  return {
    qty: sumOrNull(allocations.map((allocation) => allocation.qty)),
    cbm: sumOrNull(allocations.map((allocation) => allocation.cbm)),
    weightKg: sumOrNull(allocations.map((allocation) => allocation.weightKg)),
  };
}

function sumOrNull(values: Array<number | null>): number | null {
  if (values.length === 0 || values.some((value) => value === null)) return null;
  return Number(values.reduce((sum: number, value) => sum + (value as number), 0).toFixed(6));
}

function normalizeLines(value: unknown): DispatchLineInput[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new BadRequestException('At least one dispatch line is required');
  }
  const seen = new Set<string>();
  return value.map((raw) => {
    if (typeof raw !== 'object' || raw === null) throw new BadRequestException('Invalid dispatch line');
    const line = raw as Record<string, unknown>;
    const parsed = typeof line.cartons === 'number' || typeof line.cartons === 'string' ? Number(line.cartons) : NaN;
    if (!Number.isInteger(parsed) || parsed <= 0 || parsed > MAX_QUANTITY) {
      throw new BadRequestException(`Cartons must be a positive integer no greater than ${MAX_QUANTITY}`);
    }
    const input: DispatchLineInput = {
      supplierId: optionalUuid(line.supplierId),
      brand: optionalText(line.brand),
      productId: optionalUuid(line.productId),
      cartons: parsed,
    };
    const key = `${input.supplierId}|${input.brand}|${input.productId}`;
    if (seen.has(key)) throw new BadRequestException('Duplicate dispatch line for the same stock group');
    seen.add(key);
    return input;
  });
}

function requireUuid(value: unknown, label: string): string {
  if (!isUuid(value)) throw new BadRequestException(`${label} is required and must be a UUID`);
  return value.toLowerCase();
}

function optionalUuid(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (!isUuid(value)) throw new BadRequestException('Malformed UUID');
  return value.toLowerCase();
}

function optionalText(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > 2000) throw new BadRequestException('Invalid text field');
  return value.trim() || null;
}

function optionalTimestamp(value: unknown): Date | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new BadRequestException('Invalid timestamp');
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new BadRequestException('Invalid timestamp');
  return parsed;
}

function toNumber(value: string | number | null): number | null {
  return value === null || value === undefined ? null : Number(value);
}