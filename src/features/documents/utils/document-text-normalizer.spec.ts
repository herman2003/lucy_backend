import { normalizeExtractedMarkdown } from './document-text-normalizer';

describe('normalizeExtractedMarkdown', () => {
  it('joins paragraphs with double newlines', () => {
    expect(normalizeExtractedMarkdown('Line one\n\nLine two')).toBe('Line one\n\nLine two');
  });

  it('collapses extra blank lines and trims lines', () => {
    expect(normalizeExtractedMarkdown('  First  \n\n\n  Second  \n\n')).toBe('First\n\nSecond');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(normalizeExtractedMarkdown('   \n\n  ')).toBe('');
  });
});
