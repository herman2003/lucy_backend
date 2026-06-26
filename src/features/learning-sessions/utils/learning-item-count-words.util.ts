const SESSION_TYPE_AFTER_ARTICLE =
  /\b(un|une|ein|eine|one|a|an)\s+(quiz|qcm|cartes?|flashcards?|karteikarten)\b/i;

const NUMBER_WORD_TO_VALUE: Record<string, number> = {
  ...buildFrenchNumberWords(),
  ...buildEnglishNumberWords(),
  ...buildGermanNumberWords(),
};

const SORTED_NUMBER_WORDS = Object.keys(NUMBER_WORD_TO_VALUE).sort(
  (left, right) => right.length - left.length,
);

const ARTICLE_ONE_WORDS = new Set(['un', 'une', 'ein', 'eine', 'one', 'a', 'an']);

export function parseWrittenLearningItemCount(message: string): number | undefined {
  const normalized = normalizeCountMessage(message);
  if (!normalized) {
    return undefined;
  }

  const digitMatch = normalized.match(/\b(\d{1,2})\b/);
  if (digitMatch) {
    return Number.parseInt(digitMatch[1]!, 10);
  }

  for (const word of SORTED_NUMBER_WORDS) {
    if (!containsNumberWord(normalized, word)) {
      continue;
    }
    const value = NUMBER_WORD_TO_VALUE[word]!;
    if (shouldSkipArticleOne(normalized, word, value)) {
      continue;
    }
    return value;
  }

  return undefined;
}

function normalizeCountMessage(message: string): string {
  return message
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[’']/g, ' ')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsNumberWord(normalized: string, word: string): boolean {
  const pattern = new RegExp(`(?:^|\\s)${escapeRegExp(word)}(?:$|\\s)`, 'i');
  return pattern.test(normalized);
}

function shouldSkipArticleOne(
  normalized: string,
  word: string,
  value: number,
): boolean {
  if (value !== 1 || !ARTICLE_ONE_WORDS.has(word)) {
    return false;
  }
  return SESSION_TYPE_AFTER_ARTICLE.test(normalized);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function addWord(
  words: Record<string, number>,
  value: number,
  ...variants: string[]
): void {
  for (const variant of variants) {
    words[variant] = value;
  }
}

function buildFrenchNumberWords(): Record<string, number> {
  const words: Record<string, number> = {};
  const singles: Array<[number, ...string[]]> = [
    [1, 'un', 'une'],
    [2, 'deux'],
    [3, 'trois'],
    [4, 'quatre'],
    [5, 'cinq'],
    [6, 'six'],
    [7, 'sept'],
    [8, 'huit'],
    [9, 'neuf'],
    [10, 'dix'],
    [11, 'onze'],
    [12, 'douze'],
    [13, 'treize'],
    [14, 'quatorze'],
    [15, 'quinze'],
    [16, 'seize'],
    [20, 'vingt'],
    [30, 'trente'],
  ];

  for (const [value, ...variants] of singles) {
    addWord(words, value, ...variants);
  }

  addWord(words, 17, 'dix-sept', 'dix sept');
  addWord(words, 18, 'dix-huit', 'dix huit');
  addWord(words, 19, 'dix-neuf', 'dix neuf');
  addWord(words, 21, 'vingt-et-un', 'vingt et un', 'vingt-et-une', 'vingt et une');

  for (let value = 22; value <= 29; value += 1) {
    const unit = value - 20;
    const unitWord = singles.find(([candidate]) => candidate === unit)?.[1];
    if (!unitWord) {
      continue;
    }
    addWord(words, value, `vingt-${unitWord}`, `vingt ${unitWord}`);
  }

  return words;
}

function buildEnglishNumberWords(): Record<string, number> {
  const words: Record<string, number> = {};
  const base = [
    'one',
    'two',
    'three',
    'four',
    'five',
    'six',
    'seven',
    'eight',
    'nine',
    'ten',
    'eleven',
    'twelve',
    'thirteen',
    'fourteen',
    'fifteen',
    'sixteen',
    'seventeen',
    'eighteen',
    'nineteen',
    'twenty',
  ];

  base.forEach((word, index) => {
    words[word] = index + 1;
  });

  addWord(words, 21, 'twenty-one', 'twenty one');
  for (let unit = 2; unit <= 9; unit += 1) {
    const unitWord = base[unit - 1]!;
    addWord(words, 20 + unit, `twenty-${unitWord}`, `twenty ${unitWord}`);
  }
  addWord(words, 30, 'thirty');

  return words;
}

function buildGermanNumberWords(): Record<string, number> {
  const words: Record<string, number> = {};
  const singles: Array<[number, ...string[]]> = [
    [1, 'eins', 'ein'],
    [2, 'zwei'],
    [3, 'drei'],
    [4, 'vier'],
    [5, 'funf', 'fünf'],
    [6, 'sechs'],
    [7, 'sieben'],
    [8, 'acht'],
    [9, 'neun'],
    [10, 'zehn'],
    [11, 'elf'],
    [12, 'zwolf', 'zwölf'],
    [13, 'dreizehn'],
    [14, 'vierzehn'],
    [15, 'funfzehn', 'fünfzehn'],
    [16, 'sechzehn'],
    [17, 'siebzehn'],
    [18, 'achtzehn'],
    [19, 'neunzehn'],
    [20, 'zwanzig'],
    [30, 'dreissig', 'dreißig'],
  ];

  for (const [value, ...variants] of singles) {
    addWord(words, value, ...variants);
  }

  const units: Array<[number, string]> = [
    [1, 'ein'],
    [2, 'zwei'],
    [3, 'drei'],
    [4, 'vier'],
    [5, 'funf'],
    [6, 'sechs'],
    [7, 'sieben'],
    [8, 'acht'],
    [9, 'neun'],
  ];

  for (const [unitValue, unitWord] of units) {
    const value = 20 + unitValue;
    addWord(words, value, `${unitWord}undzwanzig`);
  }

  return words;
}
