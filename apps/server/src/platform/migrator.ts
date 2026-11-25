import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Pool } from 'pg';

const migrationsDir = resolve(__dirname, '../../db/migrations');
const advisoryLockKey = 7241836501;

export async function runMigrations(pool: Pool): Promise<string[]> {
  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();
  const client = await pool.connect();
  const applied: string[] = [];

  try {
    await client.query('SELECT pg_advisory_lock($1)', [advisoryLockKey]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const { rows } = await client.query<{ version: string; checksum: string }>(
      'SELECT version, checksum FROM schema_migrations',
    );
    const appliedChecksums = new Map(rows.map((row) => [row.version, row.checksum]));
    const fileVersions = new Set(files.map((file) => file.replace(/\.sql$/, '')));

    for (const row of rows) {
      if (!fileVersions.has(row.version)) {
        throw new Error(`Applied migration file missing or renamed: ${row.version}`);
      }
    }

    for (const file of files) {
      const version = file.replace(/\.sql$/, '');
      const sql = await readFile(resolve(migrationsDir, file), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const existingChecksum = appliedChecksums.get(version);

      if (existingChecksum) {
        if (existingChecksum !== checksum) {
          throw new Error(`Migration checksum mismatch for ${version}`);
        }
        continue;
      }

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)',
          [version, checksum],
        );
        await client.query('COMMIT');
        applied.push(version);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }

    return applied;
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [advisoryLockKey]).catch(() => undefined);
    client.release();
  }
}