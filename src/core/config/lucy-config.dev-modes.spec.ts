import { loadLucyConfig } from './lucy-config';

describe('loadLucyConfig dev modes', () => {
  it('enables dev auth and memory firestore only in non-production', () => {
    const config = loadLucyConfig({
      NODE_ENV: 'development',
      FIREBASE_AUTH_MODE: 'dev',
      FIRESTORE_PROVIDER: 'memory',
    });

    expect(config.firebaseAuthMode).toBe('dev');
    expect(config.firestoreProvider).toBe('memory');
  });

  it('forces firebase providers in production', () => {
    const config = loadLucyConfig({
      NODE_ENV: 'production',
      FIREBASE_AUTH_MODE: 'dev',
      FIRESTORE_PROVIDER: 'memory',
    });

    expect(config.firebaseAuthMode).toBe('firebase');
    expect(config.firestoreProvider).toBe('firebase');
  });
});
