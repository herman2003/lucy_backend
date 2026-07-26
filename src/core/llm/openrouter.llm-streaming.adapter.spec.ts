import { LucyErrorCodes } from '../errors/lucy-error-codes';
import { collectStreamText } from './mock.llm-streaming.adapter';
import { OpenRouterLlmStreamingAdapter } from './openrouter.llm-streaming.adapter';

describe('OpenRouterLlmStreamingAdapter', () => {
  it('throws LLM_UNAVAILABLE when OPENROUTER_API_KEY is not set', async () => {
    const adapter = new OpenRouterLlmStreamingAdapter({
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
      collectStreamText(
        adapter.streamText({ systemPrompt: 'sys', userPrompt: 'user' }),
      ),
    ).rejects.toMatchObject({
      error: LucyErrorCodes.LLM_UNAVAILABLE,
      statusCode: 503,
    });
  });
});
