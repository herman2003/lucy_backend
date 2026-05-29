import { EMBEDDING_VECTOR_DIMENSION } from './embedding.constants';
import type { EmbeddingPort } from './embedding.port';

/**
 * Test double for {@link EmbeddingPort} — no network calls.
 * Not registered in {@link LlmModule}; override `EMBEDDING_PORT` in tests.
 */
export class FakeEmbeddingAdapter implements EmbeddingPort {
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text, index) =>
      Array.from({ length: EMBEDDING_VECTOR_DIMENSION }, (_, dim) =>
        Number(((index + 1) * 0.001 + dim * 0.0001 + text.length * 0.00001).toFixed(6)),
      ),
    );
  }
}
