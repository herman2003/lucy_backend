import { DocumentChunkingService } from '../services/document-chunking.service';
import { buildDocumentOutline } from './document-outline.builder';

describe('buildDocumentOutline (LEARN-08a)', () => {
  const chunkingService = new DocumentChunkingService();

  it('builds outline entries from markdown headings with chunk ordinals', () => {
    const text = [
      '# Chapitre 1 — Entropie',
      '',
      'Introduction sur l entropie.',
      '',
      '## Applications',
      '',
      'Exemples pratiques.',
      '',
      '# Chapitre 2 — Enthalpie',
      '',
      'Suite du cours.',
    ].join('\n');
    const chunks = chunkingService.chunkText(text);

    const outline = buildDocumentOutline(text, chunks);

    expect(outline.length).toBeGreaterThanOrEqual(2);
    expect(outline[0]).toMatchObject({
      id: 'outline_1',
      label: 'Chapitre 1 — Entropie',
      level: 1,
      ordinalStart: 0,
    });
    expect(outline.at(-1)?.label).toContain('Enthalpie');
    expect(outline[0]!.ordinalEnd).toBeGreaterThanOrEqual(outline[0]!.ordinalStart);
  });

  it('detects structured chapter headings', () => {
    const text = [
      'Chapitre 1: Les bases',
      '',
      'Contenu du chapitre 1.',
      '',
      'Chapitre 2: Approfondissement',
      '',
      'Contenu du chapitre 2.',
    ].join('\n');
    const chunks = chunkingService.chunkText(text);

    const outline = buildDocumentOutline(text, chunks);

    expect(outline).toHaveLength(2);
    expect(outline[0]?.label).toContain('Les bases');
    expect(outline[1]?.label).toContain('Approfondissement');
  });

  it('returns an empty outline when no headings are found', () => {
    const text = 'Texte continu sans titres structurants.';
    const chunks = chunkingService.chunkText(text);

    expect(buildDocumentOutline(text, chunks)).toEqual([]);
  });
});
