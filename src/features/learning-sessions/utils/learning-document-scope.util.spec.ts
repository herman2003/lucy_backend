import {
  parseDocumentSelection,
  resolveLearningDocumentScope,
  type ActiveDocumentRef,
} from './learning-document-scope.util';

const documents: ActiveDocumentRef[] = [
  { id: 'doc_thermo', title: 'Thermodynamique — Polycopié' },
  { id: 'doc_chimie', title: 'Chimie organique' },
];

describe('learning-document-scope.util (LEARN-11f)', () => {
  it('resolves a unique document when the title appears in the message', () => {
    expect(
      resolveLearningDocumentScope('quiz sur Thermodynamique', documents),
    ).toEqual({
      kind: 'resolved',
      documentId: 'doc_thermo',
      documentTitle: 'Thermodynamique — Polycopié',
    });
  });

  it('returns all when no document title matches', () => {
    expect(resolveLearningDocumentScope('fais-moi un quiz', documents)).toEqual({
      kind: 'all',
    });
  });

  it('returns ambiguous when several titles match', () => {
    const ambiguousDocs: ActiveDocumentRef[] = [
      { id: 'doc_a', title: 'Cours de maths' },
      { id: 'doc_b', title: 'Cours de physique' },
    ];
    expect(
      resolveLearningDocumentScope('quiz sur le cours', ambiguousDocs),
    ).toEqual({
      kind: 'ambiguous',
      candidates: ambiguousDocs,
    });
  });

  it('parses a numbered document selection', () => {
    expect(parseDocumentSelection('2', documents)).toEqual({
      kind: 'resolved',
      documentId: 'doc_chimie',
      documentTitle: 'Chimie organique',
    });
  });

  it('rejects invalid numbered selection', () => {
    expect(parseDocumentSelection('9', documents)).toEqual({ kind: 'invalid' });
  });
});
