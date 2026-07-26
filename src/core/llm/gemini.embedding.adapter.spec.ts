import { LucyErrorCodes } from '../errors/lucy-error-codes';
import { EMBEDDING_VECTOR_DIMENSION } from './embedding.constants';
import { FakeEmbeddingAdapter } from './fake.embedding.adapter';
import { GeminiEmbeddingAdapter } from './gemini.embedding.adapter';

function testConfig(overrides: Partial<{ geminiApiKey: string }> = {}) {
  return {
    port: 3001,
    nodeEnv: 'test',
    firebaseProjectId: 'test',
    firebaseStorageBucket: 'test.appspot.com',
    storageProvider: 'firebase' as const,
    r2AccountId: '',
    r2AccessKeyId: '',
    r2SecretAccessKey: '',
    r2Bucket: '',
    r2Endpoint: '',
    llmProvider: 'mock' as const,
    geminiApiKey: overrides.geminiApiKey ?? '',
    geminiModel: 'gemini-2.5-flash',
    geminiEmbeddingModel: 'gemini-embedding-001',
    openRouterApiKey: '',
    openRouterModel: 'google/gemini-2.5-flash',
    openRouterAppUrl: 'http://localhost:3001',
    openRouterAppName: 'Lucy API',
    corsAllowedOrigins: [],
    firebaseAuthMode: 'dev' as const,
    firestoreProvider: 'memory' as const,
  };
}

describe('GeminiEmbeddingAdapter', () => {
  it('throws LLM_UNAVAILABLE when GEMINI_API_KEY is not set', async () => {
    const adapter = new GeminiEmbeddingAdapter(testConfig());

    await expect(adapter.embed(['chunk one'])).rejects.toMatchObject({
      error: LucyErrorCodes.LLM_UNAVAILABLE,
      statusCode: 503,
    });
  });

  it('returns empty array for empty input without calling the API', async () => {
    const adapter = new GeminiEmbeddingAdapter(
      testConfig({ geminiApiKey: 'test-key' }),
    );

    await expect(adapter.embed([])).resolves.toEqual([]);
  });
});

describe('FakeEmbeddingAdapter', () => {
  it('returns vectors of EMBEDDING_VECTOR_DIMENSION without network', async () => {
    const adapter = new FakeEmbeddingAdapter();
    const vectors = await adapter.embed(['alpha', 'beta']);

    expect(vectors).toHaveLength(2);
    for (const vector of vectors) {
      expect(vector).toHaveLength(EMBEDDING_VECTOR_DIMENSION);
    }
    expect(vectors[0]![0]).not.toBe(vectors[1]![0]);
  });
});
