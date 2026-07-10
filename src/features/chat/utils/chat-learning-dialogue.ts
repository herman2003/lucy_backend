import type { LearningSessionType } from '../../learning-sessions/domain/learning-session.types';
import type { CorpusStudyPlan } from '../../learning-sessions/domain/study-focus-area.types';
import { resolveLearningExamType } from '../../learning-sessions/utils/learning-exam-type.util';
import {
  isAllDocumentsSelection,
  parseDocumentSelection,
  resolveLearningDocumentScope,
  type ActiveDocumentRef,
} from '../../learning-sessions/utils/learning-document-scope.util';
import { LEARNING_SESSION_ITEM_LIMITS } from '../../learning-sessions/dto/learning-session.constants';
import type { TutoringLanguage } from '../../onboarding/domain/learner-profile.enums';
import type { LastLearningGenerationRequest } from '../domain/last-learning-generation-request.types';
import type { PendingLearningGeneration } from '../domain/pending-learning-generation.types';
import { parseFocusSelection } from './chat-focus-selection.parser';
import {
  buildFocusRefinementHint,
  parseFocusRefinementRequest,
} from './chat-focus-refinement.parser';
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
  buildLearningRegenerationUnavailableMessage,
  buildDocumentSelectionInvalidMessage,
  buildDocumentSelectionMessage,
  buildTopicFallbackPrompt,
} from './chat-learning-dialogue-messages';
import {
  detectLearningGenerationIntent,
  detectLearningRegenerationIntent,
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
      examType?: string;
      selectedFocusAreaIds?: string[];
      isRegeneration?: boolean;
    };

export type ProcessLearningDialogueInput = {
  message: string;
  pending: PendingLearningGeneration | null | undefined;
  tutoringLanguage: TutoringLanguage;
  corpusStudyPlan?: CorpusStudyPlan | null;
  lastLearningGenerationRequest?: LastLearningGenerationRequest | null;
  activeDocuments?: ActiveDocumentRef[];
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
      input.activeDocuments,
      nowIso,
    );
  }

  if (detectLearningRegenerationIntent(message)) {
    return resolveRegenerationDialogue(
      input.lastLearningGenerationRequest,
      input.tutoringLanguage,
    );
  }

  const intent = detectLearningGenerationIntent(message);
  if (!intent) {
    return null;
  }

  const itemCount = resolveItemCount(intent, message);
  const scopedPending = applyDocumentScopeToPending(
    applyExamTypeToPending(
      {
        type: intent,
        step: 'awaiting_confirm',
        updatedAt: nowIso,
      },
      message,
    ),
    message,
    input.activeDocuments,
  );

  if (itemCount !== undefined) {
    const pending = {
      ...scopedPending,
      step: 'awaiting_launch_confirm' as const,
      itemCount,
    };
    if (needsDocumentSelection(input.activeDocuments, pending)) {
      return {
        kind: 'assistant_reply',
        text: buildDocumentSelectionMessage(
          input.tutoringLanguage,
          input.activeDocuments!,
          intent,
        ),
        pending: {
          ...pending,
          step: 'awaiting_document_selection',
          updatedAt: nowIso,
        },
      };
    }
    return {
      kind: 'assistant_reply',
      text: buildLearningLaunchRecap(
        input.tutoringLanguage,
        intent,
        itemCount,
        pending.examType,
        pending.documentTitle,
      ),
      pending,
    };
  }

  return {
    kind: 'assistant_reply',
    text: buildLearningConfirmPrompt(input.tutoringLanguage, intent),
    pending: scopedPending,
  };
}

function resolveRegenerationDialogue(
  lastRequest: LastLearningGenerationRequest | null | undefined,
  tutoringLanguage: TutoringLanguage,
): LearningDialogueOutcome {
  if (!lastRequest) {
    return {
      kind: 'assistant_reply',
      text: buildLearningRegenerationUnavailableMessage(tutoringLanguage),
      pending: null,
    };
  }

  return {
    kind: 'generate',
    pending: null,
    type: lastRequest.type,
    itemCount: lastRequest.itemCount,
    isRegeneration: true,
    ...(lastRequest.topicHint !== undefined
      ? { topicHint: lastRequest.topicHint }
      : {}),
    ...(lastRequest.examType !== undefined ? { examType: lastRequest.examType } : {}),
    ...(lastRequest.selectedFocusAreaIds !== undefined
      ? { selectedFocusAreaIds: lastRequest.selectedFocusAreaIds }
      : {}),
  };
}

function advancePendingDialogue(
  pending: PendingLearningGeneration,
  message: string,
  tutoringLanguage: TutoringLanguage,
  corpusStudyPlan: CorpusStudyPlan | null | undefined,
  activeDocuments: ActiveDocumentRef[] | undefined,
  nowIso: string,
): LearningDialogueOutcome {
  const pendingWithExamType = applyDocumentScopeToPending(
    applyExamTypeToPending(pending, message),
    message,
    activeDocuments,
  );

  if (isLearningDialogueCancel(message)) {
    return {
      kind: 'assistant_reply',
      text: buildLearningCancelledMessage(tutoringLanguage),
      pending: null,
    };
  }

  const typeFromMessage = detectLearningGenerationIntent(message);
  const type = typeFromMessage ?? pendingWithExamType.type;

  switch (pendingWithExamType.step) {
    case 'awaiting_confirm': {
      if (!isLearningDialogueAffirmative(message)) {
        return {
          kind: 'assistant_reply',
          text: buildLearningConfirmPrompt(tutoringLanguage, type),
          pending: { ...pendingWithExamType, type, updatedAt: nowIso },
        };
      }
      const itemCount = resolveItemCount(type, message);
      if (itemCount !== undefined) {
        const nextPending = {
          ...pendingWithExamType,
          type,
          step: 'awaiting_launch_confirm' as const,
          itemCount,
          updatedAt: nowIso,
        };
        if (needsDocumentSelection(activeDocuments, nextPending)) {
          return {
            kind: 'assistant_reply',
            text: buildDocumentSelectionMessage(
              tutoringLanguage,
              activeDocuments!,
              type,
            ),
            pending: {
              ...nextPending,
              step: 'awaiting_document_selection',
              updatedAt: nowIso,
            },
          };
        }
        return {
          kind: 'assistant_reply',
          text: buildLearningLaunchRecap(
            tutoringLanguage,
            type,
            itemCount,
            nextPending.examType,
            nextPending.documentTitle,
          ),
          pending: nextPending,
        };
      }
      if (needsDocumentSelection(activeDocuments, pendingWithExamType)) {
        return {
          kind: 'assistant_reply',
          text: buildDocumentSelectionMessage(
            tutoringLanguage,
            activeDocuments!,
            type,
          ),
          pending: {
            ...pendingWithExamType,
            type,
            step: 'awaiting_document_selection',
            updatedAt: nowIso,
          },
        };
      }
      return {
        kind: 'needs_analysis',
        pending: {
          ...pendingWithExamType,
          type,
          step: 'analyzing',
          updatedAt: nowIso,
        },
      };
    }
    case 'awaiting_document_selection': {
      const parsed = parseDocumentSelection(message, activeDocuments ?? []);
      if (parsed.kind === 'invalid') {
        const listText =
          activeDocuments !== undefined && activeDocuments.length > 0
            ? `\n\n${buildDocumentSelectionMessage(tutoringLanguage, activeDocuments, type)}`
            : '';
        return {
          kind: 'assistant_reply',
          text: `${buildDocumentSelectionInvalidMessage(tutoringLanguage)}${listText}`,
          pending: { ...pendingWithExamType, type, updatedAt: nowIso },
        };
      }
      if (parsed.kind === 'all') {
        return {
          kind: 'needs_analysis',
          pending: {
            ...pendingWithExamType,
            type,
            step: 'analyzing',
            updatedAt: nowIso,
          },
        };
      }
      const withDocument = {
        ...pendingWithExamType,
        type,
        documentId: parsed.documentId,
        documentTitle: parsed.documentTitle,
        updatedAt: nowIso,
      };
      if (withDocument.itemCount !== undefined) {
        return {
          kind: 'assistant_reply',
          text: buildLearningLaunchRecap(
            tutoringLanguage,
            type,
            withDocument.itemCount,
            withDocument.examType,
            withDocument.documentTitle,
          ),
          pending: {
            ...withDocument,
            step: 'awaiting_launch_confirm',
          },
        };
      }
      return {
        kind: 'needs_analysis',
        pending: {
          ...withDocument,
          step: 'analyzing',
        },
      };
    }
    case 'analyzing': {
      return {
        kind: 'assistant_reply',
        text: buildLearningAnalyzingMessage(tutoringLanguage),
        pending: { ...pendingWithExamType, type, updatedAt: nowIso },
      };
    }
    case 'awaiting_focus_selection': {
      const focusAreas = corpusStudyPlan?.focusAreas ?? [];
      const parsed = parseFocusSelection(message, focusAreas);
      if (parsed.kind === 'selected') {
        return {
          kind: 'assistant_reply',
          text: buildLearningCountPrompt(tutoringLanguage, type),
          pending: {
            ...pendingWithExamType,
            type,
            step: 'awaiting_count',
            selectedFocusAreaIds: parsed.focusAreaIds,
            updatedAt: nowIso,
          },
        };
      }

      const refinement = parseFocusRefinementRequest(message);
      if (refinement.kind !== 'none' && focusAreas.length > 0) {
        return {
          kind: 'needs_analysis',
          pending: {
            ...pendingWithExamType,
            type,
            step: 'analyzing',
            focusRefinementHint: buildFocusRefinementHint(refinement),
            updatedAt: nowIso,
          },
        };
      }

      if (focusAreas.length === 0) {
        const invalidText = buildFocusSelectionInvalidMessage(tutoringLanguage);
        return {
          kind: 'assistant_reply',
          text: invalidText,
          pending: { ...pendingWithExamType, type, updatedAt: nowIso },
        };
      }

      const invalidText = buildFocusSelectionInvalidMessage(tutoringLanguage);
      const listText = `\n\n${buildFocusSelectionMessage(tutoringLanguage, corpusStudyPlan!, type)}`;
      return {
        kind: 'assistant_reply',
        text: `${invalidText}${listText}`,
        pending: { ...pendingWithExamType, type, updatedAt: nowIso },
      };
    }
    case 'awaiting_topic_fallback': {
      const topicHint = message.trim();
      if (!topicHint) {
        return {
          kind: 'assistant_reply',
          text: buildTopicFallbackPrompt(tutoringLanguage, type),
          pending: { ...pendingWithExamType, type, updatedAt: nowIso },
        };
      }
      return {
        kind: 'assistant_reply',
        text: buildLearningCountPrompt(tutoringLanguage, type),
        pending: {
          ...pendingWithExamType,
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
          pending: { ...pendingWithExamType, type, updatedAt: nowIso },
        };
      }
      const nextPending = {
        ...pendingWithExamType,
        type,
        step: 'awaiting_launch_confirm' as const,
        itemCount,
        updatedAt: nowIso,
      };
      return {
        kind: 'assistant_reply',
        text: buildLearningLaunchRecap(
          tutoringLanguage,
          type,
          itemCount,
          nextPending.examType,
          nextPending.documentTitle,
        ),
        pending: nextPending,
      };
    }
    case 'awaiting_launch_confirm': {
      if (!isLearningDialogueAffirmative(message)) {
        return {
          kind: 'assistant_reply',
          text: buildLearningLaunchClarifyMessage(tutoringLanguage),
          pending: { ...pendingWithExamType, type, updatedAt: nowIso },
        };
      }
      const itemCount =
        pendingWithExamType.itemCount ?? LEARNING_SESSION_ITEM_LIMITS[type].defaultCount;
      return {
        kind: 'generate',
        pending: null,
        type,
        itemCount,
        ...(pendingWithExamType.topicHint !== undefined
          ? { topicHint: pendingWithExamType.topicHint }
          : {}),
        ...(pendingWithExamType.examType !== undefined
          ? { examType: pendingWithExamType.examType }
          : {}),
        ...(pendingWithExamType.selectedFocusAreaIds !== undefined
          ? { selectedFocusAreaIds: pendingWithExamType.selectedFocusAreaIds }
          : {}),
      };
    }
    default: {
      const exhaustive: never = pendingWithExamType.step;
      return exhaustive;
    }
  }
}

function applyExamTypeToPending(
  pending: PendingLearningGeneration,
  message: string,
): PendingLearningGeneration {
  const examType = resolveLearningExamType(message, pending.examType);
  if (!examType) {
    return pending;
  }
  if (examType === pending.examType) {
    return pending;
  }
  return { ...pending, examType };
}

function needsDocumentSelection(
  activeDocuments: ActiveDocumentRef[] | undefined,
  pending: PendingLearningGeneration,
): boolean {
  if (!activeDocuments || activeDocuments.length <= 1) {
    return false;
  }
  return pending.documentId === undefined;
}

function applyDocumentScopeToPending(
  pending: PendingLearningGeneration,
  message: string,
  activeDocuments?: ActiveDocumentRef[],
): PendingLearningGeneration {
  if (pending.documentId !== undefined || !activeDocuments || activeDocuments.length <= 1) {
    return pending;
  }

  if (isAllDocumentsSelection(message)) {
    return pending;
  }

  const scope = resolveLearningDocumentScope(message, activeDocuments);
  if (scope.kind !== 'resolved') {
    return pending;
  }

  return {
    ...pending,
    documentId: scope.documentId,
    documentTitle: scope.documentTitle,
  };
}
