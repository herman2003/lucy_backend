export const DOCUMENTS_REPOSITORY = Symbol('DOCUMENTS_REPOSITORY');

export type DocumentStatus = 'uploading' | 'processing' | 'ready' | 'failed';

export type PersistedDocument = {
  id: string;
  uid: string;
  title: string;
  fileName: string;
  mimeType: string;
  storagePath: string;
  byteSize: number;
  status: DocumentStatus;
  searchEnabled: boolean;
  errorCode?: string;
  chunkCount?: number;
  pageCount?: number;
  ingestionAttempts?: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateDocumentInput = Pick<
  PersistedDocument,
  'title' | 'fileName' | 'mimeType' | 'byteSize'
>;

export type DocumentsRepository = {
  create(uid: string, input: CreateDocumentInput): Promise<PersistedDocument>;
  list(uid: string): Promise<PersistedDocument[]>;
  hasUploadInProgress(uid: string): Promise<boolean>;
  updateStatus(uid: string, id: string, status: DocumentStatus): Promise<void>;
  getById(uid: string, id: string): Promise<PersistedDocument | null>;
  delete(uid: string, id: string): Promise<void>;
  setSearchEnabled(uid: string, id: string, searchEnabled: boolean): Promise<PersistedDocument | null>;
  countActiveSearchEnabledReady(uid: string): Promise<number>;
  isStorageObjectPresent(uid: string, id: string): Promise<boolean>;
  getDetectedMimeType(uid: string, id: string): Promise<string | null>;
  setErrorCode(uid: string, id: string, errorCode: string | undefined): Promise<void>;
  listByStatus(status: DocumentStatus): Promise<PersistedDocument[]>;
  markIngestionSuccess(
    uid: string,
    id: string,
    input: { chunkCount: number; pageCount?: number },
  ): Promise<void>;
  markIngestionFailed(uid: string, id: string, errorCode: string): Promise<void>;
  incrementIngestionAttempts(uid: string, id: string): Promise<number>;
};

