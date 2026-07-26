import { Test } from '@nestjs/testing';

import { AppConfigModule, LUCY_CONFIG } from '../config/app-config.module';
import type { LucyConfig } from '../config/lucy-config';
import { LLM_STREAMING_PORT } from './llm-streaming.tokens';
import { LlmModule } from './llm.module';
import { LLM_PORT } from './llm.tokens';
import { MockLlmAdapter } from './mock.llm.adapter';
import { MockLlmStreamingAdapter } from './mock.llm-streaming.adapter';
import { OpenRouterLlmAdapter } from './openrouter.llm.adapter';
import { OpenRouterLlmStreamingAdapter } from './openrouter.llm-streaming.adapter';

function baseConfig(overrides: Partial<LucyConfig>): LucyConfig {
  return {
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
    llmProvider: 'mock',
    geminiApiKey: '',
    geminiModel: 'gemini-2.5-flash',
    geminiEmbeddingModel: 'gemini-embedding-001',
    openRouterApiKey: 'sk-or-test',
    openRouterModel: 'google/gemini-2.5-flash',
    openRouterAppUrl: 'http://localhost:3001',
    openRouterAppName: 'Lucy API',
    corsAllowedOrigins: [],
    firebaseAuthMode: 'dev',
    firestoreProvider: 'memory',
    ...overrides,
  };
}

describe('LlmModule', () => {
  it('wires OpenRouter adapters when LLM_PROVIDER=openrouter', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppConfigModule, LlmModule],
    })
      .overrideProvider(LUCY_CONFIG)
      .useValue(baseConfig({ llmProvider: 'openrouter' }))
      .compile();

    expect(moduleRef.get(LLM_PORT)).toBeInstanceOf(OpenRouterLlmAdapter);
    expect(moduleRef.get(LLM_STREAMING_PORT)).toBeInstanceOf(
      OpenRouterLlmStreamingAdapter,
    );
  });

  it('wires mock adapters when LLM_PROVIDER=mock', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppConfigModule, LlmModule],
    })
      .overrideProvider(LUCY_CONFIG)
      .useValue(baseConfig({ llmProvider: 'mock' }))
      .compile();

    expect(moduleRef.get(LLM_PORT)).toBeInstanceOf(MockLlmAdapter);
    expect(moduleRef.get(LLM_STREAMING_PORT)).toBeInstanceOf(
      MockLlmStreamingAdapter,
    );
  });
});
