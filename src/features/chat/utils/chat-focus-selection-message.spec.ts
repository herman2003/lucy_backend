import { buildFocusSelectionMessage, joinMarkdownBlocks } from './chat-learning-dialogue-messages';
import type { CorpusStudyPlan } from '../../learning-sessions/domain/study-focus-area.types';

describe('buildFocusSelectionMessage formatting', () => {
  const plan: CorpusStudyPlan = {
    generatedAt: '2026-06-10T12:00:00.000Z',
    expiresAt: '2026-06-11T12:00:00.000Z',
    focusAreas: [
      {
        id: 'focus_1',
        documentId: 'doc_1',
        documentTitle: 'Doc A',
        label: 'Einführung',
        ordinalStart: 0,
        ordinalEnd: 0,
        importance: 'high',
        rationale: 'Grundlagen.',
        keyConcepts: ['Intro'],
      },
      {
        id: 'focus_2',
        documentId: 'doc_1',
        documentTitle: 'Doc A',
        label: 'Architektur',
        ordinalStart: 1,
        ordinalEnd: 1,
        importance: 'medium',
        rationale: 'Aufbau.',
        keyConcepts: ['Layers'],
      },
    ],
  };

  it('separates list items with blank lines for markdown rendering', () => {
    const text = buildFocusSelectionMessage('de', plan, 'quiz');

    expect(text).toContain('1. **Einführung**');
    expect(text).toContain('2. **Architektur**');
    expect(text).toMatch(/1\. \*\*Einführung\*\*[\s\S]*\n\n2\. \*\*Architektur\*\*/);
  });

  it('joins markdown blocks with blank lines', () => {
    expect(joinMarkdownBlocks(['- first', '- second'])).toBe('- first\n\n- second');
  });
});
