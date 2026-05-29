/**
 * Embeddings for document RAG chunks (always backed by Gemini at runtime — SPEC Q10).
 * Unit tests inject {@link FakeEmbeddingAdapter} via `EMBEDDING_PORT` override.
 */
export interface EmbeddingPort {
  embed(texts: string[]): Promise<number[][]>;
}
