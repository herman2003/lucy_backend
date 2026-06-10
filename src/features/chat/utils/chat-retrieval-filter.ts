import type { SearchRetrievalHitDto } from '../../retrieval/dto/search-retrieval.dto';
import {
  CHAT_RETRIEVAL_MIN_SCORE,
  CHAT_RETRIEVAL_STRONG_SCORE,
} from '../chat.constants';

/**
 * Keeps only retrieval hits at or above the chat relevance floor.
 * Off-topic questions (e.g. small talk) often match weakly; treating them as
 * "no excerpts" lets the tutor reply in prose instead of citing noise.
 */
export function filterRetrievalHitsForChat(
  hits: SearchRetrievalHitDto[],
  minScore: number = CHAT_RETRIEVAL_MIN_SCORE,
): SearchRetrievalHitDto[] {
  return hits
    .filter((hit) => hit.score >= minScore)
    .sort((a, b) => b.score - a.score);
}

/** True when the question should not use RAG excerpts (empty or weak top match). */
export function isOffCorpusForChat(
  hits: SearchRetrievalHitDto[],
  strongScore: number = CHAT_RETRIEVAL_STRONG_SCORE,
): boolean {
  if (hits.length === 0) {
    return true;
  }
  return hits[0]!.score < strongScore;
}
