import type { SearchRetrievalHitDto } from '../../retrieval/dto/search-retrieval.dto';
import type { CorpusStudyPlan, StudyFocusArea } from '../domain/study-focus-area.types';
import type { LearningSessionType } from '../domain/learning-session.types';
import {
  FLASHCARDS_RETRIEVAL_QUERY,
  QUIZ_RETRIEVAL_QUERY,
} from '../dto/learning-session.constants';
import { parseOrdinalFromChunkId } from '../services/corpus-study-analyzer.service';

export function filterHitsByFocusAreas(
  hits: SearchRetrievalHitDto[],
  focusAreas: StudyFocusArea[],
): SearchRetrievalHitDto[] {
  if (focusAreas.length === 0) {
    return hits;
  }

  return hits.filter((hit) =>
    focusAreas.some((area) => hitMatchesFocusArea(hit, area)),
  );
}

export function documentIdsFromFocusAreas(focusAreas: StudyFocusArea[]): string[] {
  return [...new Set(focusAreas.map((area) => area.documentId))];
}

export function buildFocusScopedRetrievalQuery(
  type: LearningSessionType,
  focusAreas: StudyFocusArea[] | undefined,
  topicHint: string | undefined,
): string {
  const baseQuery = type === 'quiz' ? QUIZ_RETRIEVAL_QUERY : FLASHCARDS_RETRIEVAL_QUERY;
  const parts = [baseQuery];

  if (topicHint?.trim()) {
    parts.push(topicHint.trim());
  }

  if (focusAreas?.length) {
    for (const area of focusAreas) {
      parts.push(area.label);
      parts.push(...area.keyConcepts);
    }
  }

  return parts.join(' ');
}

export function resolveSelectedFocusAreas(
  plan: CorpusStudyPlan | null | undefined,
  selectedFocusAreaIds: string[] | undefined,
): StudyFocusArea[] {
  if (!plan || !selectedFocusAreaIds?.length) {
    return [];
  }

  const byId = new Map(plan.focusAreas.map((area) => [area.id, area]));
  return selectedFocusAreaIds
    .map((id) => byId.get(id))
    .filter((area): area is StudyFocusArea => area !== undefined);
}

function hitMatchesFocusArea(
  hit: SearchRetrievalHitDto,
  area: StudyFocusArea,
): boolean {
  if (hit.documentId !== area.documentId) {
    return false;
  }

  const ordinal = parseOrdinalFromChunkId(hit.chunkId);
  if (ordinal === undefined) {
    return false;
  }

  return ordinal >= area.ordinalStart && ordinal <= area.ordinalEnd;
}
