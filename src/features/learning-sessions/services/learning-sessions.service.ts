import { Inject, Injectable } from '@nestjs/common';

import { LLM_PORT } from '../../../core/llm/llm.tokens';
import type { LlmPort } from '../../../core/llm/llm.port';
import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../../core/errors/lucy-api.error';
import { PromptLoaderService } from '../../../core/prompt/prompt-loader.service';
import type { LearnerProfile } from '../../onboarding/domain/learner-profile.enums';
import type { SearchRetrievalHitDto } from '../../retrieval/dto/search-retrieval.dto';
import { RetrievalService } from '../../retrieval/services/retrieval.service';
import { ChatPrerequisitesService } from '../../chat/services/chat-prerequisites.service';
import type { GenerateLearningSessionInput } from '../dto/generate-learning-session.dto';
import { parseGenerateLearningSessionRequest } from '../dto/generate-learning-session.dto';
import {
  QUIZ_GENERATION_JSON_SCHEMA,
  QUIZ_RETRIEVAL_QUERY,
  quizRetrievalLimit,
} from '../dto/learning-session.constants';
import type {
  LearningSessionQuizItem,
  PersistedLearningSession,
} from '../domain/learning-session.types';
import {
  LEARNING_SESSIONS_REPOSITORY,
  type LearningSessionsRepository,
} from '../repositories/learning-sessions.repository.port';
import { parseGeneratedQuizItems } from '../validators/generated-quiz.validator';

const QUIZ_GENERATION_USER_MARKER = 'GENERATE_QUIZ_ITEMS=true';

@Injectable()
export class LearningSessionsService {
  constructor(
    @Inject(LEARNING_SESSIONS_REPOSITORY)
    private readonly sessionsRepository: LearningSessionsRepository,
    private readonly chatPrerequisites: ChatPrerequisitesService,
    private readonly retrievalService: RetrievalService,
    private readonly prompts: PromptLoaderService,
    @Inject(LLM_PORT)
    private readonly llmPort: LlmPort,
  ) {}

  async getById(uid: string, sessionId: string): Promise<PersistedLearningSession> {
    const session = await this.sessionsRepository.getById(uid, sessionId);
    if (!session || session.status !== 'ready') {
      throw new LucyApiError(
        404,
        LucyErrorCodes.LEARNING_SESSION_NOT_FOUND,
        'Learning session not found',
      );
    }
    return session;
  }

  async generate(uid: string, body: unknown): Promise<PersistedLearningSession> {
    const input = parseGenerateLearningSessionRequest(body);
    if (input.type !== 'quiz') {
      throw new LucyApiError(
        400,
        LucyErrorCodes.LEARNING_VALIDATION_ERROR,
        'Only quiz generation is supported in this release',
      );
    }

    await this.assertActiveDocuments(uid);
    const learnerProfile = await this.requireLearnerProfile(uid);
    const eligibility = await this.chatPrerequisites.getEligibility(uid);

    const hits = await this.retrievalService.search(uid, {
      query: QUIZ_RETRIEVAL_QUERY,
      limit: quizRetrievalLimit(input.itemCount),
    });
    if (hits.length === 0) {
      throw new LucyApiError(
        502,
        LucyErrorCodes.LEARNING_GENERATION_FAILED,
        'No retrieval hits available for quiz generation',
      );
    }

    const items = await this.generateQuizItems(
      learnerProfile,
      hits,
      input.itemCount,
    );
    const now = new Date().toISOString();

    return this.sessionsRepository.create(uid, {
      type: 'quiz',
      status: 'ready',
      itemCount: items.length,
      title: buildQuizTitle(now),
      createdAt: now,
      updatedAt: now,
      activeDocumentCount: eligibility.activeDocumentCount,
      ...(input.sourceChatId !== undefined
        ? { sourceChatId: input.sourceChatId }
        : {}),
      items,
    });
  }

  private async assertActiveDocuments(uid: string): Promise<void> {
    try {
      await this.chatPrerequisites.requireActiveDocuments(uid);
    } catch (error) {
      throw mapChatPrerequisiteError(error);
    }
  }

  private async requireLearnerProfile(uid: string): Promise<LearnerProfile> {
    try {
      return await this.chatPrerequisites.requireLearnerProfile(uid);
    } catch (error) {
      throw mapChatPrerequisiteError(error);
    }
  }

  private async generateQuizItems(
    learnerProfile: LearnerProfile,
    hits: SearchRetrievalHitDto[],
    itemCount: number,
  ): Promise<LearningSessionQuizItem[]> {
    const systemPrompt = this.prompts.getQuizGeneratorSystemPrompt(
      learnerProfile,
      itemCount,
    );
    const userPrompt = buildQuizUserPrompt(hits, itemCount);
    let lastError: unknown;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await this.llmPort.generateStructured({
          systemPrompt,
          userPrompt,
          responseJsonSchema: QUIZ_GENERATION_JSON_SCHEMA,
        });
        const parsed =
          response.parsedJson ??
          (response.rawText ? JSON.parse(response.rawText) : undefined);
        return parseGeneratedQuizItems(parsed, hits, itemCount);
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError instanceof LucyApiError) {
      throw lastError;
    }
    throw new LucyApiError(
      502,
      LucyErrorCodes.LEARNING_GENERATION_FAILED,
      'Quiz generation failed',
    );
  }
}

function buildQuizUserPrompt(
  hits: SearchRetrievalHitDto[],
  itemCount: number,
): string {
  const chunkIds = hits.map((hit) => hit.chunkId);
  const excerpts = hits.map((hit) => hit.contextHeader).join('\n\n');

  return [
    QUIZ_GENERATION_USER_MARKER,
    `ITEM_COUNT=${itemCount}`,
    `AVAILABLE_CHUNK_IDS=${JSON.stringify(chunkIds)}`,
    '',
    '## Excerpts',
    excerpts,
  ].join('\n');
}

function buildQuizTitle(isoTimestamp: string): string {
  return `Quiz · ${isoTimestamp.slice(0, 10)}`;
}

function mapChatPrerequisiteError(error: unknown): never {
  if (error instanceof LucyApiError) {
    if (error.error === LucyErrorCodes.CHAT_NO_ACTIVE_DOCUMENTS) {
      throw new LucyApiError(
        400,
        LucyErrorCodes.LEARNING_NO_ACTIVE_DOCUMENTS,
        error.message,
      );
    }
    if (error.error === LucyErrorCodes.CHAT_LEARNER_PROFILE_MISSING) {
      throw new LucyApiError(
        400,
        LucyErrorCodes.LEARNING_LEARNER_PROFILE_MISSING,
        error.message,
      );
    }
  }
  throw error;
}
