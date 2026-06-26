import { Inject, Injectable, Logger } from '@nestjs/common';

import { LLM_PORT } from '../../../core/llm/llm.tokens';
import type { LlmPort } from '../../../core/llm/llm.port';
import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../../core/errors/lucy-api.error';
import { PromptLoaderService } from '../../../core/prompt/prompt-loader.service';
import type { LearnerProfile } from '../../onboarding/domain/learner-profile.enums';
import type { SearchRetrievalHitDto } from '../../retrieval/dto/search-retrieval.dto';
import { MAX_RETRIEVAL_LIMIT } from '../../retrieval/dto/search-retrieval.dto';
import { RetrievalService } from '../../retrieval/services/retrieval.service';
import { ChatPrerequisitesService } from '../../chat/services/chat-prerequisites.service';
import type { GenerateLearningSessionInput } from '../dto/generate-learning-session.dto';
import { parseGenerateLearningSessionRequest } from '../dto/generate-learning-session.dto';
import {
  FLASHCARDS_GENERATION_JSON_SCHEMA,
  QUIZ_GENERATION_JSON_SCHEMA,
  flashcardsRetrievalLimit,
  quizRetrievalLimit,
} from '../dto/learning-session.constants';
import type {
  LearningSessionFlashcardItem,
  LearningSessionQuizItem,
  LearningSessionType,
  PersistedLearningSession,
} from '../domain/learning-session.types';
import {
  LEARNING_SESSIONS_REPOSITORY,
  type LearningSessionsRepository,
} from '../repositories/learning-sessions.repository.port';
import { parseGeneratedFlashcardItems } from '../validators/generated-flashcards.validator';
import { parseGeneratedQuizItems } from '../validators/generated-quiz.validator';
import {
  buildFocusScopedRetrievalQuery,
  documentIdsFromFocusAreas,
  filterHitsByFocusAreas,
} from '../utils/focus-scoped-retrieval';
import { buildLearningSessionTitle } from '../utils/learning-session-title.util';

const QUIZ_GENERATION_USER_MARKER = 'GENERATE_QUIZ_ITEMS=true';
const FLASHCARDS_GENERATION_USER_MARKER = 'GENERATE_FLASHCARD_ITEMS=true';

@Injectable()
export class LearningSessionsService {
  private readonly logger = new Logger(LearningSessionsService.name);

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

  async list(uid: string): Promise<PersistedLearningSession[]> {
    const sessions = await this.sessionsRepository.list(uid);
    return sessions.filter((session) => session.status === 'ready');
  }

  async delete(uid: string, sessionId: string): Promise<void> {
    const session = await this.sessionsRepository.getById(uid, sessionId);
    if (!session) {
      throw new LucyApiError(
        404,
        LucyErrorCodes.LEARNING_SESSION_NOT_FOUND,
        'Learning session not found',
      );
    }
    await this.sessionsRepository.delete(uid, sessionId);
  }

  async generate(uid: string, body: unknown): Promise<PersistedLearningSession> {
    const input = parseGenerateLearningSessionRequest(body);

    await this.assertActiveDocuments(uid);
    const learnerProfile = await this.requireLearnerProfile(uid);
    const eligibility = await this.chatPrerequisites.getEligibility(uid);

    const hits = await this.retrieveGenerationHits(uid, input);
    if (hits.length === 0) {
      this.logger.warn(
        `learning generation skipped uid=${uid} type=${input.type}: no retrieval hits`,
      );
      throw new LucyApiError(
        502,
        LucyErrorCodes.LEARNING_GENERATION_FAILED,
        'No retrieval hits available for learning session generation',
      );
    }

    const items =
      input.type === 'quiz'
        ? await this.generateQuizItems(learnerProfile, hits, input.itemCount)
        : await this.generateFlashcardItems(learnerProfile, hits, input.itemCount);
    const now = new Date().toISOString();

    return this.sessionsRepository.create(uid, {
      type: input.type,
      status: 'ready',
      itemCount: items.length,
      title: buildLearningSessionTitle({
        type: input.type,
        isoTimestamp: now,
        ...(input.topicHint !== undefined ? { topicHint: input.topicHint } : {}),
        ...(input.focusAreas !== undefined ? { focusAreas: input.focusAreas } : {}),
      }),
      createdAt: now,
      updatedAt: now,
      activeDocumentCount: eligibility.activeDocumentCount,
      ...(input.sourceChatId !== undefined
        ? { sourceChatId: input.sourceChatId }
        : {}),
      items,
    });
  }

  private async retrieveGenerationHits(
    uid: string,
    input: GenerateLearningSessionInput,
  ): Promise<SearchRetrievalHitDto[]> {
    const query = buildFocusScopedRetrievalQuery(
      input.type,
      input.focusAreas,
      input.topicHint,
    );
    const documentIds =
      input.focusAreas !== undefined && input.focusAreas.length > 0
        ? documentIdsFromFocusAreas(input.focusAreas)
        : undefined;
    const limit = retrievalLimitForType(input.type, input.itemCount);

    let hits = await this.retrievalService.search(uid, {
      query,
      limit,
      ...(documentIds !== undefined ? { documentIds } : {}),
    });

    if (input.focusAreas !== undefined && input.focusAreas.length > 0) {
      hits = filterHitsByFocusAreas(hits, input.focusAreas);
      if (hits.length === 0) {
        hits = filterHitsByFocusAreas(
          await this.retrievalService.search(uid, {
            query,
            limit: MAX_RETRIEVAL_LIMIT,
            documentIds,
          }),
          input.focusAreas,
        );
      }
    }

    return hits;
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
    return this.generateItemsWithRetry(
      systemPrompt,
      userPrompt,
      QUIZ_GENERATION_JSON_SCHEMA,
      (parsed) => parseGeneratedQuizItems(parsed, hits, itemCount),
      'Quiz generation failed',
    );
  }

  private async generateFlashcardItems(
    learnerProfile: LearnerProfile,
    hits: SearchRetrievalHitDto[],
    itemCount: number,
  ): Promise<LearningSessionFlashcardItem[]> {
    const systemPrompt = this.prompts.getFlashcardsGeneratorSystemPrompt(
      learnerProfile,
      itemCount,
    );
    const userPrompt = buildFlashcardsUserPrompt(hits, itemCount);
    return this.generateItemsWithRetry(
      systemPrompt,
      userPrompt,
      FLASHCARDS_GENERATION_JSON_SCHEMA,
      (parsed) => parseGeneratedFlashcardItems(parsed, hits, itemCount),
      'Flashcards generation failed',
    );
  }

  private async generateItemsWithRetry<T>(
    systemPrompt: string,
    userPrompt: string,
    responseJsonSchema: object,
    parseItems: (parsed: unknown) => T[],
    failureMessage: string,
  ): Promise<T[]> {
    let lastError: unknown;

    let lastRawText: string | undefined;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await this.llmPort.generateStructured({
          systemPrompt,
          userPrompt,
          responseJsonSchema,
        });
        lastRawText = response.rawText;
        const parsed =
          response.parsedJson ??
          (response.rawText ? JSON.parse(response.rawText) : undefined);
        return parseItems(parsed);
      } catch (error) {
        lastError = error;
        if (error instanceof LucyApiError) {
          this.logger.warn(
            `learning generation attempt ${attempt + 1} failed code=${error.error}: ${error.message}`,
          );
          if (
            error.error === LucyErrorCodes.LEARNING_GENERATION_FAILED &&
            lastRawText
          ) {
            this.logger.warn(
              `learning generation raw LLM preview: ${lastRawText.slice(0, 500)}`,
            );
          }
        }
      }
    }

    if (lastError instanceof LucyApiError) {
      throw lastError;
    }
    this.logger.warn(
      `${failureMessage}: ${formatGenerationErrorCause(lastError)}`,
    );
    throw new LucyApiError(
      502,
      LucyErrorCodes.LEARNING_GENERATION_FAILED,
      failureMessage,
    );
  }
}

function retrievalLimitForType(type: LearningSessionType, itemCount: number): number {
  return type === 'quiz'
    ? quizRetrievalLimit(itemCount)
    : flashcardsRetrievalLimit(itemCount);
}

function buildQuizUserPrompt(
  hits: SearchRetrievalHitDto[],
  itemCount: number,
): string {
  return buildGenerationUserPrompt(QUIZ_GENERATION_USER_MARKER, hits, itemCount);
}

function buildFlashcardsUserPrompt(
  hits: SearchRetrievalHitDto[],
  itemCount: number,
): string {
  return buildGenerationUserPrompt(
    FLASHCARDS_GENERATION_USER_MARKER,
    hits,
    itemCount,
  );
}

function buildGenerationUserPrompt(
  marker: string,
  hits: SearchRetrievalHitDto[],
  itemCount: number,
): string {
  const chunkIds = hits.map((hit) => hit.chunkId);
  const excerpts = hits
    .map((hit) => `[chunkId=${hit.chunkId}]\n${hit.contextHeader}`)
    .join('\n\n');

  return [
    marker,
    `ITEM_COUNT=${itemCount}`,
    `AVAILABLE_CHUNK_IDS=${JSON.stringify(chunkIds)}`,
    '',
    '## Excerpts',
    excerpts,
  ].join('\n');
}

function formatGenerationErrorCause(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }
  return String(error);
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
