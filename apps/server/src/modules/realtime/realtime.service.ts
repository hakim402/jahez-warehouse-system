import { Injectable, Logger, OnModuleDestroy, UnauthorizedException } from '@nestjs/common';
import { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { WarehouseChange } from '../sync/warehouse-change';
import { DatabaseService } from '../../platform/database.service';
import { AuthenticatedSession, SessionAuthService } from '../tenancy/session-auth.service';
import { isUuid } from '../tenancy/types';

type SubscriptionReply = { ok: true; warehouseId: string } | { ok: false; error: string };

// Cost-bearing updates must not reach worker sockets sharing the warehouse room.
const OFFICE_ONLY_ACTIONS = new Set<string>(['expense.recorded']);

@Injectable()
export class RealtimeService implements OnModuleDestroy {
  private readonly logger = new Logger(RealtimeService.name);
  private io: Server | null = null;

  constructor(private readonly sessions: SessionAuthService, private readonly database: DatabaseService) {}

  attach(server: HttpServer) {
    this.io = new Server(server);
    this.io.use(async (socket, next) => {
      try {
        socket.data.session = await this.sessions.authenticate(socket.handshake.auth?.token);
        next();
      } catch {
        next(new Error('Unauthorized'));
      }
    });
    this.io.on('connection', (socket) => {
      const session: AuthenticatedSession = socket.data.session;
      socket.on('subscribe', async (payload: unknown, ack?: unknown) => {
        if (ack !== undefined && typeof ack !== 'function') return;
        const reply = ack as ((result: SubscriptionReply) => void) | undefined;
        try {
          const warehouseId = subscriptionWarehouseId(payload);
          if (!warehouseId) {
            reply?.({ ok: false, error: 'Malformed warehouse id' });
            return;
          }
          const current = await this.sessions.revalidate(session, warehouseId);
          if (!current.warehouseId) {
            reply?.({ ok: false, error: 'Warehouse access denied' });
            return;
          }
          await socket.join(this.room(current.user.tenantId, current.warehouseId));
          reply?.({ ok: true, warehouseId: current.warehouseId });
        } catch (error) {
          const unauthorized = error instanceof UnauthorizedException;
          if (!unauthorized) this.logger.warn('Warehouse subscription failed');
          reply?.({ ok: false, error: unauthorized ? 'Unauthorized' : 'Warehouse subscription unavailable' });
          if (unauthorized) socket.disconnect(true);
        }
      });
    });
  }

  publish(change: WarehouseChange) {
    if (!this.io) return;
    // Committed changes remain available from sync even if live delivery fails.
    const io = this.io;
    this.database.afterCommit(() => {
      void this.deliver(io, change).catch(() => this.logger.warn('Warehouse update delivery failed'));
    });
  }

  async onModuleDestroy() {
    await this.io?.close();
  }

  private async deliver(io: Server, change: WarehouseChange) {
    const room = this.room(change.tenantId, change.warehouseId);
    const sockets = await io.in(room).fetchSockets();
    await Promise.all(sockets.map(async (socket) => {
      const session: AuthenticatedSession = socket.data.session;
      try {
        const current = await this.sessions.revalidate(session, change.warehouseId);
        if (current.warehouseId !== change.warehouseId || current.user.tenantId !== change.tenantId) {
          await socket.leave(room);
          return;
        }
        if (OFFICE_ONLY_ACTIONS.has(change.action) && current.user.role === 'worker') return;
        socket.emit(change.action, change.payload);
      } catch (error) {
        if (!(error instanceof UnauthorizedException)) this.logger.warn('Warehouse subscription could not be revalidated');
        socket.disconnect(true);
      }
    }));
  }

  private room(tenantId: string, warehouseId: string) {
    return `tenant:${tenantId}:warehouse:${warehouseId}`;
  }
}

function subscriptionWarehouseId(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null || !('warehouseId' in payload)) return null;
  return isUuid(payload.warehouseId) ? payload.warehouseId : null;
}
