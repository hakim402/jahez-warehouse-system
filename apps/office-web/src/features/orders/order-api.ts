import { useQuery } from '@tanstack/react-query';
import { ApiError } from '../../api/client';
import { authenticatedJson } from '../../app/session';
import { useWarehouseScope, type WarehouseScope } from '../../app/use-warehouse-scope';

export const orderStatuses = ['draft', 'ready', 'partly_received', 'received', 'cancelled'] as const;
export type OrderStatus = typeof orderStatuses[number];
type Money = number | null;

export type OrderRow = {
  id: string;
  orderNo: string;
  warehouseId: string;
  status: OrderStatus;
  supplierId: string;
  customerId: string;
  orderDate: string | null;
  expectedDate: string | null;
  totalAmount: Money;
  currency: string | null;
};
export type OrderLine = {
  id: string;
  productId: string;
  cartons: number;
  qtyPerCarton: number;
  qty: number;
  unitPrice: Money;
  amount: Money;
  brand: string | null;
  size: string | null;
  cbm: number | null;
  weight: number | null;
};
export type FullOrder = OrderRow & { deposit: Money; lines: OrderLine[] };
type OrderLineInput = Pick<OrderLine, 'productId' | 'cartons' | 'qtyPerCarton' | 'brand' | 'size' | 'cbm' | 'weight'> & {
  unitPrice: string | null;
  amount: string | null;
};
export type DraftInput = {
  orderDate: string | null;
  expectedDate: string | null;
  currency: string | null;
  deposit: string | null;
  lines: OrderLineInput[];
};
export type NewOrderInput = DraftInput & {
  warehouseId: string;
  supplierId: string;
  customerId: string;
  orderNo?: string;
};

export function useOrderScope() {
  const scope = useWarehouseScope();
  return {
    ...scope,
    listKey: scope.queryKey('orders'),
    detailKey: (id: string) => scope.queryKey('order', id),
  };
}

export function useOrders(scope: WarehouseScope, enabled = true) {
  const query = scope.warehouseId ? '?warehouseId=' + encodeURIComponent(scope.warehouseId) : '';
  return useQuery({
    queryKey: scope.queryKey('orders'), enabled: scope.canRead && enabled,
    queryFn: ({ signal }) => authenticatedJson<OrderRow[]>('/orders' + query, { signal }),
  });
}

export function useOrder(scope: WarehouseScope, id: string) {
  return useQuery({
    queryKey: scope.queryKey('order', id), enabled: scope.canRead && Boolean(id),
    queryFn: async ({ signal }) => {
      const order = await authenticatedJson<FullOrder>('/orders/' + encodeURIComponent(id), { signal });
      if (scope.warehouseId && order.warehouseId !== scope.warehouseId) throw new ApiError(404);
      return order;
    },
  });
}

export function createOrder(input: NewOrderInput) {
  return authenticatedJson<FullOrder>('/orders', { method: 'POST', json: input });
}

export function updateOrder(id: string, input: DraftInput) {
  return authenticatedJson<FullOrder>('/orders/' + encodeURIComponent(id), { method: 'PATCH', json: input });
}

export function changeOrderStatus(id: string, action: 'confirm' | 'cancel') {
  return authenticatedJson<FullOrder>('/orders/' + encodeURIComponent(id) + '/' + action, { method: 'POST' });
}
