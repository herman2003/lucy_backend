import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';

import { LLM_STREAMING_PORT } from '../../../core/llm/llm-streaming.tokens';
import type { LlmStreamingPort } from '../../../core/llm/llm-streaming.port';
import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../../core/errors/lucy-api.error';
import type { LearnerProfile } from '../../onboarding/domain/learner-profile.enums';
import type { PersistedLearningSession } from '../../learning-sessions/domain/learning-session.types';
import { CorpusStudyAnalyzerService } from '../../learning-sessions/services/corpus-study-analyzer.service';
import { LearningSessionsService } from '../../learning-sessions/services/learning-sessions.service';
import { RetrievalService } from '../../retrieval/services/retrieval.service';
import {
  CHAT_AUTO_TITLE_MAX_LENGTH,
  CHAT_RETRIEVAL_LIMIT,
} from '../chat.constants';
import {
  buildLearningSessionCreatedReply,
  detectRevisionPlanIntent,
} from '../utils/chat-learning-generation';
import {
  buildFocusSelectionMessage,
  buildLearningAnalyzingMessage,
  buildLearningGenerationFailedMessage,
  buildLearningGeneratingMessage,
  buildLearningRegeneratingMessage,
  buildRevisionPlanText,
  buildRevisionPlanUnavailableMessage,
  buildTopicFallbackPrompt,
} from '../utils/chat-learning-dialogue-messages';
import { readLearningGenerationAdviceKey } from '../../learning-sessions/utils/learning-generation-failure.error';
import { detectLearningExamType } from '../../learning-sessions/utils/learning-exam-type.util';
import { processLearningDialogueTurn } from '../utils/chat-learning-dialogue';
import { getValidCorpusStudyPlan } from '../utils/corpus-study-plan-cache';
import { resolveSelectedFocusAreas } from '../../learning-sessions/utils/focus-scoped-retrieval';
import { buildOffCorpusAssistantReply } from '../utils/chat-off-corpus-reply';
import {
  filterRetrievalHitsForChat,
  isOffCorpusForChat,
} from '../utils/chat-retrieval-filter';
import { DEFAULT_CHAT_TITLE } from '../dto/create-chat.dto';
import type { SendChatMessageResponseDto } from '../dto/send-chat-message-response.dto';
import type { ChatSseEvent } from '../domain/chat-sse.types';
import type {
  ChatSourceRecord,
  PersistedChatMessage,
  PersistedChatThread,
} from '../domain/chat.types';
import {
  CHATS_REPOSITORY,
  type ChatsRepository,
} from '../repositories/chats.repository.port';
import { ChatActiveStreamRegistry } from './chat-active-stream.registry';
import { ChatPrerequisitesService } from './chat-prerequisites.service';
import { ChatRagService } from './chat-rag.service';
import type { ChatMessageDto } from './chat.service';

type TurnContext = {
  thread: PersistedChatThread;
  learnerProfile: LearnerProfile;
  historyBefore: PersistedChatMessage[];
  isFirstUserTurn: boolean;
  userMessage: PersistedChatMessage;
};

type CompleteTurnOptions = {
  onTextDelta?: (delta: string) => void;
};

type CompleteTurnResult = {
  assistantMessage: PersistedChatMessage;
  sources: ChatSourceRecord[];
  learningSession?: PersistedLearningSession;
};

@Injectable()
export class ChatStreamService {
  private readonly logger = new Logger(ChatStreamService.name);

  constructor(
    @Inject(CHATS_REPOSITORY)
    private readonly chatsRepository: ChatsRepository,
    private readonly chatPrerequisites: ChatPrerequisitesService,
    private readonly retrievalService: RetrievalService,
    private readonly chatRag: ChatRagService,
    private readonly activeStreams: ChatActiveStreamRegistry,
    @Inject(forwardRef(() => LearningSessionsService))
    private readonly learningSessionsService: LearningSessionsService,
    @Inject(forwardRef(() => CorpusStudyAnalyzerService))
    private readonly corpusStudyAnalyzer: CorpusStudyAnalyzerService,
    @Inject(LLM_STREAMING_PORT)
    private readonly llmStreaming: LlmStreamingPort,
  ) {}

  /** Guards that must run before opening the SSE response (JSON errors). */
  async assertCanStream(uid: string, chatId: string): Promise<void> {
    await this.requireThread(uid, chatId);
    this.activeStreams.assertNotActive(uid, chatId);
    await this.chatPrerequisites.requireLearnerProfile(uid);
    await this.chatPrerequisites.requireActiveDocuments(uid);
  }

  async sendMessage(
    uid: string,
    chatId: string,
    content: string,
  ): Promise<SendChatMessageResponseDto> {
    await this.assertCanStream(uid, chatId);
    this.activeStreams.acquire(uid, chatId);
    try {
      const turn = await this.beginTurn(uid, chatId, content);
      const { assistantMessage } = await this.completeTurn(uid, chatId, content, turn);
      return {
        userMessage: toMessageDto(turn.userMessage),
        assistantMessage: toMessageDto(assistantMessage),
      };
    } finally {
      this.activeStreams.release(uid, chatId);
    }
  }

  async *streamMessage(
    uid: string,
    chatId: string,
    content: string,
  ): AsyncGenerator<ChatSseEvent> {
    this.activeStreams.acquire(uid, chatId);
    try {
      const turn = await this.beginTurn(uid, chatId, content);

      yield {
        event: 'user_message',
        data: {
          id: turn.userMessage.id,
          role: 'user',
          content: turn.userMessage.content,
          createdAt: turn.userMessage.createdAt,
        },
      };

      const pendingDeltas: string[] = [];
      let turnDone = false;
      let turnResult: CompleteTurnResult | undefined;
      let turnError: unknown;

      void this.completeTurn(uid, chatId, content, turn, {
        onTextDelta: (delta) => {
          pendingDeltas.push(delta);
        },
      })
        .then((result) => {
          turnResult = result;
          turnDone = true;
        })
        .catch((error: unknown) => {
          turnError = error;
          turnDone = true;
        });

      while (!turnDone || pendingDeltas.length > 0) {
        if (pendingDeltas.length > 0) {
          const delta = pendingDeltas.shift()!;
          yield { event: 'text_delta', data: { delta } };
          continue;
        }
        if (!turnDone) {
          await waitForNextEventLoopTick();
        }
      }

      if (turnError !== undefined) {
        throw turnError;
      }

      const { assistantMessage, sources, learningSession } = turnResult!;

      if (learningSession) {
        yield {
          event: 'learning_session_created',
          data: {
            sessionId: learningSession.id,
            type: learningSession.type,
            title: learningSession.title,
          },
        };
      }

      yield { event: 'sources', data: { sources } };
      yield {
        event: 'done',
        data: {
          userMessageId: turn.userMessage.id,
          assistantMessage: {
            id: assistantMessage.id,
            role: 'assistant',
            content: assistantMessage.content,
            createdAt: assistantMessage.createdAt,
            sources,
            status: 'completed',
          },
        },
      };
    } catch (error) {
      const apiError = toStreamError(error);
      this.logger.warn(
        `stream failed chatId=${chatId} code=${apiError.error}: ${formatStreamErrorCause(error)}`,
      );
      yield {
        event: 'error',
        data: {
          code: apiError.error,
          message: apiError.message,
        },
      };
    } finally {
      this.activeStreams.release(uid, chatId);
    }
  }

  private async beginTurn(
    uid: string,
    chatId: string,
    content: string,
  ): Promise<TurnContext> {
    const thread = await this.requireThread(uid, chatId);
    const learnerProfile = await this.chatPrerequisites.requireLearnerProfile(uid);
    await this.chatPrerequisites.requireActiveDocuments(uid);

    const historyBefore = await this.chatsRepository.listMessages(uid, chatId, {
      limit: 100,
    });
    const isFirstUserTurn = !historyBefore.some((message) => message.role === 'user');

    const userMessage = await this.chatsRepository.appendMessage(uid, chatId, {
      id: newMessageId(),
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    });

    return { thread, learnerProfile, historyBefore, isFirstUserTurn, userMessage };
  }

  private async completeTurn(
    uid: string,
    chatId: string,
    content: string,
    turn: TurnContext,
    options: CompleteTurnOptions = {},
  ): Promise<CompleteTurnResult> {
    const revisionTurn = await this.tryCompleteRevisionPlanTurn(
      uid,
      chatId,
      content,
      turn,
      options,
    );
    if (revisionTurn) {
      return revisionTurn;
    }

    const learningTurn = await this.tryCompleteLearningGenerationTurn(
      uid,
      chatId,
      content,
      turn,
      options,
    );
    if (learningTurn) {
      return learningTurn;
    }

    const rawHits = await this.retrievalService.search(uid, {
      query: content,
      limit: CHAT_RETRIEVAL_LIMIT,
    });
    const hits = filterRetrievalHitsForChat(rawHits);

    let assistantText = '';
    let sources: ChatSourceRecord[] = [];

    if (isOffCorpusForChat(hits)) {
      assistantText = buildOffCorpusAssistantReply(turn.learnerProfile.tutoring_language);
      options.onTextDelta?.(assistantText);
    } else {
      const systemPrompt = this.chatRag.buildSystemPrompt(turn.learnerProfile);
      const userPrompt = this.chatRag.buildUserPrompt(turn.historyBefore, content, hits);

      for await (const delta of this.llmStreaming.streamText({ systemPrompt, userPrompt })) {
        assistantText += delta;
        options.onTextDelta?.(delta);
      }

      sources = await this.chatRag.resolveSourcesSafely(assistantText, hits);
    }

    const assistantMessage = await this.chatsRepository.appendMessage(uid, chatId, {
      id: newMessageId(),
      role: 'assistant',
      content: assistantText,
      createdAt: new Date().toISOString(),
      status: 'completed',
      sources,
    });

    if (turn.isFirstUserTurn && turn.thread.title === DEFAULT_CHAT_TITLE) {
      await this.chatsRepository.patchThread(uid, chatId, {
        title: buildAutoTitle(content),
      });
    }

    return { assistantMessage, sources };
  }

  private async tryCompleteRevisionPlanTurn(
    uid: string,
    chatId: string,
    content: string,
    turn: TurnContext,
    options: CompleteTurnOptions,
  ): Promise<CompleteTurnResult | null> {
    if (turn.thread.pendingLearningGeneration) {
      return null;
    }
    if (!detectRevisionPlanIntent(content)) {
      return null;
    }

    const tutoringLanguage = turn.learnerProfile.tutoring_language;
    const examType = detectLearningExamType(content);
    const analyzingText = buildLearningAnalyzingMessage(tutoringLanguage);
    options.onTextDelta?.(analyzingText);

    let corpusStudyPlan = getValidCorpusStudyPlan(turn.thread.corpusStudyPlan);
    let assistantText = analyzingText;

    if (!corpusStudyPlan) {
      try {
        corpusStudyPlan = await this.corpusStudyAnalyzer.analyze(uid, { examType });
        await this.chatsRepository.patchThread(uid, chatId, { corpusStudyPlan });
      } catch (error) {
        this.logger.warn(
          `revision plan analysis failed chatId=${chatId}: ${formatStreamErrorCause(error)}`,
        );
        const failureText = buildRevisionPlanUnavailableMessage(tutoringLanguage);
        assistantText = `${analyzingText}\n\n${failureText}`;
        options.onTextDelta?.(`\n\n${failureText}`);

        const assistantMessage = await this.chatsRepository.appendMessage(uid, chatId, {
          id: newMessageId(),
          role: 'assistant',
          content: assistantText,
          createdAt: new Date().toISOString(),
          status: 'completed',
          sources: [],
        });

        if (turn.isFirstUserTurn && turn.thread.title === DEFAULT_CHAT_TITLE) {
          await this.chatsRepository.patchThread(uid, chatId, {
            title: buildAutoTitle(content),
          });
        }

        return { assistantMessage, sources: [] };
      }
    }

    const planText = buildRevisionPlanText(tutoringLanguage, corpusStudyPlan, examType);
    assistantText = `${analyzingText}\n\n${planText}`;
    options.onTextDelta?.(`\n\n${planText}`);

    const assistantMessage = await this.chatsRepository.appendMessage(uid, chatId, {
      id: newMessageId(),
      role: 'assistant',
      content: assistantText,
      createdAt: new Date().toISOString(),
      status: 'completed',
      sources: [],
    });

    if (turn.isFirstUserTurn && turn.thread.title === DEFAULT_CHAT_TITLE) {
      await this.chatsRepository.patchThread(uid, chatId, {
        title: buildAutoTitle(content),
      });
    }

    return { assistantMessage, sources: [] };
  }

  private async tryCompleteLearningGenerationTurn(
    uid: string,
    chatId: string,
    content: string,
    turn: TurnContext,
    options: CompleteTurnOptions,
  ): Promise<CompleteTurnResult | null> {
    const outcome = processLearningDialogueTurn({
      message: content,
      pending: turn.thread.pendingLearningGeneration,
      tutoringLanguage: turn.learnerProfile.tutoring_language,
      corpusStudyPlan: turn.thread.corpusStudyPlan,
      lastLearningGenerationRequest: turn.thread.lastLearningGenerationRequest,
    });
    if (!outcome) {
      return null;
    }

    if (outcome.kind === 'needs_analysis') {
      return this.completeCorpusAnalysisTurn(
        uid,
        chatId,
        content,
        turn,
        outcome.pending,
        options,
      );
    }

    if (outcome.kind === 'assistant_reply') {
      options.onTextDelta?.(outcome.text);
      await this.chatsRepository.patchThread(uid, chatId, {
        pendingLearningGeneration: outcome.pending,
      });

      const assistantMessage = await this.chatsRepository.appendMessage(uid, chatId, {
        id: newMessageId(),
        role: 'assistant',
        content: outcome.text,
        createdAt: new Date().toISOString(),
        status: 'completed',
        sources: [],
      });

      if (turn.isFirstUserTurn && turn.thread.title === DEFAULT_CHAT_TITLE) {
        await this.chatsRepository.patchThread(uid, chatId, {
          title: buildAutoTitle(content),
        });
      }

      return { assistantMessage, sources: [] };
    }

    const generatingText = outcome.isRegeneration
      ? buildLearningRegeneratingMessage(
          turn.learnerProfile.tutoring_language,
          outcome.type,
        )
      : buildLearningGeneratingMessage(
          turn.learnerProfile.tutoring_language,
          outcome.type,
        );
    options.onTextDelta?.(generatingText);

    await this.chatsRepository.patchThread(uid, chatId, {
      pendingLearningGeneration: null,
    });

    const latestThread = await this.chatsRepository.getThread(uid, chatId);
    const focusAreas = resolveSelectedFocusAreas(
      latestThread?.corpusStudyPlan,
      outcome.selectedFocusAreaIds,
    );

    let session: PersistedLearningSession;
    try {
      session = await this.learningSessionsService.generate(uid, {
        type: outcome.type,
        itemCount: outcome.itemCount,
        sourceChatId: chatId,
        ...(outcome.topicHint !== undefined ? { topicHint: outcome.topicHint } : {}),
        ...(outcome.examType !== undefined ? { examType: outcome.examType } : {}),
        ...(focusAreas.length > 0 ? { focusAreas } : {}),
      });
    } catch (error) {
      if (
        !(error instanceof LucyApiError) ||
        error.error !== LucyErrorCodes.LEARNING_GENERATION_FAILED
      ) {
        throw error;
      }

      const failureText = buildLearningGenerationFailedMessage(
        turn.learnerProfile.tutoring_language,
        outcome.type,
        readLearningGenerationAdviceKey(error),
      );
      options.onTextDelta?.(failureText);

      const assistantMessage = await this.chatsRepository.appendMessage(uid, chatId, {
        id: newMessageId(),
        role: 'assistant',
        content: failureText,
        createdAt: new Date().toISOString(),
        status: 'completed',
        sources: [],
      });

      if (turn.isFirstUserTurn && turn.thread.title === DEFAULT_CHAT_TITLE) {
        await this.chatsRepository.patchThread(uid, chatId, {
          title: buildAutoTitle(content),
        });
      }

      return { assistantMessage, sources: [] };
    }

    const assistantText = buildLearningSessionCreatedReply(
      turn.learnerProfile.tutoring_language,
      session.type,
      session.title,
    );
    options.onTextDelta?.(assistantText);

    const assistantMessage = await this.chatsRepository.appendMessage(uid, chatId, {
      id: newMessageId(),
      role: 'assistant',
      content: assistantText,
      createdAt: new Date().toISOString(),
      status: 'completed',
      sources: [],
    });

    await this.chatsRepository.patchThread(uid, chatId, {
      lastLearningGenerationRequest: {
        type: outcome.type,
        itemCount: outcome.itemCount,
        requestedAt: new Date().toISOString(),
        ...(outcome.topicHint !== undefined ? { topicHint: outcome.topicHint } : {}),
        ...(outcome.examType !== undefined ? { examType: outcome.examType } : {}),
        ...(outcome.selectedFocusAreaIds !== undefined
          ? { selectedFocusAreaIds: outcome.selectedFocusAreaIds }
          : {}),
      },
    });

    if (turn.isFirstUserTurn && turn.thread.title === DEFAULT_CHAT_TITLE) {
      await this.chatsRepository.patchThread(uid, chatId, {
        title: buildAutoTitle(content),
      });
    }

    return {
      assistantMessage,
      sources: [],
      learningSession: session,
    };
  }

  private async completeCorpusAnalysisTurn(
    uid: string,
    chatId: string,
    content: string,
    turn: TurnContext,
    pending: NonNullable<PersistedChatThread['pendingLearningGeneration']>,
    options: CompleteTurnOptions,
  ): Promise<CompleteTurnResult> {
    const tutoringLanguage = turn.learnerProfile.tutoring_language;
    const analyzingText = buildLearningAnalyzingMessage(tutoringLanguage);
    options.onTextDelta?.(analyzingText);

    await this.chatsRepository.patchThread(uid, chatId, {
      pendingLearningGeneration: pending,
    });

    let corpusStudyPlan = getValidCorpusStudyPlan(turn.thread.corpusStudyPlan);
    let assistantText = analyzingText;

    if (!corpusStudyPlan) {
      try {
        corpusStudyPlan = await this.corpusStudyAnalyzer.analyze(uid, {
          examType: pending.examType,
        });
        await this.chatsRepository.patchThread(uid, chatId, {
          corpusStudyPlan,
        });
      } catch (error) {
        this.logger.warn(
          `corpus study analysis failed chatId=${chatId}: ${formatStreamErrorCause(error)}`,
        );
        const fallbackText = buildTopicFallbackPrompt(tutoringLanguage, pending.type);
        assistantText = `${analyzingText}\n\n${fallbackText}`;
        options.onTextDelta?.(`\n\n${fallbackText}`);

        await this.chatsRepository.patchThread(uid, chatId, {
          pendingLearningGeneration: {
            ...pending,
            step: 'awaiting_topic_fallback',
            updatedAt: new Date().toISOString(),
          },
        });

        const assistantMessage = await this.chatsRepository.appendMessage(uid, chatId, {
          id: newMessageId(),
          role: 'assistant',
          content: assistantText,
          createdAt: new Date().toISOString(),
          status: 'completed',
          sources: [],
        });

        if (turn.isFirstUserTurn && turn.thread.title === DEFAULT_CHAT_TITLE) {
          await this.chatsRepository.patchThread(uid, chatId, {
            title: buildAutoTitle(content),
          });
        }

        return { assistantMessage, sources: [] };
      }
    }

    const focusText = buildFocusSelectionMessage(
      tutoringLanguage,
      corpusStudyPlan,
      pending.type,
    );
    assistantText = `${analyzingText}\n\n${focusText}`;
    options.onTextDelta?.(`\n\n${focusText}`);

    await this.chatsRepository.patchThread(uid, chatId, {
      pendingLearningGeneration: {
        ...pending,
        step: 'awaiting_focus_selection',
        updatedAt: new Date().toISOString(),
      },
    });

    const assistantMessage = await this.chatsRepository.appendMessage(uid, chatId, {
      id: newMessageId(),
      role: 'assistant',
      content: assistantText,
      createdAt: new Date().toISOString(),
      status: 'completed',
      sources: [],
    });

    if (turn.isFirstUserTurn && turn.thread.title === DEFAULT_CHAT_TITLE) {
      await this.chatsRepository.patchThread(uid, chatId, {
        title: buildAutoTitle(content),
      });
    }

    return { assistantMessage, sources: [] };
  }

  private async requireThread(uid: string, chatId: string): Promise<PersistedChatThread> {
    const thread = await this.chatsRepository.getThread(uid, chatId);
    if (!thread) {
      throw new LucyApiError(404, LucyErrorCodes.CHAT_NOT_FOUND, 'Chat not found');
    }
    return thread;
  }
}

export function buildAutoTitle(firstUserMessage: string): string {
  const trimmed = firstUserMessage.trim();
  if (trimmed.length <= CHAT_AUTO_TITLE_MAX_LENGTH) {
    return trimmed;
  }
  return `${trimmed.slice(0, CHAT_AUTO_TITLE_MAX_LENGTH - 1)}…`;
}

function toMessageDto(message: PersistedChatMessage): ChatMessageDto {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
    ...(message.status !== undefined ? { status: message.status } : {}),
    ...(message.sources !== undefined ? { sources: message.sources } : {}),
  };
}

function newMessageId(): string {
  return `msg_${Date.now().toString(16)}_${Math.random().toString(16).slice(2, 10)}`;
}

function toStreamError(error: unknown): LucyApiError {
  if (error instanceof LucyApiError) {
    return error;
  }
  return new LucyApiError(
    500,
    LucyErrorCodes.INTERNAL_ERROR,
    error instanceof Error ? error.message : 'Stream failed',
  );
}

function formatStreamErrorCause(error: unknown): string {
  if (error instanceof LucyApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }
  return String(error);
}

function waitForNextEventLoopTick(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}
