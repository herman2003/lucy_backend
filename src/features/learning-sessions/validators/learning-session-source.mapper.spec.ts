import type { SearchRetrievalHitDto } from '../../retrieval/dto/search-retrieval.dto';
import { mapLearningSessionSources } from './learning-session-source.mapper';

const hits: SearchRetrievalHitDto[] = [
  {
    documentId: 'doc_1',
    title: 'Lucy',
    chunkId: 'chunk_0',
    text: 'Intro Lucy.',
    score: 0.9,
    contextHeader: 'Lucy — intro',
    pageStart: 1,
    pageEnd: 1,
  },
  {
    documentId: 'doc_1',
    title: 'Lucy',
    chunkId: 'chunk_2',
    text: 'Défis apprentissage.',
    score: 0.8,
    contextHeader: 'Lucy — défis',
    pageStart: 2,
    pageEnd: 2,
  },
];

describe('mapLearningSessionSources', () => {
  it('keeps known chunk ids and drops unknown ones', () => {
    const sources = mapLearningSessionSources(['chunk_0', 'chunk_3', 'chunk_2'], hits);

    expect(sources.map((source) => source.chunkId)).toEqual(['chunk_0', 'chunk_2']);
  });

  it('maps positional chunk_N aliases to retrieval hit index', () => {
    const sources = mapLearningSessionSources(['chunk_1'], hits);

    expect(sources[0]?.chunkId).toBe('chunk_2');
  });

  it('falls back to the first retrieval hit when all ids are unknown', () => {
    const sources = mapLearningSessionSources(['chunk_9'], hits);

    expect(sources).toHaveLength(1);
    expect(sources[0]?.chunkId).toBe('chunk_0');
  });
});
