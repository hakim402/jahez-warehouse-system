import { useQuery } from '@tanstack/react-query';
import { ApiError } from '../../api/client';
import { authenticatedJson } from '../../app/session';
import { listOfficeFiles, type OfficeFile } from '../files/files-api';
import { useWarehouseScope } from '../../app/use-warehouse-scope';

export type QueueOrder = {
  id: string; orderNo: string; status: 'ready' | 'partly_received'; expectedDate: string | null;
  supplier: { name: string; nameCn: string | null }; customer: { name: string; shippingMark: string | null };
  expectedCartons: number; remainingCartons: number;
};
export function useReceivingQueue(scope: ReturnType<typeof useWarehouseScope>, enabled = true) {
  return useQuery({
    queryKey: scope.queryKey('receiving-queue'),
    enabled: enabled && scope.canRead && Boolean(scope.warehouseId), refetchInterval: 30_000,
    queryFn: ({ signal }) => authenticatedJson<QueueOrder[]>(
      '/orders/awaiting?warehouseId=' + encodeURIComponent(scope.warehouseId!), { signal }),
  });
}

export type FindingType = 'missing' | 'extra' | 'wrong' | 'damaged' | 'cbm' | 'weight';
export type FindingStatus = 'open' | 'resolved';

export type Finding = {
  id: string;
  warehouseId: string;
  receiptId: string;
  receiptLineId: string | null;
  orderLineId: string | null;
  type: FindingType;
  expected: number | null;
  actual: number | null;
  status: FindingStatus;
  resolvedBy: string | null;
  note: string | null;
};

export type ReceiptLine = {
  id: string;
  orderLineId: string | null;
  productId: string;
  brand: string | null;
  size: string | null;
  cartons: number;
  qty: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  cbm: number | null;
  weightKg: number | null;
  condition: 'ok' | 'damaged';
};

export type ReceiptFinding = {
  id: string;
  receiptLineId: string | null;
  orderLineId: string | null;
  type: FindingType;
  expected: number | null;
  actual: number | null;
  status: FindingStatus;
  note: string | null;
};

export type ReceiptDetail = {
  id: string;
  receiptNo: string;
  orderId: string;
  warehouseId: string;
  status: string;
  receivedAt: string;
  receivedBy: string;
  orderStatus: string | null;
  lines: ReceiptLine[];
  findings: ReceiptFinding[];
  stockMovements: Array<{
    id: string;
    productId: string;
    cartons: number;
    qty: number | null;
    cbm: number | null;
    kind: string;
  }>;
};

export function useFindings(scope: ReturnType<typeof useWarehouseScope>, status: FindingStatus, enabled = true) {
  return useQuery({
    queryKey: scope.queryKey('findings', status),
    enabled: enabled && scope.canRead && Boolean(scope.warehouseId),
    refetchInterval: 30_000,
    queryFn: async ({ signal }) => {
      const rows = await authenticatedJson<Finding[]>('/findings?status=' + status, { signal });
      return rows.filter((row) => row.warehouseId === scope.warehouseId);
    },
  });
}

export function resolveFinding(id: string, note: string) {
  return authenticatedJson<Finding>('/findings/' + encodeURIComponent(id), {
    method: 'PATCH', json: { status: 'resolved', note },
  });
}

export function useReceipt(scope: ReturnType<typeof useWarehouseScope>, receiptId: string) {
  return useQuery({
    queryKey: scope.queryKey('receipt', receiptId),
    enabled: scope.canRead && Boolean(receiptId),
    queryFn: async ({ signal }) => {
      const receipt = await authenticatedJson<ReceiptDetail>('/receipts/' + encodeURIComponent(receiptId), { signal });
      if (scope.warehouseId && receipt.warehouseId !== scope.warehouseId) throw new ApiError(404);
      return receipt;
    },
  });
}

export function useReceiptEvidence(
  scope: ReturnType<typeof useWarehouseScope>,
  receipt: ReceiptDetail | undefined,
) {
  const lineIds = receipt?.lines.map((line) => line.id).join(',') ?? '';
  return useQuery({
    queryKey: scope.queryKey('receipt-files', receipt?.id, lineIds),
    enabled: scope.canRead && Boolean(receipt && scope.warehouseId),
    queryFn: async ({ signal }) => {
      const warehouseId = scope.warehouseId!;
      const [receiptFiles, ...lineFiles] = await Promise.all([
        listOfficeFiles(warehouseId, { entityType: 'receipt', entityId: receipt!.id }, signal),
        ...receipt!.lines.map((line) => listOfficeFiles(
          warehouseId, { entityType: 'receipt_line', entityId: line.id }, signal,
        )),
      ]);
      const files = [...receiptFiles.files, ...lineFiles.flatMap((result) => result.files)];
      return Array.from(new Map(files.map((file) => [file.id, file])).values()) as OfficeFile[];
    },
  });
}
