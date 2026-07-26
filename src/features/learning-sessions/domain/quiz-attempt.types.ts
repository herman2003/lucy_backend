export type QuizAttemptAnswer = {
  itemId: string;
  selectedIndex: number;
  correctIndex: number;
  isCorrect: boolean;
};

export type PersistedQuizAttempt = {
  id: string;
  sessionId: string;
  startedAt: string;
  completedAt: string;
  scoreCorrect: number;
  scoreTotal: number;
  answers: QuizAttemptAnswer[];
};

export type CreateQuizAttemptInput = {
  id: string;
  startedAt: string;
  completedAt: string;
  scoreCorrect: number;
  scoreTotal: number;
  answers: QuizAttemptAnswer[];
};
