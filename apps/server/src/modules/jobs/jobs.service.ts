import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PgBoss } from 'pg-boss';
import { SERVER_CONFIG, ServerConfig } from '../../platform/server-config';

export type JobData = Record<string, unknown>;
export type JobHandler = (data: JobData) => Promise<void>;

/**
 * pg-boss is shared by every background feature. Both API and worker start the connection; only the
 * worker entry point calls `startConsuming`, which begins working every queue that feature modules
 * registered during init. Retried jobs must be idempotent: handlers run at-least-once.
 */
@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);
  private readonly boss: PgBoss;
  private readonly handlers = new Map<string, JobHandler>();
  private readonly ensured = new Set<string>();
  private consuming = false;
  private startup: Promise<unknown> | null = null;

  constructor(@Inject(SERVER_CONFIG) config: ServerConfig) {
    this.boss = new PgBoss({
      connectionString: config.databaseUrl,
      schema: 'pgboss',
      // Migration 0010 creates the pgboss schema and grants the runtime role CREATE on it, so the
      // least-privilege runtime role never needs database-level CREATE to install the queue schema.
      createSchema: false,
      maintenanceIntervalSeconds: 120,
    });
    // pg-boss surfaces worker/queue errors on the instance; listen so they never crash the process.
    this.boss.on('error', (error) => this.logger.warn(`Job queue error: ${error.message}`));
  }

  onModuleInit(): void {
    void this.start().catch(() => this.logger.warn('Job queue unavailable; the next queue operation will retry'));
  }

  private start(): Promise<unknown> {
    if (!this.startup) {
      this.startup = this.boss.start().catch((error) => {
        this.startup = null;
        throw error;
      });
    }
    return this.startup;
  }

  register(name: string, handler: JobHandler): void {
    this.handlers.set(name, handler);
  }

  /** Begin working every registered queue. Called by the worker entry point only. */
  async startConsuming(): Promise<void> {
    if (this.consuming) return;
    for (const [name, handler] of this.handlers) {
      await this.ensureQueue(name);
      await this.boss.work(name, async (job) => {
        // pg-boss may deliver a single job or a batch depending on queue config; normalize both.
        const delivered = Array.isArray(job) ? job : [job];
        for (const item of delivered) {
          const current = item as { id?: string; data?: unknown };
          try {
            await handler((current.data ?? {}) as JobData);
          } catch (error) {
            this.logger.error(`Job ${name} ${current.id} failed`, error instanceof Error ? error.stack : String(error));
            throw error;
          }
        }
      });
    }
    this.consuming = true;
    this.logger.log(`Consuming ${this.handlers.size} job queue(s): ${[...this.handlers.keys()].join(', ')}`);
  }

  /** Enqueue a job without starting a consumer. */
  async send(name: string, data: JobData, singletonKey?: string): Promise<string> {
    await this.ensureQueue(name);
    const id = await this.boss.send(name, data, { singletonKey });
    if (!id) throw new Error(`Job queue ${name} rejected the request`);
    return id;
  }

  /** Creates the queue once with the shared retry policy; safe to call from any process. */
  private async ensureQueue(name: string): Promise<void> {
    await this.start();
    if (this.ensured.has(name)) return;
    await this.boss.createQueue(name, { retryLimit: 3, retryBackoff: true, retryDelay: 1000 });
    this.ensured.add(name);
  }

  async onModuleDestroy(): Promise<void> {
    await this.boss.stop({ graceful: true });
  }
}
