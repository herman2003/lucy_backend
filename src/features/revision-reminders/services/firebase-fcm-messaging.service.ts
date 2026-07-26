import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';

import type {
  FcmMessagingPort,
  FcmNotificationPayload,
} from './fcm-messaging.port';

@Injectable()
export class FirebaseFcmMessagingService implements FcmMessagingPort {
  private readonly logger = new Logger(FirebaseFcmMessagingService.name);

  async sendToTokens(
    tokens: string[],
    payload: FcmNotificationPayload,
  ): Promise<void> {
    if (tokens.length === 0) {
      return;
    }

    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data,
    });

    if (response.failureCount > 0) {
      this.logger.warn(
        `FCM partial failure: ${response.failureCount}/${tokens.length}`,
      );
    }
  }
}
