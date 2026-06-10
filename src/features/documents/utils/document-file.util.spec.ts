import { buildDocumentStoragePath, fileExtensionFromName } from './document-file.util';

describe('document-file.util', () => {
  it('extracts extension from fileName', () => {
    expect(fileExtensionFromName('grammaire.pdf')).toBe('pdf');
    expect(fileExtensionFromName('notes.TXT')).toBe('txt');
    expect(fileExtensionFromName('noext')).toBe('bin');
  });

  it('builds storage path with original.{ext}', () => {
    expect(buildDocumentStoragePath('u1', 'doc1', 'a.pdf')).toBe(
      'users/u1/documents/doc1/original.pdf',
    );
  });
});
