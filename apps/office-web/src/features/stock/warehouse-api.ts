import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { authenticatedJson, useSession } from '../../app/session';
import type { Finding } from '../receiving/receiving-api';
import { useOrderScope } from '../orders/order-api';

export type { Finding } from '../receiving/receiving-api';

export type QueueOrder = {
  id: string; orderNo: string; status: 'ready' | 'partly_received'; expectedDate: string | null;
  supplier: { name: string; nameCn: string | null }; customer: { name: string; shippingMark: string | null };
  expectedCartons: number; remainingCartons: number;
};
export type StockRow = {
  id?: string;
  warehouseId?: string;
  supplierId: string | null; supplierName: string | null;
  customerId: string | null; customerName: string | null; customerMark: string | null;
  brand: string | null; productId: string | null;
  product: { nameEn: string | null; nameAr: string | null; nameCn: string | null; modelNo?: string | null };
  cartons: string | number; qty: string | number | null; cbm: number | null;
  receiptId?: string | null; receiptNo?: string | null; daysInStorage?: number; createdAt?: string; kind?: string;
  dispatchId?: string | null; dispatchNo?: string | null;
  adjustmentId?: string | null; adjustmentNo?: string | null; adjustmentReason?: string | null;
};
export type Movement = StockRow & {
  id: string;
  kind: string;
  createdAt: string;
  receiptLineId: string | null;
  dispatchId: string | null;
  dispatchNo: string | null;
  adjustmentId: string | null;
  adjustmentNo: string | null;
  adjustmentReason: string | null;
  receivedAt: string | null;
  createdBy: string;
};
type MovementPage = { warehouseId: string; movements: Movement[]; nextCursor: string | null };

export function useWarehouseData() {
  const scope = useOrderScope();
  const { session } = useSession();
  const id = scope.warehouseId;
  const queryKey = ['warehouse-data', session?.user.tenantId, session?.user.id, id] as const;
  const query = useQuery({
    queryKey, enabled: Boolean(id), refetchInterval: 30_000,
    queryFn: async ({ signal }) => {
      const suffix = '?warehouseId=' + encodeURIComponent(id!);
      const [queue, findings, balances, age] = await Promise.all([
        authenticatedJson<QueueOrder[]>('/orders/awaiting' + suffix, { signal }),
        authenticatedJson<Finding[]>('/findings?status=open', { signal }),
        authenticatedJson<{ warehouseId: string; balances: StockRow[] }>('/stock' + suffix, { signal }),
        authenticatedJson<{ warehouseId: string; age: StockRow[] }>('/stock/age' + suffix, { signal }),
      ]);
      return { queue, findings: findings.filter((item) => item.warehouseId === id), balances: balances.balances, age: age.age };
    },
  });
  const movements = useInfiniteQuery({
    queryKey: [...queryKey, 'movements'], enabled: Boolean(id), initialPageParam: null as string | null,
    refetchInterval: 30_000,
    queryFn: ({ signal, pageParam }) => authenticatedJson<MovementPage>(
      '/stock/movements?warehouseId=' + encodeURIComponent(id!) + '&limit=50' +
      (pageParam ? '&cursor=' + encodeURIComponent(pageParam) : ''), { signal }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  return { scope, query, movements };
}
