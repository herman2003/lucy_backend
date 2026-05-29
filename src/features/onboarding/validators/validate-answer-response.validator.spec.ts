import { LucyApiError } from '../../../core/errors/lucy-api.error';
import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { parseValidateAnswerLlmResponse } from './validate-answer-response.validator';

describe('parseValidateAnswerLlmResponse', () => {
  it('accepts valid true with turnSummary', () => {
    expect(
      parseValidateAnswerLlmResponse({
        valid: true,
        turnSummary: 'Noted.',
      }),
    ).toEqual({ valid: true, turnSummary: 'Noted.' });
  });

  it('accepts valid false with rephrasedQuestion and reason', () => {
    expect(
      parseValidateAnswerLlmResponse({
        valid: false,
        rephrasedQuestion: 'Are you a student or learning on your own?',
        reason: 'too_vague',
      }),
    ).toEqual({
      valid: false,
      rephrasedQuestion: 'Are you a student or learning on your own?',
      reason: 'too_vague',
    });
  });

  it('rejects meta rephrasedQuestion', () => {
    try {
      parseValidateAnswerLlmResponse({
        valid: false,
        rephrasedQuestion: 'Peux-tu préciser ta situation ?',
        reason: 'too_vague',
      });
      fail('expected LucyApiError');
    } catch (error) {
      expect(error).toBeInstanceOf(LucyApiError);
      expect((error as LucyApiError).error).toBe(
        LucyErrorCodes.LLM_RESPONSE_INVALID,
      );
    }
  });
});
