import { Inject, Injectable } from '@nestjs/common';

import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../../core/errors/lucy-api.error';
import { LLM_PORT } from '../../../core/llm/llm.tokens';
import type { LlmPort } from '../../../core/llm/llm.port';
import { PromptLoaderService } from '../../../core/prompt/prompt-loader.service';
import { parseAnalyzeRequest } from '../dto/analyze-request.dto';
import type {
  AnalyzeFallbackDto,
  AnalyzeResponseDto,
} from '../dto/analyze-response.dto';
import { buildMinimalLearnerProfile } from '../domain/minimal-learner-profile';
import { MAX_ANALYZE_ATTEMPTS } from '../domain/onboarding-limits';
import {
  parseConfirmTurnRequest,
  type ConfirmTurnResponseDto,
} from '../dto/confirm-turn.dto';
import { parseFinalizeRequest } from '../dto/finalize-request.dto';
import {
  parseValidateAnswerRequest,
  type ValidateAnswerResponseDto,
} from '../dto/validate-answer.dto';
import { assertTranscriptComplete } from '../domain/onboarding-transcript';
import {
  ONBOARDING_USERS_REPOSITORY,
  type OnboardingUsersRepository,
} from '../repositories/onboarding-users.repository.port';
import { OnboardingQuestionCatalog } from '../questions/onboarding-question.catalog';
import {
  parseAnalyzeFallbackLlmResponse,
  parseAnalyzeLlmResponse,
} from '../validators/analyze-response.validator';
import { MAX_VALIDATE_ATTEMPTS_PER_QUESTION } from '../domain/onboarding-limits';
import {
  isValidateAnswerFallback,
  type ValidateAnswerFallbackDto,
} from '../dto/validate-answer.dto';
import { parseValidateAnswerLlmResponse } from '../validators/validate-answer-response.validator';
import type { OnboardingProgressResponseDto } from '../dto/onboarding-progress-response.dto';

const ANALYZE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    learnerProfile: { type: 'object' },
    summaryForUser: { type: 'string' },
  },
  required: ['learnerProfile', 'summaryForUser'],
};

const ANALYZE_FALLBACK_JSON_SCHEMA = {
  type: 'object',
  properties: {
    fallbackProfileSummary: { type: 'string' },
    requiresUserConfirmation: { type: 'boolean' },
  },
  required: ['fallbackProfileSummary', 'requiresUserConfirmation'],
};

const VALIDATE_ANSWER_JSON_SCHEMA = {
  type: 'object',
  properties: {
    valid: { type: 'boolean' },
    turnSummary: { type: 'string' },
    rephrasedQuestion: { type: 'string' },
    reason: { type: 'string' },
    fallbackSummary: { type: 'string' },
  },
  required: ['valid'],
};

@Injectable()
export class OnboardingService {
  constructor(
    @Inject(LLM_PORT) private readonly llm: LlmPort,
    private readonly prompts: PromptLoaderService,
    private readonly questions: OnboardingQuestionCatalog,
    @Inject(ONBOARDING_USERS_REPOSITORY)
    private readonly users: OnboardingUsersRepository,
  ) {}

  async validateAnswer(
    uid: string,
    body: unknown,
  ): Promise<ValidateAnswerResponseDto> {
    const request = parseValidateAnswerRequest(body);
    const state = await this.users.getOnboardingState(uid);

    if (state.isConfigured) {
      throw new LucyApiError(
        403,
        LucyErrorCodes.ONBOARDING_ALREADY_COMPLETE,
        'Onboarding is already complete for this user',
      );
    }

    const questionText = this.questions.getQuestionText(
      request.locale,
      request.turn.questionId,
    );

    const attempts =
      state.onboardingAttempts[request.turn.questionId] ?? 0;
    if (attempts >= MAX_VALIDATE_ATTEMPTS_PER_QUESTION) {
      return this.requestFallbackSummary({
        locale: request.locale,
        questionId: request.turn.questionId,
        questionText,
        answerText: request.turn.answerText,
        fallbackReduced: request.fallbackReduced === true,
      });
    }

    const systemPrompt = this.prompts.getValidateAnswerSystemPrompt();
    const userPrompt = this.prompts.renderValidateAnswerUserPrompt({
      locale: request.locale,
      questionId: request.turn.questionId,
      questionText,
      answerText: request.turn.answerText,
    });

    const llmResult = await this.llm.generateStructured({
      systemPrompt,
      userPrompt,
      responseJsonSchema: VALIDATE_ANSWER_JSON_SCHEMA,
    });

    const parsed = parseValidateAnswerLlmResponse(llmResult.parsedJson);
    if (
      parsed.valid === false &&
      !isValidateAnswerFallback(parsed) &&
      'rephrasedQuestion' in parsed
    ) {
      await this.users.incrementValidateAttempt(uid, request.turn.questionId);
    }

    return parsed;
  }

  private async requestFallbackSummary(params: {
    locale: string;
    questionId: string;
    questionText: string;
    answerText: string;
    fallbackReduced: boolean;
  }): Promise<ValidateAnswerFallbackDto> {
    const systemPrompt = this.prompts.getValidateAnswerSystemPrompt();
    const userPrompt = `${this.prompts.renderValidateAnswerUserPrompt({
      locale: params.locale,
      questionId: params.questionId,
      questionText: params.questionText,
      answerText: params.answerText,
    })}\n\n[FALLBACK_MODE reduced=${params.fallbackReduced}]`;

    const llmResult = await this.llm.generateStructured({
      systemPrompt,
      userPrompt,
      responseJsonSchema: VALIDATE_ANSWER_JSON_SCHEMA,
    });

    const parsed = parseValidateAnswerLlmResponse(llmResult.parsedJson);
    if (!isValidateAnswerFallback(parsed)) {
      throw new LucyApiError(
        502,
        LucyErrorCodes.LLM_RESPONSE_INVALID,
        'fallbackSummary is required when validate attempts are exhausted',
      );
    }
    return parsed;
  }

  async confirmTurn(uid: string, body: unknown): Promise<ConfirmTurnResponseDto> {
    const request = parseConfirmTurnRequest(body);
    const state = await this.users.getOnboardingState(uid);

    if (state.isConfigured) {
      throw new LucyApiError(
        403,
        LucyErrorCodes.ONBOARDING_ALREADY_COMPLETE,
        'Onboarding is already complete for this user',
      );
    }

    const questionText = this.questions.getQuestionText(
      request.locale,
      request.turn.questionId,
    );

    return this.users.confirmTurn(uid, {
      locale: request.locale,
      questionId: request.turn.questionId,
      questionText,
      answerText: request.turn.answerText,
    });
  }

  async analyze(uid: string, body: unknown): Promise<AnalyzeResponseDto> {
    const request = parseAnalyzeRequest(body);
    const context = await this.users.getAnalyzeContext(uid);

    if (context.isConfigured) {
      throw new LucyApiError(
        403,
        LucyErrorCodes.ONBOARDING_ALREADY_COMPLETE,
        'Onboarding is already complete for this user',
      );
    }

    assertTranscriptComplete(context.transcript);
    const attempt = await this.users.incrementAnalyzeAttempts(uid);

    try {
      const systemPrompt = this.prompts.getAnalyzeSystemPrompt();
      const userPrompt = `${this.prompts.renderAnalyzeUserPrompt({
        locale: request.locale,
        transcriptJson: JSON.stringify(context.transcript, null, 2),
      })}${
        request.profileReduced ? '\n\n[PROFILE_FALLBACK_MODE reduced=true]' : ''
      }`;

      const llmResult = await this.llm.generateStructured({
        systemPrompt,
        userPrompt,
        responseJsonSchema: ANALYZE_JSON_SCHEMA,
      });

      const result = parseAnalyzeLlmResponse(llmResult.parsedJson);
      await this.users.saveAnalyzeSuccess(
        uid,
        result.learnerProfile,
        result.summaryForUser,
      );

      return result;
    } catch (error) {
      if (attempt >= MAX_ANALYZE_ATTEMPTS && this.isAnalyzeFailureForFallback(error)) {
        return this.requestAnalyzeFallback(uid, {
          locale: request.locale,
          transcriptJson: JSON.stringify(context.transcript, null, 2),
          profileReduced: request.profileReduced === true,
        });
      }
      throw error;
    }
  }

  private isAnalyzeFailureForFallback(error: unknown): boolean {
    if (!(error instanceof LucyApiError)) {
      return false;
    }
    return (
      error.statusCode === 502 ||
      error.error === LucyErrorCodes.LLM_RESPONSE_INVALID ||
      error.error === LucyErrorCodes.ONBOARDING_PROFILE_INCOMPLETE
    );
  }

  private async requestAnalyzeFallback(
    uid: string,
    params: {
      locale: string;
      transcriptJson: string;
      profileReduced: boolean;
    },
  ): Promise<AnalyzeFallbackDto> {
    const systemPrompt = this.prompts.getAnalyzeSystemPrompt();
    const userPrompt = `${this.prompts.renderAnalyzeUserPrompt({
      locale: params.locale,
      transcriptJson: params.transcriptJson,
    })}\n\n[PROFILE_FALLBACK_MODE reduced=${params.profileReduced}]`;

    const llmResult = await this.llm.generateStructured({
      systemPrompt,
      userPrompt,
      responseJsonSchema: ANALYZE_FALLBACK_JSON_SCHEMA,
    });

    const fallback = parseAnalyzeFallbackLlmResponse(llmResult.parsedJson);
    const profile = buildMinimalLearnerProfile(params.locale);
    await this.users.saveAnalyzeSuccess(
      uid,
      profile,
      fallback.fallbackProfileSummary,
    );

    return fallback;
  }

  async finalize(uid: string, body: unknown): Promise<{ isConfigured: true }> {
    parseFinalizeRequest(body);
    const state = await this.users.getOnboardingState(uid);

    if (state.isConfigured) {
      throw new LucyApiError(
        403,
        LucyErrorCodes.ONBOARDING_ALREADY_COMPLETE,
        'Onboarding is already complete for this user',
      );
    }

    try {
      await this.users.finalizeOnboarding(uid);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'ONBOARDING_PENDING_PROFILE_MISSING'
      ) {
        throw new LucyApiError(
          400,
          LucyErrorCodes.ONBOARDING_PENDING_PROFILE_MISSING,
          'No pending learner profile to finalize',
        );
      }
      throw error;
    }

    return { isConfigured: true };
  }

  getProgress(uid: string): Promise<OnboardingProgressResponseDto> {
    return this.users.getProgress(uid);
  }
}
