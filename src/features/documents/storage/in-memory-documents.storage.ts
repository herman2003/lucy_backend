import { Injectable } from '@nestjs/common';

import { detectMimeFromBytes } from '../utils/document-magic-bytes';
import type { DocumentsStorage, SignedUrlResult } from './documents-storage.port';
import { UPLOAD_URL_TTL_MS } from './documents-storage.port';

@Injectable()
export class InMemoryDocumentsStorage implements DocumentsStorage {
  private readonly objectPresent = new Map<string, { byteSize: number; content: Buffer }>();
  private readonly detectedMime = new Map<string, string>();

  async getUploadSignedUrl(storagePath: string, _mimeType: string): Promise<SignedUrlResult> {
    const expiresAt = new Date(Date.now() + UPLOAD_URL_TTL_MS).toISOString();
    return {
      url: `memory://${storagePath}/upload`,
      expiresAt,
    };
  }

  async getDownloadSignedUrl(storagePath: string): Promise<SignedUrlResult> {
    const expiresAt = new Date(Date.now() + UPLOAD_URL_TTL_MS).toISOString();
    return {
      url: `memory://${storagePath}/download`,
      expiresAt,
    };
  }

  async isObjectPresent(storagePath: string, expectedByteSize: number): Promise<boolean> {
    const entry = this.objectPresent.get(storagePath);
    if (!entry) {
      return false;
    }
    return entry.byteSize === expectedByteSize;
  }

  async detectMimeType(storagePath: string): Promise<string | null> {
    return this.detectedMime.get(storagePath) ?? null;
  }

  async deleteObject(storagePath: string): Promise<void> {
    this.objectPresent.delete(storagePath);
    this.detectedMime.delete(storagePath);
  }

  async putObject(storagePath: string, body: Buffer, mimeType: string): Promise<void> {
    this.objectPresent.set(storagePath, { byteSize: body.length, content: body });
    const detected = detectMimeFromBytes(body.subarray(0, 16));
    this.detectedMime.set(storagePath, detected ?? mimeType);
  }

  async downloadObject(storagePath: string): Promise<Buffer> {
    const entry = this.objectPresent.get(storagePath);
    if (!entry) {
      throw new Error(`Object not found: ${storagePath}`);
    }
    return entry.content;
  }

  /** Test helper — simulates a successful PUT to Storage. */
  __setObject(
    storagePath: string,
    byteSize: number,
    detectedMime?: string,
    content?: Buffer,
  ): void {
    this.objectPresent.set(storagePath, {
      byteSize,
      content: content ?? Buffer.alloc(byteSize, 0x61),
    });
    if (detectedMime) {
      this.detectedMime.set(storagePath, detectedMime);
    }
  }
}
