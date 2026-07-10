export type FocusRefinementParseResult =
  | { kind: 'none' }
  | { kind: 'reanalyze' }
  | { kind: 'refine'; hint: string };

const REANALYZE_PATTERNS = [
  /^autre(?:s)?\s+propositions?\b/i,
  /^propose\s+autre\b/i,
  /^refais\s+l['’]?analyse\b/i,
  /^re-?analys/i,
  /^nouvelle\s+liste\b/i,
  /^(?:change|modifie)\s+la\s+liste\b/i,
  /^other\s+suggestions?\b/i,
  /^another\s+suggestion\b/i,
  /^re-?analyze\b/i,
  /^redo\s+analysis\b/i,
  /^andere\s+vorschl[aä]ge?\b/i,
  /^neu\s+analysier/i,
  /^neue\s+liste\b/i,
];

const REFINE_HINT_PATTERNS = [
  /^plus\s+sur\b/i,
  /^plut[oô]t\s+sur\b/i,
  /^focus\s+on\b/i,
  /^concentre[\s-]?toi\s+sur\b/i,
  /^konzentrier.*\s+auf\b/i,
  /^rather\s+on\b/i,
  /^enl[eè]ve\b/i,
  /^sans\s+la\s+partie\b/i,
  /^without\s+part\b/i,
  /^ohne\s+teil\b/i,
  /^moins\s+sur\b/i,
  /^privil[eé]gie\b/i,
  /^je\s+veux\s+plus\b/i,
  /^i\s+want\s+more\b/i,
  /^ich\s+will\s+mehr\b/i,
  /^sur\s+le\s+(?:chapitre|theme|sujet)\b/i,
  /^on\s+(?:chapter|topic)\b/i,
  /^[uü]ber\s+das\s+thema\b/i,
];

export function parseFocusRefinementRequest(
  message: string,
): FocusRefinementParseResult {
  const normalized = message.trim();
  if (!normalized) {
    return { kind: 'none' };
  }

  if (REANALYZE_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return { kind: 'reanalyze' };
  }

  if (REFINE_HINT_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return { kind: 'refine', hint: normalized };
  }

  return { kind: 'none' };
}

export function buildFocusRefinementHint(
  refinement: Exclude<FocusRefinementParseResult, { kind: 'none' }>,
): string {
  if (refinement.kind === 'refine') {
    return refinement.hint;
  }
  return 'Provide different study focus recommendations than the previous list.';
}
