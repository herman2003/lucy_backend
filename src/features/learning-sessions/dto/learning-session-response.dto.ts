import type { PersistedLearningSession } from '../domain/learning-session.types';

export type LearningSessionResponseDto = {
  id: string;
  type: PersistedLearningSession['type'];
  status: PersistedLearningSession['status'];
  itemCount: number;
  title: string;
  createdAt: string;
  updatedAt: string;
  activeDocumentCount: number;
  sourceChatId?: string;
  items: PersistedLearningSession['items'];
};

export type LearningSessionListItemDto = {
  id: string;
  type: PersistedLearningSession['type'];
  status: PersistedLearningSession['status'];
  itemCount: number;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export function buildLearningSessionResponse(
  session: PersistedLearningSession,
): LearningSessionResponseDto {
  return {
    id: session.id,
    type: session.type,
    status: session.status,
    itemCount: session.itemCount,
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    activeDocumentCount: session.activeDocumentCount,
    ...(session.sourceChatId !== undefined
      ? { sourceChatId: session.sourceChatId }
      : {}),
    items: session.items,
  };
}

export function buildLearningSessionListItem(
  session: PersistedLearningSession,
): LearningSessionListItemDto {
  return {
    id: session.id,
    type: session.type,
    status: session.status,
    itemCount: session.itemCount,
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}
