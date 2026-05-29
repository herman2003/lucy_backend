import type { LearnerProfile } from '../domain/learner-profile.enums';

export type AnalyzeSuccessDto = {
  learnerProfile: LearnerProfile;
  summaryForUser: string;
};

export type AnalyzeFallbackDto = {
  fallbackProfileSummary: string;
  requiresUserConfirmation: true;
};

export type AnalyzeResponseDto = AnalyzeSuccessDto | AnalyzeFallbackDto;

export function isAnalyzeFallback(
  response: AnalyzeResponseDto,
): response is AnalyzeFallbackDto {
  return 'fallbackProfileSummary' in response;
}
