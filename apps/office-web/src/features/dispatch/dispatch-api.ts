import { useQuery } from '@tanstack/react-query';
import { ApiError } from '../../api/client';
import { authenticatedJson, useSession } from '../../app/session';
import { useOrderScope } from '../orders/order-api';

export type DispatchSummary = {
  id: string;
  dispatchNo: string;
  customerId: string;
  customerName: string | null;
  customerMark: string | null;
  destination: string | null;
  dispatchedAt: string;
  dispatchedBy: string;
  cartons: number;
  cbm: number | null;
  weightKg: number | null;
};

export type DispatchAllocation = {
  receiptLineId: string;
  receiptNo: string;
  receivedAt: string;
  cartons: number;
};

export type DispatchLine = {
  id: string;
  supplierId: string | null;
  supplierName: string | null;
  brand: string | null;
  productId: string | null;
  product: {
    nameAr: string | null;
    nameEn: string | null;
    nameCn: string | null;
    modelNo: string | null;
  };
  cartons: number;
  qty: number | null;
  cbm: number | null;
  weightKg: number | null;
  allocations: DispatchAllocation[];
};

export type DispatchDetail = {
  id: string;
  dispatchNo: string;
  warehouseId: string;
  status: 'confirmed';
  customerId: string;
  customerName: string | null;
  customerMark: string | null;
  destination: string | null;
  dispatchedAt: string;
  dispatchedBy: string;
  lines: DispatchLine[];
  totals: {
    cartons: number;
    cbm: number | null;
    weightKg: number | null;
  };
};

type DispatchListResponse = {
  warehouseId: string;
  dispatches: DispatchSummary[];
};

export function useDispatchScope() {
  const scope = useOrderScope();
  const { session } = useSession();
  const identity = [session?.user.tenantId, session?.user.id, scope.warehouseId ?? null] as const;

  return {
    ...scope,
    listKey: ['dispatch', ...identity] as const,
    detailKey: (id: string) => ['dispatch-detail', ...identity, id] as const,
  };
}

export function useDispatches(scope: ReturnType<typeof useDispatchScope>) {
  return useQuery({
    queryKey: scope.listKey,
    enabled: scope.canRead && Boolean(scope.warehouseId),
    refetchInterval: 30_000,
    queryFn: async ({ signal }) => {
      const warehouseId = scope.warehouseId;
      if (!warehouseId) throw new ApiError(404);
      const response = await authenticatedJson<DispatchListResponse>(
        '/dispatches?warehouseId=' + encodeURIComponent(warehouseId),
        { signal },
      );
      if (response.warehouseId !== warehouseId) throw new ApiError(404);
      return response.dispatches;
    },
  });
}

export function useDispatch(scope: ReturnType<typeof useDispatchScope>, id: string) {
  return useQuery({
    queryKey: scope.detailKey(id),
    enabled: scope.canRead && Boolean(scope.warehouseId) && Boolean(id),
    queryFn: async ({ signal }) => {
      const warehouseId = scope.warehouseId;
      if (!warehouseId) throw new ApiError(404);
      const dispatch = await authenticatedJson<DispatchDetail>(
        '/dispatches/' + encodeURIComponent(id),
        { signal },
      );
      // A valid dispatch from another assigned warehouse must not appear in this warehouse view.
      if (dispatch.warehouseId !== warehouseId) throw new ApiError(404);
      return dispatch;
    },
  });
}
