import type { CorpusStudyPlan } from '../../learning-sessions/domain/study-focus-area.types';

export function getValidCorpusStudyPlan(
  plan: CorpusStudyPlan | null | undefined,
  nowMs: number = Date.now(),
  scopeDocumentId?: string,
): CorpusStudyPlan | null {
  if (!plan) {
    return null;
  }
  const expiresAtMs = new Date(plan.expiresAt).getTime();
  if (Number.isNaN(expiresAtMs) || expiresAtMs <= nowMs) {
    return null;
  }
  if (plan.focusAreas.length === 0) {
    return null;
  }
  const expectedScope = scopeDocumentId ?? null;
  const cachedScope = plan.scopeDocumentId ?? null;
  if (expectedScope !== cachedScope) {
    return null;
  }
  return plan;
}
