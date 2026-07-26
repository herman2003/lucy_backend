import type { SearchRetrievalHitDto } from '../../retrieval/dto/search-retrieval.dto';
import { parseGeneratedFlashcardItems } from './generated-flashcards.validator';

const hits: SearchRetrievalHitDto[] = [
  {
    documentId: 'doc_1',
    title: 'Thermo',
    chunkId: 'chunk_1',
    text: 'Entropie et énergie libre.',
    score: 0.9,
    contextHeader: 'Thermo — Entropie',
    pageStart: 1,
    pageEnd: 1,
  },
];

describe('parseGeneratedFlashcardItems (LEARN-02)', () => {
  it('parses valid LLM payload into flashcard items with sources', () => {
    const items = parseGeneratedFlashcardItems(
      {
        items: [
          {
            front: 'Entropie',
            back: 'Mesure du désordre d’un système.',
            sourceChunkIds: ['chunk_1'],
          },
        ],
      },
      hits,
      1,
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: 'item-1',
      front: 'Entropie',
      back: 'Mesure du désordre d’un système.',
      sources: [
        {
          chunkId: 'chunk_1',
          documentId: 'doc_1',
          title: 'Thermo',
          pageStart: 1,
          pageEnd: 1,
        },
      ],
    });
  });

  it('rejects missing front or back', () => {
    expect(() =>
      parseGeneratedFlashcardItems(
        {
          items: [
            {
              front: '',
              back: 'Answer',
              sourceChunkIds: ['chunk_1'],
            },
          ],
        },
        hits,
        1,
      ),
    ).toThrow('items[0].front must be a non-empty string');
  });

  it('rejects wrong item count', () => {
    expect(() =>
      parseGeneratedFlashcardItems(
        {
          items: [
            {
              front: 'Q',
              back: 'A',
              sourceChunkIds: ['chunk_1'],
            },
          ],
        },
        hits,
        2,
      ),
    ).toThrow('expected 2 flashcard items');
  });
});
