import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../../core/errors/lucy-api.error';
import { parseAnalyzeLlmResponse } from './analyze-response.validator';

describe('parseAnalyzeLlmResponse', () => {
  const validProfile = {
    primary_role: 'student',
    main_domains: ['sciences'],
    learning_goal: 'exam',
    self_assessed_level: 'intermediate',
    explanation_style: 'step_by_step',
    feedback_tone: 'encouraging',
    tutoring_language: 'fr',
  };

  it('accepts a complete learnerProfile and summary', () => {
    expect(
      parseAnalyzeLlmResponse({
        learnerProfile: validProfile,
        summaryForUser: 'Tu prépares un examen en sciences.',
      }),
    ).toEqual({
      learnerProfile: validProfile,
      summaryForUser: 'Tu prépares un examen en sciences.',
    });
  });

  it('rejects invalid enum with ONBOARDING_PROFILE_INCOMPLETE', () => {
    try {
      parseAnalyzeLlmResponse({
        learnerProfile: { ...validProfile, primary_role: 'invalid' },
        summaryForUser: 'Summary',
      });
      fail('expected LucyApiError');
    } catch (error) {
      expect(error).toBeInstanceOf(LucyApiError);
      expect((error as LucyApiError).error).toBe(
        LucyErrorCodes.ONBOARDING_PROFILE_INCOMPLETE,
      );
      expect((error as LucyApiError).statusCode).toBe(422);
    }
  });
});
