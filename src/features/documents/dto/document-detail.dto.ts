import type { DocumentOutlineEntry } from '../domain/document-outline.types';
import type { DocumentStatus } from '../repositories/documents.repository.port';

export type DocumentDetailDto = {
  id: string;
  title: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  status: DocumentStatus;
  searchEnabled: boolean;
  errorCode?: string;
  chunkCount?: number;
  outline?: DocumentOutlineEntry[];
  createdAt: string;
  updatedAt: string;
};

