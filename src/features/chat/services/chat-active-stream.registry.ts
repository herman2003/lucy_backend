import { Injectable } from '@nestjs/common';

import { LucyErrorCodes } from '../../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../../core/errors/lucy-api.error';

@Injectable()
export class ChatActiveStreamRegistry {
  private readonly activeKeys = new Set<string>();

  isActive(uid: string, chatId: string): boolean {
    return this.activeKeys.has(this.key(uid, chatId));
  }

  assertNotActive(uid: string, chatId: string): void {
    if (this.isActive(uid, chatId)) {
      throw streamInProgressError();
    }
  }

  acquire(uid: string, chatId: string): void {
    const streamKey = this.key(uid, chatId);
    if (this.activeKeys.has(streamKey)) {
      throw streamInProgressError();
    }
    this.activeKeys.add(streamKey);
  }

  release(uid: string, chatId: string): void {
    this.activeKeys.delete(this.key(uid, chatId));
  }

  private key(uid: string, chatId: string): string {
    return `${uid}:${chatId}`;
  }
}

function streamInProgressError(): LucyApiError {
  return new LucyApiError(
    409,
    LucyErrorCodes.CHAT_STREAM_IN_PROGRESS,
    'A message stream is already in progress for this chat',
  );
}
