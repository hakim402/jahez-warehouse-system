import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DatabaseService } from '../../platform/database.service';
import { recordAudit } from '../../platform/audit';
import { RealtimeService } from '../realtime/realtime.service';
import { recordWarehouseChange, WarehouseChange } from '../sync/warehouse-change';
import { TenancyService } from '../tenancy/tenancy.service';
import { AuthenticatedUser, isOfficeRole, isUuid } from '../tenancy/types';
import { InventoryService } from './inventory.service';

const MAX_QUANTITY = 2_147_483_647;

interface LotRow {
  supplier_id: string | null;
  customer_id: string | null;
  brand: string | null;
  product_id: string | null;
  remaining: string;
}

@Injectable()
export class AdjustmentsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly tenancy: TenancyService,
    private readonly inventory: InventoryService,
    private readonly realtime: RealtimeService,
  ) {}

  async recordAdjustment(user: AuthenticatedUser, input: Record<string, unknown>) {
    if (!isOfficeRole(user.role)) throw new ForbiddenException('Only the owner or trader can adjust stock');
    const operationId = requireUuid(input.clientOperationId, 'Client operation id');
    const warehouseId = requireUuid(input.warehouseId, 'Warehouse id');
    const reason = requireText(input.reason, 'Reason');
    const note = optionalText(input.note);
    const photoFileId = requireUuid(input.photoFileId, 'Photo file id');
    const cartons = signedInt(input.cartons, 'Cartons');
    const qty = optionalSignedInt(input.qty, 'Quantity');
    const cbm = optionalSignedNumber(input.cbm, 'CBM');
    if (qty !== null && Math.sign(qty) !== Math.sign(cartons)) throw new BadRequestException('Quantity sign must match cartons');
    if (cbm !== null && Math.sign(cbm) !== Math.sign(cartons)) throw new BadRequestException('CBM sign must match cartons');
    const receiptLineId = optionalUuid(input.receiptLineId);
    const dimensions = {
      customerId: optionalUuid(input.customerId),
      supplierId: optionalUuid(input.supplierId),
      brand: optionalText(input.brand),
      productId: optionalUuid(input.productId),
    };
    if (receiptLineId && Object.values(dimensions).some((value) => value !== null)) {
      throw new BadRequestException('Stock dimensions come from the lot when receiptLineId is set');
    }
    const requestHash = createHash('sha256')
      .update(JSON.stringify({ warehouseId, reason, note, photoFileId, cartons, qty, cbm, receiptLineId, ...dimensions }))
      .digest('hex');

    const membership = await this.tenancy.findWarehouseAccess(user.id, warehouseId, user.tenantId);
    if (!membership) throw new ForbiddenException('Warehouse access denied');

    const { response, change } = await this.database.withTenant(user.tenantId, user.id, async (client) => {
      const claimed = await client.query(
        `INSERT INTO client_operations (tenant_id, operation_id, user_id, warehouse_id, kind, request_hash, created_by)
         VALUES ($1, $2, $3, $4, 'adjustment.create', $5, $3)
         ON CONFLICT (tenant_id, operation_id) DO NOTHING
         RETURNING id`,
        [user.tenantId, operationId, user.id, warehouseId, requestHash],
      );
      if (claimed.rowCount === 0) {
        const existing = await client.query<{ response: Record<string, unknown> | null }>(
          `SELECT response FROM client_operations
           WHERE operation_id = $1 AND user_id = $2 AND warehouse_id = $3
             AND kind = 'adjustment.create' AND request_hash = $4`,
          [operationId, user.id, warehouseId, requestHash],
        );
        const response = existing.rows[0]?.response;
        if (!response) throw new ConflictException('Client operation is already recorded for a different request');
        return { response, change: null };
      }

      // Share the dispatch lock so a drawdown cannot race a concurrent dispatch or adjustment.
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
        `jahez.stock:${user.tenantId}:${warehouseId}`,
      ]);

      const photo = await client.query(
        "SELECT id FROM files WHERE id = $1 AND warehouse_id = $2 AND purpose = 'adjustment_photo'",
        [photoFileId, warehouseId],
      );
      if (photo.rowCount === 0) throw new NotFoundException('Adjustment photo not found in this warehouse');

      let lot: LotRow | null = null;
      if (receiptLineId) {
        const found = await client.query<LotRow>(
          `SELECT rm.supplier_id, rm.customer_id, rm.brand, rm.product_id,
                  rm.cartons + COALESCE((
                    SELECT SUM(m2.cartons) FROM stock_movements m2
                    WHERE m2.receipt_line_id = rm.receipt_line_id AND m2.kind <> 'receipt'
                  ), 0) AS remaining
           FROM stock_movements rm
           WHERE rm.receipt_line_id = $1 AND rm.kind = 'receipt' AND rm.warehouse_id = $2`,
          [receiptLineId, warehouseId],
        );
        lot = found.rows[0] ?? null;
        if (!lot) throw new NotFoundException('Receipt lot not found in this warehouse');
        dimensions.customerId = lot.customer_id;
        dimensions.supplierId = lot.supplier_id;
        dimensions.brand = lot.brand;
        dimensions.productId = lot.product_id;
      }

      if (cartons < 0) {
        if (lot && Number(lot.remaining) + cartons < 0) {
          throw new ConflictException({
            message: 'Adjustment exceeds the lot remainder',
            available: Number(lot.remaining), requested: -cartons, shortage: -cartons - Number(lot.remaining),
          });
        }
        const balance = await client.query<{ available: string }>(
          `SELECT COALESCE(SUM(cartons), 0) AS available FROM stock_movements
           WHERE warehouse_id = $1
             AND customer_id IS NOT DISTINCT FROM $2
             AND supplier_id IS NOT DISTINCT FROM $3
             AND brand IS NOT DISTINCT FROM $4
             AND product_id IS NOT DISTINCT FROM $5`,
          [warehouseId, dimensions.customerId, dimensions.supplierId, dimensions.brand, dimensions.productId],
        );
        const available = Number(balance.rows[0].available);
        if (available + cartons < 0) {
          throw new ConflictException({
            message: 'Adjustment exceeds available stock',
            available, requested: -cartons, shortage: -cartons - available,
          });
        }
      }

      const counter = await client.query<{ next_value: string }>(
        `INSERT INTO document_counters (tenant_id, kind, next_value)
         VALUES ($1, 'adjustment', 1)
         ON CONFLICT (tenant_id, kind)
         DO UPDATE SET next_value = document_counters.next_value + 1
         RETURNING next_value`,
        [user.tenantId],
      );
      const adjustmentNo = `ADJ-${String(counter.rows[0].next_value).padStart(6, '0')}`;

      const inserted = await client.query(
        `INSERT INTO stock_adjustments
           (tenant_id, warehouse_id, adjustment_no, reason, note, photo_file_id,
            supplier_id, brand, customer_id, product_id, receipt_line_id, cartons, qty, cbm, adjusted_by, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15)
         RETURNING *`,
        [
          user.tenantId, warehouseId, adjustmentNo, reason, note, photoFileId,
          dimensions.supplierId, dimensions.brand, dimensions.customerId, dimensions.productId,
          receiptLineId, cartons, qty, cbm, user.id,
        ],
      );
      const adjustment = inserted.rows[0];
      const movementId = await this.inventory.postAdjustmentMovement(client, {
        tenantId: user.tenantId,
        userId: user.id,
        warehouseId,
        adjustmentId: adjustment.id,
        receiptLineId,
        supplierId: dimensions.supplierId,
        customerId: dimensions.customerId,
        brand: dimensions.brand,
        productId: dimensions.productId,
        cartons,
        qty,
        cbm,
      });

      const response = this.toResponse(adjustment, movementId);
      await client.query(
        'UPDATE client_operations SET response = $1 WHERE operation_id = $2',
        [JSON.stringify(response), operationId],
      );
      await recordAudit(client, {
        tenantId: user.tenantId,
        userId: user.id,
        warehouseId,
        entity: 'adjustment',
        entityId: adjustment.id,
        action: 'adjustment.recorded',
        after: response,
      });
      const change: WarehouseChange = {
        tenantId: user.tenantId, warehouseId, entity: 'adjustment', entityId: adjustment.id,
        action: 'adjustment.recorded', payload: response,
      };
      await recordWarehouseChange(client, change);
      return { response, change };
    });
    if (change) this.realtime.publish(change);
    return response;
  }

  private toResponse(adjustment: any, movementId: string) {
    return {
      id: adjustment.id,
      adjustmentNo: adjustment.adjustment_no,
      warehouseId: adjustment.warehouse_id,
      reason: adjustment.reason,
      note: adjustment.note,
      photoFileId: adjustment.photo_file_id,
      customerId: adjustment.customer_id,
      supplierId: adjustment.supplier_id,
      brand: adjustment.brand,
      productId: adjustment.product_id,
      receiptLineId: adjustment.receipt_line_id,
      cartons: adjustment.cartons,
      qty: adjustment.qty,
      cbm: adjustment.cbm === null ? null : Number(adjustment.cbm),
      adjustedBy: adjustment.adjusted_by,
      adjustedAt: adjustment.adjusted_at instanceof Date ? adjustment.adjusted_at.toISOString() : adjustment.adjusted_at,
      stockMovementId: movementId,
    };
  }
}

function requireUuid(value: unknown, label: string): string {
  if (!isUuid(value)) throw new BadRequestException(`${label} is required and must be a UUID`);
  return value.toLowerCase();
}

function optionalUuid(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (!isUuid(value)) throw new BadRequestException('Malformed UUID');
  return value.toLowerCase();
}

function requireText(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 2000) {
    throw new BadRequestException(`${label} is required and must be at most 2000 characters`);
  }
  return value.trim();
}

function optionalText(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > 2000) throw new BadRequestException('Invalid text field');
  return value.trim() || null;
}

function signedInt(value: unknown, label: string): number {
  const parsed = typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isInteger(parsed) || parsed === 0 || Math.abs(parsed) > MAX_QUANTITY) {
    throw new BadRequestException(`${label} must be a non-zero integer within ±${MAX_QUANTITY}`);
  }
  return parsed;
}

function optionalSignedInt(value: unknown, label: string): number | null {
  if (value === undefined || value === null || value === '') return null;
  return signedInt(value, label);
}

function optionalSignedNumber(value: unknown, label: string): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(parsed) || parsed === 0 || Math.abs(parsed) >= 1_000_000) {
    throw new BadRequestException(`${label} must be a non-zero number below 1,000,000 in magnitude`);
  }
  return Number(parsed.toFixed(6));
}