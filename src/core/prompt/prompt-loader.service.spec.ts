import { Test } from '@nestjs/testing';

import type { LearnerProfile } from '../../features/onboarding/domain/learner-profile.enums';
import { PromptLoaderService } from './prompt-loader.service';

const CHAT_TUTOR_PROFILE_FIXTURE: LearnerProfile = {
  primary_role: 'student',
  main_domains: ['sciences', 'cs'],
  learning_goal: 'exam',
  self_assessed_level: 'intermediate',
  explanation_style: 'analogies',
  feedback_tone: 'strict',
  tutoring_language: 'fr',
};

describe('PromptLoaderService', () => {
  let service: PromptLoaderService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [PromptLoaderService],
    }).compile();
    service = module.get(PromptLoaderService);
    service.onModuleInit();
  });

  it('loads validate-answer system prompt with JSON output rules', () => {
    const system = service.getValidateAnswerSystemPrompt();
    expect(system).toContain('rephrasedQuestion');
    expect(system).toContain('turnSummary');
    expect(system).toMatch(/Peux-tu préciser|Can you clarify|meta/i);
  });

  it('forbids vague meta-phrases in system instructions', () => {
    const system = service.getValidateAnswerSystemPrompt().toLowerCase();
    expect(system).toContain('never');
    expect(system).toContain('peux-tu préciser');
  });

  it('loads analyze system prompt with learnerProfile rules', () => {
    const system = service.getAnalyzeSystemPrompt();
    expect(system).toContain('learnerProfile');
    expect(system).toContain('summaryForUser');
    expect(system).toContain('main_domains');
  });

  it('renders analyze user template with transcript JSON', () => {
    const rendered = service.renderAnalyzeUserPrompt({
      locale: 'fr',
      transcriptJson: '[{"questionId":"q_role"}]',
    });
    expect(rendered).toContain('fr');
    expect(rendered).toContain('q_role');
    expect(rendered).not.toContain('{{');
  });

  it('renders chat-tutor system prompt with learner profile style fields', () => {
    const system = service.getChatTutorSystemPrompt(CHAT_TUTOR_PROFILE_FIXTURE);

    expect(system).toContain('explanation_style');
    expect(system).toContain('analogies');
    expect(system).toContain('feedback_tone');
    expect(system).toContain('strict');
    expect(system).toContain('"tutoring_language": "fr"');
    expect(system).toContain('Quiz');
    expect(system).not.toContain('{{');
  });

  it('renders user template with all placeholders', () => {
    const rendered = service.renderValidateAnswerUserPrompt({
      locale: 'fr',
      questionId: 'q_role',
      questionText: 'Parlez-moi de votre situation.',
      answerText: 'Je suis étudiant en L2 biologie.',
    });

    expect(rendered).toContain('fr');
    expect(rendered).toContain('q_role');
    expect(rendered).toContain('Parlez-moi de votre situation.');
    expect(rendered).toContain('Je suis étudiant en L2 biologie.');
    expect(rendered).not.toContain('{{');
  });

  it('renders quiz generator prompt with learner profile and difficulty (LEARN-07e)', () => {
    const system = service.getQuizGeneratorSystemPrompt(CHAT_TUTOR_PROFILE_FIXTURE, 5);

    expect(system).toContain('learning_goal');
    expect(system).toContain('exam');
    expect(system).toContain('self_assessed_level');
    expect(system).toContain('intermediate');
    expect(system).toContain('sciences');
    expect(system).toContain('primary_role');
    expect(system.toLowerCase()).toContain('intermediate difficulty');
    expect(system).not.toContain('{{');
  });

  it('adjusts quiz difficulty guidance for advanced learners (LEARN-07e)', () => {
    const advancedProfile: LearnerProfile = {
      ...CHAT_TUTOR_PROFILE_FIXTURE,
      self_assessed_level: 'advanced',
    };

    const system = service.getQuizGeneratorSystemPrompt(advancedProfile, 5);

    expect(system.toLowerCase()).toContain('nuanced');
    expect(system.toLowerCase()).not.toContain('foundational');
  });

  it('renders flashcards generator prompt with learner profile and difficulty (LEARN-07e)', () => {
    const system = service.getFlashcardsGeneratorSystemPrompt(
      CHAT_TUTOR_PROFILE_FIXTURE,
      10,
    );

    expect(system).toContain('learning_goal');
    expect(system).toContain('analogies');
    expect(system).toContain('intermediate');
    expect(system).not.toContain('{{');
  });
});
