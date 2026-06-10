import {
  type BatchEmbedContentsRequest,
  GoogleGenerativeAI,
  TaskType,
} from '@google/generative-ai';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';

import { LUCY_CONFIG } from '../config/app-config.module';
import type { LucyConfig } from '../config/lucy-config';
import { LucyErrorCodes } from '../errors/lucy-error-codes';
import { LucyApiError } from '../errors/lucy-api.error';
import {
  EMBEDDING_VECTOR_DIMENSION,
  GEMINI_EMBEDDING_MODEL_DEFAULT,
} from './embedding.constants';
import type { EmbeddingPort } from './embedding.port';

@Injectable()
export class GeminiEmbeddingAdapter implements EmbeddingPort {
  private readonly logger = new Logger(GeminiEmbeddingAdapter.name);
  private readonly apiKey: string;
  private readonly modelName: string;

  constructor(@Optional() @Inject(LUCY_CONFIG) config?: LucyConfig) {
    this.apiKey = config?.geminiApiKey ?? '';
    this.modelName = config?.geminiEmbeddingModel ?? GEMINI_EMBEDDING_MODEL_DEFAULT;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    if (!this.apiKey.trim()) {
      throw new LucyApiError(
        503,
        LucyErrorCodes.LLM_UNAVAILABLE,
        'Gemini API key is not configured for embeddings',
      );
    }

    const client = new GoogleGenerativeAI(this.apiKey);
    const model = client.getGenerativeModel({ model: this.modelName });

    let embeddings: number[][];
    try {
      const batchRequest = {
        requests: texts.map((text) => ({
          content: { parts: [{ text }] },
          taskType: TaskType.RETRIEVAL_DOCUMENT,
          outputDimensionality: EMBEDDING_VECTOR_DIMENSION,
        })),
      } as unknown as BatchEmbedContentsRequest;
      const response = await model.batchEmbedContents(batchRequest);
      embeddings = response.embeddings.map((entry) => entry.values);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `embed failed model=${this.modelName} count=${texts.length}: ${detail}`,
      );
      throw new LucyApiError(
        503,
        LucyErrorCodes.LLM_UNAVAILABLE,
        'Gemini embedding request failed',
      );
    }

    for (const vector of embeddings) {
      if (vector.length !== EMBEDDING_VECTOR_DIMENSION) {
        throw new LucyApiError(
          502,
          LucyErrorCodes.LLM_RESPONSE_INVALID,
          `Unexpected embedding dimension: expected ${EMBEDDING_VECTOR_DIMENSION}, got ${vector.length}`,
        );
      }
    }

    return embeddings;
  }
}
