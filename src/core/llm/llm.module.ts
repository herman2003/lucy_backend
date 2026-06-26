import { Module } from '@nestjs/common';

import type { LucyConfig } from '../config/lucy-config';
import { LUCY_CONFIG } from '../config/app-config.module';
import { GeminiLlmAdapter } from './gemini.llm.adapter';
import { GeminiLlmStreamingAdapter } from './gemini.llm-streaming.adapter';
import { MockLlmAdapter } from './mock.llm.adapter';
import { MockLlmStreamingAdapter } from './mock.llm-streaming.adapter';
import { OpenRouterLlmAdapter } from './openrouter.llm.adapter';
import { OpenRouterLlmStreamingAdapter } from './openrouter.llm-streaming.adapter';
import { LLM_STREAMING_PORT } from './llm-streaming.tokens';
import { LLM_PORT } from './llm.tokens';
import type { LlmPort } from './llm.port';
import type { LlmStreamingPort } from './llm-streaming.port';

@Module({
  providers: [
    GeminiLlmAdapter,
    GeminiLlmStreamingAdapter,
    OpenRouterLlmAdapter,
    OpenRouterLlmStreamingAdapter,
    MockLlmAdapter,
    MockLlmStreamingAdapter,
    {
      provide: LLM_PORT,
      useFactory: (
        config: LucyConfig,
        gemini: GeminiLlmAdapter,
        openRouter: OpenRouterLlmAdapter,
        mock: MockLlmAdapter,
      ): LlmPort => {
        if (config.llmProvider === 'mock') {
          return mock;
        }
        if (config.llmProvider === 'gemini') {
          return gemini;
        }
        if (config.llmProvider === 'openrouter') {
          return openRouter;
        }
        throw new Error(
          `LLM provider "${config.llmProvider}" is not implemented yet`,
        );
      },
      inject: [LUCY_CONFIG, GeminiLlmAdapter, OpenRouterLlmAdapter, MockLlmAdapter],
    },
    {
      provide: LLM_STREAMING_PORT,
      useFactory: (
        config: LucyConfig,
        gemini: GeminiLlmStreamingAdapter,
        openRouter: OpenRouterLlmStreamingAdapter,
        mock: MockLlmStreamingAdapter,
      ): LlmStreamingPort => {
        if (config.llmProvider === 'mock') {
          return mock;
        }
        if (config.llmProvider === 'gemini') {
          return gemini;
        }
        if (config.llmProvider === 'openrouter') {
          return openRouter;
        }
        throw new Error(
          `LLM provider "${config.llmProvider}" is not implemented yet`,
        );
      },
      inject: [
        LUCY_CONFIG,
        GeminiLlmStreamingAdapter,
        OpenRouterLlmStreamingAdapter,
        MockLlmStreamingAdapter,
      ],
    },
  ],
  exports: [
    LLM_PORT,
    LLM_STREAMING_PORT,
    GeminiLlmAdapter,
    GeminiLlmStreamingAdapter,
    OpenRouterLlmAdapter,
    OpenRouterLlmStreamingAdapter,
    MockLlmAdapter,
    MockLlmStreamingAdapter,
  ],
})
export class LlmModule {}
