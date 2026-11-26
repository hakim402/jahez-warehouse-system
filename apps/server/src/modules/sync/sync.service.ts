import { BadRequestException, HttpException, Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../platform/database.service';
import { ReceivingService } from '../receiving/receiving.service';
import { AuthenticatedUser, isUuid, WarehouseAccess } from '../tenancy/types';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly receiving: ReceivingService,
  ) {}

  async push(user: AuthenticatedUser, input: Record<string, unknown>) {
    if (!Array.isArray(input.operations)) {
      throw new BadRequestException('operations must be an array');
    }
    const results = [];
    for (const [index, operation] of input.operations.entries()) {
      const payload = typeof operation === 'object' && operation !== null && !Array.isArray(operation)
        ? operation as Record<string, unknown>
        : null;
      const operationId = isUuid(payload?.clientOperationId) ? payload.clientOperationId : null;
      try {
        if (!payload) throw new BadRequestException('Invalid sync operation');
        const receipt = await this.receiving.confirmReceipt(user, payload);
        results.push({ index, operationId, status: 'accepted', receipt });
      } catch (error) {
        const statusCode = error instanceof HttpException ? error.getStatus() : 500;
        const message = error instanceof HttpException && statusCode < 500 ? error.message : 'Receipt sync failed';
        if (statusCode >= 500) this.logger.error(`Receipt sync failed for batch item ${index}`, error instanceof Error ? error.stack : String(error));
        results.push({ index, operationId, status: 'rejected', error: { statusCode, message, retryable: statusCode >= 500 || statusCode === 429 } });
      }
    }
    return { results };
  }

  async pull(membership: WarehouseAccess, cursor: unknown) {
    let since = 0;
    if (cursor !== undefined && cursor !== '') {
      const parsed = Number(cursor);
      if (!Number.isInteger(parsed) || parsed < 0) throw new BadRequestException('Invalid cursor');
      since = parsed;
    }
    return this.database.withTenant(membership.tenantId, membership.userId, async (client) => {
      const changes = await client.query(
        `SELECT seq, entity, entity_id, action, payload, created_at
         FROM sync_changes
         WHERE warehouse_id = $1 AND seq > $2
         ORDER BY seq
         LIMIT 100`,
        [membership.warehouseId, since],
      );
      const nextCursor = changes.rows.length > 0 ? Number(changes.rows[changes.rows.length - 1].seq) : since;
      return {
        cursor: nextCursor,
        changes: changes.rows.map((row) => ({
          seq: Number(row.seq),
          entity: row.entity,
          entityId: row.entity_id,
          action: row.action,
          payload: row.payload,
          createdAt: row.created_at,
        })),
      };
    });
  }
}
