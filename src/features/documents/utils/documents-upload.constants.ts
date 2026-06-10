/** Stale `uploading` documents are marked failed after this (SPEC C6). */
export const UPLOAD_ABANDONED_AFTER_MS = 24 * 60 * 60 * 1000;

/** Background sweep interval for abandoned uploads. */
export const UPLOAD_SWEEP_INTERVAL_MS = 60 * 60 * 1000;
