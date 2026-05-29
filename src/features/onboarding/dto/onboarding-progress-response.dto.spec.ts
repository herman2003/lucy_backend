import {
  buildOnboardingProgressResponse,
  DEFAULT_ONBOARDING_PROGRESS_STATUS,
} from './onboarding-progress-response.dto';

describe('buildOnboardingProgressResponse', () => {
  it('returns not_started with empty transcript when doc is empty', () => {
    expect(buildOnboardingProgressResponse({})).toEqual({
      onboardingStatus: DEFAULT_ONBOARDING_PROGRESS_STATUS,
      transcript: [],
    });
  });

  it('maps transcript and awaiting_final_confirm pending fields', () => {
    const profile = {
      primary_role: 'student' as const,
      main_domains: ['sciences' as const],
      learning_goal: 'exam' as const,
      self_assessed_level: 'intermediate' as const,
      explanation_style: 'step_by_step' as const,
      feedback_tone: 'encouraging' as const,
      tutoring_language: 'fr' as const,
    };

    expect(
      buildOnboardingProgressResponse({
        onboardingStatus: 'awaiting_final_confirm',
        pendingLearnerProfile: profile,
        pendingSummaryForUser: ' Résumé ',
        onboardingTranscript: [
          {
            questionId: 'q_role',
            questionText: 'Q',
            answerText: 'A',
            confirmedAt: '2026-05-25T12:00:00.000Z',
          },
        ],
      }),
    ).toEqual({
      onboardingStatus: 'awaiting_final_confirm',
      pendingLearnerProfile: profile,
      pendingSummaryForUser: 'Résumé',
      transcript: [
        {
          questionId: 'q_role',
          questionText: 'Q',
          answerText: 'A',
          confirmedAt: '2026-05-25T12:00:00.000Z',
        },
      ],
    });
  });
});
