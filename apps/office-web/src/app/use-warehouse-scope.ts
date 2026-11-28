import { useOutletContext } from 'react-router';
import { useSession } from './session';
import type { ActiveWarehouse } from './use-active-warehouse';

export function useWarehouseScope() {
  const { session } = useSession();
  const active = useOutletContext<ActiveWarehouse>();
  const warehouseId = active.warehouse?.id;
  const identity = [session?.user.tenantId, session?.user.id, warehouseId ?? null] as const;
  const queryKey = (resource: string, ...parts: readonly unknown[]) => [resource, ...identity, ...parts] as const;
  return {
    active, warehouseId, queryKey,
    canRead: !active.configuredId || Boolean(warehouseId),
  };
}
export type WarehouseScope = ReturnType<typeof useWarehouseScope>;
