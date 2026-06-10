import { Injectable } from '@nestjs/common';

import {
  CHARS_PER_TOKEN_ESTIMATE,
  CHUNK_OVERLAP_CHARS,
  CHUNK_TARGET_CHARS,
} from '../utils/document-chunking.constants';

export type DocumentChunk = {
  ordinal: number;
  text: string;
  tokenEstimate: number;
};

@Injectable()
export class DocumentChunkingService {
  chunkText(text: string): DocumentChunk[] {
    const normalized = text.trim();
    if (!normalized) {
      return [];
    }

    const paragraphs = expandParagraphs(normalized, CHUNK_TARGET_CHARS);
    const chunks: DocumentChunk[] = [];
    let startIndex = 0;

    while (startIndex < paragraphs.length) {
      const { endIndex, parts } = takeParagraphs(
        paragraphs,
        startIndex,
        CHUNK_TARGET_CHARS,
      );
      const chunkText = parts.join('\n\n');
      chunks.push({
        ordinal: chunks.length,
        text: chunkText,
        tokenEstimate: estimateTokens(chunkText),
      });

      if (endIndex >= paragraphs.length) {
        break;
      }

      startIndex = computeOverlapStart(paragraphs, startIndex, endIndex, CHUNK_OVERLAP_CHARS);
    }

    return chunks;
  }
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN_ESTIMATE);
}

function expandParagraphs(text: string, targetChars: number): string[] {
  const raw = text.split(/\n\n+/).map((part) => part.trim()).filter(Boolean);
  if (raw.length === 0) {
    return splitOversizedUnit(text, targetChars);
  }

  const expanded: string[] = [];
  for (const paragraph of raw) {
    if (paragraph.length <= targetChars) {
      expanded.push(paragraph);
    } else {
      expanded.push(...splitOversizedUnit(paragraph, targetChars));
    }
  }
  return expanded;
}

function splitOversizedUnit(text: string, targetChars: number): string[] {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }
  if (trimmed.length <= targetChars) {
    return [trimmed];
  }

  const sentences = trimmed.split(/(?<=\. )/);
  if (sentences.length > 1) {
    const parts: string[] = [];
    let buffer = '';
    for (const sentence of sentences) {
      const piece = sentence.trim();
      if (!piece) {
        continue;
      }
      const candidate = buffer ? `${buffer} ${piece}` : piece;
      if (candidate.length > targetChars && buffer) {
        parts.push(buffer);
        buffer = piece;
      } else {
        buffer = candidate;
      }
    }
    if (buffer) {
      parts.push(buffer);
    }
    if (parts.length > 0) {
      return parts.flatMap((part) =>
        part.length > targetChars ? hardSplit(part, targetChars) : [part],
      );
    }
  }

  return hardSplit(trimmed, targetChars);
}

function hardSplit(text: string, targetChars: number): string[] {
  const parts: string[] = [];
  for (let offset = 0; offset < text.length; offset += targetChars) {
    parts.push(text.slice(offset, offset + targetChars));
  }
  return parts;
}

function takeParagraphs(
  paragraphs: string[],
  startIndex: number,
  targetChars: number,
): { endIndex: number; parts: string[] } {
  const parts: string[] = [];
  let length = 0;
  let index = startIndex;

  while (index < paragraphs.length) {
    const paragraph = paragraphs[index]!;
    const separator = parts.length > 0 ? 2 : 0;
    if (length + separator + paragraph.length > targetChars && parts.length > 0) {
      break;
    }
    parts.push(paragraph);
    length += separator + paragraph.length;
    index++;
  }

  return { endIndex: index, parts };
}

function computeOverlapStart(
  paragraphs: string[],
  chunkStart: number,
  chunkEnd: number,
  overlapChars: number,
): number {
  if (chunkEnd >= paragraphs.length) {
    return paragraphs.length;
  }

  let accumulated = 0;
  let index = chunkEnd - 1;
  while (index > chunkStart && accumulated < overlapChars) {
    accumulated += paragraphs[index]!.length;
    if (index < chunkEnd - 1) {
      accumulated += 2;
    }
    index--;
  }

  const nextStart = index + 1;
  return nextStart <= chunkStart ? chunkStart + 1 : nextStart;
}
