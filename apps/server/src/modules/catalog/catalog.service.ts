import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseError } from 'pg';
import { DatabaseService } from '../../platform/database.service';
import { recordAudit } from '../../platform/audit';
import { AuthenticatedUser, isUuid } from '../tenancy/types';

interface PartyRow {
  id: string;
  tenant_id: string;
  name: string;
  name_cn: string | null;
  type: 'customer' | 'supplier';
  shipping_mark: string | null;
  phone: string | null;
  address: string | null;
}

interface ProductRow {
  id: string;
  tenant_id: string;
  name_ar: string | null;
  name_en: string | null;
  name_cn: string | null;
  model_no: string | null;
  photo_url: string | null;
}

function optionalText(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') throw new BadRequestException('Invalid text field');
  return value.trim();
}

function requiredText(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new BadRequestException(`${label} is required`);
  }
  return value.trim();
}

@Injectable()
export class CatalogService {
  constructor(private readonly database: DatabaseService) {}

  async createParty(user: AuthenticatedUser, input: Record<string, unknown>) {
    const name = requiredText(input.name, 'Party name');
    if (input.type !== 'customer' && input.type !== 'supplier') {
      throw new BadRequestException('Party type must be customer or supplier');
    }
    const nameCn = optionalText(input.nameCn) ?? null;
    const shippingMark = optionalText(input.shippingMark) ?? null;
    const phone = optionalText(input.phone) ?? null;
    const address = optionalText(input.address) ?? null;

    return this.database.withTenant(user.tenantId, user.id, async (client) => {
      const inserted = await client.query<PartyRow>(
        `INSERT INTO parties (tenant_id, name, name_cn, type, shipping_mark, phone, address, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [user.tenantId, name, nameCn, input.type, shippingMark, phone, address, user.id],
      );
      const party = inserted.rows[0];
      await recordAudit(client, {
        tenantId: user.tenantId,
        userId: user.id,
        entity: 'party',
        entityId: party.id,
        action: 'party.create',
        after: party,
      });
      return toParty(party);
    });
  }

  async listParties(user: AuthenticatedUser, type?: unknown) {
    if (type !== undefined && type !== 'customer' && type !== 'supplier') {
      throw new BadRequestException('Party type must be customer or supplier');
    }
    return this.database.withTenant(user.tenantId, user.id, async (client) => {
      const result = type
        ? await client.query<PartyRow>('SELECT * FROM parties WHERE type = $1 ORDER BY name', [type])
        : await client.query<PartyRow>('SELECT * FROM parties ORDER BY name');
      return result.rows.map(toParty);
    });
  }

  async getParty(user: AuthenticatedUser, id: string) {
    if (!isUuid(id)) throw new BadRequestException('Malformed party id');
    return this.database.withTenant(user.tenantId, user.id, async (client) => {
      const result = await client.query<PartyRow>('SELECT * FROM parties WHERE id = $1', [id]);
      const party = result.rows[0];
      if (!party) throw new NotFoundException('Party not found');
      return toParty(party);
    });
  }

  async updateParty(user: AuthenticatedUser, id: string, input: Record<string, unknown>) {
    if (!isUuid(id)) throw new BadRequestException('Malformed party id');
    return this.database.withTenant(user.tenantId, user.id, async (client) => {
      const existing = await client.query<PartyRow>('SELECT * FROM parties WHERE id = $1 FOR UPDATE', [id]);
      const before = existing.rows[0];
      if (!before) throw new NotFoundException('Party not found');

      const name = input.name === undefined ? before.name : requiredText(input.name, 'Party name');
      const type = input.type === undefined ? before.type : input.type;
      if (type !== 'customer' && type !== 'supplier') {
        throw new BadRequestException('Party type must be customer or supplier');
      }
      const nameCn = input.nameCn === undefined ? before.name_cn : optionalText(input.nameCn);
      const shippingMark = input.shippingMark === undefined ? before.shipping_mark : optionalText(input.shippingMark);
      const phone = input.phone === undefined ? before.phone : optionalText(input.phone);
      const address = input.address === undefined ? before.address : optionalText(input.address);

      let after: PartyRow;
      try {
        const updated = await client.query<PartyRow>(
          `UPDATE parties SET name = $1, name_cn = $2, type = $3, shipping_mark = $4, phone = $5, address = $6
           WHERE id = $7 RETURNING *`,
          [name, nameCn, type, shippingMark, phone, address, id],
        );
        after = updated.rows[0];
      } catch (error) {
        if (
          error instanceof DatabaseError && error.code === '23503' &&
          (error.constraint === 'orders_customer_party_fk' || error.constraint === 'orders_supplier_party_fk')
        ) {
          throw new ConflictException('Party type cannot change while referenced by an order');
        }
        throw error;
      }
      await recordAudit(client, {
        tenantId: user.tenantId,
        userId: user.id,
        entity: 'party',
        entityId: id,
        action: 'party.update',
        before,
        after,
      });
      return toParty(after);
    });
  }

  async createProduct(user: AuthenticatedUser, input: Record<string, unknown>) {
    const nameAr = optionalText(input.nameAr) ?? null;
    const nameEn = optionalText(input.nameEn) ?? null;
    const nameCn = optionalText(input.nameCn) ?? null;
    if (!nameAr && !nameEn && !nameCn) {
      throw new BadRequestException('At least one product name is required');
    }
    const modelNo = optionalText(input.modelNo) ?? null;
    const photoUrl = optionalText(input.photoUrl) ?? null;

    return this.database.withTenant(user.tenantId, user.id, async (client) => {
      const inserted = await client.query<ProductRow>(
        `INSERT INTO products (tenant_id, name_ar, name_en, name_cn, model_no, photo_url, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [user.tenantId, nameAr, nameEn, nameCn, modelNo, photoUrl, user.id],
      );
      const product = inserted.rows[0];
      await recordAudit(client, {
        tenantId: user.tenantId,
        userId: user.id,
        entity: 'product',
        entityId: product.id,
        action: 'product.create',
        after: product,
      });
      return toProduct(product);
    });
  }

  async listProducts(user: AuthenticatedUser) {
    return this.database.withTenant(user.tenantId, user.id, async (client) => {
      const result = await client.query<ProductRow>('SELECT * FROM products ORDER BY created_at');
      return result.rows.map(toProduct);
    });
  }

  async getProduct(user: AuthenticatedUser, id: string) {
    if (!isUuid(id)) throw new BadRequestException('Malformed product id');
    return this.database.withTenant(user.tenantId, user.id, async (client) => {
      const result = await client.query<ProductRow>('SELECT * FROM products WHERE id = $1', [id]);
      const product = result.rows[0];
      if (!product) throw new NotFoundException('Product not found');
      return toProduct(product);
    });
  }

  async updateProduct(user: AuthenticatedUser, id: string, input: Record<string, unknown>) {
    if (!isUuid(id)) throw new BadRequestException('Malformed product id');
    return this.database.withTenant(user.tenantId, user.id, async (client) => {
      const existing = await client.query<ProductRow>('SELECT * FROM products WHERE id = $1 FOR UPDATE', [id]);
      const before = existing.rows[0];
      if (!before) throw new NotFoundException('Product not found');

      const nameAr = input.nameAr === undefined ? before.name_ar : optionalText(input.nameAr);
      const nameEn = input.nameEn === undefined ? before.name_en : optionalText(input.nameEn);
      const nameCn = input.nameCn === undefined ? before.name_cn : optionalText(input.nameCn);
      if (!nameAr && !nameEn && !nameCn) {
        throw new BadRequestException('At least one product name is required');
      }
      const modelNo = input.modelNo === undefined ? before.model_no : optionalText(input.modelNo);
      const photoUrl = input.photoUrl === undefined ? before.photo_url : optionalText(input.photoUrl);

      const updated = await client.query<ProductRow>(
        `UPDATE products SET name_ar = $1, name_en = $2, name_cn = $3, model_no = $4, photo_url = $5
         WHERE id = $6 RETURNING *`,
        [nameAr, nameEn, nameCn, modelNo, photoUrl, id],
      );
      const after = updated.rows[0];
      await recordAudit(client, {
        tenantId: user.tenantId,
        userId: user.id,
        entity: 'product',
        entityId: id,
        action: 'product.update',
        before,
        after,
      });
      return toProduct(after);
    });
  }
}

function toParty(row: PartyRow) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    nameCn: row.name_cn,
    type: row.type,
    shippingMark: row.shipping_mark,
    phone: row.phone,
    address: row.address,
  };
}

function toProduct(row: ProductRow) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    nameAr: row.name_ar,
    nameEn: row.name_en,
    nameCn: row.name_cn,
    modelNo: row.model_no,
    photoUrl: row.photo_url,
  };
}
