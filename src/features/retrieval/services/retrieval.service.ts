import { Inject, Injectable } from '@nestjs/common';

import { EMBEDDING_PORT } from '../../../core/llm/embedding.tokens';
import type { EmbeddingPort } from '../../../core/llm/embedding.port';
import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../../core/errors/lucy-api.error';
import { DOCUMENT_CHUNKS_REPOSITORY } from '../../documents/repositories/document-chunks.repository.port';
import type { DocumentChunksRepository } from '../../documents/repositories/document-chunks.repository.port';
import { DOCUMENTS_REPOSITORY } from '../../documents/repositories/documents.repository.port';
import type { DocumentsRepository } from '../../documents/repositories/documents.repository.port';
import type {
  SearchRetrievalHitDto,
  SearchRetrievalRequestDto,
} from '../dto/search-retrieval.dto';
import { buildContextHeader } from '../utils/context-header';

@Injectable()
export class RetrievalService {
  constructor(
    @Inject(DOCUMENTS_REPOSITORY)
    private readonly documentsRepository: DocumentsRepository,
    @Inject(DOCUMENT_CHUNKS_REPOSITORY)
    private readonly chunksRepository: DocumentChunksRepository,
    @Inject(EMBEDDING_PORT)
    private readonly embeddingPort: EmbeddingPort,
  ) {}

  async search(uid: string, input: SearchRetrievalRequestDto): Promise<SearchRetrievalHitDto[]> {
    const allDocs = await this.documentsRepository.list(uid);
    let eligible = allDocs.filter(
      (doc) => doc.status === 'ready' && doc.searchEnabled === true,
    );

    if (input.documentIds !== undefined) {
      const allowed = new Set(input.documentIds);
      eligible = eligible.filter((doc) => allowed.has(doc.id));
    }

    if (eligible.length === 0) {
      return [];
    }

    const titlesById = new Map(eligible.map((doc) => [doc.id, doc.title]));
    const documentIds = eligible.map((doc) => doc.id);

    let queryEmbedding: number[];
    try {
      const embedded = await this.embeddingPort.embed([input.query]);
      queryEmbedding = embedded[0]!;
    } catch {
      throw new LucyApiError(
        503,
        LucyErrorCodes.LLM_UNAVAILABLE,
        'Embedding service unavailable',
      );
    }

    const hits = await this.chunksRepository.searchSimilar(
      uid,
      queryEmbedding,
      documentIds,
      input.limit,
    );

    return hits.map((hit) => {
      const title = titlesById.get(hit.documentId) ?? '';
      return {
        documentId: hit.documentId,
        title,
        chunkId: hit.chunkId,
        text: hit.text,
        score: hit.score,
        contextHeader: buildContextHeader(title, hit.text, hit.pageStart, hit.pageEnd),
        ...(hit.pageStart !== undefined ? { pageStart: hit.pageStart } : {}),
        ...(hit.pageEnd !== undefined ? { pageEnd: hit.pageEnd } : {}),
      };
    });
  }
}
