const EXAM_TYPE_PATTERNS: ReadonlyArray<{ pattern: RegExp; label: string }> = [
  { pattern: /\bdissertation\b/i, label: 'dissertation' },
  { pattern: /\bexpos[ée]\b/i, label: 'exposé' },
  { pattern: /\bpartiel\b/i, label: 'partiel' },
  { pattern: /\bcontr[oô]le\b/i, label: 'contrôle' },
  { pattern: /\bconcours\b/i, label: 'concours' },
  { pattern: /\bbaccalaur[ée]at\b/i, label: 'baccalauréat' },
  { pattern: /\bbac\b/i, label: 'baccalauréat' },
  { pattern: /\boral\b/i, label: 'oral' },
  { pattern: /\bqcm\b/i, label: 'QCM' },
  { pattern: /\bexamen\b/i, label: 'examen' },
  { pattern: /\bklausur\b/i, label: 'Klausur' },
  { pattern: /\bm[üu]ndliche\s+pr[üu]fung\b/i, label: 'mündliche Prüfung' },
  { pattern: /\bpr[üu]fung\b/i, label: 'Prüfung' },
  { pattern: /\bfinal exam\b/i, label: 'final exam' },
  { pattern: /\bmidterm\b/i, label: 'midterm' },
  { pattern: /\bwritten exam\b/i, label: 'written exam' },
];

/** Detects an optional exam format mentioned by the learner (LEARN-10b). */
export function detectLearningExamType(message: string): string | undefined {
  const normalized = message.trim();
  if (!normalized) {
    return undefined;
  }

  for (const { pattern, label } of EXAM_TYPE_PATTERNS) {
    if (pattern.test(normalized)) {
      return label;
    }
  }

  return undefined;
}

export function resolveLearningExamType(
  message: string,
  existing?: string,
): string | undefined {
  return detectLearningExamType(message) ?? existing;
}

export function buildExamTypePromptContext(examType?: string): string {
  if (!examType) {
    return 'No specific exam format was mentioned by the learner.';
  }
  return `The learner mentioned this exam format: ${examType}. Tailor recommendations and item style accordingly.`;
}
