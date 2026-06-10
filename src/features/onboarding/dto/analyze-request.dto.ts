import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../../core/errors/lucy-api.error';

export type AnalyzeRequestDto = {
  locale: string;
  profileReduced?: boolean;
};

export function parseAnalyzeRequest(body: unknown): AnalyzeRequestDto {
  if (!body || typeof body !== 'object') {
    throw validationError('Request body must be an object');
  }

  const locale = (body as Record<string, unknown>).locale;
  if (typeof locale !== 'string' || !['fr', 'en', 'de'].includes(locale)) {
    throw validationError('locale must be fr, en, or de');
  }

  const dto: AnalyzeRequestDto = { locale };
  const profileReduced = (body as Record<string, unknown>).profileReduced;
  if (profileReduced === true) {
    dto.profileReduced = true;
  }
  return dto;
}

function validationError(message: string): LucyApiError {
  return new LucyApiError(400, LucyErrorCodes.VALIDATION_ERROR, message);
}
