import { useQuery } from '@tanstack/react-query';
import { ApiError } from '../api/client';
import { authenticatedJson, useSession } from './session';

type Warehouse = { id: string; tenantId: string; name: string; code: string };
const warehouseId = import.meta.env.VITE_DEFAULT_WAREHOUSE_ID?.trim();

export function useActiveWarehouse() {
  const { session } = useSession();
  const query = useQuery({
    queryKey: ['warehouse', session?.user.tenantId, session?.user.id, warehouseId],
    enabled: Boolean(session && warehouseId),
    queryFn: async ({ signal }) => {
      const warehouse = await authenticatedJson<Warehouse>(
        '/warehouses/' + encodeURIComponent(warehouseId!), { signal },
      );
      if (warehouse.tenantId !== session?.user.tenantId || warehouse.id !== warehouseId) {
        throw new ApiError(403);
      }
      return warehouse;
    },
  });

  const denied = query.error instanceof ApiError && [403, 404].includes(query.error.status);
  return {
    configuredId: warehouseId || undefined,
    warehouse: query.isError ? undefined : query.data,
    title: !warehouseId ? 'noWarehouse' : query.isError ? 'warehouseUnavailable' : 'loadingWarehouse',
    message: !warehouseId ? 'noWarehouseHelp' : denied ? 'warehouseDenied' : query.isError ? 'warehouseError' : undefined,
    retry: query.isError && !denied ? () => { void query.refetch(); } : undefined,
  } as const;
}

export type ActiveWarehouse = ReturnType<typeof useActiveWarehouse>;
