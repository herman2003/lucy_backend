import type { EmbeddingPort } from '../../../core/llm/embedding.port';
import { unitVector } from './retrieval-fixture-vectors';

/**
 * Test double aligned with {@link unitVector} chunk fixtures — not the global LLM mock (Q10).
 */
export class RetrievalFixtureEmbeddingAdapter implements EmbeddingPort {
  constructor(private readonly queryAxis: number) {}

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map(() => unitVector(this.queryAxis));
  }
}
