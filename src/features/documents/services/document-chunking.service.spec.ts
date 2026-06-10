import {
  CHUNK_OVERLAP_CHARS,
  CHUNK_TARGET_CHARS,
  CHARS_PER_TOKEN_ESTIMATE,
} from '../utils/document-chunking.constants';
import { DocumentChunkingService } from './document-chunking.service';

describe('DocumentChunkingService', () => {
  const service = new DocumentChunkingService();

  it('returns empty array for empty or whitespace-only text', () => {
    expect(service.chunkText('')).toEqual([]);
    expect(service.chunkText('   \n\n  ')).toEqual([]);
  });

  it('returns a single chunk with ordinal 0 for short text', () => {
    const text = 'Intro.\n\nConclusion.';
    const chunks = service.chunkText(text);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual({
      ordinal: 0,
      text: 'Intro.\n\nConclusion.',
      tokenEstimate: Math.ceil(text.length / CHARS_PER_TOKEN_ESTIMATE),
    });
  });

  it('splits on double newlines and respects target size with overlap', () => {
    const paragraph = 'A'.repeat(2000);
    const text = [paragraph, paragraph, paragraph, paragraph].join('\n\n');
    const chunks = service.chunkText(text);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(CHUNK_TARGET_CHARS + CHUNK_OVERLAP_CHARS);
      expect(chunk.tokenEstimate).toBe(
        Math.ceil(chunk.text.length / CHARS_PER_TOKEN_ESTIMATE),
      );
    }

    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i]?.ordinal).toBe(i);
    }
  });

  it('creates overlapping content between consecutive chunks', () => {
    const paragraphs = Array.from({ length: 8 }, (_, index) =>
      `Paragraph ${index} `.repeat(120).trim(),
    );
    const text = paragraphs.join('\n\n');
    const chunks = service.chunkText(text);

    expect(chunks.length).toBeGreaterThanOrEqual(2);

    const lastParagraph = chunks[0]!.text.split('\n\n').at(-1) ?? '';
    expect(lastParagraph.length).toBeGreaterThan(0);
    expect(chunks[1]!.text).toContain(lastParagraph.slice(0, 80));
  });

  it('splits oversized paragraphs on sentence boundaries when no double newlines', () => {
    const sentence = 'Word '.repeat(80).trim() + '. ';
    const text = sentence.repeat(120).trim();
    const chunks = service.chunkText(text);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.text.length <= CHUNK_TARGET_CHARS)).toBe(true);
  });

  it('assigns sequential ordinals from 0 to n-1 on long input', () => {
    const block = 'X'.repeat(CHUNK_TARGET_CHARS - 100);
    const text = Array.from({ length: 5 }, () => block).join('\n\n');
    const chunks = service.chunkText(text);

    expect(chunks.length).toBeGreaterThanOrEqual(3);
    expect(chunks.map((c) => c.ordinal)).toEqual(
      chunks.map((_, index) => index),
    );
  });
});
