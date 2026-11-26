import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { PoolClient } from 'pg';
import { recordAudit } from '../../platform/audit';
import { DatabaseService } from '../../platform/database.service';
import { SERVER_CONFIG, ServerConfig } from '../../platform/server-config';
import { StorageService } from '../../platform/storage.service';
import { TenancyService } from '../tenancy/tenancy.service';
import { AuthenticatedUser, isUuid, WarehouseAccess } from '../tenancy/types';

const PURPOSES = [
  'receipt_photo', 'piece_photo', 'damage_photo', 'adjustment_photo',
  'expense_invoice', 'invoice_source', 'delivery_note', 'other',
] as const;
const ENTITY_TYPES = ['receipt', 'receipt_line', 'order', 'expense', 'adjustment', 'import'] as const;
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/heif': '.heic',
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-excel': '.xls',
  'text/csv': '.csv',
};
// Only serve known evidence types; an unrestricted inline HTML/SVG upload would be stored XSS on the API origin.
const ALLOWED_CONTENT_TYPES = new Set(Object.keys(EXTENSIONS));

export interface FileRecord {
  id: string;
  warehouse_id: string;
  upload_id: string;
  purpose: string;
  entity_type: string | null;
  entity_id: string | null;
  provider: 'local' | 's3' | 'oss';
  object_key: string;
  original_name: string | null;
  content_type: string;
  size_bytes: string;
  sha256: string;
  taken_at: Date | null;
  uploaded_by: string;
  created_at: Date;
}

@Injectable()
export class FilesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly tenancy: TenancyService,
    private readonly storage: StorageService,
    @Inject(SERVER_CONFIG) private readonly config: ServerConfig,
  ) {}

  async upload(
    user: AuthenticatedUser,
    membership: WarehouseAccess,
    input: Record<string, unknown>,
    file: Express.Multer.File | undefined,
  ) {
    const uploadId = requireUuid(input.uploadId, 'Upload id');
    const purpose = typeof input.purpose === 'string' && (PURPOSES as readonly string[]).includes(input.purpose)
      ? input.purpose
      : null;
    if (!purpose) throw new BadRequestException(`Purpose must be one of ${PURPOSES.join(', ')}`);
    const entityType = optionalEnum(input.entityType, ENTITY_TYPES, 'Entity type');
    const entityId = input.entityId === undefined || input.entityId === null || input.entityId === ''
      ? null
      : requireUuid(input.entityId, 'Entity id');
    if ((entityType === null) !== (entityId === null)) {
      throw new BadRequestException('Entity type and entity id must be provided together');
    }
    const takenAt = optionalTimestamp(input.takenAt);
    if (!file || !file.buffer || file.buffer.length === 0) throw new BadRequestException('A file is required');
    if (file.buffer.length > this.config.storage.maxUploadBytes) {
      throw new PayloadTooLargeException('File exceeds the configured upload limit');
    }
    const contentType = file.mimetype || 'application/octet-stream';
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      throw new BadRequestException('Unsupported file type; upload photos, PDF, Excel, or CSV evidence');
    }
    const sha256 = createHash('sha256').update(file.buffer).digest('hex');

    return this.database.withTenant(user.tenantId, user.id, async (client) => {
      // Claim the upload id first so an independent photo retry returns the original record instead of duplicating evidence.
      const id = randomUUID();
      const now = new Date();
      const extension = EXTENSIONS[contentType];
      const objectKey = `${user.tenantId}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${id}${extension}`;
      const provider = this.storage.writeProvider;
      const claimed = await client.query<FileRecord>(
        `INSERT INTO files
           (id, tenant_id, warehouse_id, upload_id, purpose, entity_type, entity_id, provider, object_key,
            original_name, content_type, size_bytes, sha256, taken_at, uploaded_by, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15)
         ON CONFLICT (tenant_id, upload_id) DO NOTHING
         RETURNING *`,
        [
          id, user.tenantId, membership.warehouseId, uploadId, purpose, entityType, entityId,
          provider.driver, objectKey, file.originalname ?? null, contentType, file.buffer.length,
          sha256, takenAt, user.id,
        ],
      );
      if (claimed.rowCount === 0) {
        const existing = await client.query<FileRecord>('SELECT * FROM files WHERE upload_id = $1', [uploadId]);
        const row = existing.rows[0];
        if (!row) throw new ConflictException('Upload id is already recorded');
        if (row.warehouse_id !== membership.warehouseId || row.sha256 !== sha256) {
          throw new ConflictException('Upload id is already recorded for a different file');
        }
        return toResponse(row);
      }

      const row = claimed.rows[0];
      await this.assertEntityLink(client, membership.warehouseId, entityType, entityId);
      // A failed storage write rolls back the claim so the worker can retry the same upload id.
      await provider.put(objectKey, file.buffer, contentType);
      await recordAudit(client, {
        tenantId: user.tenantId,
        userId: user.id,
        warehouseId: membership.warehouseId,
        entity: 'file',
        entityId: row.id,
        action: 'file.upload',
        after: toResponse(row),
      });
      return toResponse(row);
    });
  }

  async list(membership: WarehouseAccess, query: Record<string, string>) {
    const entityType = optionalEnum(query.entityType, ENTITY_TYPES, 'Entity type');
    const entityId = query.entityId ? requireUuid(query.entityId, 'Entity id') : null;
    if ((entityType === null) !== (entityId === null)) {
      throw new BadRequestException('Entity type and entity id must be provided together');
    }
    const purpose = query.purpose ? optionalEnum(query.purpose, PURPOSES, 'Purpose') : null;
    return this.database.withTenant(membership.tenantId, membership.userId, async (client) => {
      const clauses = ['warehouse_id = $1'];
      const params: unknown[] = [membership.warehouseId];
      if (entityType && entityId) {
        params.push(entityType, entityId);
        clauses.push(`entity_type = $${params.length - 1} AND entity_id = $${params.length}`);
      }
      if (purpose) {
        params.push(purpose);
        clauses.push(`purpose = $${params.length}`);
      }
      const result = await client.query<FileRecord>(
        `SELECT * FROM files WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC, id DESC LIMIT 200`,
        params,
      );
      return { warehouseId: membership.warehouseId, files: result.rows.map(toResponse) };
    });
  }

  async getMetadata(user: AuthenticatedUser, id: string) {
    const { row } = await this.authorizedFile(user, id);
    return toResponse(row);
  }

  async download(user: AuthenticatedUser, id: string): Promise<{ row: FileRecord; stream: Readable }> {
    const { row } = await this.authorizedFile(user, id);
    const stream = await this.storage.providerFor(row.provider).get(row.object_key);
    return { row, stream };
  }

  private async authorizedFile(user: AuthenticatedUser, id: string) {
    const fileId = requireUuid(id, 'File id');
    return this.database.withTenant(user.tenantId, user.id, async (client) => {
      const result = await client.query<FileRecord>('SELECT * FROM files WHERE id = $1', [fileId]);
      const row = result.rows[0];
      if (!row) throw new NotFoundException('File not found');
      const membership = await this.tenancy.findWarehouseAccess(user.id, row.warehouse_id, user.tenantId);
      if (!membership) throw new ForbiddenException('Warehouse access denied');
      return { row };
    });
  }

  private async assertEntityLink(
    client: PoolClient,
    warehouseId: string,
    entityType: string | null,
    entityId: string | null,
  ) {
    if (!entityType || !entityId) return;
    // Expense and import tables arrive in later steps; their links are validated by those modules.
    if (entityType === 'receipt') {
      const found = await client.query('SELECT id FROM receipts WHERE id = $1 AND warehouse_id = $2', [entityId, warehouseId]);
      if (found.rowCount === 0) throw new NotFoundException('Linked receipt not found in this warehouse');
    } else if (entityType === 'receipt_line') {
      const found = await client.query(
        `SELECT rl.id FROM receipt_lines rl JOIN receipts r ON r.id = rl.receipt_id
         WHERE rl.id = $1 AND r.warehouse_id = $2`,
        [entityId, warehouseId],
      );
      if (found.rowCount === 0) throw new NotFoundException('Linked receipt line not found in this warehouse');
    } else if (entityType === 'order') {
      const found = await client.query('SELECT id FROM orders WHERE id = $1 AND warehouse_id = $2', [entityId, warehouseId]);
      if (found.rowCount === 0) throw new NotFoundException('Linked order not found in this warehouse');
    } else if (entityType === 'adjustment') {
      const found = await client.query('SELECT id FROM stock_adjustments WHERE id = $1 AND warehouse_id = $2', [entityId, warehouseId]);
      if (found.rowCount === 0) throw new NotFoundException('Linked adjustment not found in this warehouse');
    }
  }
}

function toResponse(row: FileRecord) {
  return {
    id: row.id,
    warehouseId: row.warehouse_id,
    uploadId: row.upload_id,
    purpose: row.purpose,
    entityType: row.entity_type,
    entityId: row.entity_id,
    provider: row.provider,
    originalName: row.original_name,
    contentType: row.content_type,
    sizeBytes: Number(row.size_bytes),
    sha256: row.sha256,
    takenAt: row.taken_at instanceof Date ? row.taken_at.toISOString() : row.taken_at,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  };
}

function requireUuid(value: unknown, label: string): string {
  if (!isUuid(value)) throw new BadRequestException(`${label} is required and must be a UUID`);
  return value.toLowerCase();
}

function optionalEnum<T extends string>(value: unknown, allowed: readonly T[], label: string): T | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    throw new BadRequestException(`${label} must be one of ${allowed.join(', ')}`);
  }
  return value as T;
}

function optionalTimestamp(value: unknown): Date | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new BadRequestException('Taken at must be an ISO timestamp');
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new BadRequestException('Taken at must be an ISO timestamp');
  return parsed;
}