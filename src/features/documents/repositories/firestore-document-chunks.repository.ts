import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';

import { cosineSimilarity } from '../../retrieval/utils/cosine-similarity';
import type {
  ChunkSimilarityHit,
  DocumentChunksRepository,
  PersistedDocumentChunk,
} from './document-chunks.repository.port';

type ChunkFirestoreData = {
  ordinal: number;
  text: string;
  tokenEstimate: number;
  embedding: number[];
  pageStart?: number;
  pageEnd?: number;
};

@Injectable()
export class FirestoreDocumentChunksRepository implements DocumentChunksRepository {
  async replaceChunks(
    uid: string,
    documentId: string,
    chunks: PersistedDocumentChunk[],
  ): Promise<void> {
    const chunksRef = this.chunksCollection(uid, documentId);
    const existing = await chunksRef.get();
    const batch = admin.firestore().batch();

    for (const doc of existing.docs) {
      batch.delete(doc.ref);
    }

    for (const chunk of chunks) {
      const ref = chunksRef.doc(chunk.id);
      const data: ChunkFirestoreData = {
        ordinal: chunk.ordinal,
        text: chunk.text,
        tokenEstimate: chunk.tokenEstimate,
        embedding: chunk.embedding,
        ...(chunk.pageStart !== undefined ? { pageStart: chunk.pageStart } : {}),
        ...(chunk.pageEnd !== undefined ? { pageEnd: chunk.pageEnd } : {}),
      };
      batch.set(ref, data);
    }

    await batch.commit();
  }

  async deleteChunks(uid: string, documentId: string): Promise<void> {
    const chunksRef = this.chunksCollection(uid, documentId);
    const snapshot = await chunksRef.get();
    if (snapshot.empty) {
      return;
    }
    const batch = admin.firestore().batch();
    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
  }

  async listChunks(uid: string, documentId: string): Promise<PersistedDocumentChunk[]> {
    const snapshot = await this.chunksCollection(uid, documentId).get();
    return snapshot.docs
      .map((doc) => {
        const data = doc.data() as ChunkFirestoreData;
        return {
          id: doc.id,
          ordinal: data.ordinal,
          text: data.text,
          tokenEstimate: data.tokenEstimate,
          embedding: data.embedding,
          ...(data.pageStart !== undefined ? { pageStart: data.pageStart } : {}),
          ...(data.pageEnd !== undefined ? { pageEnd: data.pageEnd } : {}),
        };
      })
      .sort((left, right) => left.ordinal - right.ordinal);
  }

  async searchSimilar(
    uid: string,
    queryEmbedding: number[],
    documentIds: string[],
    limit: number,
  ): Promise<ChunkSimilarityHit[]> {
    const hits: ChunkSimilarityHit[] = [];
    for (const documentId of documentIds) {
      const chunks = await this.listChunks(uid, documentId);
      for (const chunk of chunks) {
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

  private chunksCollection(uid: string, documentId: string) {
    return admin
      .firestore()
      .collection('users')
      .doc(uid)
      .collection('documents')
      .doc(documentId)
      .collection('chunks');
  }
}
