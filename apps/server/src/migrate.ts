import { Pool } from 'pg';
import { runMigrations } from './platform/migrator';
import { loadServerConfig } from './platform/server-config';

async function migrate(): Promise<void> {
  const config = loadServerConfig();
  if (!config.migrationDatabaseUrl) {
    throw new Error('MIGRATION_DATABASE_URL is required for migrations');
  }

  const pool = new Pool({
    connectionString: config.migrationDatabaseUrl,
    max: 1,
    connectionTimeoutMillis: config.databaseTimeoutMs,
  });

  try {
    const applied = await runMigrations(pool);
    console.log(applied.length > 0 ? `Applied migrations: ${applied.join(', ')}` : 'No pending migrations');
  } finally {
    await pool.end();
  }
}

void migrate().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});