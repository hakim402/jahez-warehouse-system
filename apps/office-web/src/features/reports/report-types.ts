export type ReportFilters = Partial<Record<'from' | 'to' | 'customerId' | 'supplierId' | 'orderId', string>>;

export const reportDefinitions = {
  goods_received: { label: 'reportReceived', fields: ['from', 'to', 'customerId', 'supplierId'] },
  goods_dispatched: { label: 'reportDispatched', fields: ['from', 'to', 'customerId'] },
  inventory: { label: 'reportInventory', fields: ['customerId', 'supplierId'] },
  stock_movements: { label: 'reportMovements', fields: ['from', 'to', 'customerId', 'supplierId'] },
  order_vs_received: { label: 'reportComparison', fields: ['from', 'to', 'customerId', 'supplierId', 'orderId'] },
  expenses: { label: 'expenses', fields: ['from', 'to', 'customerId', 'orderId'] },
  purchase_order: { label: 'reportOrder', fields: ['orderId'] },
} as const satisfies Record<string, { label: string; fields: readonly (keyof ReportFilters)[] }>;

export type ReportKind = keyof typeof reportDefinitions;
export const reportKinds = Object.keys(reportDefinitions) as ReportKind[];
export const exportStatuses = ['queued', 'processing', 'completed', 'failed'] as const;
export type ExportStatus = typeof exportStatuses[number];

export type ExportJob = {
  id: string;
  warehouseId: string;
  kind: ReportKind;
  filters: ReportFilters;
  status: ExportStatus;
  createdAt: string;
  fileName: string | null;
};

export function reportFilters(kind: ReportKind, draft: ReportFilters): ReportFilters {
  const fields: readonly (keyof ReportFilters)[] = reportDefinitions[kind].fields;
  return Object.fromEntries(fields.flatMap(field => draft[field] ? [[field, draft[field]]] : []));
}
