export type LearningSessionType = 'quiz' | 'flashcards';

export type LearningSessionStatus = 'ready' | 'failed';

export type LearningSessionSource = {
  chunkId: string;
  documentId: string;
  title: string;
  pageStart?: number;
  pageEnd?: number;
  excerpt: string;
};

export type LearningSessionQuizItem = {
  id: string;
  question: string;
  choices: [string, string, string, string];
  correctIndex: number;
  explanation: string;
  sources: LearningSessionSource[];
};

export type LearningSessionFlashcardItem = {
  id: string;
  front: string;
  back: string;
  sources: LearningSessionSource[];
};

export type LearningSessionItem =
  | LearningSessionQuizItem
  | LearningSessionFlashcardItem;

export type PersistedLearningSession = {
  id: string;
  uid: string;
  type: LearningSessionType;
  status: LearningSessionStatus;
  itemCount: number;
  title: string;
  createdAt: string;
  updatedAt: string;
  activeDocumentCount: number;
  sourceChatId?: string;
  items: LearningSessionItem[];
};

export type CreateLearningSessionInput = Omit<
  PersistedLearningSession,
  'id' | 'uid'
>;
