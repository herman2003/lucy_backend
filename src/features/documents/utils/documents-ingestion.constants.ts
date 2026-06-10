/** PDF page limit after extraction (SPEC §2.6). */
export const INGESTION_MAX_PDF_PAGES = 500;

/** Max extracted text length for any format (SPEC §2.6). */
export const INGESTION_MAX_EXTRACTED_CHARS = 1_500_000;

/** DOCX minimum extracted characters (SPEC C8). */
export const INGESTION_MIN_DOCX_EXTRACTED_CHARS = 200;

/** Transient ingestion retries (SPEC C11). */
export const INGESTION_MAX_ATTEMPTS = 3;

export const INGESTION_RETRY_DELAYS_MS = [1000, 2000, 4000] as const;

/** Gemini embed batch size for chunk texts. */
export const INGESTION_EMBED_BATCH_SIZE = 16;

/** Re-queue `processing` documents older than this on boot (SPEC C11). */
export const INGESTION_STALE_PROCESSING_MS = 15 * 60_000;
