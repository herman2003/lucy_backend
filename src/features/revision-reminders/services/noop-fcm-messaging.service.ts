import { Injectable } from '@nestjs/common';

import type {
  FcmMessagingPort,
  FcmNotificationPayload,
} from './fcm-messaging.port';

@Injectable()
export class NoopFcmMessagingService implements FcmMessagingPort {
  readonly sent: Array<{ tokens: string[]; payload: FcmNotificationPayload }> =
    [];

  async sendToTokens(
    tokens: string[],
    payload: FcmNotificationPayload,
  ): Promise<void> {
    this.sent.push({ tokens: [...tokens], payload: { ...payload } });
  }
}
