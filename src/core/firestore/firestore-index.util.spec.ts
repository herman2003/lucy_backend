import {
  formatFirestoreIndexHint,
  isFirestoreMissingIndexError,
  isFirestoreTransientError,
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

  it('detects transient Firestore connectivity errors', () => {
    expect(isFirestoreTransientError({ code: 14 })).toBe(true);
    expect(
      isFirestoreTransientError({
        code: 14,
        message: 'Name resolution failed for target dns:firestore.googleapis.com:443',
      }),
    ).toBe(true);
    expect(isFirestoreTransientError({ code: 9 })).toBe(false);
  });

  it('extracts Firebase console URL from details', () => {
    const hint = formatFirestoreIndexHint({
      details:
        'index required https://console.firebase.google.com/v1/r/project/foo/firestore/indexes?create_exemption=abc',
    });
    expect(hint).toContain('console.firebase.google.com');
  });
});
