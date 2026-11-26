import { Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import OSS from 'ali-oss';
import { createReadStream } from 'node:fs';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { SERVER_CONFIG, ServerConfig, StorageDriver } from './server-config';

export interface StorageProvider {
  readonly driver: StorageDriver;
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Readable>;
}

@Injectable()
export class StorageService {
  private readonly providers = new Map<StorageDriver, StorageProvider>();

  constructor(@Inject(SERVER_CONFIG) private readonly config: ServerConfig) {}

  get writeProvider(): StorageProvider {
    return this.providerFor(this.config.storage.driver);
  }

  // Files are read through the provider stored on their row, so switching the write driver keeps earlier uploads readable.
  providerFor(driver: StorageDriver): StorageProvider {
    const cached = this.providers.get(driver);
    if (cached) return cached;
    const provider = this.build(driver);
    this.providers.set(driver, provider);
    return provider;
  }

  private build(driver: StorageDriver): StorageProvider {
    const storage = this.config.storage;
    if (driver === 'local') return new LocalStorageProvider(storage.localDir);
    if (driver === 's3') {
      if (!storage.s3) throw new ServiceUnavailableException('S3 storage is not configured');
      return new S3StorageProvider(storage.s3);
    }
    if (!storage.oss) throw new ServiceUnavailableException('OSS storage is not configured');
    return new OssStorageProvider(storage.oss);
  }
}

class LocalStorageProvider implements StorageProvider {
  readonly driver = 'local' as const;

  constructor(private readonly root: string) {}

  async put(key: string, body: Buffer): Promise<void> {
    const target = this.pathFor(key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, body);
  }

  async get(key: string): Promise<Readable> {
    const target = this.pathFor(key);
    try {
      await access(target);
    } catch {
      throw new NotFoundException('Stored file is missing');
    }
    return createReadStream(target);
  }

  private pathFor(key: string): string {
    const target = resolve(this.root, key);
    if (key.includes('..') || key.startsWith('/') || !target.startsWith(this.root + sep)) {
      throw new ServiceUnavailableException('Invalid storage key');
    }
    return target;
  }
}

class S3StorageProvider implements StorageProvider {
  readonly driver = 's3' as const;
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: NonNullable<ServerConfig['storage']['s3']>) {
    this.bucket = config.bucket;
    this.client = new S3Client({
      region: config.region,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      ...(config.endpoint ? { endpoint: config.endpoint, forcePathStyle: config.forcePathStyle } : {}),
    });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }));
  }

  async get(key: string): Promise<Readable> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!result.Body) throw new NotFoundException('Stored file is missing');
    return result.Body as Readable;
  }
}

class OssStorageProvider implements StorageProvider {
  readonly driver = 'oss' as const;
  private readonly client: OSS;

  constructor(config: NonNullable<ServerConfig['storage']['oss']>) {
    this.client = new OSS({
      region: config.region,
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
      bucket: config.bucket,
      secure: true,
      ...(config.endpoint ? { endpoint: config.endpoint } : {}),
    });
  }

  async put(key: string, body: Buffer): Promise<void> {
    await this.client.put(key, body);
  }

  async get(key: string): Promise<Readable> {
    const result = await this.client.getStream(key);
    return result.stream as Readable;
  }
}