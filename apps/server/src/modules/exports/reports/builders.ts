import { PoolClient } from 'pg';
import { CBM_FORMAT, MONEY_FORMAT, QTY_FORMAT, ReportSheet, WEIGHT_FORMAT } from './excel';
import { FilterQuery, ReportFilters } from './filters';

type Rows = Record<string, unknown>[];

const num = (value: unknown): number => (value === null || value === undefined ? 0 : Number(value));
const text = (value: unknown): string => (value === null || value === undefined ? '' : String(value));
const dateOnly = (value: unknown): string => (value instanceof Date ? value.toISOString().slice(0, 10) : text(value).slice(0, 10));
const photoLink = (fileId: unknown): string => (fileId ? `/api/v1/files/${fileId}/content` : '');

async function query(client: PoolClient, sql: string, params: unknown[]): Promise<Rows> {
  const result = await client.query(sql, params);
  return result.rows as Rows;
}

// -- Goods received: one row per receipt line, with authorized photo links. -----------------------
export async function goodsReceived(client: PoolClient, warehouseId: string, filters: ReportFilters): Promise<ReportSheet> {
  const q = new FilterQuery('r.warehouse_id', warehouseId)
    .dateRange('r.received_at', filters)
    .uuid('r.customer_id', filters.customerId)
    .uuid('r.supplier_id', filters.supplierId);
  const rows = await query(client, `
    SELECT r.receipt_no, r.received_at, c.shipping_mark AS customer_mark, s.name AS supplier_name,
           p.name_en AS product, rl.brand, rl.size, rl.cartons, rl.qty, rl.cbm, rl.weight_kg,
           u.name AS worker,
           (SELECT string_agg('/api/v1/files/' || f.id || '/content', ', ' ORDER BY f.created_at)
              FROM files f WHERE f.entity_type = 'receipt' AND f.entity_id = r.id) AS photo_links
    FROM receipts r
    JOIN receipt_lines rl ON rl.receipt_id = r.id
    LEFT JOIN parties c ON c.id = r.customer_id
    LEFT JOIN parties s ON s.id = r.supplier_id
    LEFT JOIN products p ON p.id = rl.product_id
    LEFT JOIN users u ON u.id = r.received_by
    ${q.where()}
    ORDER BY r.received_at, r.receipt_no, rl.id`, q.params);
  const mapped = rows.map((r) => ({
    receiptNo: r.receipt_no, receivedAt: dateOnly(r.received_at), customerMark: text(r.customer_mark),
    supplier: text(r.supplier_name), product: text(r.product), brand: text(r.brand), size: text(r.size),
    cartons: num(r.cartons), qty: num(r.qty), cbm: num(r.cbm), weightKg: num(r.weight_kg),
    worker: text(r.worker), photoLinks: text(r.photo_links),
  }));
  return {
    columns: [
      { header: 'Receipt No', key: 'receiptNo', width: 16 },
      { header: 'Date', key: 'receivedAt', width: 12 },
      { header: 'Customer Mark', key: 'customerMark', width: 18 },
      { header: 'Supplier', key: 'supplier', width: 22 },
      { header: 'Product', key: 'product', width: 24 },
      { header: 'Brand', key: 'brand', width: 14 },
      { header: 'Size', key: 'size', width: 12 },
      { header: 'Cartons', key: 'cartons', numFmt: QTY_FORMAT },
      { header: 'Qty', key: 'qty', numFmt: QTY_FORMAT },
      { header: 'CBM', key: 'cbm', numFmt: CBM_FORMAT },
      { header: 'Weight (kg)', key: 'weightKg', numFmt: WEIGHT_FORMAT },
      { header: 'Worker', key: 'worker', width: 16 },
      { header: 'Photo Links', key: 'photoLinks', width: 40 },
    ],
    rows: mapped,
    totals: sum(mapped, { cartons: 'cartons', qty: 'qty', cbm: 'cbm', weightKg: 'weightKg' }, 'receiptNo'),
  };
}

// -- Goods dispatched: one row per dispatch line; doubles as the packing list. --------------------
export async function goodsDispatched(client: PoolClient, warehouseId: string, filters: ReportFilters): Promise<ReportSheet> {
  const q = new FilterQuery('d.warehouse_id', warehouseId)
    .dateRange('d.dispatched_at', filters)
    .uuid('d.customer_id', filters.customerId);
  const rows = await query(client, `
    SELECT d.dispatch_no, d.dispatched_at, d.destination, c.shipping_mark AS customer_mark,
           p.name_en AS product, dl.brand, dl.cartons, dl.qty, dl.cbm, dl.weight_kg, u.name AS dispatched_by
    FROM dispatches d
    JOIN dispatch_lines dl ON dl.dispatch_id = d.id
    LEFT JOIN parties c ON c.id = d.customer_id
    LEFT JOIN products p ON p.id = dl.product_id
    LEFT JOIN users u ON u.id = d.dispatched_by
    ${q.where()}
    ORDER BY d.dispatched_at, d.dispatch_no, dl.id`, q.params);
  const mapped = rows.map((r) => ({
    dispatchNo: r.dispatch_no, dispatchedAt: dateOnly(r.dispatched_at), customerMark: text(r.customer_mark),
    destination: text(r.destination), product: text(r.product), brand: text(r.brand),
    cartons: num(r.cartons), qty: num(r.qty), cbm: num(r.cbm), weightKg: num(r.weight_kg),
    dispatchedBy: text(r.dispatched_by),
  }));
  return {
    columns: [
      { header: 'Dispatch No', key: 'dispatchNo', width: 16 },
      { header: 'Date', key: 'dispatchedAt', width: 12 },
      { header: 'Customer Mark', key: 'customerMark', width: 18 },
      { header: 'Destination', key: 'destination', width: 20 },
      { header: 'Product', key: 'product', width: 24 },
      { header: 'Brand', key: 'brand', width: 14 },
      { header: 'Cartons', key: 'cartons', numFmt: QTY_FORMAT },
      { header: 'Qty', key: 'qty', numFmt: QTY_FORMAT },
      { header: 'CBM', key: 'cbm', numFmt: CBM_FORMAT },
      { header: 'Weight (kg)', key: 'weightKg', numFmt: WEIGHT_FORMAT },
      { header: 'Dispatched By', key: 'dispatchedBy', width: 16 },
    ],
    rows: mapped,
    totals: sum(mapped, { cartons: 'cartons', qty: 'qty', cbm: 'cbm', weightKg: 'weightKg' }, 'dispatchNo'),
  };
}

// -- Current inventory: movement balance per customer mark, supplier, brand, product. -------------
export async function inventory(client: PoolClient, warehouseId: string, filters: ReportFilters): Promise<ReportSheet> {
  const q = new FilterQuery('m.warehouse_id', warehouseId)
    .uuid('m.customer_id', filters.customerId)
    .uuid('m.supplier_id', filters.supplierId);
  const rows = await query(client, `
    SELECT c.shipping_mark AS customer_mark, s.name AS supplier_name, m.brand, p.name_en AS product,
           SUM(m.cartons) AS cartons, SUM(m.qty) AS qty, SUM(m.cbm) AS cbm, MIN(m.created_at) AS first_in
    FROM stock_movements m
    LEFT JOIN parties c ON c.id = m.customer_id
    LEFT JOIN parties s ON s.id = m.supplier_id
    LEFT JOIN products p ON p.id = m.product_id
    ${q.where()}
    GROUP BY m.customer_id, m.supplier_id, m.product_id, m.brand, c.shipping_mark, s.name, p.name_en
    HAVING SUM(m.cartons) <> 0
    ORDER BY c.shipping_mark NULLS LAST, p.name_en NULLS LAST`, q.params);
  const now = Date.now();
  const mapped = rows.map((r) => ({
    customerMark: text(r.customer_mark), supplier: text(r.supplier_name), brand: text(r.brand),
    product: text(r.product), cartons: num(r.cartons), qty: num(r.qty), cbm: num(r.cbm),
    daysInStorage: r.first_in instanceof Date ? Math.max(0, Math.floor((now - r.first_in.getTime()) / 86_400_000)) : 0,
  }));
  return {
    columns: [
      { header: 'Customer Mark', key: 'customerMark', width: 18 },
      { header: 'Supplier', key: 'supplier', width: 22 },
      { header: 'Brand', key: 'brand', width: 14 },
      { header: 'Product', key: 'product', width: 24 },
      { header: 'Cartons', key: 'cartons', numFmt: QTY_FORMAT },
      { header: 'Qty', key: 'qty', numFmt: QTY_FORMAT },
      { header: 'CBM', key: 'cbm', numFmt: CBM_FORMAT },
      { header: 'Days in Storage', key: 'daysInStorage', numFmt: QTY_FORMAT },
    ],
    rows: mapped,
    totals: sum(mapped, { cartons: 'cartons', qty: 'qty', cbm: 'cbm' }, 'customerMark'),
  };
}

// -- Stock movements: every receipt, dispatch, and adjustment with date and user. -----------------
export async function stockMovements(client: PoolClient, warehouseId: string, filters: ReportFilters): Promise<ReportSheet> {
  const q = new FilterQuery('m.warehouse_id', warehouseId)
    .dateRange('m.created_at', filters)
    .uuid('m.customer_id', filters.customerId)
    .uuid('m.supplier_id', filters.supplierId);
  const rows = await query(client, `
    SELECT m.created_at, m.kind, m.cartons, m.qty, m.cbm, c.shipping_mark AS customer_mark,
           s.name AS supplier_name, p.name_en AS product, u.name AS user_name,
           r.receipt_no, d.dispatch_no, a.adjustment_no, a.reason AS adjustment_reason
    FROM stock_movements m
    LEFT JOIN parties c ON c.id = m.customer_id
    LEFT JOIN parties s ON s.id = m.supplier_id
    LEFT JOIN products p ON p.id = m.product_id
    LEFT JOIN users u ON u.id = m.created_by
    LEFT JOIN receipts r ON r.id = m.ref_id AND m.kind = 'receipt'
    LEFT JOIN dispatches d ON d.id = m.ref_id AND m.kind = 'dispatch'
    LEFT JOIN stock_adjustments a ON a.id = m.ref_id AND m.kind = 'adjust'
    ${q.where()}
    ORDER BY m.created_at, m.id`, q.params);
  const mapped = rows.map((r) => ({
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : text(r.created_at),
    kind: text(r.kind), reference: text(r.receipt_no ?? r.dispatch_no ?? r.adjustment_no),
    customerMark: text(r.customer_mark), supplier: text(r.supplier_name), product: text(r.product),
    cartons: num(r.cartons), qty: num(r.qty), cbm: num(r.cbm),
    user: text(r.user_name), reason: text(r.adjustment_reason),
  }));
  return {
    columns: [
      { header: 'Timestamp', key: 'createdAt', width: 24 },
      { header: 'Kind', key: 'kind', width: 12 },
      { header: 'Reference', key: 'reference', width: 16 },
      { header: 'Customer Mark', key: 'customerMark', width: 18 },
      { header: 'Supplier', key: 'supplier', width: 22 },
      { header: 'Product', key: 'product', width: 24 },
      { header: 'Cartons', key: 'cartons', numFmt: QTY_FORMAT },
      { header: 'Qty', key: 'qty', numFmt: QTY_FORMAT },
      { header: 'CBM', key: 'cbm', numFmt: CBM_FORMAT },
      { header: 'User', key: 'user', width: 16 },
      { header: 'Reason', key: 'reason', width: 20 },
    ],
    rows: mapped,
    totals: sum(mapped, { cartons: 'cartons', qty: 'qty', cbm: 'cbm' }, 'createdAt'),
  };
}

// -- Order vs received: per ordered line, ordered vs received and difference. ---------------------
export async function orderVsReceived(client: PoolClient, warehouseId: string, filters: ReportFilters): Promise<ReportSheet> {
  const q = new FilterQuery('o.warehouse_id', warehouseId)
    .dateRange('o.order_date', filters)
    .uuid('o.customer_id', filters.customerId)
    .uuid('o.supplier_id', filters.supplierId)
    .uuid('o.id', filters.orderId);
  const rows = await query(client, `
    SELECT o.order_no, o.status AS order_status, p.name_en AS product, ol.brand, ol.size,
           ol.cartons AS ordered_cartons, ol.qty AS ordered_qty, ol.cbm AS ordered_cbm,
           COALESCE(SUM(rl.cartons), 0) AS received_cartons, COALESCE(SUM(rl.qty), 0) AS received_qty
    FROM orders o
    JOIN order_lines ol ON ol.order_id = o.id
    LEFT JOIN products p ON p.id = ol.product_id
    LEFT JOIN receipt_lines rl ON rl.order_line_id = ol.id
    ${q.where()}
    GROUP BY o.order_no, o.status, p.name_en, ol.brand, ol.size, ol.id, ol.cartons, ol.qty, ol.cbm
    ORDER BY o.order_no, ol.id`, q.params);
  const mapped = rows.map((r) => {
    const ordered = num(r.ordered_cartons);
    const received = num(r.received_cartons);
    return {
      orderNo: r.order_no, orderStatus: text(r.order_status), product: text(r.product),
      brand: text(r.brand), size: text(r.size), orderedCartons: ordered, orderedQty: num(r.ordered_qty),
      receivedCartons: received, receivedQty: num(r.received_qty), difference: received - ordered,
      lineStatus: received === 0 ? 'pending' : received < ordered ? 'partial' : received === ordered ? 'complete' : 'extra',
    };
  });
  return {
    columns: [
      { header: 'Order No', key: 'orderNo', width: 16 },
      { header: 'Order Status', key: 'orderStatus', width: 14 },
      { header: 'Product', key: 'product', width: 24 },
      { header: 'Brand', key: 'brand', width: 14 },
      { header: 'Size', key: 'size', width: 12 },
      { header: 'Ordered Cartons', key: 'orderedCartons', numFmt: QTY_FORMAT },
      { header: 'Ordered Qty', key: 'orderedQty', numFmt: QTY_FORMAT },
      { header: 'Received Cartons', key: 'receivedCartons', numFmt: QTY_FORMAT },
      { header: 'Received Qty', key: 'receivedQty', numFmt: QTY_FORMAT },
      { header: 'Difference', key: 'difference', numFmt: QTY_FORMAT },
      { header: 'Line Status', key: 'lineStatus', width: 12 },
    ],
    rows: mapped,
    totals: sum(mapped, { orderedCartons: 'orderedCartons', receivedCartons: 'receivedCartons', difference: 'difference' }, 'orderNo'),
  };
}

// -- Expenses: date, category, amount, linked customer or order, invoice evidence. ----------------
export async function expenses(client: PoolClient, warehouseId: string, filters: ReportFilters): Promise<ReportSheet> {
  const q = new FilterQuery('e.warehouse_id', warehouseId)
    .dateRange('e.expense_date', filters)
    .uuid('e.customer_id', filters.customerId)
    .uuid('e.order_id', filters.orderId);
  const rows = await query(client, `
    SELECT e.expense_no, e.expense_date, ec.name AS category, e.amount, e.currency,
           c.name AS customer_name, c.shipping_mark AS customer_mark, o.order_no,
           e.invoice_file_id, e.no_invoice_note, u.name AS recorded_by
    FROM expenses e
    JOIN expense_categories ec ON ec.id = e.category_id
    LEFT JOIN parties c ON c.id = e.customer_id
    LEFT JOIN orders o ON o.id = e.order_id
    LEFT JOIN users u ON u.id = e.recorded_by
    ${q.where()}
    ORDER BY e.expense_date, e.expense_no`, q.params);
  const mapped = rows.map((r) => ({
    expenseNo: r.expense_no, expenseDate: dateOnly(r.expense_date), category: text(r.category),
    amount: num(r.amount), currency: text(r.currency), customerMark: text(r.customer_mark),
    customer: text(r.customer_name), orderNo: text(r.order_no),
    evidence: r.invoice_file_id ? photoLink(r.invoice_file_id) : text(r.no_invoice_note),
    recordedBy: text(r.recorded_by),
  }));
  return {
    columns: [
      { header: 'Expense No', key: 'expenseNo', width: 16 },
      { header: 'Date', key: 'expenseDate', width: 12 },
      { header: 'Category', key: 'category', width: 16 },
      { header: 'Amount', key: 'amount', numFmt: MONEY_FORMAT },
      { header: 'Currency', key: 'currency', width: 10 },
      { header: 'Customer Mark', key: 'customerMark', width: 18 },
      { header: 'Customer', key: 'customer', width: 22 },
      { header: 'Order No', key: 'orderNo', width: 16 },
      { header: 'Invoice / Note', key: 'evidence', width: 36 },
      { header: 'Recorded By', key: 'recordedBy', width: 16 },
    ],
    rows: mapped,
    totals: sum(mapped, { amount: 'amount' }, 'expenseNo'),
  };
}

// -- Purchase order: the client's trilingual order sheet for one order. ---------------------------
export async function purchaseOrder(client: PoolClient, warehouseId: string, filters: ReportFilters): Promise<ReportSheet> {
  const q = new FilterQuery('o.warehouse_id', warehouseId).uuid('o.id', filters.orderId);
  const rows = await query(client, `
    SELECT o.order_no, o.order_date, o.currency, s.name AS supplier_name, s.name_cn AS supplier_cn,
           c.name AS customer_name, p.name_en, p.name_ar, p.name_cn, p.model_no, p.photo_url,
           ol.brand, ol.size, ol.cartons, ol.qty_per_carton, ol.qty, ol.unit_price, ol.amount, ol.cbm, ol.weight
    FROM orders o
    JOIN order_lines ol ON ol.order_id = o.id
    LEFT JOIN parties s ON s.id = o.supplier_id
    LEFT JOIN parties c ON c.id = o.customer_id
    LEFT JOIN products p ON p.id = ol.product_id
    ${q.where()}
    ORDER BY ol.id`, q.params);
  const mapped = rows.map((r) => ({
    orderNo: r.order_no, supplier: text(r.supplier_name), supplierCn: text(r.supplier_cn),
    customer: text(r.customer_name), nameEn: text(r.name_en), nameAr: text(r.name_ar), nameCn: text(r.name_cn),
    modelNo: text(r.model_no), brand: text(r.brand), size: text(r.size),
    cartons: num(r.cartons), qtyPerCarton: num(r.qty_per_carton), qty: num(r.qty),
    unitPrice: num(r.unit_price), amount: num(r.amount), cbm: num(r.cbm), weight: num(r.weight),
    photoUrl: text(r.photo_url),
  }));
  return {
    columns: [
      { header: 'Order No', key: 'orderNo', width: 16 },
      { header: 'Supplier', key: 'supplier', width: 20 },
      { header: '供应商', key: 'supplierCn', width: 20 },
      { header: 'Customer', key: 'customer', width: 20 },
      { header: 'Product (EN)', key: 'nameEn', width: 22 },
      { header: 'المنتج (AR)', key: 'nameAr', width: 22 },
      { header: '产品 (CN)', key: 'nameCn', width: 22 },
      { header: 'Model', key: 'modelNo', width: 14 },
      { header: 'Brand', key: 'brand', width: 14 },
      { header: 'Size', key: 'size', width: 12 },
      { header: 'Cartons', key: 'cartons', numFmt: QTY_FORMAT },
      { header: 'Qty/Carton', key: 'qtyPerCarton', numFmt: QTY_FORMAT },
      { header: 'Qty', key: 'qty', numFmt: QTY_FORMAT },
      { header: 'Unit Price', key: 'unitPrice', numFmt: MONEY_FORMAT },
      { header: 'Amount', key: 'amount', numFmt: MONEY_FORMAT },
      { header: 'CBM', key: 'cbm', numFmt: CBM_FORMAT },
      { header: 'Weight (kg)', key: 'weight', numFmt: WEIGHT_FORMAT },
      { header: 'Photo', key: 'photoUrl', width: 30 },
    ],
    rows: mapped,
    totals: sum(mapped, { cartons: 'cartons', qty: 'qty', amount: 'amount', cbm: 'cbm', weight: 'weight' }, 'orderNo'),
  };
}

/** Builds a totals row: the label goes under `labelKey`, each numeric column is summed. */
function sum(rows: Record<string, unknown>[], columns: Record<string, string>, labelKey: string): Record<string, unknown> {
  const totals: Record<string, unknown> = { [labelKey]: 'TOTAL' };
  for (const [key, source] of Object.entries(columns)) {
    totals[key] = rows.reduce((acc, row) => acc + (Number(row[source]) || 0), 0);
  }
  return totals;
}
