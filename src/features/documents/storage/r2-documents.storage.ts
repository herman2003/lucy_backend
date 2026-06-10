import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { LUCY_CONFIG } from '../../../core/config/app-config.module';
import type { LucyConfig } from '../../../core/config/lucy-config';
import { detectMimeFromBytes } from '../utils/document-magic-bytes';
import type { DocumentsStorage, SignedUrlResult } from './documents-storage.port';
import { UPLOAD_URL_TTL_MS } from './documents-storage.port';

const STORAGE_RETRY_DELAYS_MS = [200, 500, 1000] as const;
const R2_PRESIGN_EXPIRES_SEC = Math.floor(UPLOAD_URL_TTL_MS / 1000);

@Injectable()
export class R2DocumentsStorage implements DocumentsStorage {
  private readonly logger = new Logger(R2DocumentsStorage.name);
  private readonly client: S3Client;

  constructor(@Inject(LUCY_CONFIG) private readonly config: LucyConfig) {
    // Avoid default CRC32 query params on presigned URLs (simpler browser PUT + CORS).
    this.client = new S3Client({
      region: 'auto',
      endpoint: config.r2Endpoint,
      credentials: {
        accessKeyId: config.r2AccessKeyId,
        secretAccessKey: config.r2SecretAccessKey,
      },
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  async getUploadSignedUrl(storagePath: string, mimeType: string): Promise<SignedUrlResult> {
    const expiresAtMs = Date.now() + UPLOAD_URL_TTL_MS;
    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.config.r2Bucket,
        Key: storagePath,
        ContentType: mimeType,
      }),
      { expiresIn: R2_PRESIGN_EXPIRES_SEC },
    );
    return { url, expiresAt: new Date(expiresAtMs).toISOString() };
  }

  async getDownloadSignedUrl(storagePath: string): Promise<SignedUrlResult> {
    const expiresAtMs = Date.now() + UPLOAD_URL_TTL_MS;
    const url = await getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.config.r2Bucket,
        Key: storagePath,
      }),
      { expiresIn: R2_PRESIGN_EXPIRES_SEC },
    );
    return { url, expiresAt: new Date(expiresAtMs).toISOString() };
  }

  async isObjectPresent(storagePath: string, expectedByteSize: number): Promise<boolean> {
    for (let attempt = 0; attempt <= STORAGE_RETRY_DELAYS_MS.length; attempt++) {
      const check = await this.checkObjectSize(storagePath, expectedByteSize);
      if (check.present && check.sizeMatch) {
        this.logger.log(
          `isObjectPresent ok path=${storagePath} expected=${expectedByteSize} actual=${check.size} attempt=${attempt + 1}`,
        );
        return true;
      }
      this.logger.debug(
        `isObjectPresent miss path=${storagePath} expected=${expectedByteSize} exists=${check.present} actual=${check.size ?? 'n/a'} attempt=${attempt + 1}`,
      );
      const delay = STORAGE_RETRY_DELAYS_MS[attempt];
      if (delay === undefined) {
        break;
      }
      await sleep(delay);
    }
    this.logger.warn(
      `isObjectPresent failed path=${storagePath} expected=${expectedByteSize} attempts=${STORAGE_RETRY_DELAYS_MS.length + 1}`,
    );
    return false;
  }

  async detectMimeType(storagePath: string): Promise<string | null> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.config.r2Bucket,
          Key: storagePath,
          Range: 'bytes=0-15',
        }),
      );
      const bytes = await bodyToBuffer(response.Body);
      return detectMimeFromBytes(bytes);
    } catch {
      return null;
    }
  }

  async deleteObject(storagePath: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.config.r2Bucket,
          Key: storagePath,
        }),
      );
    } catch {
      // Best-effort delete for orphaned uploads.
    }
  }

  async putObject(storagePath: string, body: Buffer, mimeType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.r2Bucket,
        Key: storagePath,
        Body: body,
        ContentType: mimeType,
      }),
    );
    this.logger.log(
      `putObject ok path=${storagePath} bytes=${body.length} mime=${mimeType}`,
    );
  }

  async downloadObject(storagePath: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.config.r2Bucket,
        Key: storagePath,
      }),
    );
    return bodyToBuffer(response.Body);
  }

  private async checkObjectSize(
    storagePath: string,
    expectedByteSize: number,
  ): Promise<{ present: boolean; sizeMatch: boolean; size?: number }> {
    try {
      const response = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.config.r2Bucket,
          Key: storagePath,
        }),
      );
      const size = Number(response.ContentLength ?? 0);
      return { present: true, sizeMatch: size === expectedByteSize, size };
    } catch (error) {
      const name = error instanceof Error ? error.name : 'unknown';
      const message = error instanceof Error ? error.message : String(error);
      this.logger.debug(
        `headObject failed path=${storagePath} error=${name} message=${message}`,
      );
      return { present: false, sizeMatch: false };
    }
  }
}

async function bodyToBuffer(body: unknown): Promise<Buffer> {
  if (!body) {
    return Buffer.alloc(0);
  }
  if (Buffer.isBuffer(body)) {
    return body;
  }
  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }
  if (typeof body === 'object' && body !== null && 'transformToByteArray' in body) {
    const bytes = await (
      body as { transformToByteArray: () => Promise<Uint8Array> }
    ).transformToByteArray();
    return Buffer.from(bytes);
  }
  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
