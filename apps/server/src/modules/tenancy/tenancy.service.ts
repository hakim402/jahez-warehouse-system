import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../platform/database.service';
import { UserRole, WarehouseAccess, WarehouseSummary } from './types';

interface WarehouseAccessRow {
  tenant_id: string;
  user_id: string;
  warehouse_id: string;
  role: UserRole;
  warehouse_name: string;
  warehouse_code: string;
}

interface WarehouseRow {
  id: string;
  tenant_id: string;
  name: string;
  code: string;
}

@Injectable()
export class TenancyService {
  constructor(private readonly database: DatabaseService) {}

  async findWarehouseAccess(
    userId: string,
    warehouseId: string,
    tenantId: string,
  ): Promise<WarehouseAccess | null> {
    const result = await this.database.withTenant(tenantId, userId, (client) =>
      client.query<WarehouseAccessRow>(
        `SELECT m.tenant_id, m.user_id, m.warehouse_id, u.role,
                w.name AS warehouse_name, w.code AS warehouse_code
         FROM memberships m
         JOIN users u ON u.id = m.user_id AND u.tenant_id = m.tenant_id
         JOIN warehouses w ON w.id = m.warehouse_id AND w.tenant_id = m.tenant_id
         WHERE m.user_id = $1 AND m.warehouse_id = $2`,
        [userId, warehouseId],
      ),
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      tenantId: row.tenant_id,
      userId: row.user_id,
      warehouseId: row.warehouse_id,
      role: row.role,
      warehouse: {
        id: row.warehouse_id,
        tenantId: row.tenant_id,
        name: row.warehouse_name,
        code: row.warehouse_code,
      },
    };
  }

  async updateWarehouse(access: WarehouseAccess, name: string): Promise<WarehouseSummary> {
    return this.database.withTenant(access.tenantId, access.userId, async (client) => {
      const existing = await client.query<WarehouseRow>(
        'SELECT id, tenant_id, name, code FROM warehouses WHERE id = $1 FOR UPDATE',
        [access.warehouseId],
      );
      const before = existing.rows[0];
      if (!before) {
        throw new NotFoundException('Warehouse not found');
      }

      const updated = await client.query<WarehouseRow>(
        'UPDATE warehouses SET name = $1 WHERE id = $2 RETURNING id, tenant_id, name, code',
        [name, access.warehouseId],
      );
      const after = updated.rows[0];

      await client.query(
        `INSERT INTO audit_events
           (tenant_id, user_id, warehouse_id, entity, entity_id, action, before, after)
         VALUES ($1, $2, $3, 'warehouse', $4, 'warehouse.update', $5, $6)`,
        [
          access.tenantId,
          access.userId,
          access.warehouseId,
          access.warehouseId,
          JSON.stringify({ name: before.name }),
          JSON.stringify({ name: after.name }),
        ],
      );

      return {
        id: after.id,
        tenantId: after.tenant_id,
        name: after.name,
        code: after.code,
      };
    });
  }
}