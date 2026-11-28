import { useQuery } from '@tanstack/react-query';
import { ApiError } from '../../api/client';
import { authenticatedJson } from '../../app/session';
import type { WarehouseScope } from '../../app/use-warehouse-scope';

export const importKinds = ['purchase', 'expense'] as const;
export type ImportKind = typeof importKinds[number];
export const importStatuses = ['queued', 'processing', 'draft', 'committed', 'failed'] as const;
export type ImportStatus = typeof importStatuses[number];
export type Field = { value: string | number | null; confidence: number; source: string | null };
export type ExtractedFields = Record<string, Field>;
export type LineKey = 'description' | 'brand' | 'size' | 'cartons' | 'qtyPerCarton' | 'unitPrice' | 'amount' | 'cbm';
export type ExtractedLine = Partial<Record<LineKey, Field>> & { productId?: string | null };
export type InvoiceReview = {
  supplierId?: string | null;
  customerId?: string | null;
  categoryId?: string | null;
  reviewedFields?: string[];
};
export type InvoiceImport = {
  id: string;
  warehouseId: string;
  kind: ImportKind;
  status: ImportStatus;
  sourceFileId: string;
  committedEntityId: string | null;
  draft: { header?: ExtractedFields; lines?: ExtractedLine[]; review?: InvoiceReview };
  unreviewedFields: string[];
  createdAt: string;
};
export type ReviewPatch = {
  header?: Record<string, string | number | null>;
  lines?: Record<string, string | number | null>[];
  review: InvoiceReview;
};

export const uploadPurpose = { purchase: 'invoice_source', expense: 'expense_invoice' } as const;
const active = (item?: InvoiceImport) => item?.status === 'queued' || item?.status === 'processing';
const stopPolling = (error: unknown) => error instanceof ApiError && [401, 403, 404].includes(error.status);
const importPath = (id: string) => '/imports/' + encodeURIComponent(id);

export async function listImports(warehouseId: string, signal?: AbortSignal) {
  const result = await authenticatedJson<{ warehouseId: string; imports: InvoiceImport[] }>(
    '/imports?' + new URLSearchParams({ warehouseId }), { signal },
  );
  if (result.warehouseId !== warehouseId) throw new ApiError(404);
  return result.imports;
}

export function useImports(scope: WarehouseScope) {
  return useQuery({
    queryKey: scope.queryKey('imports'),
    enabled: Boolean(scope.warehouseId),
    queryFn: ({ signal }) => listImports(scope.warehouseId!, signal),
    refetchOnMount: 'always',
    refetchInterval: ({ state }) => !stopPolling(state.error) && state.data?.some(active) ? 3000 : false,
  });
}

export function useImport(scope: WarehouseScope, id: string) {
  return useQuery({
    queryKey: scope.queryKey('import', id),
    enabled: Boolean(scope.warehouseId && id),
    queryFn: async ({ signal }) => {
      const item = await authenticatedJson<InvoiceImport>(importPath(id), { signal });
      if (item.warehouseId !== scope.warehouseId) throw new ApiError(404);
      return item;
    },
    refetchOnMount: 'always',
    refetchInterval: ({ state }) => !stopPolling(state.error) && active(state.data) ? 3000 : false,
  });
}

export function enqueueImport(warehouseId: string, kind: ImportKind, fileId: string) {
  return authenticatedJson<InvoiceImport>(kind === 'purchase' ? '/orders/extract' : '/expenses/extract', {
    method: 'POST', json: { warehouseId, fileId },
  });
}

export function saveReview(id: string, patch: ReviewPatch) {
  return authenticatedJson<InvoiceImport>(importPath(id), { method: 'PATCH', json: patch });
}

export function commitImport(id: string) {
  return authenticatedJson<{ status: 'committed'; orderId?: string; expenseId?: string }>(importPath(id) + '/commit', { method: 'POST' });
}

export function importedRecordPath(kind: ImportKind, id: string) {
  return kind === 'purchase' ? '/orders/' + encodeURIComponent(id) : '/expenses?' + new URLSearchParams({ expenseId: id });
}
