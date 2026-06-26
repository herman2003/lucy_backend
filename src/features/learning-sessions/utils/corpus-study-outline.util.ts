import type { DocumentOutlineEntry } from '../../documents/domain/document-outline.types';
import type { DocumentChunksRepository } from '../../documents/repositories/document-chunks.repository.port';
import type { PersistedDocument } from '../../documents/repositories/documents.repository.port';
import type { SearchRetrievalHitDto } from '../../retrieval/dto/search-retrieval.dto';
import { buildContextHeader } from '../../retrieval/utils/context-header';

export type DocumentOutlinePromptEntry = {
  documentId: string;
  title: string;
  sections: Array<{
    id: string;
    label: string;
    level: number;
    ordinalStart: number;
    ordinalEnd: number;
  }>;
};

export function listActiveDocumentsWithOutline(
  documents: PersistedDocument[],
): PersistedDocument[] {
  return documents.filter(
    (doc) =>
      doc.status === 'ready' &&
      doc.searchEnabled === true &&
      (doc.outline?.length ?? 0) > 0,
  );
}

export function buildDocumentOutlinePromptEntries(
  documents: PersistedDocument[],
): DocumentOutlinePromptEntry[] {
  return listActiveDocumentsWithOutline(documents).map((doc) => ({
    documentId: doc.id,
    title: doc.title,
    sections: (doc.outline ?? []).map((section) => ({
      id: section.id,
      label: section.label,
      level: section.level,
      ordinalStart: section.ordinalStart,
      ordinalEnd: section.ordinalEnd,
    })),
  }));
}

export async function sampleExcerptsFromOutlines(
  uid: string,
  documents: PersistedDocument[],
  chunksRepository: DocumentChunksRepository,
): Promise<SearchRetrievalHitDto[]> {
  const hits: SearchRetrievalHitDto[] = [];
  const seenChunkIds = new Set<string>();

  for (const doc of listActiveDocumentsWithOutline(documents)) {
    const chunks = await chunksRepository.listChunks(uid, doc.id);
    const chunksByOrdinal = new Map(chunks.map((chunk) => [chunk.ordinal, chunk]));

    for (const section of doc.outline ?? []) {
      const chunk = chunksByOrdinal.get(pickRepresentativeOrdinal(section));
      if (!chunk || seenChunkIds.has(chunk.id)) {
        continue;
      }
      seenChunkIds.add(chunk.id);
      hits.push(toSearchHit(doc, chunk));
    }
  }

  return hits;
}

export function mergeCorpusStudyExcerpts(
  outlineHits: SearchRetrievalHitDto[],
  retrievalHits: SearchRetrievalHitDto[],
  maxExcerpts: number,
): SearchRetrievalHitDto[] {
  const byChunkId = new Map<string, SearchRetrievalHitDto>();

  for (const hit of outlineHits) {
    byChunkId.set(hit.chunkId, hit);
  }
  for (const hit of retrievalHits) {
    if (!byChunkId.has(hit.chunkId)) {
      byChunkId.set(hit.chunkId, hit);
    }
    if (byChunkId.size >= maxExcerpts) {
      break;
    }
  }

  return [...byChunkId.values()].slice(0, maxExcerpts);
}

function pickRepresentativeOrdinal(section: DocumentOutlineEntry): number {
  return section.ordinalStart;
}

function toSearchHit(
  doc: PersistedDocument,
  chunk: { id: string; text: string; pageStart?: number; pageEnd?: number },
): SearchRetrievalHitDto {
  return {
    documentId: doc.id,
    title: doc.title,
    chunkId: chunk.id,
    text: chunk.text,
    score: 1,
    contextHeader: buildContextHeader(
      doc.title,
      chunk.text,
      chunk.pageStart,
      chunk.pageEnd,
    ),
    ...(chunk.pageStart !== undefined ? { pageStart: chunk.pageStart } : {}),
    ...(chunk.pageEnd !== undefined ? { pageEnd: chunk.pageEnd } : {}),
  };
}
