import { buildContextHeader } from '../../retrieval/utils/context-header';
import type { PersistedDocument } from '../../documents/repositories/documents.repository.port';
import type { PersistedDocumentChunk } from '../../documents/repositories/document-chunks.repository.port';
import { InMemoryDocumentChunksRepository } from '../../documents/repositories/in-memory-document-chunks.repository';
import {
  buildDocumentOutlinePromptEntries,
  mergeCorpusStudyExcerpts,
  sampleExcerptsFromOutlines,
} from './corpus-study-outline.util';

const uid = 'user-outline-util';

function makeDocument(overrides: Partial<PersistedDocument> = {}): PersistedDocument {
  return {
    id: 'doc_1',
    uid,
    title: 'Thermodynamique',
    fileName: 't.txt',
    mimeType: 'text/plain',
    storagePath: 'path',
    byteSize: 10,
    status: 'ready',
    searchEnabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    outline: [
      {
        id: 'outline_1',
        label: 'Chapitre 1 — Entropie',
        level: 2,
        ordinalStart: 0,
        ordinalEnd: 0,
      },
      {
        id: 'outline_2',
        label: 'Chapitre 2 — Enthalpie',
        level: 2,
        ordinalStart: 1,
        ordinalEnd: 2,
      },
    ],
    ...overrides,
  };
}

describe('corpus-study-outline.util (LEARN-08b)', () => {
  it('builds prompt entries only for active documents with outline', () => {
    const documents = [
      makeDocument(),
      makeDocument({
        id: 'doc_inactive',
        searchEnabled: false,
        outline: [{ id: 'o1', label: 'X', level: 1, ordinalStart: 0, ordinalEnd: 0 }],
      }),
      makeDocument({ id: 'doc_no_outline', outline: undefined }),
    ];

    const entries = buildDocumentOutlinePromptEntries(documents);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      documentId: 'doc_1',
      title: 'Thermodynamique',
    });
    expect(entries[0]?.sections).toHaveLength(2);
    expect(entries[0]?.sections[0]?.label).toContain('Entropie');
  });

  it('samples one excerpt per outline section from chunk ordinals', async () => {
    const chunksRepo = new InMemoryDocumentChunksRepository();
    const doc = makeDocument();
    const chunks: PersistedDocumentChunk[] = [
      {
        id: 'chunk_0',
        ordinal: 0,
        text: 'Entropie et second principe.',
        tokenEstimate: 8,
        embedding: [0.1],
        pageStart: 1,
        pageEnd: 1,
      },
      {
        id: 'chunk_1',
        ordinal: 1,
        text: 'Enthalpie — définition.',
        tokenEstimate: 6,
        embedding: [0.2],
        pageStart: 2,
        pageEnd: 2,
      },
      {
        id: 'chunk_2',
        ordinal: 2,
        text: 'Changements d enthalpie.',
        tokenEstimate: 6,
        embedding: [0.3],
        pageStart: 3,
        pageEnd: 3,
      },
    ];
    await chunksRepo.replaceChunks(uid, doc.id, chunks);

    const hits = await sampleExcerptsFromOutlines(uid, [doc], chunksRepo);

    expect(hits).toHaveLength(2);
    expect(hits.map((hit) => hit.chunkId).sort()).toEqual(['chunk_0', 'chunk_1']);
    expect(hits[0]?.contextHeader).toBe(
      buildContextHeader('Thermodynamique', hits[0]!.text, 1, 1),
    );
  });

  it('prioritizes outline excerpts before retrieval hits when merging', () => {
    const outlineHits = [
      {
        documentId: 'doc_1',
        title: 'Thermodynamique',
        chunkId: 'chunk_0',
        text: 'from outline',
        score: 1,
        contextHeader: 'outline',
      },
    ];
    const retrievalHits = [
      {
        documentId: 'doc_1',
        title: 'Thermodynamique',
        chunkId: 'chunk_0',
        text: 'from retrieval',
        score: 0.9,
        contextHeader: 'retrieval',
      },
      {
        documentId: 'doc_1',
        title: 'Thermodynamique',
        chunkId: 'chunk_1',
        text: 'extra',
        score: 0.8,
        contextHeader: 'extra',
      },
    ];

    const merged = mergeCorpusStudyExcerpts(outlineHits, retrievalHits, 2);

    expect(merged).toHaveLength(2);
    expect(merged[0]?.text).toBe('from outline');
    expect(merged[1]?.chunkId).toBe('chunk_1');
  });
});
