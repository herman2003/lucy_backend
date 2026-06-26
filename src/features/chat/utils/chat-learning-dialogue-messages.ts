import type { LearningSessionType } from '../../learning-sessions/domain/learning-session.types';
import type { ActiveDocumentRef } from '../../learning-sessions/utils/learning-document-scope.util';
import type { CorpusStudyPlan, StudyFocusArea } from '../../learning-sessions/domain/study-focus-area.types';
import {
  buildRevisionCalendarEntries,
  formatRevisionCalendarSection,
} from '../../learning-sessions/utils/revision-calendar.util';
import type { TutoringLanguage } from '../../onboarding/domain/learner-profile.enums';
import { LEARNING_SESSION_ITEM_LIMITS } from '../../learning-sessions/dto/learning-session.constants';

export type BuildRevisionPlanOptions = {
  examType?: string;
  examDate?: Date;
  now?: Date;
};

function resolveLanguage(language: TutoringLanguage): 'fr' | 'en' | 'de' {
  if (language === 'en' || language === 'de') {
    return language;
  }
  return 'fr';
}

function typeLabel(
  language: 'fr' | 'en' | 'de',
  type: LearningSessionType,
): string {
  if (type === 'quiz') {
    return language === 'en'
      ? 'quiz'
      : language === 'de'
        ? 'Quiz'
        : 'quiz';
  }
  return language === 'en'
    ? 'flashcards'
    : language === 'de'
      ? 'Karteikarten'
      : 'cartes mémoire';
}

export function buildLearningConfirmPrompt(
  tutoringLanguage: TutoringLanguage,
  type: LearningSessionType,
): string {
  const lang = resolveLanguage(tutoringLanguage);
  const label = typeLabel(lang, type);
  switch (lang) {
    case 'en':
      return `You asked for a **${label}** from your active documents — is that right? Reply **yes** to continue or **cancel** to stop.`;
    case 'de':
      return type === 'quiz'
        ? 'Du möchtest ein **Quiz** aus deinen aktiven Dokumenten — stimmt das? Antworte mit **ja** oder **abbrechen**.'
        : 'Du möchtest **Karteikarten** aus deinen aktiven Dokumenten — stimmt das? Antworte mit **ja** oder **abbrechen**.';
    default:
      return type === 'quiz'
        ? 'Tu veux un **quiz** sur tes documents actifs — c’est bien ça ? Réponds **oui** pour continuer ou **annule** pour arrêter.'
        : 'Tu veux des **cartes mémoire** sur tes documents actifs — c’est bien ça ? Réponds **oui** pour continuer ou **annule** pour arrêter.';
  }
}

export function buildLearningCountPrompt(
  tutoringLanguage: TutoringLanguage,
  type: LearningSessionType,
): string {
  const lang = resolveLanguage(tutoringLanguage);
  const max = LEARNING_SESSION_ITEM_LIMITS[type].maxCount;
  const defaultCount = LEARNING_SESSION_ITEM_LIMITS[type].defaultCount;
  switch (lang) {
    case 'en':
      return type === 'quiz'
        ? `How many **questions** do you want? (1–${max}, or say "as you like" for ${defaultCount}.)`
        : `How many **flashcards** do you want? (1–${max}, or say "as you like" for ${defaultCount}.)`;
    case 'de':
      return type === 'quiz'
        ? `Wie viele **Fragen** möchtest du? (1–${max}, oder „wie du willst“ für ${defaultCount}.)`
        : `Wie viele **Karteikarten** möchtest du? (1–${max}, oder „wie du willst“ für ${defaultCount}.)`;
    default:
      return type === 'quiz'
        ? `Combien de **questions** veux-tu ? (1–${max}, ou « comme tu veux » pour ${defaultCount}.)`
        : `Combien de **cartes** veux-tu ? (1–${max}, ou « comme tu veux » pour ${defaultCount}.)`;
  }
}

export function buildLearningLaunchRecap(
  tutoringLanguage: TutoringLanguage,
  type: LearningSessionType,
  itemCount: number,
  examType?: string,
  documentTitle?: string,
): string {
  const lang = resolveLanguage(tutoringLanguage);
  const label = typeLabel(lang, type);
  const examClause = formatExamTypeRecapClause(lang, examType);
  const scopeClause = formatDocumentScopeRecapClause(lang, documentTitle);
  switch (lang) {
    case 'en':
      return `**Summary**: ${itemCount} ${label}${scopeClause}${examClause}. Should I generate them? Reply **yes** or **cancel**.`;
    case 'de':
      return `**Zusammenfassung**: ${itemCount} ${label}${scopeClause}${examClause}. Soll ich starten? Antworte mit **ja** oder **abbrechen**.`;
    default:
      return `**Récap** : ${itemCount} ${type === 'quiz' ? 'questions' : 'cartes'}${scopeClause}${examClause}. Je lance ? Réponds **oui** ou **annule**.`;
  }
}

function formatDocumentScopeRecapClause(
  language: 'fr' | 'en' | 'de',
  documentTitle?: string,
): string {
  if (!documentTitle) {
    switch (language) {
      case 'en':
        return ' from all your active documents';
      case 'de':
        return ' aus allen aktiven Dokumenten';
      default:
        return ' sur tous tes documents actifs';
    }
  }
  switch (language) {
    case 'en':
      return ` on **${documentTitle}**`;
    case 'de':
      return ` zu **${documentTitle}**`;
    default:
      return ` sur **${documentTitle}**`;
  }
}

export function buildDocumentSelectionMessage(
  tutoringLanguage: TutoringLanguage,
  documents: ActiveDocumentRef[],
  type: LearningSessionType,
): string {
  const lang = resolveLanguage(tutoringLanguage);
  const label = typeLabel(lang, type);
  const lines = documents.map(
    (doc, index) => `**${index + 1}.** ${doc.title}`,
  );
  switch (lang) {
    case 'en':
      return [
        `You have several active documents. Which one should I use for this **${label}**?`,
        '',
        ...lines,
        '',
        'Reply with a **number** or the **document title**.',
      ].join('\n');
    case 'de':
      return [
        `Du hast mehrere aktive Dokumente. Welches soll ich für ${label === 'quiz' ? 'dieses Quiz' : 'diese Karteikarten'} verwenden?`,
        '',
        ...lines,
        '',
        'Antworte mit einer **Zahl** oder dem **Dokumenttitel**.',
      ].join('\n');
    default:
      return [
        `Tu as plusieurs documents actifs. Lequel dois-je utiliser pour ${type === 'quiz' ? 'ce quiz' : 'ces cartes'} ?`,
        '',
        ...lines,
        '',
        'Réponds par un **numéro** ou le **titre du document**.',
      ].join('\n');
  }
}

export function buildDocumentSelectionInvalidMessage(
  tutoringLanguage: TutoringLanguage,
): string {
  const lang = resolveLanguage(tutoringLanguage);
  switch (lang) {
    case 'en':
      return 'I did not recognize that document. Pick one from the list below.';
    case 'de':
      return 'Dieses Dokument habe ich nicht erkannt. Wähle eines aus der Liste unten.';
    default:
      return 'Je n’ai pas reconnu ce document. Choisis-en un dans la liste ci-dessous.';
  }
}

function formatExamTypeRecapClause(
  language: 'fr' | 'en' | 'de',
  examType?: string,
): string {
  if (!examType) {
    return '';
  }
  switch (language) {
    case 'en':
      return ` for a **${examType}**`;
    case 'de':
      return ` für **${examType}**`;
    default:
      return ` pour un **${examType}**`;
  }
}

export function buildLearningGeneratingMessage(
  tutoringLanguage: TutoringLanguage,
  type: LearningSessionType,
): string {
  const lang = resolveLanguage(tutoringLanguage);
  switch (lang) {
    case 'en':
      return type === 'quiz'
        ? 'I am preparing your quiz…'
        : 'I am preparing your flashcards…';
    case 'de':
      return type === 'quiz'
        ? 'Ich bereite dein Quiz vor…'
        : 'Ich bereite deine Karteikarten vor…';
    default:
      return type === 'quiz'
        ? 'Je prépare ton quiz…'
        : 'Je prépare tes cartes…';
  }
}

export function buildLearningRegeneratingMessage(
  tutoringLanguage: TutoringLanguage,
  type: LearningSessionType,
): string {
  const lang = resolveLanguage(tutoringLanguage);
  switch (lang) {
    case 'en':
      return type === 'quiz'
        ? 'I am generating the same quiz again with the same settings…'
        : 'I am generating the same flashcards again with the same settings…';
    case 'de':
      return type === 'quiz'
        ? 'Ich erstelle dasselbe Quiz noch einmal mit denselben Einstellungen…'
        : 'Ich erstelle dieselben Karteikarten noch einmal mit denselben Einstellungen…';
    default:
      return type === 'quiz'
        ? 'Je relance le même quiz avec les mêmes paramètres…'
        : 'Je relance les mêmes cartes avec les mêmes paramètres…';
  }
}

export function buildLearningRegenerationUnavailableMessage(
  tutoringLanguage: TutoringLanguage,
): string {
  const lang = resolveLanguage(tutoringLanguage);
  switch (lang) {
    case 'en':
      return 'I do not have a previous quiz or flashcards request in this chat yet. Ask me for a quiz or flashcards first.';
    case 'de':
      return 'In diesem Chat gibt es noch keine vorherige Quiz- oder Karteikarten-Anfrage. Bitte fordere zuerst ein Quiz oder Karteikarten an.';
    default:
      return 'Je n’ai pas encore de quiz ou de cartes à relancer dans cette conversation. Demande-moi d’abord un quiz ou des cartes.';
  }
}

export function buildLearningCancelledMessage(
  tutoringLanguage: TutoringLanguage,
): string {
  const lang = resolveLanguage(tutoringLanguage);
  switch (lang) {
    case 'en':
      return 'Okay, I cancelled the quiz/flashcards request. What would you like to work on?';
    case 'de':
      return 'Alles klar, ich habe die Anfrage abgebrochen. Womit möchtest du weitermachen?';
    default:
      return 'D’accord, j’annule la demande. Sur quoi veux-tu qu’on travaille ?';
  }
}

export function buildLearningInvalidCountMessage(
  tutoringLanguage: TutoringLanguage,
  type: LearningSessionType,
): string {
  const lang = resolveLanguage(tutoringLanguage);
  const max = LEARNING_SESSION_ITEM_LIMITS[type].maxCount;
  switch (lang) {
    case 'en':
      return `Please give a whole number between 1 and ${max}, or say "as you like".`;
    case 'de':
      return `Bitte gib eine ganze Zahl zwischen 1 und ${max} an, oder sag „wie du willst“.`;
    default:
      return `Indique un nombre entier entre 1 et ${max}, ou dis « comme tu veux ».`;
  }
}

export function buildLearningLaunchClarifyMessage(
  tutoringLanguage: TutoringLanguage,
): string {
  const lang = resolveLanguage(tutoringLanguage);
  switch (lang) {
    case 'en':
      return 'Reply **yes** to generate or **cancel** to stop.';
    case 'de':
      return 'Antworte mit **ja** zum Starten oder **abbrechen** zum Stoppen.';
    default:
      return 'Réponds **oui** pour lancer ou **annule** pour arrêter.';
  }
}

export function buildLearningAnalyzingMessage(
  tutoringLanguage: TutoringLanguage,
): string {
  const lang = resolveLanguage(tutoringLanguage);
  switch (lang) {
    case 'en':
      return 'I am reviewing your active documents to spot what matters most for your revision…';
    case 'de':
      return 'Ich gehe deine aktiven Dokumente durch, um die wichtigsten Lernbereiche zu finden…';
    default:
      return 'Je parcours tes documents actifs pour repérer ce qu’il est important de travailler…';
  }
}

function formatFocusAreaLine(
  index: number,
  area: StudyFocusArea,
  lang: 'fr' | 'en' | 'de',
): string {
  const number = `**${index + 1}.**`;
  const importance =
    area.importance === 'high'
      ? lang === 'en'
        ? 'high priority'
        : lang === 'de'
          ? 'hohe Priorität'
          : 'priorité haute'
      : lang === 'en'
        ? 'medium priority'
        : lang === 'de'
          ? 'mittlere Priorität'
          : 'priorité moyenne';
  const pages =
    area.pageStart !== undefined
      ? lang === 'en'
        ? ` (pp. ${area.pageStart}–${area.pageEnd ?? area.pageStart})`
        : lang === 'de'
          ? ` (S. ${area.pageStart}–${area.pageEnd ?? area.pageStart})`
          : ` (p. ${area.pageStart}–${area.pageEnd ?? area.pageStart})`
      : '';
  const concepts =
    area.keyConcepts.length > 0
      ? lang === 'en'
        ? ` · concepts: ${area.keyConcepts.join(', ')}`
        : lang === 'de'
          ? ` · Konzepte: ${area.keyConcepts.join(', ')}`
          : ` · concepts : ${area.keyConcepts.join(', ')}`
      : '';
  return `${number} ${area.label}${pages} — *${importance}* — ${area.rationale}${concepts}`;
}

export function buildFocusSelectionMessage(
  tutoringLanguage: TutoringLanguage,
  plan: CorpusStudyPlan,
  type: LearningSessionType,
): string {
  const lang = resolveLanguage(tutoringLanguage);
  const label = typeLabel(lang, type);
  const lines = plan.focusAreas.map((area, index) =>
    formatFocusAreaLine(index, area, lang),
  );

  switch (lang) {
    case 'en':
      return [
        `Here is what I recommend for your **${label}**:`,
        '',
        ...lines,
        '',
        'Which parts should we use? Reply with numbers (e.g. **1 and 2**), **all**, or **most important**.',
      ].join('\n');
    case 'de':
      return [
        `Das empfehle ich für dein **${label}**:`,
        '',
        ...lines,
        '',
        'Welche Teile sollen wir nehmen? Antworte mit Nummern (z. B. **1 und 2**), **alle** oder **wichtigsten**.',
      ].join('\n');
    default:
      return [
        `Voici ce que je te recommande pour ton **${label}** :`,
        '',
        ...lines,
        '',
        'Quelles parties veux-tu travailler ? Réponds avec des numéros (ex. **1 et 2**), **tout**, ou **les plus importantes**.',
      ].join('\n');
  }
}

export function buildRevisionPlanText(
  tutoringLanguage: TutoringLanguage,
  plan: CorpusStudyPlan,
  options?: string | BuildRevisionPlanOptions,
): string {
  const resolvedOptions = resolveRevisionPlanOptions(options);
  const lang = resolveLanguage(tutoringLanguage);
  const lines = plan.focusAreas.map((area, index) =>
    formatFocusAreaLine(index, area, lang),
  );
  const examType = resolvedOptions.examType;
  const examSuffix =
    examType !== undefined
      ? lang === 'en'
        ? ` for your **${examType}**`
        : lang === 'de'
          ? ` für deine **${examType}**`
          : ` pour ton **${examType}**`
      : '';

  const baseSections = (() => {
    switch (lang) {
      case 'en':
        return [
          `## Revision plan${examSuffix}`,
          '',
          'Based on your active documents, here is a prioritized study plan you can copy:',
          '',
          ...lines,
          '',
          '**Next steps:** ask for a **quiz** or **flashcards** on any section (e.g. "quiz on 1 and 2").',
        ];
      case 'de':
        return [
          `## Lernplan${examSuffix}`,
          '',
          'Auf Basis deiner aktiven Dokumente — ein priorisierter Plan zum Kopieren:',
          '',
          ...lines,
          '',
          '**Nächste Schritte:** Bitte um ein **Quiz** oder **Karteikarten** zu einem Abschnitt (z. B. „Quiz zu 1 und 2“).',
        ];
      default:
        return [
          `## Plan de révision${examSuffix}`,
          '',
          'D’après tes documents actifs, voici un plan priorisé que tu peux copier :',
          '',
          ...lines,
          '',
          '**Prochaines étapes :** demande un **quiz** ou des **cartes** sur une section (ex. « quiz sur 1 et 2 »).',
        ];
    }
  })();

  const calendarSection =
    resolvedOptions.examDate !== undefined
      ? formatRevisionCalendarSection(
          tutoringLanguage,
          buildRevisionCalendarEntries(
            plan.focusAreas,
            resolvedOptions.examDate,
            resolvedOptions.now ?? new Date(),
          ),
        )
      : '';

  if (!calendarSection) {
    return baseSections.join('\n');
  }

  return [...baseSections, '', calendarSection].join('\n');
}

function resolveRevisionPlanOptions(
  options?: string | BuildRevisionPlanOptions,
): BuildRevisionPlanOptions {
  if (typeof options === 'string') {
    return { examType: options };
  }
  return options ?? {};
}

export function buildRevisionPlanUnavailableMessage(
  tutoringLanguage: TutoringLanguage,
): string {
  const lang = resolveLanguage(tutoringLanguage);
  switch (lang) {
    case 'en':
      return 'I could not build a revision plan from your documents. Check that at least one document is active, then try again.';
    case 'de':
      return 'Ich konnte keinen Lernplan aus deinen Dokumenten erstellen. Prüfe, ob mindestens ein Dokument aktiv ist, und versuche es erneut.';
    default:
      return 'Je n’ai pas pu établir de plan de révision à partir de tes documents. Vérifie qu’au moins un document est actif, puis réessaie.';
  }
}

export function buildFocusSelectionInvalidMessage(
  tutoringLanguage: TutoringLanguage,
): string {
  const lang = resolveLanguage(tutoringLanguage);
  switch (lang) {
    case 'en':
      return 'I did not understand your selection. Use numbers (e.g. **1 and 3**), **all**, or **most important**.';
    case 'de':
      return 'Ich habe deine Auswahl nicht verstanden. Nutze Nummern (z. B. **1 und 3**), **alle** oder **wichtigsten**.';
    default:
      return 'Je n’ai pas compris ta sélection. Indique des numéros (ex. **1 et 3**), **tout**, ou **les plus importantes**.';
  }
}

export function buildTopicFallbackPrompt(
  tutoringLanguage: TutoringLanguage,
  type: LearningSessionType,
): string {
  const lang = resolveLanguage(tutoringLanguage);
  const label = typeLabel(lang, type);
  switch (lang) {
    case 'en':
      return `I could not analyze your documents automatically. Which topic or chapter should this **${label}** focus on?`;
    case 'de':
      return `Ich konnte deine Dokumente nicht automatisch analysieren. Auf welches Thema oder Kapitel soll sich dein **${label}** konzentrieren?`;
    default:
      return `Je n’ai pas pu analyser tes documents automatiquement. Sur quel sujet ou chapitre veux-tu ce **${label}** ?`;
  }
}

export function buildLearningGenerationFailedMessage(
  tutoringLanguage: TutoringLanguage,
  type: LearningSessionType,
  adviceKey: 'no_retrieval_hits' | 'invalid_llm_output' | 'unknown',
): string {
  const lang = resolveLanguage(tutoringLanguage);
  const label = typeLabel(lang, type);

  if (adviceKey === 'no_retrieval_hits') {
    switch (lang) {
      case 'en':
        return `I could not find enough content in your active documents to build this **${label}**. Try enabling another document, broadening your section selection, or asking for a wider topic.`;
      case 'de':
        return `Ich habe nicht genug Inhalt in deinen aktiven Dokumenten gefunden, um diese **${label}** zu erstellen. Aktiviere ein weiteres Dokument, erweitere deine Auswahl oder wähle ein breiteres Thema.`;
      default:
        return `Je n’ai pas trouvé assez de contenu dans tes documents actifs pour générer ce **${label}**. Essaie d’activer un autre document, d’élargir ta sélection de parties, ou de demander un sujet plus large.`;
    }
  }

  if (adviceKey === 'invalid_llm_output') {
    switch (lang) {
      case 'en':
        return `Generation failed on my side. Try again in a moment, or ask for fewer ${type === 'quiz' ? 'questions' : 'flashcards'}. You can also restart by asking for a new **${label}**.`;
      case 'de':
        return `Die Generierung ist auf meiner Seite fehlgeschlagen. Versuche es gleich noch einmal oder fordere weniger ${type === 'quiz' ? 'Fragen' : 'Karteikarten'} an. Du kannst auch einfach eine neue **${label}** anfordern.`;
      default:
        return `La génération a échoué de mon côté. Réessaie dans un instant, ou demande moins de ${type === 'quiz' ? 'questions' : 'cartes'}. Tu peux aussi redemander un nouveau **${label}** depuis le chat.`;
    }
  }

  switch (lang) {
    case 'en':
      return `I could not generate your **${label}**. Try again from chat, or pick different sections before launching.`;
    case 'de':
      return `Ich konnte deine **${label}** nicht erstellen. Versuche es erneut im Chat oder wähle andere Abschnitte vor dem Start.`;
    default:
      return `Je n’ai pas pu générer ton **${label}**. Réessaie depuis le chat, ou choisis d’autres parties avant de lancer.`;
  }
}
