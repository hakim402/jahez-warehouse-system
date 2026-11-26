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

interface OrderLineRow {
  id: string;
  product_id: string;
  brand: string | null;
  size: string | null;
  cartons: number;
  received_cartons: string;
  qty_per_carton: number;
  cbm: string | null;
  weight: string | null;
}

interface SavedReceiptLine {
  id: string;
  order_line_id: string | null;
  product_id: string;
  cartons: number;
  qty: number | null;
  cbm: string | null;
  weight_kg: string | null;
  condition: 'ok' | 'damaged';
  brand: string | null;
}

const MAX_QUANTITY = 2_147_483_647;

interface ReceiptLineInput {
  orderLineId: string | null;
  productId: string | null;
  cartons: number;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  weightKg: number | null;
  condition: 'ok' | 'damaged';
  brand: string | null;
  size: string | null;
}

@Injectable()
export class ReceivingService {
  constructor(
    private readonly database: DatabaseService,
    private readonly tenancy: TenancyService,
    private readonly inventory: InventoryService,
    private readonly realtime: RealtimeService,
  ) {}

  async confirmReceipt(user: AuthenticatedUser, input: Record<string, unknown>) {
    const operationId = requireUuid(input.clientOperationId, 'Client operation id');
    const warehouseId = requireUuid(input.warehouseId, 'Warehouse id');
    const orderId = requireUuid(input.orderId, 'Order id');
    const lines = normalizeLines(input.lines);
    const receivedAt = optionalTimestamp(input.receivedAt);
    const requestHash = createHash('sha256')
      .update(JSON.stringify({ warehouseId, orderId, lines, receivedAt: receivedAt?.toISOString() ?? null }))
      .digest('hex');

    const membership = await this.tenancy.findWarehouseAccess(user.id, warehouseId, user.tenantId);
    if (!membership) throw new ForbiddenException('Warehouse access denied');

    const { response, change } = await this.database.withTenant(user.tenantId, user.id, async (client) => {
      // Enforce the operation ID and record the stock movement in one transaction so a replay cannot add stock twice.
      const claimed = await client.query(
        `INSERT INTO client_operations (tenant_id, operation_id, user_id, warehouse_id, kind, request_hash, created_by)
         VALUES ($1, $2, $3, $4, 'receipt.confirm', $5, $3)
         ON CONFLICT (tenant_id, operation_id) DO NOTHING
         RETURNING id`,
        [user.tenantId, operationId, user.id, warehouseId, requestHash],
      );
      if (claimed.rowCount === 0) {
        const existing = await client.query<{ response: ReturnType<ReceivingService['toResponse']> | null }>(
          `SELECT response FROM client_operations
           WHERE operation_id = $1 AND user_id = $2 AND warehouse_id = $3
             AND kind = 'receipt.confirm' AND request_hash = $4`,
          [operationId, user.id, warehouseId, requestHash],
        );
        const response = existing.rows[0]?.response;
        if (!response) throw new ConflictException('Client operation is already recorded for a different request');
        return { response, change: null };
      }

      const orders = await client.query(
        'SELECT * FROM receiving_lock_order($1, $2)',
        [orderId, warehouseId],
      );
      const order = orders.rows[0];
      if (!order) throw new NotFoundException('Order not found');
      if (!['ready', 'partly_received', 'received'].includes(order.status)) {
        throw new BadRequestException('Order is not open for receiving');
      }

      const orderLines = await client.query<OrderLineRow>(
        `SELECT id, product_id, brand, size, cartons, qty_per_carton, cbm, weight,
                receiving_received_cartons(order_id, id) AS received_cartons
         FROM order_lines WHERE order_id = $1`,
        [orderId],
      );
      const byId = new Map(orderLines.rows.map((row) => [row.id, row]));
      const prepared = await prepareLines(client, lines, byId);
      const tolerances = await client.query<{ cbm_tolerance_percent: string; weight_tolerance_percent: string }>(
        'SELECT cbm_tolerance_percent, weight_tolerance_percent FROM companies WHERE id = $1',
        [user.tenantId],
      );

      const counter = await client.query<{ next_value: string }>(
        `INSERT INTO document_counters (tenant_id, kind, next_value)
         VALUES ($1, 'receipt', 1)
         ON CONFLICT (tenant_id, kind)
         DO UPDATE SET next_value = document_counters.next_value + 1
         RETURNING next_value`,
        [user.tenantId],
      );
      const receiptNo = `RCPT-${String(counter.rows[0].next_value).padStart(6, '0')}`;

      const inserted = await client.query(
        `INSERT INTO receipts
           (tenant_id, warehouse_id, receipt_no, order_id, customer_id, supplier_id, received_by, received_at, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'confirmed', $7)
         RETURNING *`,
        [user.tenantId, warehouseId, receiptNo, orderId, order.customer_id, order.supplier_id, user.id, receivedAt ?? new Date()],
      );
      const receipt = inserted.rows[0];

      const savedLines: SavedReceiptLine[] = [];
      for (const line of prepared) {
        const cbm = calculateCbm(line);
        const saved = await client.query<SavedReceiptLine>(
          `INSERT INTO receipt_lines
             (tenant_id, receipt_id, order_line_id, product_id, cartons, qty, length_cm, width_cm, height_cm, cbm, weight_kg, condition, brand, size, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           RETURNING *`,
          [
            user.tenantId, receipt.id, line.orderLineId, line.productId, line.cartons, line.qty,
            line.lengthCm, line.widthCm, line.heightCm, cbm, line.weightKg, line.condition,
            line.brand, line.size, user.id,
          ],
        );
        savedLines.push(saved.rows[0]);
      }

      const tolerance = tolerances.rows[0];
      await createFindings(client, user, receipt.id, savedLines, byId, {
        cbm: Number(tolerance.cbm_tolerance_percent) / 100,
        weight: Number(tolerance.weight_tolerance_percent) / 100,
      });

      await this.inventory.postReceiptMovements(client, {
        tenantId: user.tenantId,
        userId: user.id,
        warehouseId,
        receiptId: receipt.id,
        supplierId: order.supplier_id,
        customerId: order.customer_id,
        lines: savedLines.map((line) => ({
          receiptLineId: line.id,
          productId: line.product_id,
          brand: line.brand,
          cartons: line.cartons,
          qty: line.qty,
          cbm: toNumber(line.cbm),
        })),
      });

      const updatedOrder = await client.query<{ status: string | null }>(
        'SELECT receiving_refresh_order_status($1, $2) AS status',
        [orderId, warehouseId],
      );
      if (!updatedOrder.rows[0]?.status) throw new ConflictException('Order is no longer open for receiving');

      const response = await this.loadReceiptResponse(client, receipt.id);
      await client.query(
        'UPDATE client_operations SET receipt_id = $1, response = $2 WHERE operation_id = $3',
        [receipt.id, JSON.stringify(response), operationId],
      );
      await recordAudit(client, {
        tenantId: user.tenantId,
        userId: user.id,
        warehouseId,
        entity: 'receipt',
        entityId: receipt.id,
        action: 'receipt.confirm',
        after: response,
      });
      const change: WarehouseChange = {
        tenantId: user.tenantId, warehouseId, entity: 'receipt', entityId: receipt.id,
        action: 'receipt.confirmed', payload: response,
      };
      await recordWarehouseChange(client, change);
      return { response, change };
    });
    // Notify subscribers only after the transaction commits; replays and rollbacks emit nothing.
    if (change) this.realtime.publish(change);
    return response;
  }

  async getReceipt(user: AuthenticatedUser, id: string) {
    const receiptId = requireUuid(id, 'Receipt id');
    return this.database.withTenant(user.tenantId, user.id, (client) => this.loadReceiptResponse(client, receiptId));
  }

  private async loadReceiptResponse(client: PoolClient, receiptId: string) {
    const receipts = await client.query('SELECT * FROM receipts WHERE id = $1', [receiptId]);
    const receipt = receipts.rows[0];
    if (!receipt) throw new NotFoundException('Receipt not found');
    const lines = await client.query('SELECT * FROM receipt_lines WHERE receipt_id = $1 ORDER BY created_at, id', [receiptId]);
    const findings = await client.query('SELECT * FROM findings WHERE receipt_id = $1 ORDER BY created_at, id', [receiptId]);
    const movements = await client.query(
      "SELECT * FROM stock_movements WHERE ref_id = $1 AND kind = 'receipt' ORDER BY created_at, id",
      [receiptId],
    );
    const orders = await client.query('SELECT status FROM orders WHERE id = $1', [receipt.order_id]);
    const orderStatus = orders.rows[0]?.status ?? null;
    return this.toResponse(receipt, lines.rows, findings.rows, movements.rows, orderStatus);
  }

  private toResponse(receipt: any, lines: any[], findings: any[], movements: any[], orderStatus: string | null) {
    return {
      id: receipt.id,
      receiptNo: receipt.receipt_no,
      orderId: receipt.order_id,
      warehouseId: receipt.warehouse_id,
      status: receipt.status,
      receivedAt: receipt.received_at instanceof Date ? receipt.received_at.toISOString() : receipt.received_at,
      receivedBy: receipt.received_by,
      orderStatus,
      lines: lines.map((line) => ({
        id: line.id,
        orderLineId: line.order_line_id,
        productId: line.product_id,
        brand: line.brand,
        size: line.size,
        cartons: line.cartons,
        qty: line.qty ?? null,
        lengthCm: toNumber(line.length_cm),
        widthCm: toNumber(line.width_cm),
        heightCm: toNumber(line.height_cm),
        cbm: toNumber(line.cbm),
        weightKg: toNumber(line.weight_kg),
        condition: line.condition,
      })),
      findings: findings.map((finding) => ({
        id: finding.id,
        receiptLineId: finding.receipt_line_id,
        orderLineId: finding.order_line_id,
        type: finding.type,
        expected: toNumber(finding.expected),
        actual: toNumber(finding.actual),
        status: finding.status,
        note: finding.note,
      })),
      stockMovements: movements.map((movement) => ({
        id: movement.id,
        productId: movement.product_id,
        cartons: movement.cartons,
        qty: movement.qty,
        cbm: toNumber(movement.cbm),
        kind: movement.kind,
      })),
    };
  }
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

function optionalMeasurement(value: unknown, scale: number, maxExclusive: number): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(parsed) || parsed < 0) throw new BadRequestException('Invalid numeric value');
  const rounded = Number(parsed.toFixed(scale));
  if (rounded >= maxExclusive) throw new BadRequestException('Measurement exceeds the maximum value');
  return rounded;
}

function optionalString(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new BadRequestException('Invalid text field');
  return value.trim();
}

function optionalTimestamp(value: unknown): Date | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new BadRequestException('Invalid timestamp');
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new BadRequestException('Invalid timestamp');
  return parsed;
}

function positiveInt(value: unknown, label: string): number {
  const parsed = typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > MAX_QUANTITY) {
    throw new BadRequestException(`${label} must be a positive integer no greater than ${MAX_QUANTITY}`);
  }
  return parsed;
}

function normalizeLines(value: unknown): ReceiptLineInput[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new BadRequestException('At least one receipt line is required');
  }
  return value.map((raw) => {
    if (typeof raw !== 'object' || raw === null) throw new BadRequestException('Invalid receipt line');
    const line = raw as Record<string, unknown>;
    const condition = line.condition === undefined ? 'ok' : line.condition;
    if (condition !== 'ok' && condition !== 'damaged') {
      throw new BadRequestException('Condition must be ok or damaged');
    }
    return {
      orderLineId: optionalUuid(line.orderLineId),
      productId: optionalUuid(line.productId),
      cartons: positiveInt(line.cartons, 'Cartons'),
      lengthCm: optionalMeasurement(line.lengthCm, 2, 100_000_000),
      widthCm: optionalMeasurement(line.widthCm, 2, 100_000_000),
      heightCm: optionalMeasurement(line.heightCm, 2, 100_000_000),
      weightKg: optionalMeasurement(line.weightKg, 3, 1_000_000_000),
      condition,
      brand: optionalString(line.brand),
      size: optionalString(line.size),
    };
  });
}

async function prepareLines(client: PoolClient, lines: ReceiptLineInput[], byId: Map<string, OrderLineRow>) {
  const prepared = [];
  for (const line of lines) {
    const orderLine = line.orderLineId ? byId.get(line.orderLineId) : undefined;
    if (line.orderLineId && !orderLine) throw new BadRequestException('Invalid order line id');
    if (orderLine && (!line.productId || line.productId === orderLine.product_id)) {
      const qty = line.cartons * orderLine.qty_per_carton;
      if (qty > MAX_QUANTITY) throw new BadRequestException(`Quantity must not exceed ${MAX_QUANTITY}`);
      prepared.push({
        ...line,
        productId: orderLine.product_id,
        brand: line.brand ?? orderLine.brand,
        size: line.size ?? orderLine.size,
        qty,
      });
    } else {
      if (!line.productId) throw new BadRequestException('Product id is required for an unmatched line');
      const products = await client.query('SELECT id FROM products WHERE id = $1', [line.productId]);
      if (products.rows.length === 0) throw new BadRequestException('Invalid product id');
      prepared.push({ ...line, productId: line.productId, qty: null });
    }
  }
  return prepared;
}

function calculateCbm(line: { lengthCm: number | null; widthCm: number | null; heightCm: number | null; cartons: number }): number | null {
  if (line.lengthCm === null || line.widthCm === null || line.heightCm === null) return null;
  const cbm = Number(((line.lengthCm * line.widthCm * line.heightCm) / 1_000_000 * line.cartons).toFixed(6));
  if (!Number.isFinite(cbm) || cbm >= 1_000_000) throw new BadRequestException('Calculated CBM exceeds the maximum value');
  return cbm;
}

interface FindingInput {
  receiptLineId: string | null;
  orderLineId: string | null;
  type: 'missing' | 'extra' | 'wrong' | 'damaged' | 'cbm' | 'weight';
  expected: number | null;
  actual: number | null;
  note?: string;
}

async function createFindings(
  client: PoolClient,
  user: AuthenticatedUser,
  receiptId: string,
  savedLines: SavedReceiptLine[],
  byId: Map<string, OrderLineRow>,
  tolerance: { cbm: number; weight: number },
): Promise<void> {
  const findings: FindingInput[] = [];
  const delivered = new Map<string, { cartons: number; receiptLineId: string }>();
  for (const line of savedLines) {
    const orderLine = line.order_line_id ? byId.get(line.order_line_id) : undefined;
    const context = { receiptLineId: line.id, orderLineId: line.order_line_id };
    if (!orderLine || line.product_id !== orderLine.product_id) {
      findings.push({ ...context, type: 'wrong', expected: null, actual: line.cartons, note: 'Product does not match an ordered line' });
    } else {
      const previous = delivered.get(orderLine.id);
      delivered.set(orderLine.id, {
        cartons: (previous?.cartons ?? 0) + line.cartons,
        receiptLineId: previous?.receiptLineId ?? line.id,
      });
      const fraction = line.cartons / orderLine.cartons;
      for (const type of ['cbm', 'weight'] as const) {
        const ordered = toNumber(orderLine[type]);
        const actual = toNumber(type === 'cbm' ? line.cbm : line.weight_kg);
        if (ordered !== null && ordered > 0 && actual !== null) {
          const expected = ordered * fraction;
          if (Math.abs(actual - expected) / expected > tolerance[type]) {
            findings.push({ ...context, type, expected, actual });
          }
        }
      }
    }
    if (line.condition === 'damaged') {
      findings.push({ ...context, type: 'damaged', expected: null, actual: line.cartons });
    }
  }
  for (const orderLine of byId.values()) {
    const expected = Math.max(0, orderLine.cartons - Number(orderLine.received_cartons));
    const receipt = delivered.get(orderLine.id);
    const actual = receipt?.cartons ?? 0;
    if (actual !== expected) {
      findings.push({
        receiptLineId: receipt?.receiptLineId ?? null, orderLineId: orderLine.id,
        type: actual < expected ? 'missing' : 'extra', expected, actual,
      });
    }
  }
  for (const finding of findings) {
    await client.query(
      `INSERT INTO findings (tenant_id, receipt_id, receipt_line_id, order_line_id, type, expected, actual, note, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [user.tenantId, receiptId, finding.receiptLineId, finding.orderLineId, finding.type,
        finding.expected, finding.actual, finding.note ?? null, user.id],
    );
  }
}

function toNumber(value: string | number | null): number | null {
  return value === null || value === undefined ? null : Number(value);
}
