import { GoogleGenerativeAI } from '@google/generative-ai';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';

import { LUCY_CONFIG } from '../config/app-config.module';
import type { LucyConfig } from '../config/lucy-config';
import { LucyErrorCodes } from '../errors/lucy-error-codes';
import { LucyApiError } from '../errors/lucy-api.error';
import type {
  LlmPort,
  LlmStructuredRequest,
  LlmStructuredResponse,
} from './llm.port';
import { toGeminiResponseSchema } from './gemini-json-schema';

@Injectable()
export class GeminiLlmAdapter implements LlmPort {
  private readonly logger = new Logger(GeminiLlmAdapter.name);
  private readonly apiKey: string;
  private readonly modelName: string;

  constructor(@Optional() @Inject(LUCY_CONFIG) config?: LucyConfig) {
    this.apiKey = config?.geminiApiKey ?? '';
    this.modelName = config?.geminiModel ?? 'gemini-2.5-flash';
  }

  async generateStructured(
    input: LlmStructuredRequest,
  ): Promise<LlmStructuredResponse> {
    if (!this.apiKey.trim()) {
      throw new LucyApiError(
        503,
        LucyErrorCodes.LLM_UNAVAILABLE,
        'Gemini API key is not configured',
      );
    }

    const client = new GoogleGenerativeAI(this.apiKey);
    const model = client.getGenerativeModel({
      model: this.modelName,
      systemInstruction: input.systemPrompt,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: toGeminiResponseSchema(input.responseJsonSchema),
      },
    });

    let rawText: string;
    try {
      const result = await model.generateContent(input.userPrompt);
      rawText = result.response.text();
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `generateStructured failed model=${this.modelName}: ${detail}`,
      );
      throw new LucyApiError(
        503,
        LucyErrorCodes.LLM_UNAVAILABLE,
        'Gemini request failed',
      );
    }

    if (!rawText?.trim()) {
      throw new LucyApiError(
        502,
        LucyErrorCodes.LLM_RESPONSE_INVALID,
        'Empty response from Gemini',
      );
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawText) as unknown;
    } catch {
      throw new LucyApiError(
        502,
        LucyErrorCodes.LLM_RESPONSE_INVALID,
        'Gemini response is not valid JSON',
      );
    }

    return { rawText, parsedJson };
  }
}
