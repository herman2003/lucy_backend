import { EMBEDDING_VECTOR_DIMENSION } from '../../../core/llm/embedding.constants';
import type { PersistedDocumentChunk } from '../../documents/repositories/document-chunks.repository.port';

/** Orthogonal unit vector for deterministic cosine ranking in tests (DOC-14). */
export function unitVector(axis: number, dimension = EMBEDDING_VECTOR_DIMENSION): number[] {
  const vector = new Array<number>(dimension).fill(0);
  vector[axis % dimension] = 1;
  return vector;
}

export function makeFixtureChunk(
  id: string,
  ordinal: number,
  text: string,
  axis: number,
  pages?: { pageStart: number; pageEnd: number },
): PersistedDocumentChunk {
  return {
    id,
    ordinal,
    text,
    tokenEstimate: Math.max(1, Math.ceil(text.length / 4)),
    embedding: unitVector(axis),
    ...(pages ?? {}),
  };
}
