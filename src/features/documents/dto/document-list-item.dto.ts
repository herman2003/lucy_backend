import type { DocumentStatus } from '../repositories/documents.repository.port';

export type DocumentListItemDto = {
  id: string;
  title: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  status: DocumentStatus;
  searchEnabled: boolean;
  errorCode?: string;
  chunkCount?: number;
  createdAt: string;
  updatedAt: string;
};

