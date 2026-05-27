import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { ChatActiveStreamRegistry } from './chat-active-stream.registry';

describe('ChatActiveStreamRegistry', () => {
  const registry = new ChatActiveStreamRegistry();
  const uid = 'user-a';
  const chatId = 'chat-1';

  afterEach(() => {
    registry.release(uid, chatId);
  });

  it('throws CHAT_STREAM_IN_PROGRESS on second acquire', () => {
    registry.acquire(uid, chatId);

    expect(() => registry.acquire(uid, chatId)).toThrow(
      expect.objectContaining({
        statusCode: 409,
        error: LucyErrorCodes.CHAT_STREAM_IN_PROGRESS,
      }),
    );
  });

  it('allows acquire after release', () => {
    registry.acquire(uid, chatId);
    registry.release(uid, chatId);

    expect(() => registry.acquire(uid, chatId)).not.toThrow();
  });
});
