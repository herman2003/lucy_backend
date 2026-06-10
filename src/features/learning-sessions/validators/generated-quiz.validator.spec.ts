import type { SearchRetrievalHitDto } from '../../retrieval/dto/search-retrieval.dto';
import { parseGeneratedQuizItems } from './generated-quiz.validator';

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

describe('parseGeneratedQuizItems (LEARN-01b)', () => {
  it('parses valid LLM payload into quiz items with sources', () => {
    const items = parseGeneratedQuizItems(
      {
        items: [
          {
            question: 'Qu’est-ce que l’entropie ?',
            choices: ['A', 'B', 'C', 'D'],
            correctIndex: 2,
            explanation: 'Parce que.',
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
      question: 'Qu’est-ce que l’entropie ?',
      choices: ['A', 'B', 'C', 'D'],
      correctIndex: 2,
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

  it('rejects wrong item count', () => {
    expect(() =>
      parseGeneratedQuizItems(
        {
          items: [
            {
              question: 'Q?',
              choices: ['A', 'B', 'C', 'D'],
              correctIndex: 0,
              explanation: 'E',
              sourceChunkIds: ['chunk_1'],
            },
          ],
        },
        hits,
        2,
      ),
    ).toThrow('expected 2 quiz items');
  });
});
