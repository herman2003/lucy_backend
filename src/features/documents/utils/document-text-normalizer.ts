/**
 * Normalizes extracted text to canonical Markdown-ish plain text (SPEC D-FMT1).
 * Paragraphs are separated by exactly two newlines.
 */
export function normalizeExtractedMarkdown(raw: string): string {
  const unified = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!unified) {
    return '';
  }

  const paragraphs = unified
    .split(/\n{2,}/)
    .map((paragraph) =>
      paragraph
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .join('\n')
        .trim(),
    )
    .filter((paragraph) => paragraph.length > 0);

  return paragraphs.join('\n\n');
}
