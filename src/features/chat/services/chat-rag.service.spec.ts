import { Test } from '@nestjs/testing';

import { LLM_PORT } from '../../../core/llm/llm.tokens';
import { MockLlmAdapter } from '../../../core/llm/mock.llm.adapter';
import { PromptLoaderService } from '../../../core/prompt/prompt-loader.service';
import { PromptModule } from '../../../core/prompt/prompt.module';
import type { LearnerProfile } from '../../onboarding/domain/learner-profile.enums';
import type { SearchRetrievalHitDto } from '../../retrieval/dto/search-retrieval.dto';
import { ChatRagService } from './chat-rag.service';

const profile: LearnerProfile = {
  primary_role: 'student',
  main_domains: ['sciences'],
  learning_goal: 'exam',
  self_assessed_level: 'intermediate',
  explanation_style: 'step_by_step',
  feedback_tone: 'encouraging',
  tutoring_language: 'fr',
};

describe('ChatRagService (CHAT-05)', () => {
  let chatRag: ChatRagService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PromptModule],
      providers: [ChatRagService, { provide: LLM_PORT, useClass: MockLlmAdapter }],
    }).compile();

    chatRag = moduleRef.get(ChatRagService);
    moduleRef.get(PromptLoaderService).onModuleInit();
  });

  it('buildSystemPrompt includes quiz guidance and profile style fields', () => {
    const system = chatRag.buildSystemPrompt(profile);

    expect(system).toContain('step_by_step');
    expect(system).toContain('encouraging');
    expect(system).toContain('learning sessions');
    expect(system).not.toContain('coming soon');
  });

  it('resolveSourcesSafely returns empty array without calling LLM when hits are empty', async () => {
    const llm = { generateStructured: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      imports: [PromptModule],
      providers: [
        ChatRagService,
        { provide: LLM_PORT, useValue: llm },
      ],
    }).compile();
    const service = moduleRef.get(ChatRagService);
    moduleRef.get(PromptLoaderService).onModuleInit();

    const sources = await service.resolveSourcesSafely('Réponse', []);

    expect(sources).toEqual([]);
    expect(llm.generateStructured).not.toHaveBeenCalled();
  });

  it('resolveSourcesSafely returns empty array when citation LLM fails', async () => {
    const llm = {
      generateStructured: jest.fn().mockRejectedValue(new Error('citation failed')),
    };
    const moduleRef = await Test.createTestingModule({
      imports: [PromptModule],
      providers: [
        ChatRagService,
        { provide: LLM_PORT, useValue: llm },
      ],
    }).compile();
    const service = moduleRef.get(ChatRagService);
    moduleRef.get(PromptLoaderService).onModuleInit();

    const hits: SearchRetrievalHitDto[] = [
      {
        documentId: 'doc_1',
        title: 'Cours',
        chunkId: 'chunk_a',
        text: 'Texte',
        score: 0.9,
        contextHeader: 'header',
      },
    ];

    const sources = await service.resolveSourcesSafely('Réponse', hits);

    expect(sources).toEqual([]);
  });

  it('resolveSources maps mock citedChunkIds to source records', async () => {
    const hits: SearchRetrievalHitDto[] = [
      {
        documentId: 'doc_1',
        title: 'Cours',
        chunkId: 'chunk_a',
        text: 'Texte long '.repeat(40),
        score: 0.9,
        contextHeader: 'header',
      },
    ];

    const sources = await chatRag.resolveSources('Réponse mock', hits);

    expect(sources).toHaveLength(1);
    expect(sources[0]?.chunkId).toBe('chunk_a');
    expect(sources[0]?.excerpt.length).toBeLessThanOrEqual(300);
  });
});
