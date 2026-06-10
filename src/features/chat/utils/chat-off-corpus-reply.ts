import type { TutoringLanguage } from '../../onboarding/domain/learner-profile.enums';

const OFF_CORPUS_REPLIES: Record<'fr' | 'en' | 'de', string> = {
  fr: [
    '**Cette question ne figure pas dans vos documents.**',
    '',
    'Je ne peux répondre qu’à partir des fichiers que vous avez déposés (onglet **Documents**). Votre message est hors du contenu de votre corpus actuel.',
    '',
    'Pour continuer :',
    '- posez une question liée à vos cours ou PDF ;',
    '- ou activez d’autres documents prêts à la recherche.',
  ].join('\n'),
  en: [
    '**This question is not covered by your documents.**',
    '',
    'I can only answer from the files you uploaded (**Documents** tab). Your message is outside your current learning corpus.',
    '',
    'To continue:',
    '- ask something tied to your course materials or PDFs;',
    '- or enable more documents that are ready for search.',
  ].join('\n'),
  de: [
    '**Diese Frage ist in Ihren Dokumenten nicht enthalten.**',
    '',
    'Ich kann nur aus den Dateien antworten, die Sie hochgeladen haben (Reiter **Dokumente**). Ihre Nachricht liegt außerhalb Ihres aktuellen Lernkorpus.',
    '',
    'So geht es weiter:',
    '- stellen Sie eine Frage zu Ihren Kursunterlagen oder PDFs;',
    '- oder aktivieren Sie weitere Dokumente, die für die Suche bereit sind.',
  ].join('\n'),
};

/** Deterministic tutor reply when retrieval finds no relevant excerpt. */
export function buildOffCorpusAssistantReply(
  tutoringLanguage: TutoringLanguage,
): string {
  if (tutoringLanguage === 'en' || tutoringLanguage === 'de') {
    return OFF_CORPUS_REPLIES[tutoringLanguage];
  }
  return OFF_CORPUS_REPLIES.fr;
}
