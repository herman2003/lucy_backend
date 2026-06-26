import type { LearningSessionType } from '../../learning-sessions/domain/learning-session.types';
import type { CorpusStudyPlan, StudyFocusArea } from '../../learning-sessions/domain/study-focus-area.types';
import type { TutoringLanguage } from '../../onboarding/domain/learner-profile.enums';
import { LEARNING_SESSION_ITEM_LIMITS } from '../../learning-sessions/dto/learning-session.constants';

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
): string {
  const lang = resolveLanguage(tutoringLanguage);
  const label = typeLabel(lang, type);
  switch (lang) {
    case 'en':
      return `**Summary**: ${itemCount} ${label} from all your active documents. Should I generate them? Reply **yes** or **cancel**.`;
    case 'de':
      return `**Zusammenfassung**: ${itemCount} ${label} aus allen aktiven Dokumenten. Soll ich starten? Antworte mit **ja** oder **abbrechen**.`;
    default:
      return `**Récap** : ${itemCount} ${type === 'quiz' ? 'questions' : 'cartes'} sur tous tes documents actifs. Je lance ? Réponds **oui** ou **annule**.`;
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
