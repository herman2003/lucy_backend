import type { DocumentOutlineEntry } from '../domain/document-outline.types';
import type { DocumentChunk } from '../services/document-chunking.service';

const MAX_OUTLINE_ENTRIES = 50;

const STRUCTURED_HEADING_PATTERN =
  /^(?:chapitre|chapter|partie|section|module|leçon|lesson)\s+([\dIVXLC]+)[\.:\-\s]+(.+)$/i;

type DetectedHeading = {
  label: string;
  level: number;
  ordinalStart: number;
};

export function buildDocumentOutline(
  text: string,
  chunks: DocumentChunk[],
): DocumentOutlineEntry[] {
  if (!text.trim() || chunks.length === 0) {
    return [];
  }

  const detected = detectHeadings(text, chunks);
  if (detected.length === 0) {
    return [];
  }

  const maxOrdinal = chunks[chunks.length - 1]!.ordinal;
  const sorted = [...detected].sort((left, right) => left.ordinalStart - right.ordinalStart);

  const outline: DocumentOutlineEntry[] = [];
  for (let index = 0; index < sorted.length && outline.length < MAX_OUTLINE_ENTRIES; index += 1) {
    const current = sorted[index]!;
    const next = sorted[index + 1];
    const ordinalEnd = next
      ? Math.max(current.ordinalStart, next.ordinalStart - 1)
      : maxOrdinal;

    outline.push({
      id: `outline_${index + 1}`,
      label: current.label,
      level: current.level,
      ordinalStart: current.ordinalStart,
      ordinalEnd: Math.min(maxOrdinal, Math.max(current.ordinalStart, ordinalEnd)),
    });
  }

  return outline;
}

function detectHeadings(text: string, chunks: DocumentChunk[]): DetectedHeading[] {
  const headings: DetectedHeading[] = [];

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed) {
      const markdownMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (markdownMatch) {
        const label = markdownMatch[2]!.trim();
        headings.push({
          label,
          level: markdownMatch[1]!.length,
          ordinalStart: resolveChunkOrdinalForLabel(label, chunks),
        });
      } else {
        const structuredMatch = trimmed.match(STRUCTURED_HEADING_PATTERN);
        if (structuredMatch) {
          const label = `${structuredMatch[1]} — ${structuredMatch[2]!.trim()}`;
          headings.push({
            label,
            level: 2,
            ordinalStart: resolveChunkOrdinalForLabel(label, chunks),
          });
        }
      }
    }
  }

  return dedupeHeadings(headings);
}

function resolveChunkOrdinalForLabel(label: string, chunks: DocumentChunk[]): number {
  const normalizedLabel = label.trim().toLowerCase();
  for (const chunk of chunks) {
    const chunkLower = chunk.text.toLowerCase();
    if (
      chunkLower.includes(normalizedLabel) ||
      chunk.text.includes(label.trim())
    ) {
      return chunk.ordinal;
    }
  }
  return chunks[0]!.ordinal;
}

function dedupeHeadings(headings: DetectedHeading[]): DetectedHeading[] {
  const seen = new Set<string>();
  const unique: DetectedHeading[] = [];
  for (const heading of headings) {
    const key = `${heading.level}:${heading.label.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(heading);
  }
  return unique;
}
