import { PoolClient } from 'pg';

export interface AuditEvent {
  tenantId: string;
  userId?: string | null;
  warehouseId?: string | null;
  entity: string;
  entityId?: string | null;
  action: string;
  before?: unknown;
  after?: unknown;
}

export async function recordAudit(client: PoolClient, event: AuditEvent): Promise<void> {
  await client.query(
    `INSERT INTO audit_events
       (tenant_id, user_id, warehouse_id, entity, entity_id, action, before, after)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      event.tenantId,
      event.userId ?? null,
      event.warehouseId ?? null,
      event.entity,
      event.entityId ?? null,
      event.action,
      event.before === undefined ? null : JSON.stringify(event.before),
      event.after === undefined ? null : JSON.stringify(event.after),
    ],
  );
}