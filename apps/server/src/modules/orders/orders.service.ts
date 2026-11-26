import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PoolClient } from 'pg';
import { DatabaseService } from '../../platform/database.service';
import { recordAudit } from '../../platform/audit';
import { TenancyService } from '../tenancy/tenancy.service';
import { AuthenticatedUser, WarehouseAccess, isOfficeRole, isUuid } from '../tenancy/types';

const MAX_QUANTITY = 2_147_483_647;
const MAX_MONEY_UNITS = 99_999_999_999_999n;
type MoneyScale = 2 | 4;

interface OrderRow {
  id: string;
  tenant_id: string;
  warehouse_id: string;
  order_no: string;
  customer_id: string;
  supplier_id: string;
  order_date: string | null;
  expected_date: string | null;
  deposit: string | null;
  total_amount: string | null;
  currency: string | null;
  status: string;
  source: string;
}

interface LineRow {
  id: string;
  order_id: string;
  product_id: string;
  brand: string | null;
  size: string | null;
  cartons: number;
  qty_per_carton: number;
  qty: number;
  unit_price: string | null;
  amount: string | null;
  cbm: string | null;
  weight: string | null;
}

interface QueueOrderRow extends OrderRow {
  supplier_name: string;
  supplier_name_cn: string | null;
  customer_name: string;
  customer_shipping_mark: string | null;
}

interface QueueLineRow extends LineRow {
  name_ar: string | null;
  name_en: string | null;
  name_cn: string | null;
  model_no: string | null;
}

interface NormalizedLine {
  productId: string;
  brand: string | null;
  size: string | null;
  cartons: number;
  qtyPerCarton: number;
  qty: number;
  unitPrice: string | null;
  amount: string | null;
  cbm: number | null;
  weight: number | null;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly database: DatabaseService,
    private readonly tenancy: TenancyService,
  ) {}

  async createDraft(user: AuthenticatedUser, input: Record<string, unknown>) {
    const warehouseId = requireUuid(input.warehouseId, 'Warehouse id');
    const membership = await this.tenancy.findWarehouseAccess(user.id, warehouseId, user.tenantId);
    if (!membership || !isOfficeRole(membership.role)) {
      throw new ForbiddenException('Warehouse write access denied');
    }
    const supplierId = requireUuid(input.supplierId, 'Supplier id');
    const customerId = requireUuid(input.customerId, 'Customer id');
    const lines = normalizeLines(input.lines);
    const orderNo = optionalString(input.orderNo) ?? `PO-${randomBytes(4).toString('hex').toUpperCase()}`;
    const orderDate = optionalDate(input.orderDate);
    const expectedDate = optionalDate(input.expectedDate);
    const deposit = formatMoney(parseMoney(input.deposit, 2, 'Deposit'), 2, 'Deposit');
    const currency = optionalString(input.currency);

    return this.database.withTenant(user.tenantId, user.id, async (client) => {
      await assertParty(client, supplierId, 'supplier');
      await assertParty(client, customerId, 'customer');
      await assertProducts(client, lines);

      const inserted = await client.query<OrderRow>(
        `INSERT INTO orders
           (tenant_id, warehouse_id, order_no, customer_id, supplier_id, order_date, expected_date,
            deposit, currency, status, source, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft', 'manual', $10)
         RETURNING *`,
        [user.tenantId, warehouseId, orderNo, customerId, supplierId, orderDate, expectedDate, deposit, currency, user.id],
      );
      const order = inserted.rows[0];
      const savedLines = await insertLines(client, user, order.id, lines);
      const total = totalAmount(savedLines, input.totalAmount);
      const updated = await client.query<OrderRow>(
        'UPDATE orders SET total_amount = $1 WHERE id = $2 RETURNING *',
        [total, order.id],
      );
      await recordAudit(client, {
        tenantId: user.tenantId,
        userId: user.id,
        warehouseId,
        entity: 'order',
        entityId: order.id,
        action: 'order.create',
        after: { order: updated.rows[0], lines: savedLines },
      });
      return toFullOrder(updated.rows[0], savedLines);
    });
  }

  async listOrders(user: AuthenticatedUser, warehouseId?: unknown) {
    let filter: string | null = null;
    if (warehouseId !== undefined) {
      filter = requireUuid(warehouseId, 'Warehouse id');
      const membership = await this.tenancy.findWarehouseAccess(user.id, filter, user.tenantId);
      if (!membership) throw new ForbiddenException('Warehouse access denied');
    }
    return this.database.withTenant(user.tenantId, user.id, async (client) => {
      const result = filter
        ? await client.query<OrderRow>('SELECT * FROM orders WHERE warehouse_id = $1 ORDER BY created_at DESC', [filter])
        : await client.query<OrderRow>('SELECT * FROM orders ORDER BY created_at DESC');
      return result.rows.map((row) => toOrderSummary(row));
    });
  }

  async getOrder(user: AuthenticatedUser, id: string) {
    const orderId = requireUuid(id, 'Order id');
    return this.database.withTenant(user.tenantId, user.id, async (client) => {
      const order = await findOrder(client, orderId);
      const lines = await findLines(client, orderId);
      return toFullOrder(order, lines);
    });
  }

  async editDraft(user: AuthenticatedUser, id: string, input: Record<string, unknown>) {
    const orderId = requireUuid(id, 'Order id');
    return this.database.withTenant(user.tenantId, user.id, async (client) => {
      const before = await findOrder(client, orderId, true);
      if (before.status !== 'draft') {
        throw new BadRequestException('Only draft orders can be edited');
      }
      const expectedDate = input.expectedDate === undefined ? before.expected_date : optionalDate(input.expectedDate);
      const orderDate = input.orderDate === undefined ? before.order_date : optionalDate(input.orderDate);
      const deposit = input.deposit === undefined
        ? before.deposit
        : formatMoney(parseMoney(input.deposit, 2, 'Deposit'), 2, 'Deposit');
      const currency = input.currency === undefined ? before.currency : optionalString(input.currency);

      let lines = await findLines(client, orderId);
      if (input.lines !== undefined) {
        const normalized = normalizeLines(input.lines);
        await assertProducts(client, normalized);
        await client.query('DELETE FROM order_lines WHERE order_id = $1', [orderId]);
        lines = await insertLines(client, user, orderId, normalized);
      }
      const total = totalAmount(lines, input.totalAmount);
      const updated = await client.query<OrderRow>(
        `UPDATE orders SET expected_date = $1, order_date = $2, deposit = $3, currency = $4, total_amount = $5
         WHERE id = $6 RETURNING *`,
        [expectedDate, orderDate, deposit, currency, total, orderId],
      );
      await recordAudit(client, {
        tenantId: user.tenantId,
        userId: user.id,
        warehouseId: before.warehouse_id,
        entity: 'order',
        entityId: orderId,
        action: 'order.update',
        before: { order: before },
        after: { order: updated.rows[0], lines },
      });
      return toFullOrder(updated.rows[0], lines);
    });
  }

  async confirm(user: AuthenticatedUser, id: string) {
    return this.transition(user, id, ['draft'], 'ready', 'order.confirm');
  }

  async cancel(user: AuthenticatedUser, id: string) {
    return this.transition(user, id, ['draft', 'ready'], 'cancelled', 'order.cancel');
  }

  async awaitingQueue(membership: WarehouseAccess) {
    return this.database.withTenant(membership.tenantId, membership.userId, async (client) => {
      const orders = await client.query<QueueOrderRow>(
        `SELECT o.*, s.name AS supplier_name, s.name_cn AS supplier_name_cn,
                c.name AS customer_name, c.shipping_mark AS customer_shipping_mark
         FROM orders o
         JOIN parties s ON s.id = o.supplier_id
         JOIN parties c ON c.id = o.customer_id
         WHERE o.warehouse_id = $1 AND o.status = 'ready'
         ORDER BY o.expected_date NULLS LAST, o.created_at`,
        [membership.warehouseId],
      );
      if (orders.rows.length === 0) return [];
      const ids = orders.rows.map((row) => row.id);
      const lines = await client.query<QueueLineRow>(
        `SELECT l.*, p.name_ar, p.name_en, p.name_cn, p.model_no
         FROM order_lines l
         JOIN products p ON p.id = l.product_id
         WHERE l.order_id = ANY($1::uuid[])
         ORDER BY l.created_at`,
        [ids],
      );
      return orders.rows.map((order) => toWorkerOrder(order, lines.rows.filter((line) => line.order_id === order.id)));
    });
  }

  private async transition(
    user: AuthenticatedUser,
    id: string,
    allowed: string[],
    next: string,
    action: string,
  ) {
    const orderId = requireUuid(id, 'Order id');
    return this.database.withTenant(user.tenantId, user.id, async (client) => {
      const before = await findOrder(client, orderId, true);
      if (!allowed.includes(before.status)) {
        throw new BadRequestException(`Order cannot transition from ${before.status} to ${next}`);
      }
      const updated = await client.query<OrderRow>(
        'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
        [next, orderId],
      );
      await recordAudit(client, {
        tenantId: user.tenantId,
        userId: user.id,
        warehouseId: before.warehouse_id,
        entity: 'order',
        entityId: orderId,
        action,
        before: { status: before.status },
        after: { status: next },
      });
      const lines = await findLines(client, orderId);
      return toFullOrder(updated.rows[0], lines);
    });
  }
}

function requireUuid(value: unknown, label: string): string {
  if (!isUuid(value)) throw new BadRequestException(`${label} is required and must be a UUID`);
  return value;
}

function optionalString(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new BadRequestException('Invalid text field');
  return value.trim();
}

function optionalDate(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException('Dates must use YYYY-MM-DD');
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.getUTCFullYear() === 0 || date.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException('Invalid calendar date');
  }
  return value;
}

function parseMoney(value: unknown, scale: MoneyScale, label: string): bigint | null {
  if (value === undefined || value === null || value === '') return null;
  const text = typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
  if (!/^\d+(\.\d+)?$/.test(text)) {
    throw new BadRequestException(`${label} must be a nonnegative decimal`);
  }
  const [rawWhole, fraction = ''] = text.split('.');
  const whole = rawWhole.replace(/^0+(?=\d)/, '');
  if (whole.length > 14 - scale || fraction.length > scale) {
    throw new BadRequestException(`${label} must fit within ${14 - scale} whole digits and ${scale} decimal places`);
  }
  return BigInt(`${whole}${fraction.padEnd(scale, '0')}`);
}

function formatMoney(units: bigint | null, scale: MoneyScale, label: string): string | null {
  if (units === null) return null;
  if (units > MAX_MONEY_UNITS) {
    throw new BadRequestException(`${label} exceeds the maximum value`);
  }
  const digits = units.toString().padStart(scale + 1, '0');
  return `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
}

function optionalNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new BadRequestException('Invalid numeric value');
  return parsed;
}

function positiveInt(value: unknown, label: string): number {
  const parsed = typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > MAX_QUANTITY) {
    throw new BadRequestException(`${label} must be a positive integer no greater than ${MAX_QUANTITY}`);
  }
  return parsed;
}

function normalizeLines(value: unknown): NormalizedLine[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new BadRequestException('At least one order line is required');
  }
  return value.map((raw) => {
    if (typeof raw !== 'object' || raw === null) throw new BadRequestException('Invalid order line');
    const line = raw as Record<string, unknown>;
    const productId = requireUuid(line.productId, 'Product id');
    const cartons = positiveInt(line.cartons, 'Cartons');
    const qtyPerCarton = positiveInt(line.qtyPerCarton, 'Quantity per carton');
    const qty = cartons * qtyPerCarton;
    if (qty > MAX_QUANTITY) throw new BadRequestException(`Quantity must not exceed ${MAX_QUANTITY}`);
    if (line.qty !== undefined && positiveInt(line.qty, 'Quantity') !== qty) {
      throw new BadRequestException('Quantity must equal cartons times quantity per carton');
    }
    const unitPrice = parseMoney(line.unitPrice, 4, 'Unit price');
    const suppliedAmount = parseMoney(line.amount, 2, 'Line amount');
    // Convert ten-thousandths to cents, rounding half up after multiplication.
    const amount = unitPrice === null ? suppliedAmount : (BigInt(qty) * unitPrice + 50n) / 100n;
    if (suppliedAmount !== null && suppliedAmount !== amount) {
      throw new BadRequestException('Line amount must equal quantity times unit price');
    }
    return {
      productId,
      brand: optionalString(line.brand),
      size: optionalString(line.size),
      cartons,
      qtyPerCarton,
      qty,
      unitPrice: formatMoney(unitPrice, 4, 'Unit price'),
      amount: formatMoney(amount, 2, 'Line amount'),
      cbm: optionalNumber(line.cbm),
      weight: optionalNumber(line.weight),
    };
  });
}

async function assertParty(client: PoolClient, id: string, type: 'customer' | 'supplier') {
  const result = await client.query('SELECT id FROM parties WHERE id = $1 AND type = $2 FOR KEY SHARE', [id, type]);
  if (result.rows.length === 0) throw new BadRequestException(`Invalid ${type} id`);
}

async function assertProducts(client: PoolClient, lines: NormalizedLine[]) {
  const ids = [...new Set(lines.map((line) => line.productId))];
  const result = await client.query('SELECT id FROM products WHERE id = ANY($1::uuid[])', [ids]);
  if (result.rows.length !== ids.length) throw new BadRequestException('Invalid product id');
}

async function insertLines(
  client: PoolClient,
  user: AuthenticatedUser,
  orderId: string,
  lines: NormalizedLine[],
): Promise<LineRow[]> {
  const saved: LineRow[] = [];
  for (const line of lines) {
    const inserted = await client.query(
      `INSERT INTO order_lines
         (tenant_id, order_id, product_id, brand, size, cartons, qty_per_carton, qty, unit_price, amount, cbm, weight, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        user.tenantId, orderId, line.productId, line.brand, line.size, line.cartons, line.qtyPerCarton,
        line.qty, line.unitPrice, line.amount, line.cbm, line.weight, user.id,
      ],
    );
    saved.push(inserted.rows[0] as LineRow);
  }
  return saved;
}

async function findOrder(client: PoolClient, id: string, lock = false): Promise<OrderRow> {
  const result = await client.query(
    lock ? 'SELECT * FROM orders WHERE id = $1 FOR UPDATE' : 'SELECT * FROM orders WHERE id = $1',
    [id],
  );
  const order = result.rows[0] as OrderRow | undefined;
  if (!order) throw new NotFoundException('Order not found');
  return order;
}

async function findLines(client: PoolClient, orderId: string): Promise<LineRow[]> {
  const result = await client.query('SELECT * FROM order_lines WHERE order_id = $1 ORDER BY created_at', [orderId]);
  return result.rows as LineRow[];
}

function totalAmount(lines: LineRow[], suppliedTotal: unknown): string | null {
  const expected = parseMoney(suppliedTotal, 2, 'Order total');
  let sum: bigint | null = 0n;
  for (const line of lines) {
    const amount = parseMoney(line.amount, 2, 'Line amount');
    if (amount === null) {
      sum = null;
      break;
    }
    sum += amount;
  }
  if (expected !== null && expected !== sum) {
    throw new BadRequestException('Order total must equal the sum of line amounts');
  }
  return formatMoney(sum, 2, 'Order total');
}

function toNumber(value: string | number | null): number | null {
  return value === null ? null : Number(value);
}

function dateOnly(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return String(value).slice(0, 10);
}

function toOrderSummary(row: OrderRow) {
  return {
    id: row.id,
    orderNo: row.order_no,
    warehouseId: row.warehouse_id,
    status: row.status,
    supplierId: row.supplier_id,
    customerId: row.customer_id,
    orderDate: dateOnly(row.order_date),
    expectedDate: dateOnly(row.expected_date),
    totalAmount: toNumber(row.total_amount),
    currency: row.currency,
  };
}

function toFullOrder(row: OrderRow, lines: LineRow[]) {
  return {
    ...toOrderSummary(row),
    deposit: toNumber(row.deposit),
    source: row.source,
    lines: lines.map((line) => ({
      id: line.id,
      productId: line.product_id,
      brand: line.brand,
      size: line.size,
      cartons: line.cartons,
      qtyPerCarton: line.qty_per_carton,
      qty: line.qty,
      unitPrice: toNumber(line.unit_price),
      amount: toNumber(line.amount),
      cbm: toNumber(line.cbm),
      weight: toNumber(line.weight),
    })),
  };
}

function toWorkerOrder(row: QueueOrderRow, lines: QueueLineRow[]) {
  return {
    id: row.id,
    orderNo: row.order_no,
    status: row.status,
    orderDate: dateOnly(row.order_date),
    expectedDate: dateOnly(row.expected_date),
    supplier: { id: row.supplier_id, name: row.supplier_name, nameCn: row.supplier_name_cn },
    customer: { id: row.customer_id, name: row.customer_name, shippingMark: row.customer_shipping_mark },
    expectedCartons: lines.reduce((sum, line) => sum + line.cartons, 0),
    lines: lines.map((line) => ({
      id: line.id,
      product: {
        id: line.product_id,
        nameAr: line.name_ar,
        nameEn: line.name_en,
        nameCn: line.name_cn,
        modelNo: line.model_no,
      },
      brand: line.brand,
      size: line.size,
      cartons: line.cartons,
      qtyPerCarton: line.qty_per_carton,
      qty: line.qty,
      cbm: toNumber(line.cbm),
      weight: toNumber(line.weight),
    })),
  };
}
