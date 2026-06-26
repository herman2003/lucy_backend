export type FcmNotificationPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

export const FCM_MESSAGING_PORT = Symbol('FCM_MESSAGING_PORT');

export interface FcmMessagingPort {
  sendToTokens(tokens: string[], payload: FcmNotificationPayload): Promise<void>;
}
