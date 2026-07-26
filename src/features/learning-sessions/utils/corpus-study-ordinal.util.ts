import type { CorpusStudyPlanValidationContext } from '../validators/generated-corpus-study-plan.validator';

export function clampOrdinalRangeToKnown(
  start: number,
  end: number,
  ordinals: Set<number>,
): { ordinalStart: number; ordinalEnd: number } {
  const sorted = [...ordinals].sort((a, b) => a - b);
  if (sorted.length === 0) {
    return { ordinalStart: start, ordinalEnd: end };
  }

  const inRange = sorted.filter((ordinal) => ordinal >= start && ordinal <= end);
  if (inRange.length > 0) {
    return {
      ordinalStart: inRange[0]!,
      ordinalEnd: inRange[inRange.length - 1]!,
    };
  }

  let bestOrdinal = sorted[0]!;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const ordinal of sorted) {
    const distance =
      ordinal < start ? start - ordinal : ordinal > end ? ordinal - end : 0;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestOrdinal = ordinal;
    }
  }

  return { ordinalStart: bestOrdinal, ordinalEnd: bestOrdinal };
}

export function buildAllowedChunkOrdinalsJson(
  context: CorpusStudyPlanValidationContext,
): string {
  const entries = [...context.ordinalsByDocumentId.entries()].map(
    ([documentId, ordinals]) => ({
      documentId,
      title: context.documentsById.get(documentId)?.title ?? documentId,
      ordinals: [...ordinals].sort((a, b) => a - b),
    }),
  );
  return JSON.stringify(entries);
}
