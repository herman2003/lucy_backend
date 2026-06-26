export type LearningGenerationAdviceKey =
  | 'no_retrieval_hits'
  | 'invalid_llm_output'
  | 'unknown';

export type LearningGenerationFailureDetails = {
  adviceKey: LearningGenerationAdviceKey;
};
