import { Request } from 'express';

export type UserRole = 'owner' | 'trader' | 'worker';

export interface AuthenticatedUser {
  id: string;
  tenantId: string;
  role: UserRole;
  sessionId: string;
}

export interface WarehouseSummary {
  id: string;
  tenantId: string;
  name: string;
  code: string;
}

export interface WarehouseAccess {
  tenantId: string;
  userId: string;
  warehouseId: string;
  role: UserRole;
  warehouse: WarehouseSummary;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  membership?: WarehouseAccess;
}

export function isUserRole(value: unknown): value is UserRole {
  return value === 'owner' || value === 'trader' || value === 'worker';
}

export function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}