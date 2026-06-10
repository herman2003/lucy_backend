import { Inject, Injectable } from '@nestjs/common';

import { LLM_PORT } from '../../../core/llm/llm.tokens';
import type { LlmPort } from '../../../core/llm/llm.port';
import { PromptLoaderService } from '../../../core/prompt/prompt-loader.service';
import type { LearnerProfile } from '../../onboarding/domain/learner-profile.enums';
import type { SearchRetrievalHitDto } from '../../retrieval/dto/search-retrieval.dto';
import {
  CHAT_CITATION_JSON_SCHEMA,
  CHAT_HISTORY_PROMPT_MAX_MESSAGES,
  CHAT_SOURCE_EXCERPT_MAX_LENGTH,
} from '../chat.constants';
import type { ChatSourceRecord, PersistedChatMessage } from '../domain/chat.types';

const CITATION_CHUNK_IDS_MARKER = 'AVAILABLE_CHUNK_IDS_JSON=';

@Injectable()
export class ChatRagService {
  constructor(
    private readonly prompts: PromptLoaderService,
    @Inject(LLM_PORT)
    private readonly llmPort: LlmPort,
  ) {}

  buildSystemPrompt(learnerProfile: LearnerProfile): string {
    return this.prompts.getChatTutorSystemPrompt(learnerProfile);
  }

  buildUserPrompt(
    history: PersistedChatMessage[],
    question: string,
    hits: SearchRetrievalHitDto[],
  ): string {
    const recent = history.slice(-CHAT_HISTORY_PROMPT_MAX_MESSAGES);
    const historyBlock =
      recent.length === 0
        ? '(No prior messages in this thread.)'
        : recent
            .map((message) => `${message.role}: ${message.content}`)
            .join('\n');

    const excerptsBlock =
      hits.length === 0
        ? '(No relevant excerpts — START with an explicit sentence that the question is NOT in the learner uploaded documents; do NOT introduce yourself. Then suggest a document-related reformulation. Do not invent document content.)'
        : hits.map((hit) => hit.contextHeader).join('\n\n');

    return [
      '## Conversation history',
      historyBlock,
      '',
      '## Learner question',
      question,
      '',
      '## Retrieved excerpts',
      excerptsBlock,
    ].join('\n');
  }

  buildCitationUserPrompt(
    assistantAnswer: string,
    hits: SearchRetrievalHitDto[],
  ): string {
    const chunkIds = hits.map((hit) => hit.chunkId);
    return [
      'Select chunk IDs from the assistant answer that support factual claims.',
      `${CITATION_CHUNK_IDS_MARKER}${JSON.stringify(chunkIds)}`,
      '',
      '## Assistant answer',
      assistantAnswer,
      '',
      '## Retrieved chunks',
      hits.length === 0
        ? '(none)'
        : hits
            .map(
              (hit) =>
                `- chunkId=${hit.chunkId} documentId=${hit.documentId} title=${hit.title}`,
            )
            .join('\n'),
    ].join('\n');
  }

  /**
   * Resolves source cards without failing the chat turn when citation LLM errors.
   */
  async resolveSourcesSafely(
    assistantAnswer: string,
    hits: SearchRetrievalHitDto[],
  ): Promise<ChatSourceRecord[]> {
    if (hits.length === 0) {
      return [];
    }
    try {
      return await this.resolveSources(assistantAnswer, hits);
    } catch {
      return [];
    }
  }

  async resolveSources(
    assistantAnswer: string,
    hits: SearchRetrievalHitDto[],
  ): Promise<ChatSourceRecord[]> {
    const response = await this.llmPort.generateStructured({
      systemPrompt:
        'Return JSON only. citedChunkIds must be a subset of AVAILABLE_CHUNK_IDS from the user message.',
      userPrompt: this.buildCitationUserPrompt(assistantAnswer, hits),
      responseJsonSchema: CHAT_CITATION_JSON_SCHEMA,
    });

    const record = response.parsedJson as { citedChunkIds?: unknown } | undefined;
    const citedChunkIds = Array.isArray(record?.citedChunkIds)
      ? record.citedChunkIds.filter((id): id is string => typeof id === 'string')
      : [];

    const allowed = new Set(hits.map((hit) => hit.chunkId));
    const validIds = citedChunkIds.filter((id) => allowed.has(id));

    return validIds
      .map((chunkId) => {
        const hit = hits.find((h) => h.chunkId === chunkId);
        if (!hit) {
          return null;
        }
        return this.hitToSource(hit);
      })
      .filter((source): source is ChatSourceRecord => source !== null);
  }

  hitToSource(hit: SearchRetrievalHitDto): ChatSourceRecord {
    return {
      documentId: hit.documentId,
      title: hit.title,
      chunkId: hit.chunkId,
      excerpt: truncateExcerpt(hit.text),
      score: hit.score,
      ...(hit.pageStart !== undefined ? { pageStart: hit.pageStart } : {}),
      ...(hit.pageEnd !== undefined ? { pageEnd: hit.pageEnd } : {}),
    };
  }
}

export function truncateExcerpt(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= CHAT_SOURCE_EXCERPT_MAX_LENGTH) {
    return trimmed;
  }
  return `${trimmed.slice(0, CHAT_SOURCE_EXCERPT_MAX_LENGTH - 1)}…`;
}

export { CITATION_CHUNK_IDS_MARKER };
