import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../../core/errors/lucy-api.error';

export const DEFAULT_RETRIEVAL_LIMIT = 5;
export const MAX_RETRIEVAL_LIMIT = 20;

export type SearchRetrievalRequestDto = {
  query: string;
  limit: number;
  documentIds?: string[];
};

export type SearchRetrievalHitDto = {
  documentId: string;
  title: string;
  chunkId: string;
  text: string;
  score: number;
  contextHeader: string;
  pageStart?: number;
  pageEnd?: number;
};

export function parseSearchRetrievalRequest(body: unknown): SearchRetrievalRequestDto {
  if (!body || typeof body !== 'object') {
    throw validationError('Request body must be an object');
  }

  const record = body as Record<string, unknown>;

  const query = record.query;
  if (typeof query !== 'string' || query.trim().length === 0) {
    throw validationError('query is required');
  }
  if (query.trim().length > 2000) {
    throw validationError('query must be at most 2000 characters');
  }

  let limit = DEFAULT_RETRIEVAL_LIMIT;
  if (record.limit !== undefined) {
    if (typeof record.limit !== 'number' || !Number.isInteger(record.limit)) {
      throw validationError('limit must be an integer');
    }
    if (record.limit < 1 || record.limit > MAX_RETRIEVAL_LIMIT) {
      throw validationError(`limit must be between 1 and ${MAX_RETRIEVAL_LIMIT}`);
    }
    limit = record.limit;
  }

  let documentIds: string[] | undefined;
  if (record.documentIds !== undefined) {
    if (!Array.isArray(record.documentIds)) {
      throw validationError('documentIds must be an array');
    }
    documentIds = record.documentIds.map((id, index) => {
      if (typeof id !== 'string' || id.trim().length === 0) {
        throw validationError(`documentIds[${index}] must be a non-empty string`);
      }
      return id.trim();
    });
  }

  return {
    query: query.trim(),
    limit,
    ...(documentIds !== undefined ? { documentIds } : {}),
  };
}

function validationError(message: string): LucyApiError {
  return new LucyApiError(400, LucyErrorCodes.VALIDATION_ERROR, message);
}
