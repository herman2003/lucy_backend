/** D-CTX1 — built at retrieval time, not persisted on chunks. */
export function buildContextHeader(
  title: string,
  text: string,
  pageStart?: number,
  pageEnd?: number,
): string {
  const pagesLine =
    pageStart !== undefined && pageEnd !== undefined
      ? `Pages: ${pageStart}-${pageEnd}\n\n`
      : '\n';
  return `Document: ${title}\n${pagesLine}${text}`;
}
