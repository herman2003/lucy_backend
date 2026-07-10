export type ActiveDocumentRef = {
  id: string;
  title: string;
};

export type LearningDocumentScopeResolution =
  | { kind: 'all' }
  | { kind: 'resolved'; documentId: string; documentTitle: string }
  | { kind: 'ambiguous'; candidates: ActiveDocumentRef[] };

export function resolveLearningDocumentScope(
  message: string,
  documents: ActiveDocumentRef[],
): LearningDocumentScopeResolution {
  if (documents.length <= 1) {
    return { kind: 'all' };
  }

  const normalizedMessage = normalizeDocumentMatchText(message);
  if (!normalizedMessage) {
    return { kind: 'all' };
  }

  const matches = documents.filter((doc) =>
    titleMatchesMessage(
      normalizeDocumentMatchText(doc.title),
      normalizedMessage,
    ),
  );

  if (matches.length === 1) {
    const match = matches[0]!;
    return {
      kind: 'resolved',
      documentId: match.id,
      documentTitle: match.title,
    };
  }

  if (matches.length > 1) {
    return { kind: 'ambiguous', candidates: matches };
  }

  return { kind: 'all' };
}

export type DocumentSelectionResult =
  | { kind: 'resolved'; documentId: string; documentTitle: string }
  | { kind: 'all' }
  | { kind: 'invalid' };

export function isAllDocumentsSelection(message: string): boolean {
  const normalized = normalizeDocumentMatchText(message);
  if (!normalized) {
    return false;
  }

  const patterns = [
    /^tous?\s+(les\s+)?documents?\b/,
    /^toutes?\s+(les\s+)?documents?\b/,
    /^tout\s+les\s+documents?\b/,
    /^all\s+documents?\b/,
    /^alle\s+dokumente\b/,
    /^alle\b/,
    /^everything\b/,
    /^tout\b$/,
    /^tous\b$/,
  ];

  return patterns.some((pattern) => pattern.test(normalized));
}

export function parseDocumentSelection(
  message: string,
  documents: ActiveDocumentRef[],
): DocumentSelectionResult {
  const normalized = message.trim();
  if (!normalized || documents.length === 0) {
    return { kind: 'invalid' };
  }

  if (isAllDocumentsSelection(message)) {
    return { kind: 'all' };
  }

  const numberMatch = normalized.match(/^(\d+)$/);
  if (numberMatch) {
    const index = Number.parseInt(numberMatch[1]!, 10) - 1;
    if (index < 0 || index >= documents.length) {
      return { kind: 'invalid' };
    }
    const doc = documents[index]!;
    return {
      kind: 'resolved',
      documentId: doc.id,
      documentTitle: doc.title,
    };
  }

  const scope = resolveLearningDocumentScope(message, documents);
  if (scope.kind === 'resolved') {
    return scope;
  }

  return { kind: 'invalid' };
}

function normalizeDocumentMatchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[’'—–-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleMatchesMessage(normalizedTitle: string, normalizedMessage: string): boolean {
  if (normalizedTitle.length >= 3 && normalizedMessage.includes(normalizedTitle)) {
    return true;
  }

  const titleTokens = normalizedTitle
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 5);
  return titleTokens.some((token) => normalizedMessage.includes(token));
}
