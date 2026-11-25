import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../platform/database.service';
import { UserRole, WarehouseAccess } from './types';

interface WarehouseAccessRow {
  tenant_id: string;
  user_id: string;
  warehouse_id: string;
  role: UserRole;
  warehouse_name: string;
  warehouse_code: string;
}

@Injectable()
export class TenancyService {
  constructor(private readonly database: DatabaseService) {}

  async findWarehouseAccess(userId: string, warehouseId: string): Promise<WarehouseAccess | null> {
    const result = await this.database.query<WarehouseAccessRow>(
      `SELECT m.tenant_id, m.user_id, m.warehouse_id, u.role,
              w.name AS warehouse_name, w.code AS warehouse_code
       FROM memberships m
       JOIN users u ON u.id = m.user_id AND u.tenant_id = m.tenant_id
       JOIN warehouses w ON w.id = m.warehouse_id AND w.tenant_id = m.tenant_id
       WHERE m.user_id = $1 AND m.warehouse_id = $2`,
      [userId, warehouseId],
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
}