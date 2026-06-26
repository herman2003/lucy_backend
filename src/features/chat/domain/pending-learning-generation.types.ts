import type { LearningSessionType } from '../../learning-sessions/domain/learning-session.types';

export type PendingLearningGenerationStep =
  | 'awaiting_confirm'
  | 'awaiting_document_selection'
  | 'analyzing'
  | 'awaiting_focus_selection'
  | 'awaiting_topic_fallback'
  | 'awaiting_count'
  | 'awaiting_launch_confirm';

export type PendingLearningGeneration = {
  type: LearningSessionType;
  step: PendingLearningGenerationStep;
  itemCount?: number;
  topicHint?: string;
  examType?: string;
  documentId?: string;
  documentTitle?: string;
  selectedFocusAreaIds?: string[];
  updatedAt: string;
};
