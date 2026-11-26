import { PoolClient } from 'pg';
import { ReportSheet } from './excel';
import { ReportFilters } from './filters';
import * as builders from './builders';

export type ReportKind =
  | 'goods_received'
  | 'goods_dispatched'
  | 'inventory'
  | 'stock_movements'
  | 'order_vs_received'
  | 'expenses'
  | 'purchase_order';

export interface ReportDefinition {
  kind: ReportKind;
  label: string;
  /** True when the report needs filters.orderId to select a single record. */
  requiresOrder?: boolean;
  build(client: PoolClient, warehouseId: string, filters: ReportFilters): Promise<ReportSheet>;
}

export const REPORTS: Record<ReportKind, ReportDefinition> = {
  goods_received: { kind: 'goods_received', label: 'Goods Received', build: builders.goodsReceived },
  goods_dispatched: { kind: 'goods_dispatched', label: 'Goods Dispatched', build: builders.goodsDispatched },
  inventory: { kind: 'inventory', label: 'Current Inventory', build: builders.inventory },
  stock_movements: { kind: 'stock_movements', label: 'Stock Movements', build: builders.stockMovements },
  order_vs_received: { kind: 'order_vs_received', label: 'Order vs Received', build: builders.orderVsReceived },
  expenses: { kind: 'expenses', label: 'Expenses', build: builders.expenses },
  purchase_order: { kind: 'purchase_order', label: 'Purchase Order', requiresOrder: true, build: builders.purchaseOrder },
};

export const REPORT_KINDS = Object.keys(REPORTS) as ReportKind[];

export function isReportKind(value: unknown): value is ReportKind {
  return typeof value === 'string' && value in REPORTS;
}
