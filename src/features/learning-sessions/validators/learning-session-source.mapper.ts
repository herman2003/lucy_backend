import type { LearningSessionSource } from '../domain/learning-session.types';
import type { SearchRetrievalHitDto } from '../../retrieval/dto/search-retrieval.dto';

/**
 * Maps LLM sourceChunkIds to persisted sources.
 * Unknown IDs are dropped; positional `chunk_N` aliases map to retrieval hit index N.
 * Falls back to the first retrieval hit when nothing resolves.
 */
export function mapLearningSessionSources(
  chunkIds: string[],
  hits: SearchRetrievalHitDto[],
): LearningSessionSource[] {
  const hitsByChunkId = new Map(hits.map((hit) => [hit.chunkId, hit]));
  const uniqueIds = [...new Set(chunkIds)];
  const sources: LearningSessionSource[] = [];

  for (const chunkId of uniqueIds) {
    const hit = resolveRetrievalHit(chunkId, hits, hitsByChunkId);
    if (!hit) {
      continue;
    }
    sources.push(toLearningSessionSource(hit));
  }

  if (sources.length === 0 && hits.length > 0) {
    sources.push(toLearningSessionSource(hits[0]));
  }

  return sources;
}

function resolveRetrievalHit(
  chunkId: string,
  hits: SearchRetrievalHitDto[],
  hitsByChunkId: Map<string, SearchRetrievalHitDto>,
): SearchRetrievalHitDto | undefined {
  const direct = hitsByChunkId.get(chunkId);
  if (direct) {
    return direct;
  }

  const match = /^chunk_(\d+)$/i.exec(chunkId.trim());
  if (!match) {
    return undefined;
  }

  const index = Number.parseInt(match[1], 10);
  if (!Number.isInteger(index) || index < 0 || index >= hits.length) {
    return undefined;
  }

  return hits[index];
}

function toLearningSessionSource(hit: SearchRetrievalHitDto): LearningSessionSource {
  return {
    chunkId: hit.chunkId,
    documentId: hit.documentId,
    title: hit.title,
    excerpt: hit.text.slice(0, 240),
    ...(hit.pageStart !== undefined ? { pageStart: hit.pageStart } : {}),
    ...(hit.pageEnd !== undefined ? { pageEnd: hit.pageEnd } : {}),
  };
}
