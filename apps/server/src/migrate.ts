import { Client, Pool } from "pg";
import { runMigrations } from "./platform/migrator";
import { loadServerConfig } from "./platform/server-config";

async function migrate(): Promise<void> {
  const config = loadServerConfig();
  if (!config.migrationDatabaseUrl) {
    throw new Error("MIGRATION_DATABASE_URL is required for migrations");
  }

  // Use the same connection parsing as the runtime pool, including URL options.
  const { user: runtimeRole } = new Client({
    connectionString: config.databaseUrl,
  });
  if (!runtimeRole) {
    throw new Error("DATABASE_URL must resolve to a PostgreSQL runtime role");
  }

  const pool = new Pool({
    connectionString: config.migrationDatabaseUrl,
    max: 1,
    connectionTimeoutMillis: config.databaseTimeoutMs,
  });

  try {
    const applied = await runMigrations(pool, runtimeRole);
    console.log(
      applied.length > 0
        ? `Applied migrations: ${applied.join(", ")}`
        : "No pending migrations",
    );
  } finally {
    await pool.end();
  }
}

void migrate().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
