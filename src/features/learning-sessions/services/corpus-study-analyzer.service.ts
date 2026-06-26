import { Inject, Injectable, Logger } from '@nestjs/common';

import { LLM_PORT } from '../../../core/llm/llm.tokens';
import type { LlmPort } from '../../../core/llm/llm.port';
import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../../core/errors/lucy-api.error';
import { PromptLoaderService } from '../../../core/prompt/prompt-loader.service';
import type { LearnerProfile } from '../../onboarding/domain/learner-profile.enums';
import type { SearchRetrievalHitDto } from '../../retrieval/dto/search-retrieval.dto';
import { RetrievalService } from '../../retrieval/services/retrieval.service';
import { ChatPrerequisitesService } from '../../chat/services/chat-prerequisites.service';
import type { CorpusStudyPlan } from '../domain/study-focus-area.types';
import {
  CORPUS_STUDY_ANALYSIS_JSON_SCHEMA,
  CORPUS_STUDY_MAX_EXCERPTS,
  CORPUS_STUDY_PLAN_TTL_MS,
  CORPUS_STUDY_SAMPLE_QUERIES,
} from '../dto/learning-session.constants';
import { parseGeneratedCorpusStudyPlan } from '../validators/generated-corpus-study-plan.validator';

const CORPUS_STUDY_USER_MARKER = 'CORPUS_STUDY_ANALYSIS=true';

@Injectable()
export class CorpusStudyAnalyzerService {
  private readonly logger = new Logger(CorpusStudyAnalyzerService.name);

  constructor(
    private readonly chatPrerequisites: ChatPrerequisitesService,
    private readonly retrievalService: RetrievalService,
    private readonly prompts: PromptLoaderService,
    @Inject(LLM_PORT)
    private readonly llmPort: LlmPort,
  ) {}

  async analyze(uid: string): Promise<CorpusStudyPlan> {
    const learnerProfile = await this.chatPrerequisites.requireLearnerProfile(uid);
    await this.chatPrerequisites.requireActiveDocuments(uid);

    const hits = await this.sampleCorpusExcerpts(uid);
    if (hits.length === 0) {
      throw new LucyApiError(
        502,
        LucyErrorCodes.LEARNING_GENERATION_FAILED,
        'No excerpts available for corpus study analysis',
      );
    }

    const validationContext = buildValidationContext(hits);
    const systemPrompt = this.prompts.getCorpusStudyAnalyzerSystemPrompt(learnerProfile);
    const userPrompt = buildCorpusStudyUserPrompt(learnerProfile, hits);

    let lastError: LucyApiError | null = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await this.llmPort.generateStructured({
          systemPrompt,
          userPrompt,
          responseJsonSchema: CORPUS_STUDY_ANALYSIS_JSON_SCHEMA,
        });
        const focusAreas = parseGeneratedCorpusStudyPlan(
          response.parsedJson,
          validationContext,
        );
        const generatedAt = new Date().toISOString();
        return {
          generatedAt,
          expiresAt: new Date(Date.now() + CORPUS_STUDY_PLAN_TTL_MS).toISOString(),
          focusAreas,
        };
      } catch (error) {
        lastError = toAnalysisError(error);
        this.logger.warn(
          `corpus study analysis attempt ${attempt + 1} failed: ${lastError.message}`,
        );
      }
    }

    throw lastError ?? analysisFailed('Corpus study analysis failed');
  }

  private async sampleCorpusExcerpts(uid: string): Promise<SearchRetrievalHitDto[]> {
    const byChunkId = new Map<string, SearchRetrievalHitDto>();

    for (const query of CORPUS_STUDY_SAMPLE_QUERIES) {
      const hits = await this.retrievalService.search(uid, {
        query,
        limit: 12,
      });
      for (const hit of hits) {
        if (!byChunkId.has(hit.chunkId)) {
          byChunkId.set(hit.chunkId, hit);
        }
      }
      if (byChunkId.size >= CORPUS_STUDY_MAX_EXCERPTS) {
        break;
      }
    }

    return [...byChunkId.values()].slice(0, CORPUS_STUDY_MAX_EXCERPTS);
  }
}

function buildValidationContext(hits: SearchRetrievalHitDto[]): {
  documentsById: Map<string, { title: string }>;
  ordinalsByDocumentId: Map<string, Set<number>>;
} {
  const documentsById = new Map<string, { title: string }>();
  const ordinalsByDocumentId = new Map<string, Set<number>>();

  for (const hit of hits) {
    documentsById.set(hit.documentId, { title: hit.title });
    const ordinals = ordinalsByDocumentId.get(hit.documentId) ?? new Set<number>();
    const ordinal = parseOrdinalFromChunkId(hit.chunkId);
    if (ordinal !== undefined) {
      ordinals.add(ordinal);
    }
    ordinalsByDocumentId.set(hit.documentId, ordinals);
  }

  return { documentsById, ordinalsByDocumentId };
}

function buildCorpusStudyUserPrompt(
  learnerProfile: LearnerProfile,
  hits: SearchRetrievalHitDto[],
): string {
  const documents = [...buildValidationContext(hits).documentsById.entries()].map(
    ([id, doc]) => ({ id, title: doc.title }),
  );

  const excerpts = hits
    .map((hit) => {
      const ordinal = parseOrdinalFromChunkId(hit.chunkId);
      const pages =
        hit.pageStart !== undefined
          ? ` pages=${hit.pageStart}-${hit.pageEnd ?? hit.pageStart}`
          : '';
      const ordinalPart = ordinal !== undefined ? ` ordinal=${ordinal}` : '';
      return `[chunkId=${hit.chunkId} documentId=${hit.documentId}${ordinalPart}${pages}]\n${hit.text}`;
    })
    .join('\n\n');

  return [
    CORPUS_STUDY_USER_MARKER,
    `LEARNER_PROFILE=${JSON.stringify(learnerProfile)}`,
    `DOCUMENTS_JSON=${JSON.stringify(documents)}`,
    'EXCERPTS:',
    excerpts,
  ].join('\n');
}

export function parseOrdinalFromChunkId(chunkId: string): number | undefined {
  const match = chunkId.match(/^chunk_(\d+)$/);
  if (!match) {
    return undefined;
  }
  return Number.parseInt(match[1]!, 10);
}

function toAnalysisError(error: unknown): LucyApiError {
  if (error instanceof LucyApiError) {
    return error;
  }
  return analysisFailed(
    error instanceof Error ? error.message : 'Corpus study analysis failed',
  );
}

function analysisFailed(message: string): LucyApiError {
  return new LucyApiError(
    502,
    LucyErrorCodes.LEARNING_GENERATION_FAILED,
    message,
  );
}
