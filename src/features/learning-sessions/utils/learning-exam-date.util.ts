const DAY_MS = 24 * 60 * 60 * 1000;

const FRENCH_MONTHS: Record<string, number> = {
  janvier: 1,
  fevrier: 2,
  février: 2,
  mars: 3,
  avril: 4,
  mai: 5,
  juin: 6,
  juillet: 7,
  aout: 8,
  août: 8,
  septembre: 9,
  octobre: 10,
  novembre: 11,
  decembre: 12,
  décembre: 12,
};

const ENGLISH_MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

const GERMAN_MONTHS: Record<string, number> = {
  januar: 1,
  februar: 2,
  marz: 3,
  märz: 3,
  april: 4,
  mai: 5,
  juni: 6,
  juli: 7,
  august: 8,
  september: 9,
  oktober: 10,
  november: 11,
  dezember: 12,
};

/** Detects an optional exam date mentioned by the learner (LEARN-11d). */
export function detectLearningExamDate(
  message: string,
  referenceDate: Date = new Date(),
): Date | undefined {
  const normalized = normalizeExamDateMessage(message);
  if (!normalized) {
    return undefined;
  }

  const relative =
    matchRelativeDays(normalized, /dans\s+(\d{1,3})\s+jours?/) ??
    matchRelativeDays(normalized, /\bin\s+(\d{1,3})\s+days?\b/) ??
    matchRelativeDays(normalized, /\bin\s+(\d{1,3})\s+tagen\b/);
  if (relative) {
    return addUtcDays(startOfUtcDay(referenceDate), relative);
  }

  const slashMatch = normalized.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/);
  if (slashMatch) {
    const day = Number.parseInt(slashMatch[1]!, 10);
    const month = Number.parseInt(slashMatch[2]!, 10);
    const year = slashMatch[3]
      ? Number.parseInt(slashMatch[3], 10)
      : resolveYear(month, day, referenceDate);
    return buildUtcDate(year, month, day);
  }

  const isoMatch = normalized.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    return buildUtcDate(
      Number.parseInt(isoMatch[1]!, 10),
      Number.parseInt(isoMatch[2]!, 10),
      Number.parseInt(isoMatch[3]!, 10),
    );
  }

  for (const matcher of [
    () =>
      matchNamedMonthDate(
        normalized,
        FRENCH_MONTHS,
        /(?:^|\s)le\s+(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?(?:\s|$)/,
        referenceDate,
      ),
    () =>
      matchNamedMonthDate(
        normalized,
        ENGLISH_MONTHS,
        /\b([a-z]+)\s+(\d{1,2})(?:,?\s+(\d{4}))?\b/,
        referenceDate,
        true,
      ),
    () =>
      matchNamedMonthDate(
        normalized,
        GERMAN_MONTHS,
        /\b(\d{1,2})\.\s*([a-z]+)(?:\s+(\d{4}))?\b/,
        referenceDate,
      ),
  ]) {
    const parsed = matcher();
    if (parsed) {
      return parsed;
    }
  }

  return undefined;
}

function normalizeExamDateMessage(message: string): string {
  return message
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[’']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchRelativeDays(message: string, pattern: RegExp): number | undefined {
  const match = message.match(pattern);
  if (!match) {
    return undefined;
  }
  return Number.parseInt(match[1]!, 10);
}

function matchNamedMonthDate(
  message: string,
  months: Record<string, number>,
  pattern: RegExp,
  referenceDate: Date,
  monthFirst = false,
): Date | undefined {
  const match = message.match(pattern);
  if (!match) {
    return undefined;
  }

  if (monthFirst) {
    const month = months[match[1]!];
    if (!month) {
      return undefined;
    }
    const day = Number.parseInt(match[2]!, 10);
    const year = match[3]
      ? Number.parseInt(match[3], 10)
      : resolveYear(month, day, referenceDate);
    return buildUtcDate(year, month, day);
  }

  const day = Number.parseInt(match[1]!, 10);
  const month = months[match[2]!];
  if (!month) {
    return undefined;
  }
  const year = match[3]
    ? Number.parseInt(match[3], 10)
    : resolveYear(month, day, referenceDate);
  return buildUtcDate(year, month, day);
}

function resolveYear(month: number, day: number, referenceDate: Date): number {
  let year = referenceDate.getUTCFullYear();
  const candidate = buildUtcDate(year, month, day);
  if (candidate.getTime() < startOfUtcDay(referenceDate).getTime()) {
    year += 1;
  }
  return year;
}

function buildUtcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}
