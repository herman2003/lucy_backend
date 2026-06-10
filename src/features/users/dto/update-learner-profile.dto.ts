import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../../core/errors/lucy-api.error';
import type { LearnerProfile } from '../../onboarding/domain/learner-profile.enums';
import { parseLearnerProfile } from '../../onboarding/validators/analyze-response.validator';

export function parseUpdateLearnerProfileRequest(body: unknown): LearnerProfile {
  try {
    return parseLearnerProfile(body);
  } catch {
    throw new LucyApiError(
      400,
      LucyErrorCodes.VALIDATION_ERROR,
      'Invalid learner profile payload',
    );
  }
}
