export const DOCUMENTS_STORAGE = Symbol('DOCUMENTS_STORAGE');

export type SignedUrlResult = {
  url: string;
  expiresAt: string;
};

export type DocumentsStorage = {
  getUploadSignedUrl(storagePath: string, mimeType: string): Promise<SignedUrlResult>;
  getDownloadSignedUrl(storagePath: string): Promise<SignedUrlResult>;
  isObjectPresent(storagePath: string, expectedByteSize: number): Promise<boolean>;
  detectMimeType(storagePath: string): Promise<string | null>;
  deleteObject(storagePath: string): Promise<void>;
  downloadObject(storagePath: string): Promise<Buffer>;
  putObject(storagePath: string, body: Buffer, mimeType: string): Promise<void>;
};

export const UPLOAD_URL_TTL_MS = 15 * 60_000;
