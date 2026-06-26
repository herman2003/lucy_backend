import type { LearningSessionType } from '../../learning-sessions/domain/learning-session.types';
import type { CorpusStudyPlan } from '../../learning-sessions/domain/study-focus-area.types';
import { LEARNING_SESSION_ITEM_LIMITS } from '../../learning-sessions/dto/learning-session.constants';
import type { TutoringLanguage } from '../../onboarding/domain/learner-profile.enums';
import type { PendingLearningGeneration } from '../domain/pending-learning-generation.types';
import { parseFocusSelection } from './chat-focus-selection.parser';
import {
  buildLearningCancelledMessage,
  buildLearningConfirmPrompt,
  buildLearningCountPrompt,
  buildFocusSelectionInvalidMessage,
  buildFocusSelectionMessage,
  buildLearningAnalyzingMessage,
  buildLearningInvalidCountMessage,
  buildLearningLaunchClarifyMessage,
  buildLearningLaunchRecap,
  buildTopicFallbackPrompt,
} from './chat-learning-dialogue-messages';
import {
  detectLearningGenerationIntent,
  parseLearningItemCount,
} from './chat-learning-generation';

export type LearningDialogueOutcome =
  | {
      kind: 'assistant_reply';
      text: string;
      pending: PendingLearningGeneration | null;
    }
  | {
      kind: 'needs_analysis';
      pending: PendingLearningGeneration;
    }
  | {
      kind: 'generate';
      pending: null;
      type: LearningSessionType;
      itemCount: number;
      topicHint?: string;
      selectedFocusAreaIds?: string[];
    };

export type ProcessLearningDialogueInput = {
  message: string;
  pending: PendingLearningGeneration | null | undefined;
  tutoringLanguage: TutoringLanguage;
  corpusStudyPlan?: CorpusStudyPlan | null;
  nowIso?: string;
};

const CANCEL_PATTERNS = [
  /^annule\b/i,
  /^annuler\b/i,
  /^cancel\b/i,
  /^stop\b/i,
  /^abandon/i,
  /^abbrechen\b/i,
];

const AFFIRMATIVE_PATTERNS = [
  /^oui\b/i,
  /^yes\b/i,
  /^ja\b/i,
  /^ok\b/i,
  /^d'accord\b/i,
  /^daccord\b/i,
  /^c'est bon\b/i,
  /^cest bon\b/i,
  /^vas[- ]?y\b/i,
  /^go\b/i,
  /^lance\b/i,
  /^génère\b/i,
  /^genere\b/i,
];

const DEFAULT_COUNT_PATTERNS = [
  /comme tu veux/i,
  /comme vous voulez/i,
  /as you like/i,
  /wie du willst/i,
  /tu choisis/i,
  /à toi de voir/i,
];

export function isLearningDialogueCancel(message: string): boolean {
  const normalized = message.trim();
  if (!normalized) {
    return false;
  }
  if (/^non\b/i.test(normalized) || /^no\b/i.test(normalized) || /^nein\b/i.test(normalized)) {
    return true;
  }
  return CANCEL_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function isLearningDialogueAffirmative(message: string): boolean {
  const normalized = message.trim();
  if (!normalized) {
    return false;
  }
  return AFFIRMATIVE_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function isDefaultItemCountRequest(message: string): boolean {
  return DEFAULT_COUNT_PATTERNS.some((pattern) => pattern.test(message));
}

export function resolveItemCount(
  type: LearningSessionType,
  message: string,
): number | undefined {
  if (isDefaultItemCountRequest(message)) {
    return LEARNING_SESSION_ITEM_LIMITS[type].defaultCount;
  }
  const parsed = parseLearningItemCount(message);
  if (parsed === undefined) {
    return undefined;
  }
  const max = LEARNING_SESSION_ITEM_LIMITS[type].maxCount;
  if (parsed < 1 || parsed > max) {
    return undefined;
  }
  return parsed;
}

export function processLearningDialogueTurn(
  input: ProcessLearningDialogueInput,
): LearningDialogueOutcome | null {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const message = input.message.trim();
  if (!message) {
    return null;
  }

  if (input.pending) {
    return advancePendingDialogue(
      input.pending,
      message,
      input.tutoringLanguage,
      input.corpusStudyPlan,
      nowIso,
    );
  }

  const intent = detectLearningGenerationIntent(message);
  if (!intent) {
    return null;
  }

  const itemCount = resolveItemCount(intent, message);

  if (itemCount !== undefined) {
    const pending: PendingLearningGeneration = {
      type: intent,
      step: 'awaiting_launch_confirm',
      itemCount,
      updatedAt: nowIso,
    };
    return {
      kind: 'assistant_reply',
      text: buildLearningLaunchRecap(input.tutoringLanguage, intent, itemCount),
      pending,
    };
  }

  const pending: PendingLearningGeneration = {
    type: intent,
    step: 'awaiting_confirm',
    updatedAt: nowIso,
  };
  return {
    kind: 'assistant_reply',
    text: buildLearningConfirmPrompt(input.tutoringLanguage, intent),
    pending,
  };
}

function advancePendingDialogue(
  pending: PendingLearningGeneration,
  message: string,
  tutoringLanguage: TutoringLanguage,
  corpusStudyPlan: CorpusStudyPlan | null | undefined,
  nowIso: string,
): LearningDialogueOutcome {
  if (isLearningDialogueCancel(message)) {
    return {
      kind: 'assistant_reply',
      text: buildLearningCancelledMessage(tutoringLanguage),
      pending: null,
    };
  }

  const typeFromMessage = detectLearningGenerationIntent(message);
  const type = typeFromMessage ?? pending.type;

  switch (pending.step) {
    case 'awaiting_confirm': {
      if (!isLearningDialogueAffirmative(message)) {
        return {
          kind: 'assistant_reply',
          text: buildLearningConfirmPrompt(tutoringLanguage, type),
          pending: { ...pending, type, updatedAt: nowIso },
        };
      }
      const itemCount = resolveItemCount(type, message);
      if (itemCount !== undefined) {
        return {
          kind: 'assistant_reply',
          text: buildLearningLaunchRecap(tutoringLanguage, type, itemCount),
          pending: {
            type,
            step: 'awaiting_launch_confirm',
            itemCount,
            updatedAt: nowIso,
          },
        };
      }
      return {
        kind: 'needs_analysis',
        pending: {
          type,
          step: 'analyzing',
          updatedAt: nowIso,
        },
      };
    }
    case 'analyzing': {
      return {
        kind: 'assistant_reply',
        text: buildLearningAnalyzingMessage(tutoringLanguage),
        pending: { ...pending, type, updatedAt: nowIso },
      };
    }
    case 'awaiting_focus_selection': {
      const focusAreas = corpusStudyPlan?.focusAreas ?? [];
      const parsed = parseFocusSelection(message, focusAreas);
      if (parsed.kind === 'invalid' || focusAreas.length === 0) {
        const invalidText = buildFocusSelectionInvalidMessage(tutoringLanguage);
        const listText =
          corpusStudyPlan !== null &&
          corpusStudyPlan !== undefined &&
          corpusStudyPlan.focusAreas.length > 0
            ? `\n\n${buildFocusSelectionMessage(tutoringLanguage, corpusStudyPlan, type)}`
            : '';
        return {
          kind: 'assistant_reply',
          text: `${invalidText}${listText}`,
          pending: { ...pending, type, updatedAt: nowIso },
        };
      }
      return {
        kind: 'assistant_reply',
        text: buildLearningCountPrompt(tutoringLanguage, type),
        pending: {
          type,
          step: 'awaiting_count',
          selectedFocusAreaIds: parsed.focusAreaIds,
          updatedAt: nowIso,
        },
      };
    }
    case 'awaiting_topic_fallback': {
      const topicHint = message.trim();
      if (!topicHint) {
        return {
          kind: 'assistant_reply',
          text: buildTopicFallbackPrompt(tutoringLanguage, type),
          pending: { ...pending, type, updatedAt: nowIso },
        };
      }
      return {
        kind: 'assistant_reply',
        text: buildLearningCountPrompt(tutoringLanguage, type),
        pending: {
          type,
          step: 'awaiting_count',
          topicHint,
          updatedAt: nowIso,
        },
      };
    }
    case 'awaiting_count': {
      const itemCount = resolveItemCount(type, message);
      if (itemCount === undefined) {
        return {
          kind: 'assistant_reply',
          text: buildLearningInvalidCountMessage(tutoringLanguage, type),
          pending: { ...pending, type, updatedAt: nowIso },
        };
      }
      return {
        kind: 'assistant_reply',
        text: buildLearningLaunchRecap(tutoringLanguage, type, itemCount),
        pending: {
          ...pending,
          type,
          step: 'awaiting_launch_confirm',
          itemCount,
          updatedAt: nowIso,
        },
      };
    }
    case 'awaiting_launch_confirm': {
      if (!isLearningDialogueAffirmative(message)) {
        return {
          kind: 'assistant_reply',
          text: buildLearningLaunchClarifyMessage(tutoringLanguage),
          pending: { ...pending, type, updatedAt: nowIso },
        };
      }
      const itemCount =
        pending.itemCount ?? LEARNING_SESSION_ITEM_LIMITS[type].defaultCount;
      return {
        kind: 'generate',
        pending: null,
        type,
        itemCount,
        ...(pending.topicHint !== undefined ? { topicHint: pending.topicHint } : {}),
        ...(pending.selectedFocusAreaIds !== undefined
          ? { selectedFocusAreaIds: pending.selectedFocusAreaIds }
          : {}),
      };
    }
    default: {
      const exhaustive: never = pending.step;
      return exhaustive;
    }
  }
}
