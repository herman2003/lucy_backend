import { Injectable } from '@nestjs/common';
import * as mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

import { LucyApiError } from '../../../core/errors/lucy-api.error';
import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { normalizeExtractedMarkdown } from '../utils/document-text-normalizer';

export type DocumentTextExtractionResult = {
  text: string;
  pageCount?: number;
};

const SUPPORTED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
]);

@Injectable()
export class DocumentTextExtractorService {
  async extract(
    buffer: Buffer,
    mimeType: string,
  ): Promise<DocumentTextExtractionResult> {
    if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
      throw new LucyApiError(
        422,
        LucyErrorCodes.DOCUMENT_PROCESSING_FAILED,
        `Unsupported document mime type: ${mimeType}`,
      );
    }

    try {
      switch (mimeType) {
        case 'application/pdf':
          return await this.extractPdf(buffer);
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          return await this.extractDocx(buffer);
        case 'text/plain':
        case 'text/markdown':
          return this.extractUtf8(buffer);
        default:
          throw new LucyApiError(
            422,
            LucyErrorCodes.DOCUMENT_PROCESSING_FAILED,
            `Unsupported document mime type: ${mimeType}`,
          );
      }
    } catch (error) {
      if (error instanceof LucyApiError) {
        throw error;
      }
      throw new LucyApiError(
        422,
        LucyErrorCodes.DOCUMENT_PROCESSING_FAILED,
        'Document text extraction failed',
        {
          mimeType,
          cause: error instanceof Error ? error.message : String(error),
        },
      );
    }
  }

  private async extractPdf(buffer: Buffer): Promise<DocumentTextExtractionResult> {
    const parser = new PDFParse({ data: buffer });
    try {
      const textResult = await parser.getText();
      const text = normalizeExtractedMarkdown(textResult.text);
      return {
        text,
        pageCount: textResult.total,
      };
    } finally {
      await parser.destroy();
    }
  }

  private async extractDocx(buffer: Buffer): Promise<DocumentTextExtractionResult> {
    const converted = await mammoth.extractRawText({ buffer });
    const text = normalizeExtractedMarkdown(converted.value);
    return { text };
  }

  private extractUtf8(buffer: Buffer): DocumentTextExtractionResult {
    const raw = buffer.toString('utf8');
    return { text: normalizeExtractedMarkdown(raw) };
  }
}
