import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

export const SERVER_CONFIG = Symbol('SERVER_CONFIG');

export type DeploymentProfile = 'international' | 'cn-mainland';

export interface ServerConfig {
  port: number;
  deploymentProfile: DeploymentProfile;
  jwtSecret: string;
  databaseUrl: string;
  migrationDatabaseUrl?: string;
  databasePoolMax: number;
  databaseTimeoutMs: number;
}

export function validateServerConfig(env: NodeJS.ProcessEnv): ServerConfig {
  const errors: string[] = [];
  const port = parseInteger(env.PORT ?? '3000', 'PORT', 1, 65535, errors);
  const databasePoolMax = parseInteger(
    env.DATABASE_POOL_MAX ?? '10',
    'DATABASE_POOL_MAX',
    1,
    100,
    errors,
  );
  const databaseTimeoutMs = parseInteger(
    env.DATABASE_TIMEOUT_MS ?? '5000',
    'DATABASE_TIMEOUT_MS',
    100,
    60000,
    errors,
  );

  const deploymentProfile = env.DEPLOYMENT_PROFILE ?? 'international';
  if (deploymentProfile !== 'international' && deploymentProfile !== 'cn-mainland') {
    errors.push('DEPLOYMENT_PROFILE must be international or cn-mainland');
  }

  const jwtSecret = env.JWT_SECRET?.trim();
  if (!jwtSecret) {
    errors.push('JWT_SECRET is required');
  } else if (jwtSecret.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters');
  } else if (/change_me|placeholder|example/i.test(jwtSecret)) {
    errors.push('JWT_SECRET must not be a placeholder');
  }

  const databaseUrl = validateDatabaseUrl(env.DATABASE_URL, 'DATABASE_URL', true, errors);
  const migrationDatabaseUrl = validateDatabaseUrl(
    env.MIGRATION_DATABASE_URL,
    'MIGRATION_DATABASE_URL',
    false,
    errors,
  );

  if (errors.length > 0) {
    throw new Error(`Invalid server configuration:\n- ${errors.join('\n- ')}`);
  }

  return {
    port,
    deploymentProfile: deploymentProfile as DeploymentProfile,
    jwtSecret: jwtSecret!,
    databaseUrl: databaseUrl!,
    migrationDatabaseUrl,
    databasePoolMax,
    databaseTimeoutMs,
  };
}

export function loadServerConfig(): ServerConfig {
  loadEnv({ path: resolve(__dirname, '../../.env') });
  return validateServerConfig(process.env);
}

function validateDatabaseUrl(
  value: string | undefined,
  name: string,
  required: boolean,
  errors: string[],
): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    if (required) {
      errors.push(`${name} is required`);
    }
    return undefined;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
      errors.push(`${name} must use the postgresql:// or postgres:// protocol`);
    }
    if (!parsed.hostname || !parsed.pathname.replace(/^\//, '')) {
      errors.push(`${name} must include a host and database name`);
    }
  } catch {
    errors.push(`${name} must be a valid PostgreSQL URL`);
  }

  return trimmed;
}

function parseInteger(
  value: string,
  name: string,
  min: number,
  max: number,
  errors: string[],
): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    errors.push(`${name} must be an integer between ${min} and ${max}`);
    return min;
  }
  return parsed;
}