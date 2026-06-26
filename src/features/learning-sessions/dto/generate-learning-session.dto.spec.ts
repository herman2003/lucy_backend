import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../../core/errors/lucy-api.error';
import { parseGenerateLearningSessionRequest } from './generate-learning-session.dto';

describe('parseGenerateLearningSessionRequest (LEARN-01a)', () => {
  it('parses quiz with default itemCount', () => {
    expect(parseGenerateLearningSessionRequest({ type: 'quiz' })).toEqual({
      type: 'quiz',
      itemCount: 5,
    });
  });

  it('parses flashcards with default itemCount', () => {
    expect(parseGenerateLearningSessionRequest({ type: 'flashcards' })).toEqual({
      type: 'flashcards',
      itemCount: 10,
    });
  });

  it('accepts explicit itemCount within limits', () => {
    expect(
      parseGenerateLearningSessionRequest({ type: 'quiz', itemCount: 12 }),
    ).toEqual({
      type: 'quiz',
      itemCount: 12,
    });
  });

  it('accepts optional sourceChatId', () => {
    expect(
      parseGenerateLearningSessionRequest({
        type: 'flashcards',
        itemCount: 3,
        sourceChatId: 'chat_abc',
      }),
    ).toEqual({
      type: 'flashcards',
      itemCount: 3,
      sourceChatId: 'chat_abc',
    });
  });

  it('accepts optional examType (LEARN-10b)', () => {
    expect(
      parseGenerateLearningSessionRequest({
        type: 'flashcards',
        itemCount: 8,
        examType: 'partiel',
      }),
    ).toEqual({
      type: 'flashcards',
      itemCount: 8,
      examType: 'partiel',
    });
  });

  it('accepts optional topicHint and focusAreas (LEARN-07d)', () => {
    expect(
      parseGenerateLearningSessionRequest({
        type: 'quiz',
        itemCount: 5,
        topicHint: 'entropie',
        focusAreas: [
          {
            id: 'focus_1',
            documentId: 'doc_1',
            documentTitle: 'Thermo',
            label: 'Chapitre entropie',
            ordinalStart: 0,
            ordinalEnd: 2,
            importance: 'high',
            rationale: 'Concept central.',
            keyConcepts: ['entropie'],
          },
        ],
      }),
    ).toEqual({
      type: 'quiz',
      itemCount: 5,
      topicHint: 'entropie',
      focusAreas: [
        {
          id: 'focus_1',
          documentId: 'doc_1',
          documentTitle: 'Thermo',
          label: 'Chapitre entropie',
          ordinalStart: 0,
          ordinalEnd: 2,
          importance: 'high',
          rationale: 'Concept central.',
          keyConcepts: ['entropie'],
        },
      ],
    });
  });

  it('rejects invalid type', () => {
    expect(() =>
      parseGenerateLearningSessionRequest({ type: 'exam' }),
    ).toThrow(LucyApiError);

    try {
      parseGenerateLearningSessionRequest({ type: 'exam' });
    } catch (error) {
      expect(error).toBeInstanceOf(LucyApiError);
      expect((error as LucyApiError).error).toBe(
        LucyErrorCodes.LEARNING_VALIDATION_ERROR,
      );
    }
  });

  it('rejects itemCount above quiz max', () => {
    expect(() =>
      parseGenerateLearningSessionRequest({ type: 'quiz', itemCount: 16 }),
    ).toThrow(LucyApiError);
  });

  it('rejects non-object body', () => {
    expect(() => parseGenerateLearningSessionRequest(null)).toThrow(LucyApiError);
  });
});
