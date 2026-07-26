import {
  buildExamTypePromptContext,
  detectLearningExamType,
  resolveLearningExamType,
} from './learning-exam-type.util';

describe('learning-exam-type.util (LEARN-10b)', () => {
  it('detects exam types from user messages', () => {
    expect(detectLearningExamType('quiz pour mon partiel de bio')).toBe('partiel');
    expect(detectLearningExamType('cartes pour une dissertation')).toBe('dissertation');
    expect(detectLearningExamType('fais-moi un QCM')).toBe('QCM');
    expect(detectLearningExamType('Karten für meine Klausur')).toBe('Klausur');
  });

  it('returns undefined when no exam type is mentioned', () => {
    expect(detectLearningExamType('fais-moi un quiz')).toBeUndefined();
  });

  it('keeps the first detected exam type across turns', () => {
    expect(resolveLearningExamType('oui', 'partiel')).toBe('partiel');
    expect(resolveLearningExamType('10 questions', undefined)).toBeUndefined();
    expect(resolveLearningExamType('pour mon oral', undefined)).toBe('oral');
  });

  it('builds prompt context only when exam type is set', () => {
    expect(buildExamTypePromptContext()).toContain('No specific exam format');
    expect(buildExamTypePromptContext('partiel')).toContain('partiel');
  });
});
