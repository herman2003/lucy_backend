import { tryParseDevFirebaseToken } from './dev-firebase-token';

describe('tryParseDevFirebaseToken', () => {
  it('parses dev:uid tokens', () => {
    expect(tryParseDevFirebaseToken('dev:local-user-1')).toEqual({
      uid: 'local-user-1',
    });
  });

  it('rejects non-dev tokens', () => {
    expect(tryParseDevFirebaseToken('eyJhbGciOi')).toBeNull();
    expect(tryParseDevFirebaseToken('dev:')).toBeNull();
  });
});
