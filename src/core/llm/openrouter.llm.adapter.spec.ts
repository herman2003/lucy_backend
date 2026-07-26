import { LucyErrorCodes } from '../errors/lucy-error-codes';
import { OpenRouterLlmAdapter } from './openrouter.llm.adapter';

describe('OpenRouterLlmAdapter', () => {
  it('throws LLM_UNAVAILABLE when OPENROUTER_API_KEY is not set', async () => {
    const adapter = new OpenRouterLlmAdapter({
      port: 3001,
      nodeEnv: 'test',
      firebaseProjectId: 'test',
      firebaseStorageBucket: 'test.appspot.com',
      storageProvider: 'firebase',
      r2AccountId: '',
      r2AccessKeyId: '',
      r2SecretAccessKey: '',
      r2Bucket: '',
      r2Endpoint: '',
      llmProvider: 'openrouter',
      geminiApiKey: '',
      geminiModel: 'gemini-2.5-flash',
      geminiEmbeddingModel: 'gemini-embedding-001',
      openRouterApiKey: '',
      openRouterModel: 'google/gemini-2.5-flash',
      openRouterAppUrl: 'http://localhost:3001',
      openRouterAppName: 'Lucy API',
      corsAllowedOrigins: [],
      firebaseAuthMode: 'dev',
      firestoreProvider: 'memory',
    });

    await expect(
      adapter.generateStructured({
        systemPrompt: 'sys',
        userPrompt: 'user',
        responseJsonSchema: { type: 'object' },
      }),
    ).rejects.toMatchObject({
      error: LucyErrorCodes.LLM_UNAVAILABLE,
      statusCode: 503,
    });
  });
});
