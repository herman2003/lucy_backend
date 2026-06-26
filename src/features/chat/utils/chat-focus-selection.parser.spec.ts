import type { StudyFocusArea } from '../../learning-sessions/domain/study-focus-area.types';
import { parseFocusSelection } from './chat-focus-selection.parser';

const focusAreas: StudyFocusArea[] = [
  {
    id: 'focus_1',
    documentId: 'doc_1',
    documentTitle: 'Thermo',
    label: 'Chapitre 1 — Entropie',
    ordinalStart: 0,
    ordinalEnd: 2,
    importance: 'high',
    rationale: 'Base du cours.',
    keyConcepts: ['entropie'],
  },
  {
    id: 'focus_2',
    documentId: 'doc_1',
    documentTitle: 'Thermo',
    label: 'Chapitre 2 — Enthalpie',
    ordinalStart: 3,
    ordinalEnd: 5,
    importance: 'medium',
    rationale: 'Applications.',
    keyConcepts: ['enthalpie'],
  },
];

describe('parseFocusSelection (LEARN-07c)', () => {
  it('parses numbered selections', () => {
    expect(parseFocusSelection('1 et 3', focusAreas)).toEqual({
      kind: 'selected',
      focusAreaIds: ['focus_1'],
    });
    expect(parseFocusSelection('1 et 2', focusAreas)).toEqual({
      kind: 'selected',
      focusAreaIds: ['focus_1', 'focus_2'],
    });
  });

  it('parses all and most important shortcuts', () => {
    expect(parseFocusSelection('tout', focusAreas)).toEqual({
      kind: 'selected',
      focusAreaIds: ['focus_1', 'focus_2'],
    });
    expect(parseFocusSelection('les plus importantes', focusAreas)).toEqual({
      kind: 'selected',
      focusAreaIds: ['focus_1'],
    });
  });

  it('returns invalid when nothing matches', () => {
    expect(parseFocusSelection('peut-être demain', focusAreas)).toEqual({
      kind: 'invalid',
    });
  });
});
