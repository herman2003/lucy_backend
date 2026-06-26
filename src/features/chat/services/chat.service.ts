import { Inject, Injectable } from '@nestjs/common';

import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../../core/errors/lucy-api.error';
import { getValidCorpusStudyPlan } from '../utils/corpus-study-plan-cache';
import { buildRevisionCalendarEntries } from '../../learning-sessions/utils/revision-calendar.util';
import { buildRevisionCalendarIcs } from '../utils/revision-calendar-ics.util';
import {
  USERS_PROFILE_REPOSITORY,
  type UsersProfileRepository,
} from '../../users/repositories/users.repository.port';
import type { TutoringLanguage } from '../../onboarding/domain/learner-profile.enums';
import {
  DEFAULT_CHAT_TITLE,
  type CreateChatRequestDto,
} from '../dto/create-chat.dto';
import type { ListChatMessagesQueryDto } from '../dto/list-chat-messages-query.dto';
import type { PersistedChatMessage, PersistedChatThread } from '../domain/chat.types';
import type { ChatEligibilityDto } from '../dto/chat-eligibility.dto';
import {
  CHATS_REPOSITORY,
  type ChatsRepository,
} from '../repositories/chats.repository.port';
import { ChatActiveStreamRegistry } from './chat-active-stream.registry';
import { ChatPrerequisitesService } from './chat-prerequisites.service';

export type ChatThreadListItemDto = {
  id: string;
  title: string;
  updatedAt: string;
  lastMessagePreview?: string;
};

export type ChatThreadCreatedDto = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type ChatMessageDto = {
  id: string;
  role: PersistedChatMessage['role'];
  content: string;
  createdAt: string;
  status?: PersistedChatMessage['status'];
  sources?: PersistedChatMessage['sources'];
};

export type RevisionCalendarIcsExport = {
  filename: string;
  content: string;
};

@Injectable()
export class ChatService {
  constructor(
    @Inject(CHATS_REPOSITORY)
    private readonly chatsRepository: ChatsRepository,
    private readonly chatPrerequisites: ChatPrerequisitesService,
    private readonly activeStreams: ChatActiveStreamRegistry,
    @Inject(USERS_PROFILE_REPOSITORY)
    private readonly usersRepository: UsersProfileRepository,
  ) {}

  getEligibility(uid: string): Promise<ChatEligibilityDto> {
    return this.chatPrerequisites.getEligibility(uid);
  }

  async listThreads(uid: string): Promise<ChatThreadListItemDto[]> {
    const threads = await this.chatsRepository.listThreads(uid);
    return threads.map((thread) => this.toThreadListItem(thread));
  }

  async createThread(uid: string, input: CreateChatRequestDto): Promise<ChatThreadCreatedDto> {
    const title = input.title ?? DEFAULT_CHAT_TITLE;
    const thread = await this.chatsRepository.createThread(uid, title);
    return {
      id: thread.id,
      title: thread.title,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
    };
  }

  async deleteThread(uid: string, chatId: string): Promise<void> {
    await this.requireThread(uid, chatId);
    this.activeStreams.assertNotActive(uid, chatId);
    await this.chatsRepository.deleteThread(uid, chatId);
  }

  async listMessages(
    uid: string,
    chatId: string,
    query: ListChatMessagesQueryDto,
  ): Promise<ChatMessageDto[]> {
    await this.requireThread(uid, chatId);
    const messages = await this.chatsRepository.listMessages(uid, chatId, {
      limit: query.limit,
      ...(query.beforeMessageId !== undefined
        ? { beforeMessageId: query.beforeMessageId }
        : {}),
    });
    return messages.map((message) => this.toMessageDto(message));
  }

  async exportRevisionCalendarIcs(
    uid: string,
    chatId: string,
  ): Promise<RevisionCalendarIcsExport> {
    const thread = await this.requireThread(uid, chatId);
    if (!thread.revisionExamDate) {
      throw new LucyApiError(
        404,
        LucyErrorCodes.VALIDATION_ERROR,
        'Revision calendar unavailable',
      );
    }

    const corpusStudyPlan = getValidCorpusStudyPlan(thread.corpusStudyPlan);
    if (!corpusStudyPlan) {
      throw new LucyApiError(
        404,
        LucyErrorCodes.VALIDATION_ERROR,
        'Revision calendar unavailable',
      );
    }

    const examDate = new Date(thread.revisionExamDate);
    const now = new Date();
    const entries = buildRevisionCalendarEntries(
      corpusStudyPlan.focusAreas,
      examDate,
      now,
    );
    if (entries.length === 0) {
      throw new LucyApiError(
        404,
        LucyErrorCodes.VALIDATION_ERROR,
        'Revision calendar unavailable',
      );
    }

    const language = await this.resolveTutoringLanguage(uid);
    const content = buildRevisionCalendarIcs({
      calendarName: thread.title,
      entries,
      language,
      generatedAt: now,
      uidPrefix: `chat-${chatId}`,
    });

    return {
      filename: 'lucy-revision-calendar.ics',
      content,
    };
  }

  private async resolveTutoringLanguage(
    uid: string,
  ): Promise<'fr' | 'en' | 'de'> {
    const profile = await this.usersRepository.getProfile(uid);
    const learnerProfile = profile?.learnerProfile;
    if (
      learnerProfile &&
      typeof learnerProfile === 'object' &&
      typeof (learnerProfile as Record<string, unknown>).tutoring_language ===
        'string'
    ) {
      const language = (learnerProfile as { tutoring_language: TutoringLanguage })
        .tutoring_language;
      if (language === 'en' || language === 'de') {
        return language;
      }
    }
    const uiLocale = profile?.uiLocale;
    if (uiLocale === 'en' || uiLocale === 'de') {
      return uiLocale;
    }
    return 'fr';
  }

  private async requireThread(uid: string, chatId: string): Promise<PersistedChatThread> {
    const thread = await this.chatsRepository.getThread(uid, chatId);
    if (!thread) {
      throw new LucyApiError(404, LucyErrorCodes.CHAT_NOT_FOUND, 'Chat not found');
    }
    return thread;
  }

  private toThreadListItem(thread: PersistedChatThread): ChatThreadListItemDto {
    return {
      id: thread.id,
      title: thread.title,
      updatedAt: thread.updatedAt,
      ...(thread.lastMessagePreview !== undefined
        ? { lastMessagePreview: thread.lastMessagePreview }
        : {}),
    };
  }

  private toMessageDto(message: PersistedChatMessage): ChatMessageDto {
    return {
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
      ...(message.status !== undefined ? { status: message.status } : {}),
      ...(message.sources !== undefined ? { sources: message.sources } : {}),
    };
  }
}
