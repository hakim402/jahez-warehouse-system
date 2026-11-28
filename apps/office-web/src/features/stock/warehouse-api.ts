import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { authenticatedJson } from '../../app/session';
import { useFindings, useReceivingQueue } from '../receiving/receiving-api';
import { useWarehouseScope } from '../../app/use-warehouse-scope';

export type { Finding } from '../receiving/receiving-api';

export type { QueueOrder } from '../receiving/receiving-api';

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

type Resource = 'queue' | 'findings' | 'balances' | 'age' | 'movements';

export function useWarehouseData(resources: Resource[] = ['queue', 'findings', 'balances', 'movements']) {
  const scope = useWarehouseScope();
  const id = scope.warehouseId;
  const enabled = (resource: Resource) => Boolean(id) && resources.includes(resource);
  const queue = useReceivingQueue(scope, enabled('queue'));
  const findings = useFindings(scope, 'open', enabled('findings'));
  const balances = useQuery({
    queryKey: scope.queryKey('warehouse-data', 'balances'), enabled: enabled('balances'), refetchInterval: 30_000,
    queryFn: async ({ signal }) => {
      const response = await authenticatedJson<{ warehouseId: string; balances: StockRow[] }>(
        '/stock?warehouseId=' + encodeURIComponent(id!), { signal });
      return response.balances;
    },
  });
  const age = useQuery({
    queryKey: scope.queryKey('warehouse-data', 'age'), enabled: enabled('age'), refetchInterval: 30_000,
    queryFn: async ({ signal }) => {
      const response = await authenticatedJson<{ warehouseId: string; age: StockRow[] }>(
        '/stock/age?warehouseId=' + encodeURIComponent(id!), { signal });
      return response.age;
    },
  });
  const movements = useInfiniteQuery({
    queryKey: scope.queryKey('warehouse-data', 'movements'), enabled: enabled('movements'), initialPageParam: null as string | null,
    refetchInterval: 30_000,
    queryFn: ({ signal, pageParam }) => authenticatedJson<MovementPage>(
      '/stock/movements?warehouseId=' + encodeURIComponent(id!) + '&limit=50' +
      (pageParam ? '&cursor=' + encodeURIComponent(pageParam) : ''), { signal }),
    getNextPageParam: (page, _pages, _param, params) =>
      page.nextCursor && !params.includes(page.nextCursor) ? page.nextCursor : undefined,
  });
  return { scope, queue, findings, balances, age, movements };
}
