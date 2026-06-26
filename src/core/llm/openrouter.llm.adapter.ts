import { Inject, Injectable, Optional } from '@nestjs/common';

import { LUCY_CONFIG } from '../config/app-config.module';
import type { LucyConfig } from '../config/lucy-config';
import { LucyErrorCodes } from '../errors/lucy-error-codes';
import { LucyApiError } from '../errors/lucy-api.error';
import type {
  LlmPort,
  LlmStructuredRequest,
  LlmStructuredResponse,
} from './llm.port';
import {
  OPENROUTER_APP_NAME_DEFAULT,
  OPENROUTER_APP_URL_DEFAULT,
  OPENROUTER_MODEL_DEFAULT,
} from './openrouter.constants';
import { extractJsonText } from './openrouter-json-schema';
import { OpenRouterClient } from './openrouter.client';

@Injectable()
export class OpenRouterLlmAdapter implements LlmPort {
  private readonly client: OpenRouterClient;

  constructor(@Optional() @Inject(LUCY_CONFIG) config?: LucyConfig) {
    this.client = new OpenRouterClient({
      apiKey: config?.openRouterApiKey ?? '',
      model: config?.openRouterModel ?? OPENROUTER_MODEL_DEFAULT,
      appUrl: config?.openRouterAppUrl ?? OPENROUTER_APP_URL_DEFAULT,
      appName: config?.openRouterAppName ?? OPENROUTER_APP_NAME_DEFAULT,
    });
  }

  async generateStructured(
    input: LlmStructuredRequest,
  ): Promise<LlmStructuredResponse> {
    if (!this.client.isConfigured) {
      throw new LucyApiError(
        503,
        LucyErrorCodes.LLM_UNAVAILABLE,
        'OpenRouter API key is not configured',
      );
    }

    let rawText: string;
    try {
      rawText = await this.client.createStructuredCompletion(input);
    } catch {
      throw new LucyApiError(
        503,
        LucyErrorCodes.LLM_UNAVAILABLE,
        'OpenRouter request failed',
      );
    }

    if (!rawText.trim()) {
      throw new LucyApiError(
        502,
        LucyErrorCodes.LLM_RESPONSE_INVALID,
        'Empty response from OpenRouter',
      );
    }

    const jsonText = extractJsonText(rawText);
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(jsonText) as unknown;
    } catch {
      throw new LucyApiError(
        502,
        LucyErrorCodes.LLM_RESPONSE_INVALID,
        'OpenRouter response is not valid JSON',
      );
    }

    return { rawText, parsedJson };
  }
}
