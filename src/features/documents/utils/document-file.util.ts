/** File extension from `fileName` (lowercase, without dot). */
export function fileExtensionFromName(fileName: string): string {
  const base = fileName.trim();
  const idx = base.lastIndexOf('.');
  if (idx <= 0 || idx === base.length - 1) {
    return 'bin';
  }
  return base.slice(idx + 1).toLowerCase();
}

/** Storage object path: `users/{uid}/documents/{docId}/original.{ext}`. */
export function buildDocumentStoragePath(
  uid: string,
  docId: string,
  fileName: string,
): string {
  const ext = fileExtensionFromName(fileName);
  return `users/${uid}/documents/${docId}/original.${ext}`;
}
