import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../../core/errors/lucy-api.error';
import { DocumentTextExtractorService } from './document-text-extractor.service';

const fixturesDir = join(__dirname, '..', 'fixtures');

function readFixture(name: string): Buffer {
  return readFileSync(join(fixturesDir, name));
}

describe('DocumentTextExtractorService', () => {
  const extractor = new DocumentTextExtractorService();

  it('extracts non-empty text from PDF fixture', async () => {
    const result = await extractor.extract(
      readFixture('sample.pdf'),
      'application/pdf',
    );

    expect(result.text.length).toBeGreaterThan(0);
    expect(result.pageCount).toBeGreaterThan(0);
    expect(result.text).toContain('Hello PDF');
  });

  it('extracts non-empty text from DOCX fixture', async () => {
    const result = await extractor.extract(
      readFixture('sample.docx'),
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );

    expect(result.text.length).toBeGreaterThan(0);
    expect(result.text.toLowerCase()).toContain('bonjour');
  });

  it('extracts UTF-8 plain text', async () => {
    const result = await extractor.extract(
      readFixture('sample.txt'),
      'text/plain',
    );

    expect(result.text).toBe('Bonjour monde.\n\nDeuxième paragraphe.');
  });

  it('extracts and normalizes UTF-8 markdown', async () => {
    const result = await extractor.extract(
      readFixture('sample.md'),
      'text/markdown',
    );

    expect(result.text).toContain('# Titre');
    expect(result.text).toContain('Contenu markdown.');
    expect(result.text).toMatch(/\n\n/);
  });

  it('throws DOCUMENT_PROCESSING_FAILED for unsupported mime types', async () => {
    await expect(
      extractor.extract(Buffer.from('data'), 'application/octet-stream'),
    ).rejects.toMatchObject({
      statusCode: 422,
      error: LucyErrorCodes.DOCUMENT_PROCESSING_FAILED,
    } satisfies Partial<LucyApiError>);
  });
});
