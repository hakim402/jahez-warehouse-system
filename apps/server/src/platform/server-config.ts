import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

export const SERVER_CONFIG = Symbol('SERVER_CONFIG');

export type DeploymentProfile = 'international' | 'cn-mainland';
export type StorageDriver = 'local' | 's3' | 'oss';
export type InvoiceAiProvider = 'deepseek' | 'qwen' | 'sample' | 'none';

export interface InvoiceAiConfig {
  provider: InvoiceAiProvider;
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  timeoutMs: number;
}

export interface S3StorageConfig {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
  forcePathStyle: boolean;
}

export interface OssStorageConfig {
  bucket: string;
  region: string;
  accessKeyId: string;
  accessKeySecret: string;
  endpoint?: string;
}

export interface StorageConfig {
  driver: StorageDriver;
  localDir: string;
  maxUploadBytes: number;
  s3?: S3StorageConfig;
  oss?: OssStorageConfig;
}

export interface ServerConfig {
  port: number;
  deploymentProfile: DeploymentProfile;
  jwtSecret: string;
  databaseUrl: string;
  migrationDatabaseUrl?: string;
  databasePoolMax: number;
  databaseTimeoutMs: number;
  storage: StorageConfig;
  invoiceAi: InvoiceAiConfig;
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

  const storage = validateStorageConfig(env, errors);
  const invoiceAi = validateInvoiceAiConfig(env, deploymentProfile as DeploymentProfile, errors);

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
    storage,
    invoiceAi,
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

function validateStorageConfig(env: NodeJS.ProcessEnv, errors: string[]): StorageConfig {
  const driver = env.STORAGE_DRIVER ?? 'local';
  if (driver !== 'local' && driver !== 's3' && driver !== 'oss') {
    errors.push('STORAGE_DRIVER must be local, s3, or oss');
  }

  const localDir = resolve(__dirname, '../..', env.STORAGE_LOCAL_DIR?.trim() || '../../storage');
  const maxUploadMb = parseInteger(env.STORAGE_MAX_UPLOAD_MB ?? '15', 'STORAGE_MAX_UPLOAD_MB', 1, 100, errors);

  const s3 = validateS3Config(env, driver === 's3', errors);
  const oss = validateOssConfig(env, driver === 'oss', errors);

  return {
    driver: (driver === 's3' || driver === 'oss' ? driver : 'local') as StorageDriver,
    localDir,
    maxUploadBytes: maxUploadMb * 1024 * 1024,
    s3,
    oss,
  };
}

function validateS3Config(env: NodeJS.ProcessEnv, required: boolean, errors: string[]): S3StorageConfig | undefined {
  const bucket = env.S3_BUCKET?.trim();
  const region = env.S3_REGION?.trim();
  const accessKeyId = env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.S3_SECRET_ACCESS_KEY?.trim();
  const endpoint = env.S3_ENDPOINT?.trim() || undefined;
  const anySet = Boolean(bucket || region || accessKeyId || secretAccessKey || endpoint);
  if (!anySet) {
    if (required) errors.push('S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY are required when STORAGE_DRIVER=s3');
    return undefined;
  }
  if (!bucket || !region || !accessKeyId || !secretAccessKey) {
    errors.push('S3 storage needs S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY together');
    return undefined;
  }
  if (endpoint) {
    try {
      const parsed = new URL(endpoint);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') errors.push('S3_ENDPOINT must be an http(s) URL');
    } catch {
      errors.push('S3_ENDPOINT must be a valid URL');
    }
  }
  const forcePathStyle = env.S3_FORCE_PATH_STYLE === 'true';
  return { bucket, region, accessKeyId, secretAccessKey, endpoint, forcePathStyle };
}

function validateOssConfig(env: NodeJS.ProcessEnv, required: boolean, errors: string[]): OssStorageConfig | undefined {
  const bucket = env.OSS_BUCKET?.trim();
  const region = env.OSS_REGION?.trim();
  const accessKeyId = env.OSS_ACCESS_KEY_ID?.trim();
  const accessKeySecret = env.OSS_ACCESS_KEY_SECRET?.trim();
  const endpoint = env.OSS_ENDPOINT?.trim() || undefined;
  const anySet = Boolean(bucket || region || accessKeyId || accessKeySecret || endpoint);
  if (!anySet) {
    if (required) errors.push('OSS_BUCKET, OSS_REGION, OSS_ACCESS_KEY_ID, and OSS_ACCESS_KEY_SECRET are required when STORAGE_DRIVER=oss');
    return undefined;
  }
  if (!bucket || !region || !accessKeyId || !accessKeySecret) {
    errors.push('OSS storage needs OSS_BUCKET, OSS_REGION, OSS_ACCESS_KEY_ID, and OSS_ACCESS_KEY_SECRET together');
    return undefined;
  }
  if (endpoint) {
    try {
      const parsed = new URL(endpoint);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') errors.push('OSS_ENDPOINT must be an http(s) URL');
    } catch {
      errors.push('OSS_ENDPOINT must be a valid URL');
    }
  }
  return { bucket, region, accessKeyId, accessKeySecret, endpoint };
}

const INVOICE_AI_PROVIDERS: readonly InvoiceAiProvider[] = ['deepseek', 'qwen', 'sample', 'none'];

// Provider selection defaults by region; keys are enforced at extraction time so a missing key never
// blocks startup — it only fails the ingest that needs it.
function validateInvoiceAiConfig(
  env: NodeJS.ProcessEnv,
  deploymentProfile: DeploymentProfile,
  errors: string[],
): InvoiceAiConfig {
  const explicit = env.INVOICE_AI_PROVIDER?.trim();
  let provider: InvoiceAiProvider = deploymentProfile === 'cn-mainland' ? 'qwen' : 'deepseek';
  if (explicit) {
    if (!INVOICE_AI_PROVIDERS.includes(explicit as InvoiceAiProvider)) {
      errors.push(`INVOICE_AI_PROVIDER must be one of ${INVOICE_AI_PROVIDERS.join(', ')}`);
    } else {
      provider = explicit as InvoiceAiProvider;
    }
  }
  const timeoutMs = parseInteger(env.INVOICE_AI_TIMEOUT_MS ?? '30000', 'INVOICE_AI_TIMEOUT_MS', 1000, 120000, errors);
  const apiKey = (env.INVOICE_AI_API_KEY ?? env.DEEPSEEK_API_KEY)?.trim() || undefined;
  const baseUrl = env.INVOICE_AI_BASE_URL?.trim() || (provider === 'deepseek' ? 'https://api.deepseek.com' : undefined);
  const model = env.INVOICE_AI_MODEL?.trim() || (provider === 'deepseek' ? 'deepseek-flash' : undefined);
  return { provider, baseUrl, model, apiKey, timeoutMs };
}