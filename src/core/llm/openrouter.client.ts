import { Logger } from '@nestjs/common';

import {
  OPENROUTER_API_BASE_URL,
  OPENROUTER_STRUCTURED_SCHEMA_NAME,
} from './openrouter.constants';
import { toOpenRouterJsonSchema } from './openrouter-json-schema';

export type OpenRouterClientConfig = {
  apiKey: string;
  model: string;
  appUrl: string;
  appName: string;
};

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type OpenRouterChatCompletionResponse = {
  choices?: Array<{
    message?: { content?: string };
    delta?: { content?: string };
    finish_reason?: string | null;
  }>;
  error?: { code?: string | number; message?: string };
};

export class OpenRouterClient {
  private readonly logger = new Logger(OpenRouterClient.name);

  constructor(private readonly config: OpenRouterClientConfig) {}

  get isConfigured(): boolean {
    return this.config.apiKey.trim().length > 0;
  }

  async createStructuredCompletion(input: {
    systemPrompt: string;
    userPrompt: string;
    responseJsonSchema: object;
  }): Promise<string> {
    const response = await this.postChatCompletions({
      stream: false,
      messages: this.toMessages(input.systemPrompt, input.userPrompt),
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: OPENROUTER_STRUCTURED_SCHEMA_NAME,
          strict: true,
          schema: toOpenRouterJsonSchema(input.responseJsonSchema),
        },
      },
    });

    const payload = (await response.json()) as OpenRouterChatCompletionResponse;
    this.assertOkResponse(response.status, payload);

    const content = payload.choices?.[0]?.message?.content;
    if (!content?.trim()) {
      throw new Error('Empty completion content from OpenRouter');
    }
    return content;
  }

  streamText(input: {
    systemPrompt: string;
    userPrompt: string;
  }): AsyncIterable<string> {
    return this.streamTextInternal(input);
  }

  private async *streamTextInternal(input: {
    systemPrompt: string;
    userPrompt: string;
  }): AsyncIterable<string> {
    const response = await this.postChatCompletions({
      stream: true,
      messages: this.toMessages(input.systemPrompt, input.userPrompt),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as OpenRouterChatCompletionResponse;
      this.assertOkResponse(response.status, payload);
      return;
    }

    const body = response.body;
    if (!body) {
      throw new Error('OpenRouter streaming response has no body');
    }

    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const delta = this.parseSseDataLine(line);
          if (delta !== undefined) {
            yield delta;
          }
        }
      }

      if (buffer.trim().length > 0) {
        const delta = this.parseSseDataLine(buffer);
        if (delta !== undefined) {
          yield delta;
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private parseSseDataLine(line: string): string | undefined {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) {
      return undefined;
    }

    const data = trimmed.slice(5).trim();
    if (!data || data === '[DONE]') {
      return undefined;
    }

    let payload: OpenRouterChatCompletionResponse;
    try {
      payload = JSON.parse(data) as OpenRouterChatCompletionResponse;
    } catch {
      return undefined;
    }

    if (payload.error) {
      throw new Error(payload.error.message ?? 'OpenRouter stream error');
    }

    const choice = payload.choices?.[0];
    if (choice?.finish_reason === 'error') {
      throw new Error('OpenRouter stream finished with error');
    }

    const content = choice?.delta?.content;
    return content && content.length > 0 ? content : undefined;
  }

  private toMessages(systemPrompt: string, userPrompt: string): ChatMessage[] {
    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];
  }

  private async postChatCompletions(body: Record<string, unknown>): Promise<Response> {
    const url = `${OPENROUTER_API_BASE_URL}/chat/completions`;
    try {
      return await fetch(url, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify({
          model: this.config.model,
          ...body,
        }),
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.warn(`OpenRouter request failed model=${this.config.model}: ${detail}`);
      throw error;
    }
  }

  private buildHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': this.config.appUrl,
      'X-Title': this.config.appName,
    };
  }

  private assertOkResponse(
    status: number,
    payload: OpenRouterChatCompletionResponse,
  ): void {
    if (status >= 200 && status < 300 && !payload.error) {
      return;
    }

    const detail =
      payload.error?.message ??
      (typeof payload.error?.code === 'string' ? payload.error.code : undefined) ??
      `HTTP ${status}`;
    this.logger.warn(
      `OpenRouter chat/completions failed model=${this.config.model}: ${detail}`,
    );
    throw new Error(detail);
  }
}
