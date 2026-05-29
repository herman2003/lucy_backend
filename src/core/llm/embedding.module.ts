import { Module } from '@nestjs/common';

import { GeminiEmbeddingAdapter } from './gemini.embedding.adapter';
import { EMBEDDING_PORT } from './embedding.tokens';

/**
 * Embeddings always use Gemini at runtime (never `LLM_PROVIDER=mock` — SPEC Q10).
 */
@Module({
  providers: [
    GeminiEmbeddingAdapter,
    {
      provide: EMBEDDING_PORT,
      useExisting: GeminiEmbeddingAdapter,
    },
  ],
  exports: [EMBEDDING_PORT, GeminiEmbeddingAdapter],
})
export class EmbeddingModule {}
