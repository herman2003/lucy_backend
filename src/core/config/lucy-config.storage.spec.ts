import { loadLucyConfig, validateLucyConfig } from './lucy-config';

describe('loadLucyConfig storage provider', () => {
  it('defaults storageProvider to firebase', () => {
    const config = loadLucyConfig({ NODE_ENV: 'development' });
    expect(config.storageProvider).toBe('firebase');
  });

  it('loads R2 settings from env', () => {
    const config = loadLucyConfig({
      NODE_ENV: 'development',
      STORAGE_PROVIDER: 'r2',
      R2_ACCOUNT_ID: 'acct123',
      R2_BUCKET: 'lucy',
      R2_ACCESS_KEY_ID: 'key',
      R2_SECRET_ACCESS_KEY: 'secret',
      R2_ENDPOINT: 'https://acct123.r2.cloudflarestorage.com',
    });

    expect(config.storageProvider).toBe('r2');
    expect(config.r2Bucket).toBe('lucy');
    expect(config.r2Endpoint).toBe('https://acct123.r2.cloudflarestorage.com');
  });

  it('derives R2 endpoint from account id when endpoint unset', () => {
    const config = loadLucyConfig({
      R2_ACCOUNT_ID: 'acct123',
      STORAGE_PROVIDER: 'r2',
    });

    expect(config.r2Endpoint).toBe('https://acct123.r2.cloudflarestorage.com');
  });
});

describe('validateLucyConfig R2', () => {
  it('throws when STORAGE_PROVIDER=r2 without credentials', () => {
    const config = loadLucyConfig({
      NODE_ENV: 'development',
      FIRESTORE_PROVIDER: 'firebase',
      STORAGE_PROVIDER: 'r2',
      R2_BUCKET: 'lucy',
    });

    expect(() => validateLucyConfig(config)).toThrow(/R2_ACCESS_KEY_ID/);
  });

  it('passes when R2 env is complete', () => {
    const config = loadLucyConfig({
      NODE_ENV: 'development',
      FIRESTORE_PROVIDER: 'firebase',
      STORAGE_PROVIDER: 'r2',
      R2_BUCKET: 'lucy',
      R2_ACCESS_KEY_ID: 'key',
      R2_SECRET_ACCESS_KEY: 'secret',
      R2_ENDPOINT: 'https://acct.r2.cloudflarestorage.com',
    });

    expect(() => validateLucyConfig(config)).not.toThrow();
  });

  it('skips R2 validation when firestore is memory', () => {
    const config = loadLucyConfig({
      NODE_ENV: 'development',
      FIRESTORE_PROVIDER: 'memory',
      STORAGE_PROVIDER: 'r2',
    });

    expect(() => validateLucyConfig(config)).not.toThrow();
  });
});
