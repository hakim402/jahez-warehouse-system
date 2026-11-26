import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { AsyncLocalStorage } from 'node:async_hooks';
import { SERVER_CONFIG, ServerConfig } from './server-config';

export interface DatabaseReadiness {
  status: 'up' | 'down';
  latencyMs?: number;
}

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly transaction = new AsyncLocalStorage<{
    tenantId: string; userId: string; client: PoolClient; afterCommit: Array<() => void>;
  }>();

  afterCommit(action: () => void): void {
    const active = this.transaction.getStore();
    if (active) active.afterCommit.push(action);
    else action();
  }
  private readonly logger = new Logger(DatabaseService.name);
  private readonly pool: Pool;

  constructor(@Inject(SERVER_CONFIG) config: ServerConfig) {
    this.pool = new Pool({
      connectionString: config.databaseUrl,
      max: config.databasePoolMax,
      connectionTimeoutMillis: config.databaseTimeoutMs,
      query_timeout: config.databaseTimeoutMs,
      statement_timeout: config.databaseTimeoutMs,
    });
    this.pool.on('error', (error) => {
      this.logger.error(`Idle PostgreSQL client error: ${error.message}`);
    });
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  async withTenant<T>(
    tenantId: string,
    userId: string,
    fn: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const active = this.transaction.getStore();
    if (active) {
      if (active.tenantId !== tenantId || active.userId !== userId) {
        throw new Error('Cannot change identity inside a tenant transaction');
      }
      return fn(active.client);
    }
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
      await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
      const afterCommit: Array<() => void> = [];
      const result = await this.transaction.run({ tenantId, userId, client, afterCommit }, () => fn(client));
      await client.query('COMMIT');
      for (const action of afterCommit) action();
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async checkReadiness(): Promise<DatabaseReadiness> {
    const startedAt = Date.now();
    try {
      await this.pool.query('SELECT 1');
      return { status: 'up', latencyMs: Date.now() - startedAt };
    } catch (error) {
      this.logger.warn(
        `PostgreSQL readiness check failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return { status: 'down' };
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
