import { PoolClient } from 'pg';

export interface WarehouseChange {
  tenantId: string;
  warehouseId: string;
  entity: 'order' | 'receipt' | 'finding' | 'dispatch' | 'adjustment' | 'expense';
  entityId: string;
  action: 'order.confirmed' | 'order.cancelled' | 'receipt.confirmed' | 'finding.resolved' | 'dispatch.confirmed' | 'adjustment.recorded' | 'expense.recorded';
  payload: Record<string, unknown>;
}

export async function recordWarehouseChange(client: PoolClient, change: WarehouseChange): Promise<void> {
  // A pull cursor can advance safely only when sequence allocation and commit order agree in the warehouse.
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
    `jahez.sync:${change.tenantId}:${change.warehouseId}`,
  ]);
  await client.query(
    `INSERT INTO sync_changes (tenant_id, warehouse_id, entity, entity_id, action, payload)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [change.tenantId, change.warehouseId, change.entity, change.entityId, change.action, JSON.stringify(change.payload)],
  );
}
