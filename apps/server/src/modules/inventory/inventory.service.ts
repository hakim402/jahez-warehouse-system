import { BadRequestException, Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../../platform/database.service';
import { isUuid, WarehouseAccess } from '../tenancy/types';

const MAX_MOVEMENT_PAGE_SIZE = 200;

export interface ReceiptMovementInput {
  tenantId: string;
  userId: string;
  warehouseId: string;
  receiptId: string;
  supplierId: string | null;
  customerId: string | null;
  lines: Array<{
    receiptLineId: string;
    productId: string;
    brand: string | null;
    cartons: number;
    qty: number | null;
    cbm: number | null;
  }>;
}

export interface StockFilters {
  customerMark?: string;
  supplierId?: string;
  brand?: string;
  productId?: string;
}

@Injectable()
export class InventoryService {
  constructor(private readonly database: DatabaseService) {}

  // Stock is posted inside the caller's receipt transaction so a replay cannot add stock twice.
  async postReceiptMovements(client: PoolClient, input: ReceiptMovementInput): Promise<void> {
    for (const line of input.lines) {
      await client.query(
        `INSERT INTO stock_movements
           (tenant_id, warehouse_id, supplier_id, brand, customer_id, product_id, cartons, qty, cbm, kind, ref_id, receipt_line_id, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'receipt', $10, $11, $12)`,
        [
          input.tenantId, input.warehouseId, input.supplierId, line.brand, input.customerId, line.productId,
          line.cartons, line.qty, line.cbm, input.receiptId, line.receiptLineId, input.userId,
        ],
      );
    }
  }

  async listBalances(membership: WarehouseAccess, filters: StockFilters) {
    return this.database.withTenant(membership.tenantId, membership.userId, async (client) => {
      const { where, params } = movementFilters(membership.warehouseId, filters);
      const result = await client.query(
        `SELECT m.warehouse_id, m.supplier_id, s.name AS supplier_name,
                m.customer_id, c.name AS customer_name, c.shipping_mark AS customer_mark,
                m.brand, m.product_id, p.name_ar, p.name_en, p.name_cn, p.model_no,
                SUM(m.cartons) AS cartons,
                SUM(m.qty) AS qty,
                SUM(m.cbm) AS cbm
         FROM stock_movements m
         LEFT JOIN parties s ON s.id = m.supplier_id
         LEFT JOIN parties c ON c.id = m.customer_id
         LEFT JOIN products p ON p.id = m.product_id
         WHERE ${where}
         GROUP BY m.warehouse_id, m.supplier_id, s.name, m.customer_id, c.name, c.shipping_mark,
                  m.brand, m.product_id, p.name_ar, p.name_en, p.name_cn, p.model_no
         ORDER BY c.shipping_mark NULLS LAST, m.brand NULLS LAST, p.name_en NULLS LAST`,
        params,
      );
      return {
        warehouseId: membership.warehouseId,
        balances: result.rows.map((row) => ({
          warehouseId: row.warehouse_id,
          supplierId: row.supplier_id,
          supplierName: row.supplier_name,
          customerId: row.customer_id,
          customerName: row.customer_name,
          customerMark: row.customer_mark,
          brand: row.brand,
          productId: row.product_id,
          product: { nameAr: row.name_ar, nameEn: row.name_en, nameCn: row.name_cn, modelNo: row.model_no },
          cartons: stockCount(row.cartons),
          qty: stockCount(row.qty),
          cbm: toNumber(row.cbm),
        })),
      };
    });
  }

  async listMovements(membership: WarehouseAccess, filters: StockFilters, limit: unknown, cursor: unknown) {
    const pageSize = movementPageSize(limit);
    const before = decodeMovementCursor(cursor);
    return this.database.withTenant(membership.tenantId, membership.userId, async (client) => {
      const { where, params } = movementFilters(membership.warehouseId, filters);
      let boundary = '';
      if (before) {
        const index = params.length + 1;
        params.push(before[0], before[1]);
        boundary = `AND (m.created_at, m.id) < ($${index}::timestamptz, $${index + 1}::uuid)`;
      }
      params.push(pageSize + 1);
      const result = await client.query(
        `SELECT m.id, m.kind, m.product_id, p.name_en, p.name_ar, p.name_cn, m.brand,
                m.cartons, m.qty, m.cbm, m.supplier_id, s.name AS supplier_name,
                m.customer_id, c.name AS customer_name, c.shipping_mark AS customer_mark,
                m.ref_id, m.receipt_line_id, m.created_at, m.created_by,
                r.receipt_no, r.received_at,
                to_char(m.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_created_at
         FROM stock_movements m
         LEFT JOIN parties s ON s.id = m.supplier_id
         LEFT JOIN parties c ON c.id = m.customer_id
         LEFT JOIN products p ON p.id = m.product_id
         LEFT JOIN receipts r ON r.id = m.ref_id AND m.kind = 'receipt'
         WHERE ${where} ${boundary}
         ORDER BY m.created_at DESC, m.id DESC
         LIMIT $${params.length}`,
        params,
      );
      const page = result.rows.slice(0, pageSize);
      const last = page[page.length - 1];
      return {
        warehouseId: membership.warehouseId,
        nextCursor: result.rows.length > pageSize ? encodeMovementCursor(last.cursor_created_at, last.id) : null,
        movements: page.map((row) => ({
          id: row.id,
          kind: row.kind,
          productId: row.product_id,
          product: { nameAr: row.name_ar, nameEn: row.name_en, nameCn: row.name_cn },
          brand: row.brand,
          cartons: row.cartons,
          qty: row.qty,
          cbm: toNumber(row.cbm),
          supplierId: row.supplier_id,
          supplierName: row.supplier_name,
          customerId: row.customer_id,
          customerName: row.customer_name,
          customerMark: row.customer_mark,
          receiptId: row.kind === 'receipt' ? row.ref_id : null,
          receiptNo: row.receipt_no,
          receiptLineId: row.receipt_line_id,
          receivedAt: row.received_at instanceof Date ? row.received_at.toISOString() : row.received_at,
          createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
          createdBy: row.created_by,
        })),
      };
    });
  }

  async listAge(membership: WarehouseAccess, filters: StockFilters) {
    return this.database.withTenant(membership.tenantId, membership.userId, async (client) => {
      const { where, params } = movementFilters(membership.warehouseId, filters, "m.kind = 'receipt'");
      const result = await client.query(
        `SELECT m.ref_id AS receipt_id, r.receipt_no, r.received_at,
                m.supplier_id, s.name AS supplier_name,
                m.customer_id, c.name AS customer_name, c.shipping_mark AS customer_mark,
                m.brand, m.product_id, p.name_ar, p.name_en, p.name_cn,
                SUM(m.cartons) AS cartons,
                SUM(m.qty) AS qty,
                SUM(m.cbm) AS cbm,
                FLOOR(EXTRACT(EPOCH FROM (now() - r.received_at)) / 86400)::int AS days_in_storage
         FROM stock_movements m
         JOIN receipts r ON r.id = m.ref_id
         LEFT JOIN parties s ON s.id = m.supplier_id
         LEFT JOIN parties c ON c.id = m.customer_id
         LEFT JOIN products p ON p.id = m.product_id
         WHERE ${where}
         GROUP BY m.ref_id, r.receipt_no, r.received_at, m.supplier_id, s.name,
                  m.customer_id, c.name, c.shipping_mark, m.brand, m.product_id, p.name_ar, p.name_en, p.name_cn
         ORDER BY r.received_at ASC, r.receipt_no`,
        params,
      );
      return {
        warehouseId: membership.warehouseId,
        age: result.rows.map((row) => ({
          receiptId: row.receipt_id,
          receiptNo: row.receipt_no,
          receivedAt: row.received_at instanceof Date ? row.received_at.toISOString() : row.received_at,
          daysInStorage: row.days_in_storage,
          supplierId: row.supplier_id,
          supplierName: row.supplier_name,
          customerId: row.customer_id,
          customerName: row.customer_name,
          customerMark: row.customer_mark,
          brand: row.brand,
          productId: row.product_id,
          product: { nameAr: row.name_ar, nameEn: row.name_en, nameCn: row.name_cn },
          cartons: stockCount(row.cartons),
          qty: stockCount(row.qty),
          cbm: toNumber(row.cbm),
        })),
      };
    });
  }
}

function movementFilters(warehouseId: string, filters: StockFilters, extra?: string) {
  const clauses = ['m.warehouse_id = $1'];
  const params: unknown[] = [warehouseId];
  if (extra) clauses.push(extra);
  if (filters.customerMark) { params.push(filters.customerMark); clauses.push(`c.shipping_mark = $${params.length}`); }
  if (filters.supplierId) { params.push(filters.supplierId); clauses.push(`m.supplier_id = $${params.length}`); }
  if (filters.brand) { params.push(filters.brand); clauses.push(`m.brand = $${params.length}`); }
  if (filters.productId) { params.push(filters.productId); clauses.push(`m.product_id = $${params.length}`); }
  return { where: clauses.join(' AND '), params };
}

function toNumber(value: string | number | null): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function stockCount(value: string | null): number | string | null {
  if (value === null) return null;
  const count = Number(value);
  return Number.isSafeInteger(count) ? count : value;
}

function movementPageSize(value: unknown): number {
  if (value === undefined) return MAX_MOVEMENT_PAGE_SIZE;
  if (typeof value !== 'string' || !/^[1-9]\d{0,2}$/.test(value) || Number(value) > MAX_MOVEMENT_PAGE_SIZE) {
    throw new BadRequestException(`limit must be an integer from 1 to ${MAX_MOVEMENT_PAGE_SIZE}`);
  }
  return Number(value);
}

function encodeMovementCursor(timestamp: string, id: string): string {
  return Buffer.from(JSON.stringify([timestamp, id])).toString('base64url');
}

function decodeMovementCursor(value: unknown): [string, string] | null {
  if (value === undefined) return null;
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,160}$/.test(value)) {
    throw new BadRequestException('Invalid movement cursor');
  }
  let parts: unknown;
  try {
    parts = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    throw new BadRequestException('Invalid movement cursor');
  }
  if (!Array.isArray(parts) || parts.length !== 2) throw new BadRequestException('Invalid movement cursor');
  const [timestamp, id] = parts;
  if (typeof timestamp !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(timestamp) || !isUuid(id)) {
    throw new BadRequestException('Invalid movement cursor');
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime()) || date.getUTCFullYear() === 0 || date.toISOString().slice(0, 19) !== timestamp.slice(0, 19)) {
    throw new BadRequestException('Invalid movement cursor');
  }
  return [timestamp, id];
}
