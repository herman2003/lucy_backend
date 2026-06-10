import { LucyErrorCodes } from '../errors/lucy-error-codes';
import { GeminiLlmAdapter } from './gemini.llm.adapter';

describe('GeminiLlmAdapter', () => {
  it('throws LLM_UNAVAILABLE when GEMINI_API_KEY is not set', async () => {
    const adapter = new GeminiLlmAdapter({
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
      llmProvider: 'gemini',
      geminiApiKey: '',
      geminiModel: 'gemini-2.5-flash',
      geminiEmbeddingModel: 'gemini-embedding-001',
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
