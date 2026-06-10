import type { SearchRetrievalHitDto } from '../../retrieval/dto/search-retrieval.dto';
import { CHAT_RETRIEVAL_MIN_SCORE } from '../chat.constants';
import {
  CHAT_RETRIEVAL_STRONG_SCORE,
} from '../chat.constants';
import { filterRetrievalHitsForChat, isOffCorpusForChat } from './chat-retrieval-filter';

function hit(score: number): SearchRetrievalHitDto {
  return {
    documentId: 'doc_1',
    title: 'Cours',
    chunkId: 'chunk_1',
    text: 'Excerpt',
    score,
    contextHeader: 'header',
  };
}

describe('filterRetrievalHitsForChat', () => {
  it('keeps hits at or above the default min score', () => {
    const filtered = filterRetrievalHitsForChat([
      hit(CHAT_RETRIEVAL_MIN_SCORE),
      hit(CHAT_RETRIEVAL_MIN_SCORE + 0.1),
      hit(CHAT_RETRIEVAL_MIN_SCORE - 0.01),
    ]);

    expect(filtered).toHaveLength(2);
    expect(filtered.every((item) => item.score >= CHAT_RETRIEVAL_MIN_SCORE)).toBe(true);
  });

  it('returns empty when all hits are below threshold', () => {
    expect(filterRetrievalHitsForChat([hit(0.1), hit(0.15)])).toEqual([]);
  });

  it('isOffCorpusForChat is true when empty or top score is weak', () => {
    expect(isOffCorpusForChat([])).toBe(true);
    expect(isOffCorpusForChat([hit(CHAT_RETRIEVAL_STRONG_SCORE - 0.01)])).toBe(true);
    expect(isOffCorpusForChat([hit(CHAT_RETRIEVAL_STRONG_SCORE)])).toBe(false);
  });
});
