import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../../core/errors/lucy-api.error';
import { OnboardingQuestionCatalog } from '../questions/onboarding-question.catalog';
import {
  assertTranscriptComplete,
  type OnboardingTranscriptTurn,
} from './onboarding-transcript';

function buildTranscript(count: number): OnboardingTranscriptTurn[] {
  return OnboardingQuestionCatalog.orderedQuestionIds
    .slice(0, count)
    .map((questionId, index) => ({
      questionId,
      questionText: `Question ${index}`,
      answerText: `Answer ${index}`,
      confirmedAt: new Date().toISOString(),
    }));
}

describe('assertTranscriptComplete', () => {
  it('accepts seven unique question ids', () => {
    expect(() => assertTranscriptComplete(buildTranscript(7))).not.toThrow();
  });

  it('rejects fewer than seven turns', () => {
    try {
      assertTranscriptComplete(buildTranscript(6));
      fail('expected LucyApiError');
    } catch (error) {
      expect(error).toBeInstanceOf(LucyApiError);
      expect((error as LucyApiError).error).toBe(
        LucyErrorCodes.ONBOARDING_TRANSCRIPT_INCOMPLETE,
      );
    }
  });
});
