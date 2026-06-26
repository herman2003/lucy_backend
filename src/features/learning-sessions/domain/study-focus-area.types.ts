export type StudyFocusImportance = 'high' | 'medium';

export type StudyFocusArea = {
  id: string;
  documentId: string;
  documentTitle: string;
  label: string;
  pageStart?: number;
  pageEnd?: number;
  ordinalStart: number;
  ordinalEnd: number;
  importance: StudyFocusImportance;
  rationale: string;
  keyConcepts: string[];
};

export type CorpusStudyPlan = {
  generatedAt: string;
  expiresAt: string;
  focusAreas: StudyFocusArea[];
};
