import type { SearchRetrievalHitDto } from '../../retrieval/dto/search-retrieval.dto';
import { normalizeGeneratedQuizPayload } from './generated-quiz-normalizer';
import { parseGeneratedQuizItems } from './generated-quiz.validator';

const hits: SearchRetrievalHitDto[] = [
  {
    documentId: 'doc_1',
    title: 'Lucy',
    chunkId: 'chunk_1',
    text: 'Lucy transforme les documents en apprentissage interactif.',
    score: 0.9,
    contextHeader: 'Lucy — mission',
    pageStart: 1,
    pageEnd: 1,
  },
];

describe('normalizeGeneratedQuizPayload', () => {
  it('wraps a root array into items', () => {
    const normalized = normalizeGeneratedQuizPayload([
      {
        question: 'Q1 ?',
        options: [
          { text: 'A', isCorrect: false },
          { text: 'B', isCorrect: true },
          { text: 'C', isCorrect: false },
          { text: 'D', isCorrect: false },
        ],
        sourceChunkIds: ['chunk_1'],
      },
    ]);

    expect(normalized.items).toHaveLength(1);
    expect((normalized.items as unknown[])[0]).toMatchObject({
      question: 'Q1 ?',
      choices: ['A', 'B', 'C', 'D'],
      correctIndex: 1,
      explanation: 'Réponse dérivée des extraits fournis.',
      sourceChunkIds: ['chunk_1'],
    });
  });

  it('normalizes quiz_items with option objects (text only)', () => {
    const items = parseGeneratedQuizItems(
      {
        quiz_items: [
          {
            question: "Quel est l'objectif de Lucy ?",
            options: [
              { option_id: 'a', text: 'Stockage cloud uniquement.' },
              {
                option_id: 'b',
                text: 'Transformer des documents en apprentissage interactif.',
                is_correct: true,
              },
              { option_id: 'c', text: 'Réseau social.' },
              { option_id: 'd', text: 'Messagerie instantanée.' },
            ],
          },
        ],
      },
      hits,
      1,
    );

    expect(items[0]).toMatchObject({
      correctIndex: 1,
      choices: [
        'Stockage cloud uniquement.',
        'Transformer des documents en apprentissage interactif.',
        'Réseau social.',
        'Messagerie instantanée.',
      ],
    });
  });

  it('normalizes choices with choice_text objects', () => {
    const items = parseGeneratedQuizItems(
      {
        quiz_questions: [
          {
            question_text: "Quel est l'objectif de Lucy ?",
            choices: [
              { choice_id: 'A', choice_text: 'Chatbot général.' },
              { choice_id: 'B', choice_text: 'Apprentissage interactif.', is_correct: true },
              { choice_id: 'C', choice_text: 'Stockage seul.' },
              { choice_id: 'D', choice_text: 'Calendrier.' },
            ],
          },
        ],
      },
      hits,
      1,
    );

    expect(items[0]).toMatchObject({
      question: "Quel est l'objectif de Lucy ?",
      correctIndex: 1,
    });
  });

  it('normalizes quiz_questions with question_text and question_choices', () => {
    const normalized = normalizeGeneratedQuizPayload(
      {
        quiz_title: 'Découverte de Lucy',
        quiz_questions: [
          {
            question_id: 'lucy_q1',
            question_text: 'Quelle est la mission de Lucy ?',
            question_choices: [
              { choice_id: 'a', choice_text: 'Créer des PDF.', is_correct: false },
              {
                choice_id: 'b',
                choice_text: 'Transformer les documents en apprentissage interactif.',
                is_correct: true,
              },
              { choice_id: 'c', choice_text: 'Gérer la comptabilité.', is_correct: false },
              { choice_id: 'd', choice_text: 'Publier des romans.', is_correct: false },
            ],
          },
        ],
      },
      { fallbackChunkIds: ['chunk_1'] },
    );

    expect(normalized.items).toHaveLength(1);
    expect((normalized.items as unknown[])[0]).toMatchObject({
      question: 'Quelle est la mission de Lucy ?',
      choices: [
        'Créer des PDF.',
        'Transformer les documents en apprentissage interactif.',
        'Gérer la comptabilité.',
        'Publier des romans.',
      ],
      correctIndex: 1,
      sourceChunkIds: ['chunk_1'],
    });
  });

  it('parses OpenRouter-style quiz payload end to end', () => {
    const items = parseGeneratedQuizItems(
      [
        {
          question: 'Quelle est la mission de Lucy ?',
          options: [
            { text: 'Organiser des événements.', isCorrect: false },
            {
              text: 'Transformer les documents en apprentissage interactif.',
              isCorrect: true,
            },
            { text: 'Gérer la comptabilité.', isCorrect: false },
            { text: 'Publier des romans.', isCorrect: false },
          ],
          sourceChunkIds: ['chunk_1'],
        },
      ],
      hits,
      1,
    );

    expect(items[0]).toMatchObject({
      question: 'Quelle est la mission de Lucy ?',
      choices: [
        'Organiser des événements.',
        'Transformer les documents en apprentissage interactif.',
        'Gérer la comptabilité.',
        'Publier des romans.',
      ],
      correctIndex: 1,
    });
  });
});
