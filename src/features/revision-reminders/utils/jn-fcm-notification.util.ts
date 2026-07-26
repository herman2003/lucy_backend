import type { TutoringLanguage } from '../../onboarding/domain/learner-profile.enums';
import type { RevisionJnReminderPayload } from '../utils/revision-jn-reminder.util';

export function buildJnFcmNotification(
  reminder: RevisionJnReminderPayload,
  language: TutoringLanguage | 'fr',
): { title: string; body: string } {
  const lang = resolveLanguage(language);
  const focusText = reminder.focusLabels.join(', ');
  switch (lang) {
    case 'en':
      return {
        title: `J-${reminder.daysBeforeExam} revision`,
        body: `Review: ${focusText}`,
      };
    case 'de':
      return {
        title: `J-${reminder.daysBeforeExam} Wiederholung`,
        body: `Heute: ${focusText}`,
      };
    default:
      return {
        title: `Révision J-${reminder.daysBeforeExam}`,
        body: `Aujourd'hui : ${focusText}`,
      };
  }
}

function resolveLanguage(language: TutoringLanguage | 'fr'): 'fr' | 'en' | 'de' {
  if (language === 'en' || language === 'de') {
    return language;
  }
  return 'fr';
}
