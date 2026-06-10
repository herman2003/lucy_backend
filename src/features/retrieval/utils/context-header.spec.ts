import { buildContextHeader } from './context-header';

describe('buildContextHeader', () => {
  it('includes pages line when pageStart and pageEnd are set', () => {
    expect(buildContextHeader('Cours', 'Corps du chunk.', 1, 3)).toBe(
      'Document: Cours\nPages: 1-3\n\nCorps du chunk.',
    );
  });

  it('omits pages line when pages are absent', () => {
    expect(buildContextHeader('Notes', 'Texte seul.')).toBe('Document: Notes\n\nTexte seul.');
  });
});
