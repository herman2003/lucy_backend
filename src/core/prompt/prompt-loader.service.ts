import { Injectable, OnModuleInit } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { LearnerProfile } from '../../features/onboarding/domain/learner-profile.enums';

export type ValidateAnswerUserPromptVars = {
  locale: string;
  questionId: string;
  questionText: string;
  answerText: string;
};

export type AnalyzeUserPromptVars = {
  locale: string;
  transcriptJson: string;
};

@Injectable()
export class PromptLoaderService implements OnModuleInit {
  private validateAnswerSystem = '';
  private validateAnswerUserTemplate = '';
  private analyzeSystem = '';
  private analyzeUserTemplate = '';
  private chatTutorSystemTemplate = '';

  onModuleInit(): void {
    const promptsRoot = this.resolvePromptsRoot();
    this.validateAnswerSystem = readFileSync(
      join(promptsRoot, 'onboarding-validate-answer.system.md'),
      'utf8',
    );
    this.validateAnswerUserTemplate = readFileSync(
      join(promptsRoot, 'onboarding-validate-answer.user.hbs'),
      'utf8',
    );
    this.analyzeSystem = readFileSync(
      join(promptsRoot, 'onboarding-analyze.system.md'),
      'utf8',
    );
    this.analyzeUserTemplate = readFileSync(
      join(promptsRoot, 'onboarding-analyze.user.hbs'),
      'utf8',
    );
    this.chatTutorSystemTemplate = readFileSync(
      join(promptsRoot, 'chat-tutor.system.hbs'),
      'utf8',
    );
  }

  getChatTutorSystemPrompt(learnerProfile: LearnerProfile): string {
    return renderHandlebarsTemplate(this.chatTutorSystemTemplate, {
      learnerProfileJson: JSON.stringify(learnerProfile, null, 2),
      explanation_style: learnerProfile.explanation_style,
      feedback_tone: learnerProfile.feedback_tone,
      self_assessed_level: learnerProfile.self_assessed_level,
      primary_role: learnerProfile.primary_role,
      main_domains: learnerProfile.main_domains.join(', '),
      learning_goal: learnerProfile.learning_goal,
      tutoring_language: learnerProfile.tutoring_language,
    });
  }

  getValidateAnswerSystemPrompt(): string {
    return this.validateAnswerSystem;
  }

  renderValidateAnswerUserPrompt(vars: ValidateAnswerUserPromptVars): string {
    return renderHandlebarsTemplate(this.validateAnswerUserTemplate, vars);
  }

  getAnalyzeSystemPrompt(): string {
    return this.analyzeSystem;
  }

  renderAnalyzeUserPrompt(vars: AnalyzeUserPromptVars): string {
    return renderHandlebarsTemplate(this.analyzeUserTemplate, vars);
  }

  private resolvePromptsRoot(): string {
    const candidates = [
      join(__dirname, '..', '..', 'prompts'),
      join(process.cwd(), 'dist', 'prompts'),
      join(process.cwd(), 'src', 'prompts'),
    ];
    for (const dir of candidates) {
      try {
        readFileSync(join(dir, 'onboarding-validate-answer.system.md'), 'utf8');
        return dir;
      } catch {
        // try next
      }
    }
    throw new Error('Prompts directory not found (onboarding-validate-answer.system.md)');
  }
}

export function renderHandlebarsTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '');
}
