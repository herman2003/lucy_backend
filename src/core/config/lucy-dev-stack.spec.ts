import { describeDevStack, isLocalDevStackReady } from './lucy-dev-stack';
import { loadLucyConfig } from './lucy-config';

describe('lucy-dev-stack', () => {
  it('detects full local dev stack from env', () => {
    const config = loadLucyConfig({
      NODE_ENV: 'development',
      LLM_PROVIDER: 'mock',
      FIREBASE_AUTH_MODE: 'dev',
      FIRESTORE_PROVIDER: 'memory',
      GEMINI_API_KEY: '',
    });

    expect(isLocalDevStackReady(config)).toBe(true);
    expect(describeDevStack(config)).toMatchObject({
      localStackReady: true,
      llmProvider: 'mock',
      firebaseAuthMode: 'dev',
      firestoreProvider: 'memory',
      geminiConfigured: false,
      openRouterConfigured: false,
    });
  });

  it('reports openRouterConfigured when key is set', () => {
    const config = loadLucyConfig({
      NODE_ENV: 'development',
      LLM_PROVIDER: 'openrouter',
      OPENROUTER_API_KEY: 'sk-or-test',
      GEMINI_API_KEY: 'gemini-key',
    });

    expect(describeDevStack(config)).toMatchObject({
      openRouterConfigured: true,
      geminiConfigured: true,
      llmProvider: 'openrouter',
    });
  });

  it('requires gemini key when provider is gemini', () => {
    const config = loadLucyConfig({
      NODE_ENV: 'development',
      LLM_PROVIDER: 'gemini',
      GEMINI_API_KEY: '',
    });

    expect(isLocalDevStackReady(config)).toBe(false);
    expect(describeDevStack(config).geminiConfigured).toBe(false);
  });
});
