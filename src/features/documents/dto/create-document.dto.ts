import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../../core/errors/lucy-api.error';

export type CreateDocumentRequestDto = {
  title: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
};

const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set<string>([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
]);

export function parseCreateDocumentRequest(body: unknown): CreateDocumentRequestDto {
  if (!body || typeof body !== 'object') {
    throw validationError('Request body must be an object');
  }

  const record = body as Record<string, unknown>;

  const title = record.title;
  if (typeof title !== 'string' || title.trim().length < 3 || title.trim().length > 120) {
    throw validationError('title must be a string of length 3..120');
  }

  const fileName = record.fileName;
  if (typeof fileName !== 'string' || fileName.trim().length === 0) {
    throw validationError('fileName is required');
  }

  const mimeType = record.mimeType;
  if (typeof mimeType !== 'string' || mimeType.trim().length === 0) {
    throw validationError('mimeType is required');
  }
  if (!ALLOWED_MIME_TYPES.has(mimeType.trim())) {
    throw new LucyApiError(
      422,
      LucyErrorCodes.DOCUMENT_TYPE_NOT_ALLOWED,
      'mimeType is not allowed',
    );
  }

  const byteSize = record.byteSize;
  if (typeof byteSize !== 'number' || !Number.isFinite(byteSize) || byteSize <= 0) {
    throw validationError('byteSize must be a positive number');
  }
  if (byteSize > MAX_BYTES) {
    throw new LucyApiError(422, LucyErrorCodes.DOCUMENT_TOO_LARGE, 'Document too large');
  }

  return {
    title: title.trim(),
    fileName: fileName.trim(),
    mimeType: mimeType.trim(),
    byteSize,
  };
}

function validationError(message: string): LucyApiError {
  return new LucyApiError(400, LucyErrorCodes.VALIDATION_ERROR, message);
}

