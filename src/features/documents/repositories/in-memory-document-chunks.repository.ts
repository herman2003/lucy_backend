import { Injectable } from '@nestjs/common';

import { cosineSimilarity } from '../../retrieval/utils/cosine-similarity';
import type {
  ChunkSimilarityHit,
  DocumentChunksRepository,
  PersistedDocumentChunk,
} from './document-chunks.repository.port';

@Injectable()
export class InMemoryDocumentChunksRepository implements DocumentChunksRepository {
  private readonly chunksByDoc = new Map<string, PersistedDocumentChunk[]>();

  private key(uid: string, documentId: string): string {
    return `${uid}:${documentId}`;
  }

  async replaceChunks(
    uid: string,
    documentId: string,
    chunks: PersistedDocumentChunk[],
  ): Promise<void> {
    this.chunksByDoc.set(this.key(uid, documentId), chunks.map((chunk) => ({ ...chunk })));
  }

  async deleteChunks(uid: string, documentId: string): Promise<void> {
    this.chunksByDoc.delete(this.key(uid, documentId));
  }

  listChunks(uid: string, documentId: string): PersistedDocumentChunk[] {
    return [...(this.chunksByDoc.get(this.key(uid, documentId)) ?? [])];
  }

  async searchSimilar(
    uid: string,
    queryEmbedding: number[],
    documentIds: string[],
    limit: number,
  ): Promise<ChunkSimilarityHit[]> {
    const hits: ChunkSimilarityHit[] = [];
    for (const documentId of documentIds) {
      for (const chunk of this.listChunks(uid, documentId)) {
        hits.push({
          documentId,
          chunkId: chunk.id,
          text: chunk.text,
          score: cosineSimilarity(queryEmbedding, chunk.embedding),
          ...(chunk.pageStart !== undefined ? { pageStart: chunk.pageStart } : {}),
          ...(chunk.pageEnd !== undefined ? { pageEnd: chunk.pageEnd } : {}),
        });
      }
    }
    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, limit);
  }
}
