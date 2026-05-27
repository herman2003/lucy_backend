import { GoogleGenerativeAI } from '@google/generative-ai';
import { Inject, Injectable, Optional } from '@nestjs/common';

import { LUCY_CONFIG } from '../config/app-config.module';
import type { LucyConfig } from '../config/lucy-config';
import { LucyErrorCodes } from '../errors/lucy-error-codes';
import { LucyApiError } from '../errors/lucy-api.error';
import type { LlmStreamingPort, LlmStreamingRequest } from './llm-streaming.port';

@Injectable()
export class GeminiLlmStreamingAdapter implements LlmStreamingPort {
  private readonly apiKey: string;
  private readonly modelName: string;

  constructor(@Optional() @Inject(LUCY_CONFIG) config?: LucyConfig) {
    this.apiKey = config?.geminiApiKey ?? '';
    this.modelName = config?.geminiModel ?? 'gemini-2.5-flash';
  }

  streamText(input: LlmStreamingRequest): AsyncIterable<string> {
    return this.streamTextInternal(input);
  }

  private async *streamTextInternal(
    input: LlmStreamingRequest,
  ): AsyncIterable<string> {
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
    });

    let streamResult;
    try {
      streamResult = await model.generateContentStream(input.userPrompt);
    } catch {
      throw new LucyApiError(
        503,
        LucyErrorCodes.LLM_UNAVAILABLE,
        'Gemini streaming request failed',
      );
    }

    try {
      for await (const chunk of streamResult.stream) {
        const text = chunk.text();
        if (text) {
          yield text;
        }
      }
    } catch {
      throw new LucyApiError(
        503,
        LucyErrorCodes.LLM_UNAVAILABLE,
        'Gemini streaming request failed',
      );
    }
  }
}
