import { Inject, Injectable } from '@nestjs/common';

import { CHATS_REPOSITORY, type ChatsRepository } from '../../chat/repositories/chats.repository.port';
import {
  USERS_PROFILE_REPOSITORY,
  type UsersProfileRepository,
} from '../../users/repositories/users.repository.port';
import type { TutoringLanguage } from '../../onboarding/domain/learner-profile.enums';
import {
  REVISION_REMINDER_PUSH_REPOSITORY,
  type RevisionReminderPushRepository,
} from '../repositories/revision-reminder-push.repository.port';
import { buildJnFcmNotification } from '../utils/jn-fcm-notification.util';
import {
  formatLocalDateKey,
  isReminderSlot,
  pickRevisionJnReminder,
} from '../utils/revision-jn-reminder.util';
import {
  FCM_MESSAGING_PORT,
  type FcmMessagingPort,
} from './fcm-messaging.port';

export type RevisionReminderDispatchResult = {
  scanned: number;
  sent: number;
};

@Injectable()
export class RevisionReminderDispatchService {
  constructor(
    @Inject(REVISION_REMINDER_PUSH_REPOSITORY)
    private readonly pushRepository: RevisionReminderPushRepository,
    @Inject(CHATS_REPOSITORY)
    private readonly chatsRepository: ChatsRepository,
    @Inject(USERS_PROFILE_REPOSITORY)
    private readonly usersRepository: UsersProfileRepository,
    @Inject(FCM_MESSAGING_PORT)
    private readonly fcmMessaging: FcmMessagingPort,
  ) {}

  async dispatchDueReminders(now: Date): Promise<RevisionReminderDispatchResult> {
    const userIds = await this.pushRepository.listEligibleUserIds();
    let sent = 0;

    for (const uid of userIds) {
      const didSend = await this.dispatchForUser(uid, now);
      if (didSend) {
        sent += 1;
      }
    }

    return { scanned: userIds.length, sent };
  }

  private async dispatchForUser(uid: string, now: Date): Promise<boolean> {
    const state = await this.pushRepository.getState(uid);
    if (
      !state ||
      !state.prefs.enabled ||
      !state.prefs.revisionPlanEnabled ||
      state.fcmTokens.length === 0
    ) {
      return false;
    }

    if (!isReminderSlot(now, state.prefs)) {
      return false;
    }

    const localDateKey = formatLocalDateKey(now, state.prefs.timezone);
    if (state.lastJnPushLocalDate === localDateKey) {
      return false;
    }

    const threads = await this.chatsRepository.listThreads(uid);
    const reminder = pickRevisionJnReminder(threads, now);
    if (!reminder) {
      return false;
    }

    const language = await this.resolveTutoringLanguage(uid);
    const notification = buildJnFcmNotification(reminder, language);

    await this.fcmMessaging.sendToTokens(state.fcmTokens, {
      title: notification.title,
      body: notification.body,
      data: {
        kind: 'revision_jn',
        chatId: reminder.chatId,
        daysBeforeExam: String(reminder.daysBeforeExam),
      },
    });

    await this.pushRepository.upsertState(uid, {
      ...state,
      lastJnPushLocalDate: localDateKey,
    });

    return true;
  }

  private async resolveTutoringLanguage(
    uid: string,
  ): Promise<TutoringLanguage | 'fr'> {
    const profile = await this.usersRepository.getProfile(uid);
    const learnerProfile = profile?.learnerProfile;
    if (
      learnerProfile &&
      typeof learnerProfile === 'object' &&
      typeof (learnerProfile as Record<string, unknown>).tutoring_language ===
        'string'
    ) {
      return (learnerProfile as { tutoring_language: TutoringLanguage })
        .tutoring_language;
    }
    const uiLocale = profile?.uiLocale;
    if (uiLocale === 'en' || uiLocale === 'de' || uiLocale === 'fr') {
      return uiLocale;
    }
    return 'fr';
  }
}
