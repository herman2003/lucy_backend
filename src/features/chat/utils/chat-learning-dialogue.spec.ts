import {
  isLearningDialogueAffirmative,
  isLearningDialogueCancel,
  processLearningDialogueTurn,
  resolveItemCount,
} from './chat-learning-dialogue';

describe('chat-learning-dialogue (LEARN-06)', () => {
  const now = '2026-06-10T12:00:00.000Z';

  it('starts with confirmation when user asks for a quiz', () => {
    const outcome = processLearningDialogueTurn({
      message: 'fais-moi un quiz',
      pending: null,
      tutoringLanguage: 'fr',
      nowIso: now,
    });

    expect(outcome).toMatchObject({
      kind: 'assistant_reply',
      pending: { type: 'quiz', step: 'awaiting_confirm' },
    });
    expect(outcome && outcome.kind === 'assistant_reply' ? outcome.text : '').toContain(
      'quiz',
    );
  });

  it('jumps to launch recap when count is in the first message', () => {
    const outcome = processLearningDialogueTurn({
      message: 'fais-moi 8 cartes mémoire',
      pending: null,
      tutoringLanguage: 'fr',
      nowIso: now,
    });

    expect(outcome).toMatchObject({
      kind: 'assistant_reply',
      pending: { type: 'flashcards', step: 'awaiting_launch_confirm', itemCount: 8 },
    });
  });

  it('starts corpus analysis after confirmation', () => {
    const outcome = processLearningDialogueTurn({
      message: 'oui',
      pending: {
        type: 'quiz',
        step: 'awaiting_confirm',
        updatedAt: now,
      },
      tutoringLanguage: 'fr',
      nowIso: now,
    });

    expect(outcome).toMatchObject({
      kind: 'needs_analysis',
      pending: { step: 'analyzing' },
    });
  });

  it('moves to count after focus selection', () => {
    const plan = {
      generatedAt: now,
      expiresAt: '2026-06-11T12:00:00.000Z',
      focusAreas: [
        {
          id: 'focus_1',
          documentId: 'doc_1',
          documentTitle: 'Thermo',
          label: 'Entropie',
          ordinalStart: 0,
          ordinalEnd: 0,
          importance: 'high' as const,
          rationale: 'Base.',
          keyConcepts: ['entropie'],
        },
      ],
    };
    const outcome = processLearningDialogueTurn({
      message: '1',
      pending: {
        type: 'quiz',
        step: 'awaiting_focus_selection',
        updatedAt: now,
      },
      tutoringLanguage: 'fr',
      corpusStudyPlan: plan,
      nowIso: now,
    });

    expect(outcome).toMatchObject({
      kind: 'assistant_reply',
      pending: {
        step: 'awaiting_count',
        selectedFocusAreaIds: ['focus_1'],
      },
    });
  });

  it('generates only after launch confirmation', () => {
    const outcome = processLearningDialogueTurn({
      message: 'oui',
      pending: {
        type: 'flashcards',
        step: 'awaiting_launch_confirm',
        itemCount: 10,
        updatedAt: now,
      },
      tutoringLanguage: 'fr',
      nowIso: now,
    });

    expect(outcome).toEqual({
      kind: 'generate',
      pending: null,
      type: 'flashcards',
      itemCount: 10,
    });
  });

  it('clears pending on cancel', () => {
    const outcome = processLearningDialogueTurn({
      message: 'annule',
      pending: {
        type: 'quiz',
        step: 'awaiting_count',
        updatedAt: now,
      },
      tutoringLanguage: 'fr',
      nowIso: now,
    });

    expect(outcome).toMatchObject({
      kind: 'assistant_reply',
      pending: null,
    });
  });

  it('defaults count when user says comme tu veux', () => {
    expect(resolveItemCount('flashcards', 'comme tu veux')).toBe(10);
    expect(resolveItemCount('quiz', 'comme tu veux')).toBe(5);
  });

  it('returns null for normal chat messages', () => {
    expect(
      processLearningDialogueTurn({
        message: "Qu'est-ce que l'entropie ?",
        pending: null,
        tutoringLanguage: 'fr',
      }),
    ).toBeNull();
  });

  it('detects cancel and affirmative helpers', () => {
    expect(isLearningDialogueCancel('annule')).toBe(true);
    expect(isLearningDialogueAffirmative('oui')).toBe(true);
  });
});
