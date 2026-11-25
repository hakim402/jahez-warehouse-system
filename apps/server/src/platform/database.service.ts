import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Pool, QueryResult, QueryResultRow } from 'pg';
import { SERVER_CONFIG, ServerConfig } from './server-config';

export interface DatabaseReadiness {
  status: 'up' | 'down';
  latencyMs?: number;
}

@Injectable()
export class DatabaseService implements OnModuleDestroy {
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