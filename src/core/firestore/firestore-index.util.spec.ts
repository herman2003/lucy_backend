import {
  formatFirestoreIndexHint,
  isFirestoreMissingIndexError,
} from './firestore-index.util';

describe('firestore-index.util', () => {
  it('detects FAILED_PRECONDITION missing index errors', () => {
    expect(isFirestoreMissingIndexError({ code: 9 })).toBe(true);
    expect(
      isFirestoreMissingIndexError({
        message: 'The query requires a COLLECTION_GROUP_ASC index',
      }),
    ).toBe(true);
    expect(isFirestoreMissingIndexError(new Error('other'))).toBe(false);
  });

  it('extracts Firebase console URL from details', () => {
    const hint = formatFirestoreIndexHint({
      details:
        'index required https://console.firebase.google.com/v1/r/project/foo/firestore/indexes?create_exemption=abc',
    });
    expect(hint).toContain('console.firebase.google.com');
  });
});
