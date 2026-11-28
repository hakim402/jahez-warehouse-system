import type { ReactNode } from 'react';
import type { WarehouseScope } from '../../app/use-warehouse-scope';
import { WarehouseState } from './WarehouseState';

export function WarehouseGate({ scope, children }: { scope: WarehouseScope; children: ReactNode }) {
  return scope.warehouseId ? <>{children}</> : <WarehouseState active={scope.active} />;
}
