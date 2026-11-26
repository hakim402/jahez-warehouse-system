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
import { RealtimeService } from '../realtime/realtime.service';
import { WarehouseChange } from '../sync/warehouse-change';
import { TenancyService } from '../tenancy/tenancy.service';
import { AuthenticatedUser, isOfficeRole, isUuid } from '../tenancy/types';

@Injectable()
export class ExpensesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly tenancy: TenancyService,
    private readonly realtime: RealtimeService,
  ) {}

  async listCategories(user: AuthenticatedUser) {
    this.requireOffice(user);
    return this.database.withTenant(user.tenantId, user.id, async (client) => {
      const result = await client.query(
        'SELECT * FROM expense_categories ORDER BY active DESC, name',
      );
      return { categories: result.rows.map(toCategory) };
    });
  }

  async createCategory(user: AuthenticatedUser, input: Record<string, unknown>) {
    this.requireOwner(user);
    const name = requireText(input.name, 'Name');
    const nameCn = optionalText(input.nameCn);
    return this.database.withTenant(user.tenantId, user.id, async (client) => {
      const inserted = await client.query(
        'INSERT INTO expense_categories (tenant_id, name, name_cn, created_by) VALUES ($1, $2, $3, $4) RETURNING *',
        [user.tenantId, name, nameCn, user.id],
      ).catch((error: { code?: string }) => {
        if (error.code === '23505') throw new ConflictException('Category name already exists');
        throw error;
      });
      const category = toCategory(inserted.rows[0]);
      await recordAudit(client, {
        tenantId: user.tenantId, userId: user.id, entity: 'expense_category', entityId: category.id,
        action: 'expense_category.create', after: category,
      });
      return category;
    });
  }

  async updateCategory(user: AuthenticatedUser, id: string, input: Record<string, unknown>) {
    this.requireOwner(user);
    const categoryId = requireUuid(id, 'Category id');
    const name = input.name === undefined ? undefined : requireText(input.name, 'Name');
    const nameCn = input.nameCn === undefined ? undefined : optionalText(input.nameCn);
    const active = input.active === undefined ? undefined : input.active;
    if (active !== undefined && typeof active !== 'boolean') throw new BadRequestException('Active must be a boolean');
    if (name === undefined && nameCn === undefined && active === undefined) {
      throw new BadRequestException('Nothing to update');
    }
    return this.database.withTenant(user.tenantId, user.id, async (client) => {
      const existing = await client.query('SELECT * FROM expense_categories WHERE id = $1', [categoryId]);
      if (existing.rowCount === 0) throw new NotFoundException('Category not found');
      const updated = await client.query(
        'UPDATE expense_categories SET name = $1, name_cn = $2, active = $3 WHERE id = $4 RETURNING *',
        [name ?? existing.rows[0].name, nameCn === undefined ? existing.rows[0].name_cn : nameCn, active ?? existing.rows[0].active, categoryId],
      ).catch((error: { code?: string }) => {
        if (error.code === '23505') throw new ConflictException('Category name already exists');
        throw error;
      });
      const category = toCategory(updated.rows[0]);
      await recordAudit(client, {
        tenantId: user.tenantId, userId: user.id, entity: 'expense_category', entityId: category.id,
        action: 'expense_category.update', before: toCategory(existing.rows[0]), after: category,
      });
      return category;
    });
  }

  async recordExpense(user: AuthenticatedUser, input: Record<string, unknown>) {
    this.requireOffice(user);
    const operationId = requireUuid(input.clientOperationId, 'Client operation id');
    const warehouseId = requireUuid(input.warehouseId, 'Warehouse id');
    const amount = requireAmount(input.amount);
    const currency = requireCurrency(input.currency);
    const expenseDate = requireDate(input.expenseDate);
    const categoryId = requireUuid(input.categoryId, 'Category id');
    const customerId = optionalUuid(input.customerId);
    const orderId = optionalUuid(input.orderId);
    const invoiceFileId = optionalUuid(input.invoiceFileId);
    const noInvoiceNote = optionalText(input.noInvoiceNote);
    if ((invoiceFileId === null) === (noInvoiceNote === null)) {
      throw new BadRequestException('Provide exactly one of invoiceFileId or noInvoiceNote');
    }
    const requestHash = createHash('sha256')
      .update(JSON.stringify({ warehouseId, amount, currency, expenseDate, categoryId, customerId, orderId, invoiceFileId, noInvoiceNote }))
      .digest('hex');

    const membership = await this.tenancy.findWarehouseAccess(user.id, warehouseId, user.tenantId);
    if (!membership) throw new ForbiddenException('Warehouse access denied');

    const { response, change } = await this.database.withTenant(user.tenantId, user.id, async (client) => {
      const claimed = await client.query(
        `INSERT INTO client_operations (tenant_id, operation_id, user_id, warehouse_id, kind, request_hash, created_by)
         VALUES ($1, $2, $3, $4, 'expense.create', $5, $3)
         ON CONFLICT (tenant_id, operation_id) DO NOTHING
         RETURNING id`,
        [user.tenantId, operationId, user.id, warehouseId, requestHash],
      );
      if (claimed.rowCount === 0) {
        const existing = await client.query<{ response: Record<string, unknown> | null }>(
          `SELECT response FROM client_operations
           WHERE operation_id = $1 AND user_id = $2 AND warehouse_id = $3
             AND kind = 'expense.create' AND request_hash = $4`,
          [operationId, user.id, warehouseId, requestHash],
        );
        const response = existing.rows[0]?.response;
        if (!response) throw new ConflictException('Client operation is already recorded for a different request');
        return { response, change: null };
      }

      const category = await client.query('SELECT id, active FROM expense_categories WHERE id = $1', [categoryId]);
      if (category.rowCount === 0) throw new NotFoundException('Category not found');
      if (!category.rows[0].active) throw new ConflictException('Category is not active');
      if (customerId) {
        const customer = await client.query("SELECT id FROM parties WHERE id = $1 AND type = 'customer'", [customerId]);
        if (customer.rowCount === 0) throw new NotFoundException('Customer not found');
      }
      if (orderId) {
        const order = await client.query('SELECT id FROM orders WHERE id = $1 AND warehouse_id = $2', [orderId, warehouseId]);
        if (order.rowCount === 0) throw new NotFoundException('Order not found in this warehouse');
      }
      if (invoiceFileId) {
        const file = await client.query(
          "SELECT id FROM files WHERE id = $1 AND warehouse_id = $2 AND purpose = 'expense_invoice'",
          [invoiceFileId, warehouseId],
        );
        if (file.rowCount === 0) throw new NotFoundException('Invoice file not found in this warehouse');
      }

      const counter = await client.query<{ next_value: string }>(
        `INSERT INTO document_counters (tenant_id, kind, next_value)
         VALUES ($1, 'expense', 1)
         ON CONFLICT (tenant_id, kind)
         DO UPDATE SET next_value = document_counters.next_value + 1
         RETURNING next_value`,
        [user.tenantId],
      );
      const expenseNo = `EXP-${String(counter.rows[0].next_value).padStart(6, '0')}`;

      const inserted = await client.query(
        `INSERT INTO expenses
           (tenant_id, warehouse_id, expense_no, amount, currency, expense_date, category_id,
            customer_id, order_id, invoice_file_id, no_invoice_note, recorded_by, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
         RETURNING *`,
        [user.tenantId, warehouseId, expenseNo, amount, currency, expenseDate, categoryId,
          customerId, orderId, invoiceFileId, noInvoiceNote, user.id],
      );
      const response = await this.loadExpenseResponse(client, inserted.rows[0].id);
      await client.query(
        'UPDATE client_operations SET response = $1 WHERE operation_id = $2',
        [JSON.stringify(response), operationId],
      );
      await recordAudit(client, {
        tenantId: user.tenantId, userId: user.id, warehouseId, entity: 'expense', entityId: response.id,
        action: 'expense.recorded', after: response,
      });
      // Expenses stay out of sync_changes because workers pull that feed; live delivery is office-only.
      const change: WarehouseChange = {
        tenantId: user.tenantId, warehouseId, entity: 'expense', entityId: response.id,
        action: 'expense.recorded', payload: response,
      };
      return { response, change };
    });
    if (change) this.realtime.publish(change);
    return response;
  }

  async listExpenses(user: AuthenticatedUser, warehouseId: string, query: Record<string, unknown>) {
    this.requireOffice(user);
    const warehouse = requireUuid(warehouseId, 'Warehouse id');
    const categoryId = optionalUuid(query.categoryId);
    const customerId = optionalUuid(query.customerId);
    const orderId = optionalUuid(query.orderId);
    const membership = await this.tenancy.findWarehouseAccess(user.id, warehouse, user.tenantId);
    if (!membership) throw new ForbiddenException('Warehouse access denied');
    return this.database.withTenant(user.tenantId, user.id, async (client) => {
      const clauses = ['e.warehouse_id = $1'];
      const params: unknown[] = [warehouse];
      if (categoryId) { params.push(categoryId); clauses.push(`e.category_id = $${params.length}`); }
      if (customerId) { params.push(customerId); clauses.push(`e.customer_id = $${params.length}`); }
      if (orderId) { params.push(orderId); clauses.push(`e.order_id = $${params.length}`); }
      const result = await client.query(
        `SELECT e.*, ec.name AS category_name, c.name AS customer_name, c.shipping_mark AS customer_mark, o.order_no
         FROM expenses e
         JOIN expense_categories ec ON ec.id = e.category_id
         LEFT JOIN parties c ON c.id = e.customer_id
         LEFT JOIN orders o ON o.id = e.order_id
         WHERE ${clauses.join(' AND ')}
         ORDER BY e.created_at DESC, e.id DESC
         LIMIT 200`,
        params,
      );
      return { warehouseId: warehouse, expenses: result.rows.map(toExpense) };
    });
  }

  async getExpense(user: AuthenticatedUser, id: string) {
    this.requireOffice(user);
    const expenseId = requireUuid(id, 'Expense id');
    return this.database.withTenant(user.tenantId, user.id, (client) => this.loadExpenseResponse(client, expenseId));
  }

  private async loadExpenseResponse(client: PoolClient, expenseId: string) {
    const result = await client.query(
      `SELECT e.*, ec.name AS category_name, c.name AS customer_name, c.shipping_mark AS customer_mark, o.order_no
       FROM expenses e
       JOIN expense_categories ec ON ec.id = e.category_id
       LEFT JOIN parties c ON c.id = e.customer_id
       LEFT JOIN orders o ON o.id = e.order_id
       WHERE e.id = $1`,
      [expenseId],
    );
    if (result.rowCount === 0) throw new NotFoundException('Expense not found');
    return toExpense(result.rows[0]);
  }

  private requireOffice(user: AuthenticatedUser) {
    if (!isOfficeRole(user.role)) throw new ForbiddenException('Expenses are restricted to the owner and trader');
  }

  private requireOwner(user: AuthenticatedUser) {
    if (user.role !== 'owner') throw new ForbiddenException('Only the owner can manage expense categories');
  }
}

function toCategory(row: any) {
  return { id: row.id, name: row.name, nameCn: row.name_cn, active: row.active };
}

function toExpense(row: any) {
  return {
    id: row.id,
    expenseNo: row.expense_no,
    warehouseId: row.warehouse_id,
    amount: Number(row.amount),
    currency: row.currency,
    expenseDate: row.expense_date instanceof Date ? row.expense_date.toISOString().slice(0, 10) : row.expense_date,
    categoryId: row.category_id,
    categoryName: row.category_name,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerMark: row.customer_mark,
    orderId: row.order_id,
    orderNo: row.order_no,
    invoiceFileId: row.invoice_file_id,
    noInvoiceNote: row.no_invoice_note,
    recordedBy: row.recorded_by,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  };
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

function requireText(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 200) {
    throw new BadRequestException(`${label} is required and must be at most 200 characters`);
  }
  return value.trim();
}

function optionalText(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > 2000) throw new BadRequestException('Invalid text field');
  return value.trim() || null;
}

function requireAmount(value: unknown): number {
  const text = typeof value === 'number' ? String(value) : value;
  if (typeof text !== 'string' || !/^\d+(\.\d{1,2})?$/.test(text)) {
    throw new BadRequestException('Amount must be a positive number with at most two decimal places');
  }
  const parsed = Number(text);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed >= 1_000_000_000_000) {
    throw new BadRequestException('Amount is out of range');
  }
  return parsed;
}

function requireCurrency(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Z]{3}$/.test(value)) {
    throw new BadRequestException('Currency must be a three-letter uppercase code');
  }
  return value;
}

function requireDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException('Expense date must be YYYY-MM-DD');
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException('Expense date must be a valid calendar date');
  }
  return value;
}