import type { StudyFocusArea } from '../../learning-sessions/domain/study-focus-area.types';

export type FocusSelectionParseResult =
  | { kind: 'selected'; focusAreaIds: string[] }
  | { kind: 'invalid' };

const ALL_PATTERNS = [
  /^tout\b/i,
  /^tous\b/i,
  /^toutes\b/i,
  /^all\b/i,
  /^everything\b/i,
  /^alle\b/i,
  /^alles\b/i,
  /tout le livre/i,
  /tous les chapitres/i,
];

const MOST_IMPORTANT_PATTERNS = [
  /les plus important/i,
  /plus important/i,
  /most important/i,
  /highest priority/i,
  /wichtigsten/i,
  /priorit[aä]t hoch/i,
];

export function parseFocusSelection(
  message: string,
  focusAreas: StudyFocusArea[],
): FocusSelectionParseResult {
  const normalized = message.trim();
  if (!normalized || focusAreas.length === 0) {
    return { kind: 'invalid' };
  }

  if (ALL_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return {
      kind: 'selected',
      focusAreaIds: focusAreas.map((area) => area.id),
    };
  }

  if (MOST_IMPORTANT_PATTERNS.some((pattern) => pattern.test(normalized))) {
    const highImportance = focusAreas.filter((area) => area.importance === 'high');
    if (highImportance.length > 0) {
      return {
        kind: 'selected',
        focusAreaIds: highImportance.map((area) => area.id),
      };
    }
  }

  const byNumber = parseNumberSelection(normalized, focusAreas);
  if (byNumber.length > 0) {
    return { kind: 'selected', focusAreaIds: byNumber };
  }

  const byLabel = parseLabelSelection(normalized, focusAreas);
  if (byLabel.length > 0) {
    return { kind: 'selected', focusAreaIds: byLabel };
  }

  return { kind: 'invalid' };
}

function parseNumberSelection(
  message: string,
  focusAreas: StudyFocusArea[],
): string[] {
  const matches = message.match(/\b(\d{1,2})\b/g);
  if (!matches) {
    return [];
  }

  const ids: string[] = [];
  for (const match of matches) {
    const index = Number.parseInt(match, 10) - 1;
    if (index < 0 || index >= focusAreas.length) {
      continue;
    }
    const id = focusAreas[index]!.id;
    if (!ids.includes(id)) {
      ids.push(id);
    }
  }
  return ids;
}

function parseLabelSelection(
  message: string,
  focusAreas: StudyFocusArea[],
): string[] {
  const lowered = message.toLowerCase();
  const ids: string[] = [];

  for (const area of focusAreas) {
    const label = area.label.toLowerCase();
    if (label.length >= 4 && lowered.includes(label)) {
      ids.push(area.id);
      continue;
    }
    for (const concept of area.keyConcepts) {
      const conceptLower = concept.toLowerCase();
      if (conceptLower.length >= 4 && lowered.includes(conceptLower)) {
        ids.push(area.id);
        break;
      }
    }
  }

  return ids;
}
