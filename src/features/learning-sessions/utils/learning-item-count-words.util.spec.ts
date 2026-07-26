import {
  parseWrittenLearningItemCount,
} from '../../learning-sessions/utils/learning-item-count-words.util';

describe('parseWrittenLearningItemCount (LEARN-11b)', () => {
  it('parses French written numbers', () => {
    expect(parseWrittenLearningItemCount('quinze')).toBe(15);
    expect(parseWrittenLearningItemCount('dix questions')).toBe(10);
    expect(parseWrittenLearningItemCount('vingt-cinq cartes')).toBe(25);
  });

  it('parses English written numbers', () => {
    expect(parseWrittenLearningItemCount('fifteen')).toBe(15);
    expect(parseWrittenLearningItemCount('twenty flashcards')).toBe(20);
  });

  it('parses German written numbers', () => {
    expect(parseWrittenLearningItemCount('fünfzehn')).toBe(15);
    expect(parseWrittenLearningItemCount('zwanzig Karteikarten')).toBe(20);
  });

  it('still parses digit counts', () => {
    expect(parseWrittenLearningItemCount('fais-moi un quiz de 8 questions')).toBe(8);
  });

  it('does not treat article "un" before quiz as item count', () => {
    expect(parseWrittenLearningItemCount('fais-moi un quiz')).toBeUndefined();
    expect(parseWrittenLearningItemCount('create a quiz')).toBeUndefined();
    expect(parseWrittenLearningItemCount('Schlage ein Quiz vor')).toBeUndefined();
  });

  it('accepts standalone "un" as count one', () => {
    expect(parseWrittenLearningItemCount('un')).toBe(1);
    expect(parseWrittenLearningItemCount('une question')).toBe(1);
  });

  it('prefers explicit count in a long quiz request', () => {
    expect(parseWrittenLearningItemCount('fais-moi un quiz de quinze questions')).toBe(15);
  });
});
