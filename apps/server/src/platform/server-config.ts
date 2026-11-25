import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

export const SERVER_CONFIG = Symbol('SERVER_CONFIG');

export type DeploymentProfile = 'international' | 'cn-mainland';

export interface ServerConfig {
  port: number;
  deploymentProfile: DeploymentProfile;
  databaseUrl: string;
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

  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    errors.push('DATABASE_URL is required');
  } else {
    try {
      const parsed = new URL(databaseUrl);
      if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
        errors.push('DATABASE_URL must use the postgresql:// or postgres:// protocol');
      }
      if (!parsed.hostname || !parsed.pathname.replace(/^\//, '')) {
        errors.push('DATABASE_URL must include a host and database name');
      }
    } catch {
      errors.push('DATABASE_URL must be a valid PostgreSQL URL');
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid server configuration:\n- ${errors.join('\n- ')}`);
  }

  return {
    port,
    deploymentProfile: deploymentProfile as DeploymentProfile,
    databaseUrl: databaseUrl!,
    databasePoolMax,
    databaseTimeoutMs,
  };
}

export function loadServerConfig(): ServerConfig {
  loadEnv({ path: resolve(__dirname, '../../.env') });
  return validateServerConfig(process.env);
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