import type { LearningSessionType } from '../../learning-sessions/domain/learning-session.types';

export type LastLearningGenerationRequest = {
  type: LearningSessionType;
  itemCount: number;
  topicHint?: string;
  selectedFocusAreaIds?: string[];
  requestedAt: string;
};
