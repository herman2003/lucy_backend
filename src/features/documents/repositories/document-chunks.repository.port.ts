export const DOCUMENT_CHUNKS_REPOSITORY = Symbol('DOCUMENT_CHUNKS_REPOSITORY');

export type PersistedDocumentChunk = {
  id: string;
  ordinal: number;
  text: string;
  tokenEstimate: number;
  embedding: number[];
  pageStart?: number;
  pageEnd?: number;
};

export type ChunkSimilarityHit = {
  documentId: string;
  chunkId: string;
  text: string;
  score: number;
  pageStart?: number;
  pageEnd?: number;
};

export type DocumentChunksRepository = {
  replaceChunks(
    uid: string,
    documentId: string,
    chunks: PersistedDocumentChunk[],
  ): Promise<void>;
  deleteChunks(uid: string, documentId: string): Promise<void>;
  listChunks(uid: string, documentId: string): Promise<PersistedDocumentChunk[]>;
  searchSimilar(
    uid: string,
    queryEmbedding: number[],
    documentIds: string[],
    limit: number,
  ): Promise<ChunkSimilarityHit[]>;
};
