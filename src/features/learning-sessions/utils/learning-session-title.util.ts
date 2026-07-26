import type { LearningSessionType } from '../domain/learning-session.types';
import type { StudyFocusArea } from '../domain/study-focus-area.types';

export const LEARNING_SESSION_TITLE_SUBJECT_MAX_LENGTH = 48;

export type BuildLearningSessionTitleInput = {
  type: LearningSessionType;
  isoTimestamp: string;
  topicHint?: string;
  focusAreas?: StudyFocusArea[];
};

export function buildLearningSessionTitle(
  input: BuildLearningSessionTitleInput,
): string {
  const prefix = input.type === 'quiz' ? 'Quiz' : 'Cartes';
  const subject = resolveSessionTitleSubject(input);

  if (subject) {
    return `${prefix} · ${truncateTitleSubject(subject)}`;
  }

  return `${prefix} · ${input.isoTimestamp.slice(0, 10)}`;
}

function resolveSessionTitleSubject(
  input: BuildLearningSessionTitleInput,
): string | undefined {
  if (input.focusAreas !== undefined && input.focusAreas.length > 0) {
    const subject = buildSubjectFromFocusAreas(input.focusAreas);
    if (subject) {
      return subject;
    }
  }

  const topicHint = input.topicHint?.trim();
  if (topicHint) {
    return topicHint;
  }

  return undefined;
}

function buildSubjectFromFocusAreas(focusAreas: StudyFocusArea[]): string {
  const labels = focusAreas
    .map((area) => area.label.trim())
    .filter((label) => label.length > 0);

  if (labels.length === 0) {
    return '';
  }
  if (labels.length === 1) {
    return labels[0]!;
  }
  if (labels.length === 2) {
    return `${labels[0]}, ${labels[1]}`;
  }

  return `${labels[0]} +${labels.length - 1}`;
}

function truncateTitleSubject(subject: string): string {
  const trimmed = subject.trim();
  if (trimmed.length <= LEARNING_SESSION_TITLE_SUBJECT_MAX_LENGTH) {
    return trimmed;
  }

  return `${trimmed.slice(0, LEARNING_SESSION_TITLE_SUBJECT_MAX_LENGTH - 1)}…`;
}
