import { ConflictException, ForbiddenException, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../../platform/database.service';
import { recordAudit } from '../../platform/audit';
import { hashPassword } from '../auth/password';
import { AuthenticatedUser, UserRole } from '../tenancy/types';
import * as input from './settings-input';

interface UserRow { id: string; name: string; phone: string; role: UserRole; active: boolean; version: number; warehouse_ids: string[] }
const safeColumns = `u.id, u.name, u.phone, u.role, u.active, u.version,
  ARRAY(SELECT m.warehouse_id FROM memberships m WHERE m.tenant_id = u.tenant_id AND m.user_id = u.id ORDER BY m.warehouse_id) AS warehouse_ids`;
function safeUser(row: UserRow) {
  return { id: row.id, name: row.name, phone: row.phone, role: row.role, active: row.active, version: row.version, warehouseIds: row.warehouse_ids };
}

@Injectable()
export class SettingsService {
  constructor(private readonly database: DatabaseService) {}

  private owner<T>(actor: AuthenticatedUser, mutate: boolean, run: (client: PoolClient) => Promise<T>): Promise<T> {
    if (actor.role !== 'owner') throw new ForbiddenException('Owner access required');
    return this.database.withTenant(actor.tenantId, actor.id, async (client) => {
      // Serialize owner changes; NO KEY UPDATE permits concurrent session/audit foreign-key checks.
      if (mutate) await client.query('SELECT id FROM companies WHERE id = $1 FOR NO KEY UPDATE', [actor.tenantId]);
      const current = await client.query("SELECT id FROM users WHERE id = $1 AND tenant_id = $2 AND active AND role = 'owner'", [actor.id, actor.tenantId]);
      if (!current.rowCount) throw new ForbiddenException('Owner access required');
      try { return await run(client); }
      catch (error) {
        if ((error as { code?: string }).code === '23505') throw new ConflictException({ code: 'PHONE_CONFLICT', message: 'Phone already belongs to a company user' });
        throw error;
      }
    });
  }

  listUsers(actor: AuthenticatedUser, query: input.SettingsInput) {
    const search = query.search === undefined || query.search === '' ? '' : input.text(query.search, 'search', 200);
    const role = query.role === undefined || query.role === '' ? null : input.role(query.role);
    if (query.active !== undefined && query.active !== '' && query.active !== 'true' && query.active !== 'false') throw new BadRequestException('Invalid active filter');
    const active = query.active === 'true' ? true : query.active === 'false' ? false : null;
    const cursor = query.cursor ? input.uuid(query.cursor) : null;
    const limit = query.limit === undefined ? 50 : Number(query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new BadRequestException('Limit must be 1–200');
    return this.owner(actor, false, async (client) => {
      const result = await client.query<UserRow>(`SELECT ${safeColumns} FROM users u WHERE u.tenant_id = $1
        AND ($2::text = '' OR u.name ILIKE $2 OR u.phone ILIKE $2) AND ($3::text IS NULL OR u.role = $3)
        AND ($4::boolean IS NULL OR u.active = $4) AND ($5::uuid IS NULL OR u.id > $5)
        ORDER BY u.id LIMIT $6`, [actor.tenantId, search ? '%' + search.replace(/[\\%_]/g, '\\$&') + '%' : '', role, active, cursor, limit + 1]);
      const rows = result.rows.slice(0, limit);
      return { users: rows.map(safeUser), nextCursor: result.rows.length > limit ? rows.at(-1)!.id : null };
    });
  }

  getUser(actor: AuthenticatedUser, id: string) {
    return this.owner(actor, false, async client => {
      const result = await client.query<UserRow>(`SELECT ${safeColumns} FROM users u WHERE u.id = $1 AND u.tenant_id = $2`, [input.uuid(id), actor.tenantId]);
      if (!result.rows[0]) throw new NotFoundException('User not found');
      return safeUser(result.rows[0]);
    });
  }

  listWarehouses(actor: AuthenticatedUser) {
    return this.owner(actor, false, async (client) => ({ warehouses: (await client.query<{ id: string; name: string; code: string }>(
      'SELECT id, name, code FROM warehouses WHERE tenant_id = $1 ORDER BY name, id', [actor.tenantId])).rows }));
  }

  private async assignments(client: PoolClient, tenantId: string, ids: string[]) {
    const found = await client.query('SELECT id FROM warehouses WHERE tenant_id = $1 AND id = ANY($2::uuid[])', [tenantId, ids]);
    if (found.rowCount !== ids.length) throw new BadRequestException({ code: 'INVALID_WAREHOUSE', message: 'A warehouse is not available in this company' });
  }
  private async replaceAssignments(client: PoolClient, actor: AuthenticatedUser, id: string, ids: string[]) {
    await client.query('DELETE FROM memberships WHERE tenant_id = $1 AND user_id = $2', [actor.tenantId, id]);
    await client.query(`INSERT INTO memberships (tenant_id, user_id, warehouse_id, created_by)
      SELECT $1, $2, w, $4 FROM unnest($3::uuid[]) w`, [actor.tenantId, id, ids, actor.id]);
  }
  private async user(client: PoolClient, tenantId: string, id: string, expectedVersion?: unknown) {
    const result = await client.query<UserRow>(`SELECT ${safeColumns} FROM users u WHERE u.id = $1 AND u.tenant_id = $2 FOR UPDATE OF u`, [input.uuid(id), tenantId]);
    const row = result.rows[0];
    if (!row) throw new NotFoundException('User not found');
    if (expectedVersion !== undefined && row.version !== input.version(expectedVersion)) throw new ConflictException({ code: 'STALE_VERSION', message: 'User changed. Reload latest before saving.' });
    return row;
  }
  private async audit(client: PoolClient, actor: AuthenticatedUser, id: string, action: string, before?: unknown, after?: unknown) {
    await recordAudit(client, { tenantId: actor.tenantId, userId: actor.id, entity: 'user', entityId: id, action, before, after });
  }
  private async revoke(client: PoolClient, actor: AuthenticatedUser, id: string) {
    await client.query('UPDATE auth_sessions SET revoked_at = now() WHERE tenant_id = $1 AND user_id = $2 AND revoked_at IS NULL', [actor.tenantId, id]);
  }

  createUser(actor: AuthenticatedUser, body: input.SettingsInput) {
    const name = input.text(body.name, 'name', 200), phone = input.text(body.phone, 'phone', 64), role = input.role(body.role);
    const ids = input.warehouses(body.warehouseIds), passwordHash = hashPassword(input.password(body.initialPassword));
    return this.owner(actor, true, async (client) => {
      await this.assignments(client, actor.tenantId, ids);
      const inserted = await client.query<{ id: string }>(`INSERT INTO users (tenant_id, name, phone, role, password_hash, created_by)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`, [actor.tenantId, name, phone, role, passwordHash, actor.id]);
      const id = inserted.rows[0].id;
      await this.replaceAssignments(client, actor, id, ids);
      const user = safeUser(await this.user(client, actor.tenantId, id));
      await this.audit(client, actor, id, 'user.created', undefined, user);
      return { user, sessionsRevoked: false };
    });
  }

  updateUser(actor: AuthenticatedUser, id: string, body: input.SettingsInput) {
    const expected = input.version(body.expectedVersion);
    return this.owner(actor, true, async (client) => {
      const before = await this.user(client, actor.tenantId, id, expected);
      const name = body.name === undefined ? before.name : input.text(body.name, 'name', 200);
      const phone = body.phone === undefined ? before.phone : input.text(body.phone, 'phone', 64);
      const role = body.role === undefined ? before.role : input.role(body.role);
      if (body.active !== undefined && typeof body.active !== 'boolean') throw new BadRequestException('Invalid active status');
      const active = body.active === undefined ? before.active : body.active as boolean;
      const ids = body.warehouseIds === undefined ? before.warehouse_ids : input.warehouses(body.warehouseIds);
      if (id === actor.id && !active) throw new BadRequestException({ code: 'SELF_DISABLE', message: 'You cannot disable your own account' });
      if (before.active && before.role === 'owner' && (!active || role !== 'owner')) {
        const count = await client.query<{ count: number }>("SELECT count(*)::int AS count FROM users WHERE tenant_id = $1 AND active AND role = 'owner'", [actor.tenantId]);
        if (count.rows[0].count <= 1) throw new ConflictException({ code: 'LAST_OWNER', message: 'Keep at least one active owner' });
      }
      await this.assignments(client, actor.tenantId, ids);
      const accessChanged = ids.join(',') !== before.warehouse_ids.join(',');
      await client.query('UPDATE users SET name = $1, phone = $2, role = $3, active = $4, version = version + 1 WHERE id = $5 AND tenant_id = $6', [name, phone, role, active, id, actor.tenantId]);
      if (accessChanged) await this.replaceAssignments(client, actor, id, ids);
      const sessionsRevoked = accessChanged || role !== before.role || active !== before.active;
      if (sessionsRevoked) await this.revoke(client, actor, id);
      const user = safeUser(await this.user(client, actor.tenantId, id));
      await this.audit(client, actor, id, 'user.updated', safeUser(before), user);
      return { user, sessionsRevoked };
    });
  }

  resetPassword(actor: AuthenticatedUser, id: string, body: input.SettingsInput) {
    const expected = input.version(body.expectedVersion), passwordHash = hashPassword(input.password(body.newPassword));
    return this.owner(actor, true, async (client) => {
      await this.user(client, actor.tenantId, id, expected);
      await client.query('UPDATE users SET password_hash = $1, version = version + 1 WHERE id = $2 AND tenant_id = $3', [passwordHash, id, actor.tenantId]);
      await this.revoke(client, actor, id);
      await this.audit(client, actor, id, 'user.password_reset', undefined, { sessionsRevoked: true });
      return { user: safeUser(await this.user(client, actor.tenantId, id)), sessionsRevoked: true };
    });
  }

  private async tolerances(client: PoolClient, tenantId: string) {
    const result = await client.query<{ cbmTolerancePercent: string; weightTolerancePercent: string; version: number }>(
      'SELECT cbm_tolerance_percent AS "cbmTolerancePercent", weight_tolerance_percent AS "weightTolerancePercent", version FROM companies WHERE id = $1', [tenantId]);
    if (!result.rows[0]) throw new NotFoundException('Company not found');
    return result.rows[0];
  }
  getTolerances(actor: AuthenticatedUser) { return this.owner(actor, false, client => this.tolerances(client, actor.tenantId)); }
  updateTolerances(actor: AuthenticatedUser, body: input.SettingsInput) {
    const cbm = input.percent(body.cbmTolerancePercent), weight = input.percent(body.weightTolerancePercent), expected = input.version(body.expectedVersion);
    return this.owner(actor, true, async client => {
      const before = await this.tolerances(client, actor.tenantId);
      if (before.version !== expected) throw new ConflictException({ code: 'STALE_VERSION', message: 'Tolerances changed. Reload latest before saving.' });
      await client.query('UPDATE companies SET cbm_tolerance_percent = $1, weight_tolerance_percent = $2, version = version + 1 WHERE id = $3', [cbm, weight, actor.tenantId]);
      const after = await this.tolerances(client, actor.tenantId);
      await recordAudit(client, { tenantId: actor.tenantId, userId: actor.id, entity: 'company', entityId: actor.tenantId, action: 'settings.receiving_tolerances_updated', before, after });
      return after;
    });
  }
}
