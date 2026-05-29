import { Inject, Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';

import { LUCY_CONFIG } from '../../../core/config/app-config.module';
import type { LucyConfig } from '../../../core/config/lucy-config';
import { detectMimeFromBytes } from '../utils/document-magic-bytes';
import type { DocumentsStorage, SignedUrlResult } from './documents-storage.port';
import { UPLOAD_URL_TTL_MS } from './documents-storage.port';

const STORAGE_RETRY_DELAYS_MS = [200, 500, 1000] as const;

@Injectable()
export class FirebaseDocumentsStorage implements DocumentsStorage {
  private readonly logger = new Logger(FirebaseDocumentsStorage.name);

  constructor(@Inject(LUCY_CONFIG) private readonly config: LucyConfig) {}

  async getUploadSignedUrl(storagePath: string, mimeType: string): Promise<SignedUrlResult> {
    const expiresAtMs = Date.now() + UPLOAD_URL_TTL_MS;
    const [url] = await this.file(storagePath).getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: expiresAtMs,
      contentType: mimeType,
    });
    return { url, expiresAt: new Date(expiresAtMs).toISOString() };
  }

  async getDownloadSignedUrl(storagePath: string): Promise<SignedUrlResult> {
    const expiresAtMs = Date.now() + UPLOAD_URL_TTL_MS;
    const [url] = await this.file(storagePath).getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: expiresAtMs,
    });
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
      const [buffer] = await this.file(storagePath).download({ start: 0, end: 15 });
      return detectMimeFromBytes(buffer);
    } catch {
      return null;
    }
  }

  async deleteObject(storagePath: string): Promise<void> {
    try {
      await this.file(storagePath).delete({ ignoreNotFound: true });
    } catch {
      // Best-effort delete for orphaned uploads.
    }
  }

  async putObject(storagePath: string, body: Buffer, mimeType: string): Promise<void> {
    await this.file(storagePath).save(body, {
      metadata: { contentType: mimeType },
    });
  }

  async downloadObject(storagePath: string): Promise<Buffer> {
    const [buffer] = await this.file(storagePath).download();
    return buffer;
  }

  private async checkObjectSize(
    storagePath: string,
    expectedByteSize: number,
  ): Promise<{ present: boolean; sizeMatch: boolean; size?: number }> {
    try {
      const file = this.file(storagePath);
      const [exists] = await file.exists();
      if (!exists) {
        return { present: false, sizeMatch: false };
      }
      const [metadata] = await file.getMetadata();
      const size = Number(metadata.size ?? 0);
      return { present: true, sizeMatch: size === expectedByteSize, size };
    } catch {
      return { present: false, sizeMatch: false };
    }
  }

  private file(storagePath: string) {
    return admin.storage().bucket(this.config.firebaseStorageBucket).file(storagePath);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
