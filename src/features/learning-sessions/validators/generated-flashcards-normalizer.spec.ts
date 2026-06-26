import type { SearchRetrievalHitDto } from '../../retrieval/dto/search-retrieval.dto';
import { normalizeGeneratedFlashcardsPayload } from './generated-flashcards-normalizer';
import { parseGeneratedFlashcardItems } from './generated-flashcards.validator';

const hits: SearchRetrievalHitDto[] = [
  {
    documentId: 'doc_1',
    title: 'Lucy',
    chunkId: 'chunk_0',
    text: 'Lucy transforme les documents en apprentissage interactif.',
    score: 0.9,
    contextHeader: 'Lucy — mission',
    pageStart: 1,
    pageEnd: 1,
  },
  {
    documentId: 'doc_1',
    title: 'Lucy',
    chunkId: 'chunk_2',
    text: 'Lucy aide à surmonter les défis d apprentissage.',
    score: 0.8,
    contextHeader: 'Lucy — défis',
    pageStart: 2,
    pageEnd: 2,
  },
];

describe('normalizeGeneratedFlashcardsPayload', () => {
  it('wraps a root array into items', () => {
    const normalized = normalizeGeneratedFlashcardsPayload([
      {
        front: "Qu'est-ce que Lucy ?",
        back: 'Agent IA personnalisé.',
        sourceChunkId: ['chunk_0', 'chunk_2'],
      },
    ]);

    expect(normalized.items).toHaveLength(1);
    expect((normalized.items as unknown[])[0]).toMatchObject({
      front: "Qu'est-ce que Lucy ?",
      back: 'Agent IA personnalisé.',
      sourceChunkIds: ['chunk_0', 'chunk_2'],
    });
  });

  it('normalizes singular sourceChunkId string', () => {
    const normalized = normalizeGeneratedFlashcardsPayload([
      {
        front: 'Défis',
        back: 'Apprentissage efficace.',
        sourceChunkId: 'chunk_0',
      },
    ]);

    expect((normalized.items as unknown[])[0]).toMatchObject({
      sourceChunkIds: ['chunk_0'],
    });
  });

  it('parses OpenRouter-style flashcards payload end to end', () => {
    const items = parseGeneratedFlashcardItems(
      [
        {
          front: "Qu'est-ce que Lucy ?",
          back: 'Agent IA personnalisé.',
          sourceChunkId: ['chunk_0', 'chunk_2'],
        },
        {
          front: 'Défis',
          back: 'Apprentissage efficace.',
          sourceChunkId: 'chunk_0',
        },
      ],
      hits,
      2,
    );

    expect(items).toHaveLength(2);
    expect(items[0].sources).toHaveLength(2);
    expect(items[1].sources[0].chunkId).toBe('chunk_0');
  });

  it('ignores hallucinated chunk ids such as chunk_3', () => {
    const items = parseGeneratedFlashcardItems(
      [
        {
          front: 'Q1',
          back: 'A1',
          sourceChunkIds: ['chunk_0'],
        },
        {
          front: 'Q2',
          back: 'A2',
          sourceChunkIds: ['chunk_2'],
        },
        {
          front: 'Q3',
          back: 'A3',
          sourceChunkIds: ['chunk_3'],
        },
      ],
      hits,
      3,
    );

    expect(items[2].sources[0].chunkId).toBe('chunk_0');
  });
});
