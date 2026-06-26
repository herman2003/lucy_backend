import { LucyErrorCodes } from '../errors/lucy-error-codes';
import { GeminiLlmStreamingAdapter } from './gemini.llm-streaming.adapter';
import { collectStreamText } from './mock.llm-streaming.adapter';

describe('GeminiLlmStreamingAdapter', () => {
  it('throws LLM_UNAVAILABLE when GEMINI_API_KEY is not set', async () => {
    const adapter = new GeminiLlmStreamingAdapter({
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
      openRouterApiKey: '',
      openRouterModel: 'google/gemini-2.5-flash',
      openRouterAppUrl: 'http://localhost:3001',
      openRouterAppName: 'Lucy API',
      corsAllowedOrigins: [],
      firebaseAuthMode: 'dev',
      firestoreProvider: 'memory',
    });

    await expect(
      collectStreamText(
        adapter.streamText({ systemPrompt: 'sys', userPrompt: 'user' }),
      ),
    ).rejects.toMatchObject({
      error: LucyErrorCodes.LLM_UNAVAILABLE,
      statusCode: 503,
    });
  });
});
