import { Inject, Injectable, Optional } from '@nestjs/common';

import { LUCY_CONFIG } from '../config/app-config.module';
import type { LucyConfig } from '../config/lucy-config';
import { LucyErrorCodes } from '../errors/lucy-error-codes';
import { LucyApiError } from '../errors/lucy-api.error';
import type { LlmStreamingPort, LlmStreamingRequest } from './llm-streaming.port';
import {
  OPENROUTER_APP_NAME_DEFAULT,
  OPENROUTER_APP_URL_DEFAULT,
  OPENROUTER_MODEL_DEFAULT,
} from './openrouter.constants';
import { OpenRouterClient } from './openrouter.client';

@Injectable()
export class OpenRouterLlmStreamingAdapter implements LlmStreamingPort {
  private readonly client: OpenRouterClient;

  constructor(@Optional() @Inject(LUCY_CONFIG) config?: LucyConfig) {
    this.client = new OpenRouterClient({
      apiKey: config?.openRouterApiKey ?? '',
      model: config?.openRouterModel ?? OPENROUTER_MODEL_DEFAULT,
      appUrl: config?.openRouterAppUrl ?? OPENROUTER_APP_URL_DEFAULT,
      appName: config?.openRouterAppName ?? OPENROUTER_APP_NAME_DEFAULT,
    });
  }

  streamText(input: LlmStreamingRequest): AsyncIterable<string> {
    return this.streamTextInternal(input);
  }

  private async *streamTextInternal(
    input: LlmStreamingRequest,
  ): AsyncIterable<string> {
    if (!this.client.isConfigured) {
      throw new LucyApiError(
        503,
        LucyErrorCodes.LLM_UNAVAILABLE,
        'OpenRouter API key is not configured',
      );
    }

    try {
      for await (const delta of this.client.streamText(input)) {
        yield delta;
      }
    } catch {
      throw new LucyApiError(
        503,
        LucyErrorCodes.LLM_UNAVAILABLE,
        'OpenRouter streaming request failed',
      );
    }
  }
}
