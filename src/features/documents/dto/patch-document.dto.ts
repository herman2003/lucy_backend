import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../../core/errors/lucy-api.error';

export type PatchDocumentRequestDto = {
  searchEnabled: boolean;
};

export function parsePatchDocumentRequest(body: unknown): PatchDocumentRequestDto {
  if (!body || typeof body !== 'object') {
    throw validationError('Request body must be an object');
  }
  const record = body as Record<string, unknown>;
  if (!('searchEnabled' in record)) {
    throw validationError('searchEnabled is required');
  }
  if (typeof record.searchEnabled !== 'boolean') {
    throw validationError('searchEnabled must be a boolean');
  }
  return { searchEnabled: record.searchEnabled };
}

function validationError(message: string): LucyApiError {
  return new LucyApiError(400, LucyErrorCodes.VALIDATION_ERROR, message);
}

