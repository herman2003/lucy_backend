import type { SearchRetrievalHitDto } from '../../retrieval/dto/search-retrieval.dto';
import type { StudyFocusArea } from '../domain/study-focus-area.types';
import { parseOrdinalFromChunkId } from '../services/corpus-study-analyzer.service';
import type { CorpusStudyPlanValidationContext } from '../validators/generated-corpus-study-plan.validator';

export function buildSyntheticCorpusStudyPlanFromExcerpts(
  hits: SearchRetrievalHitDto[],
  context: CorpusStudyPlanValidationContext,
): StudyFocusArea[] {
  const ordinalsByDocument = new Map<string, number[]>();

  for (const hit of hits) {
    const ordinal = parseOrdinalFromChunkId(hit.chunkId);
    if (ordinal === undefined) {
      continue;
    }
    const ordinals = ordinalsByDocument.get(hit.documentId) ?? [];
    if (!ordinals.includes(ordinal)) {
      ordinals.push(ordinal);
    }
    ordinalsByDocument.set(hit.documentId, ordinals);
  }

  const focusAreas: StudyFocusArea[] = [];
  let index = 0;

  for (const [documentId, ordinals] of ordinalsByDocument) {
    const document = context.documentsById.get(documentId);
    if (!document || ordinals.length === 0) {
      continue;
    }

    const sortedOrdinals = [...ordinals].sort((a, b) => a - b);
    const representativeHit =
      hits.find((hit) => hit.documentId === documentId) ?? hits[0];

    focusAreas.push({
      id: `focus_${index + 1}`,
      documentId,
      documentTitle: document.title,
      label: document.title,
      ordinalStart: sortedOrdinals[0]!,
      ordinalEnd: sortedOrdinals[sortedOrdinals.length - 1]!,
      importance: index === 0 ? 'high' : 'medium',
      rationale: 'Main content sampled from your active documents.',
      keyConcepts: extractKeyConcepts(representativeHit?.text ?? document.title),
      ...(representativeHit?.pageStart !== undefined
        ? { pageStart: representativeHit.pageStart }
        : {}),
      ...(representativeHit?.pageEnd !== undefined
        ? { pageEnd: representativeHit.pageEnd }
        : {}),
    });
    index += 1;
  }

  return focusAreas.slice(0, 8);
}

function extractKeyConcepts(text: string): string[] {
  const cleaned = text
    .replace(/^#+\s*/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) {
    return ['key concepts'];
  }

  const words = cleaned
    .split(/[^A-Za-zÀ-ÿ0-9-]+/)
    .filter((word) => word.length >= 5)
    .slice(0, 3);

  return words.length > 0 ? words : [cleaned.slice(0, 40)];
}
