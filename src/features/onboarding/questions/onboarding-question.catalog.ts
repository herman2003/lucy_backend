import { Injectable } from '@nestjs/common';

import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../../core/errors/lucy-api.error';

export type OnboardingLocale = 'fr' | 'en' | 'de';

const QUESTION_TEXTS: Record<OnboardingLocale, Record<string, string>> = {
  fr: {
    q_role:
      'Parlez-moi de votre situation : êtes-vous étudiant·e, en reconversion, ou apprenez-vous de votre côté ?',
    q_domains: 'Quels sujets ou domaines allez-vous travailler avec moi ?',
    q_goal: 'Quel est votre objectif principal avec moi ?',
    q_level: 'Comment décririez-vous votre niveau aujourd’hui ?',
    q_style: 'Comment aimez-vous qu’on vous explique les notions ?',
    q_tone: 'Quel ton préférez-vous pour les corrections et le feedback ?',
    q_language: 'Dans quelle langue dois-je vous expliquer les cours ?',
  },
  en: {
    q_role:
      'Tell me about your situation: are you a student, changing careers, or learning on your own?',
    q_domains: 'Which subjects or areas will you work on with me?',
    q_goal: 'What is your main goal with me?',
    q_level: 'How would you describe your level today?',
    q_style: 'How do you like concepts explained to you?',
    q_tone: 'What tone do you prefer for corrections and feedback?',
    q_language: 'Which language should I use to explain lessons to you?',
  },
  de: {
    q_role:
      'Erzählen Sie mir von Ihrer Situation: Studium, Berufswechsel oder selbstständiges Lernen?',
    q_domains: 'Welche Fächer oder Bereiche möchten Sie mit mir bearbeiten?',
    q_goal: 'Was ist Ihr Hauptziel mit mir?',
    q_level: 'Wie würden Sie Ihr aktuelles Niveau beschreiben?',
    q_style: 'Wie sollen Ihnen Inhalte am besten erklärt werden?',
    q_tone: 'Welchen Ton bevorzugen Sie bei Korrekturen und Feedback?',
    q_language:
      'In welcher Sprache soll ich Ihnen den Unterricht erklären?',
  },
};

@Injectable()
export class OnboardingQuestionCatalog {
  static readonly orderedQuestionIds = [
    'q_role',
    'q_domains',
    'q_goal',
    'q_level',
    'q_style',
    'q_tone',
    'q_language',
  ] as const;

  getQuestionText(locale: string, questionId: string): string {
    if (!isOnboardingLocale(locale)) {
      throw new LucyApiError(
        400,
        LucyErrorCodes.VALIDATION_ERROR,
        `Unsupported locale: ${locale}`,
      );
    }

    const text = QUESTION_TEXTS[locale][questionId];
    if (!text) {
      throw new LucyApiError(
        400,
        LucyErrorCodes.VALIDATION_ERROR,
        `Unknown questionId: ${questionId}`,
      );
    }
    return text;
  }
}

function isOnboardingLocale(locale: string): locale is OnboardingLocale {
  return locale === 'fr' || locale === 'en' || locale === 'de';
}
