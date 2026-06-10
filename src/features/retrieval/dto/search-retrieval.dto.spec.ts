import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import {
  DEFAULT_RETRIEVAL_LIMIT,
  MAX_RETRIEVAL_LIMIT,
  parseSearchRetrievalRequest,
} from './search-retrieval.dto';

describe('parseSearchRetrievalRequest', () => {
  it('defaults limit and trims query', () => {
    const parsed = parseSearchRetrievalRequest({ query: '  photosynthèse  ' });
    expect(parsed).toEqual({ query: 'photosynthèse', limit: DEFAULT_RETRIEVAL_LIMIT });
  });

  it('accepts limit and documentIds', () => {
    const parsed = parseSearchRetrievalRequest({
      query: 'test',
      limit: 3,
      documentIds: ['doc_a', 'doc_b'],
    });
    expect(parsed.limit).toBe(3);
    expect(parsed.documentIds).toEqual(['doc_a', 'doc_b']);
  });

  it('rejects limit out of range', () => {
    expect(() =>
      parseSearchRetrievalRequest({ query: 'x', limit: MAX_RETRIEVAL_LIMIT + 1 }),
    ).toThrow(
      expect.objectContaining({
        statusCode: 400,
        error: LucyErrorCodes.VALIDATION_ERROR,
      }),
    );
  });
});
