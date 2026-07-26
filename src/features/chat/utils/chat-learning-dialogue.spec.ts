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

  it('captures optional exam type from the first message (LEARN-10b)', () => {
    const outcome = processLearningDialogueTurn({
      message: 'fais-moi un quiz pour mon partiel',
      pending: null,
      tutoringLanguage: 'fr',
      nowIso: now,
    });

    expect(outcome).toMatchObject({
      kind: 'assistant_reply',
      pending: { type: 'quiz', step: 'awaiting_confirm', examType: 'partiel' },
    });
  });

  it('includes exam type in launch recap when provided', () => {
    const outcome = processLearningDialogueTurn({
      message: '10',
      pending: {
        type: 'quiz',
        step: 'awaiting_count',
        examType: 'dissertation',
        updatedAt: now,
      },
      tutoringLanguage: 'fr',
      nowIso: now,
    });

    expect(outcome && outcome.kind === 'assistant_reply' ? outcome.text : '').toContain(
      'dissertation',
    );
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

  it('asks for a document when several are active (LEARN-11f)', () => {
    const activeDocuments = [
      { id: 'doc_1', title: 'Thermodynamique' },
      { id: 'doc_2', title: 'Chimie organique' },
    ];

    const outcome = processLearningDialogueTurn({
      message: 'oui',
      pending: {
        type: 'quiz',
        step: 'awaiting_confirm',
        updatedAt: now,
      },
      tutoringLanguage: 'fr',
      activeDocuments,
      nowIso: now,
    });

    expect(outcome).toMatchObject({
      kind: 'assistant_reply',
      pending: { step: 'awaiting_document_selection' },
    });
    expect(outcome && outcome.kind === 'assistant_reply' ? outcome.text : '').toContain(
      'Thermodynamique',
    );
  });

  it('scopes to a named document from the first message (LEARN-11f)', () => {
    const activeDocuments = [
      { id: 'doc_1', title: 'Thermodynamique' },
      { id: 'doc_2', title: 'Chimie organique' },
    ];

    const outcome = processLearningDialogueTurn({
      message: 'fais-moi un quiz sur Thermodynamique',
      pending: null,
      tutoringLanguage: 'fr',
      activeDocuments,
      nowIso: now,
    });

    expect(outcome).toMatchObject({
      kind: 'assistant_reply',
      pending: {
        type: 'quiz',
        step: 'awaiting_confirm',
        documentId: 'doc_1',
        documentTitle: 'Thermodynamique',
      },
    });
  });

  it('starts analysis after document selection (LEARN-11f)', () => {
    const activeDocuments = [
      { id: 'doc_1', title: 'Thermodynamique' },
      { id: 'doc_2', title: 'Chimie organique' },
    ];

    const outcome = processLearningDialogueTurn({
      message: '2',
      pending: {
        type: 'quiz',
        step: 'awaiting_document_selection',
        updatedAt: now,
      },
      tutoringLanguage: 'fr',
      activeDocuments,
      nowIso: now,
    });

    expect(outcome).toMatchObject({
      kind: 'needs_analysis',
      pending: {
        step: 'analyzing',
        documentId: 'doc_2',
        documentTitle: 'Chimie organique',
      },
    });
  });

  it('starts analysis on all documents selection (LEARN-11f)', () => {
    const activeDocuments = [
      { id: 'doc_1', title: 'Sprint-3-Personalized-learning-documents' },
      { id: 'doc_2', title: 'Bachelorarbeit_german' },
      { id: 'doc_3', title: 'documentpresentation' },
    ];

    const outcome = processLearningDialogueTurn({
      message: 'tout les documents stp',
      pending: {
        type: 'flashcards',
        step: 'awaiting_document_selection',
        updatedAt: now,
      },
      tutoringLanguage: 'fr',
      activeDocuments,
      nowIso: now,
    });

    expect(outcome).toMatchObject({
      kind: 'needs_analysis',
      pending: {
        step: 'analyzing',
      },
    });
    expect(
      outcome && outcome.kind === 'needs_analysis' ? outcome.pending.documentId : 'set',
    ).toBeUndefined();
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

  it('re-runs analysis when the learner asks to refine focus areas', () => {
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
      message: 'plus sur la chimie organique',
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
      kind: 'needs_analysis',
      pending: {
        step: 'analyzing',
        focusRefinementHint: 'plus sur la chimie organique',
      },
    });
  });

  it('re-runs analysis on other suggestions request', () => {
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
      message: 'autre proposition',
      pending: {
        type: 'flashcards',
        step: 'awaiting_focus_selection',
        updatedAt: now,
      },
      tutoringLanguage: 'fr',
      corpusStudyPlan: plan,
      nowIso: now,
    });

    expect(outcome).toMatchObject({
      kind: 'needs_analysis',
      pending: {
        step: 'analyzing',
      },
    });
    expect(
      outcome && outcome.kind === 'needs_analysis'
        ? outcome.pending.focusRefinementHint
        : undefined,
    ).toContain('different study focus recommendations');
  });

  it('preserves selectedFocusAreaIds when moving to launch recap', () => {
    const outcome = processLearningDialogueTurn({
      message: '5',
      pending: {
        type: 'quiz',
        step: 'awaiting_count',
        selectedFocusAreaIds: ['focus_1'],
        updatedAt: now,
      },
      tutoringLanguage: 'fr',
      nowIso: now,
    });

    expect(outcome).toMatchObject({
      kind: 'assistant_reply',
      pending: {
        step: 'awaiting_launch_confirm',
        itemCount: 5,
        selectedFocusAreaIds: ['focus_1'],
      },
    });
  });

  it('accepts written item counts during count step (LEARN-11b)', () => {
    const outcome = processLearningDialogueTurn({
      message: 'quinze',
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
      pending: {
        step: 'awaiting_launch_confirm',
        itemCount: 15,
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

  it('passes examType to generate outcome (LEARN-10b)', () => {
    const outcome = processLearningDialogueTurn({
      message: 'oui',
      pending: {
        type: 'quiz',
        step: 'awaiting_launch_confirm',
        itemCount: 5,
        examType: 'oral',
        updatedAt: now,
      },
      tutoringLanguage: 'fr',
      nowIso: now,
    });

    expect(outcome).toMatchObject({
      kind: 'generate',
      type: 'quiz',
      itemCount: 5,
      examType: 'oral',
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

  it('explains when regeneration is requested without a previous session (LEARN-09c)', () => {
    const outcome = processLearningDialogueTurn({
      message: 'refais pareil',
      pending: null,
      tutoringLanguage: 'fr',
      lastLearningGenerationRequest: null,
      nowIso: now,
    });

    expect(outcome).toMatchObject({
      kind: 'assistant_reply',
      pending: null,
    });
    expect(outcome && outcome.kind === 'assistant_reply' ? outcome.text : '').toContain(
      'pas encore',
    );
  });

  it('regenerates with the previous request parameters (LEARN-09c)', () => {
    const outcome = processLearningDialogueTurn({
      message: 'refais pareil',
      pending: null,
      tutoringLanguage: 'fr',
      lastLearningGenerationRequest: {
        type: 'quiz',
        itemCount: 5,
        selectedFocusAreaIds: ['focus_1'],
        requestedAt: now,
      },
      nowIso: now,
    });

    expect(outcome).toEqual({
      kind: 'generate',
      pending: null,
      type: 'quiz',
      itemCount: 5,
      selectedFocusAreaIds: ['focus_1'],
      isRegeneration: true,
    });
  });
});
