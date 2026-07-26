import {
  Body,
  Controller,
  Headers,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';

import {
  FirebaseAuthGuard,
  type FirebaseAuthRequest,
} from '../../core/auth/firebase-auth.guard';
import { LucyErrorCodes } from '../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../core/errors/lucy-api.error';
import { parseSyncRevisionReminderPushRequest } from './dto/sync-revision-reminder-push.dto';
import { RevisionReminderDispatchService } from './services/revision-reminder-dispatch.service';
import { RevisionReminderPushService } from './services/revision-reminder-push.service';

@Controller()
export class RevisionRemindersController {
  constructor(
    private readonly pushService: RevisionReminderPushService,
    private readonly dispatchService: RevisionReminderDispatchService,
  ) {}

  @Put('users/me/revision-reminder-push')
  @UseGuards(FirebaseAuthGuard)
  async syncPushState(
    @Req() request: FirebaseAuthRequest,
    @Body() body: unknown,
  ) {
    const uid = this.requireUid(request);
    const input = parseSyncRevisionReminderPushRequest(body);
    return this.pushService.syncPushState(uid, input);
  }

  @Post('revision-reminders/dispatch')
  async dispatchDueReminders(
    @Headers('x-cron-secret') cronSecret: string | undefined,
  ) {
    this.assertCronAuthorized(cronSecret);
    return this.dispatchService.dispatchDueReminders(new Date());
  }

  private requireUid(request: FirebaseAuthRequest): string {
    const uid = request.user?.uid;
    if (!uid) {
      throw new LucyApiError(401, LucyErrorCodes.UNAUTHORIZED, 'Unauthorized');
    }
    return uid;
  }

  private assertCronAuthorized(cronSecret: string | undefined): void {
    const expected = process.env.REVISION_REMINDER_CRON_SECRET?.trim();
    if (!expected) {
      if (process.env.NODE_ENV === 'production') {
        throw new LucyApiError(
          503,
          LucyErrorCodes.INTERNAL_ERROR,
          'Revision reminder cron is not configured',
        );
      }
      return;
    }
    if (cronSecret !== expected) {
      throw new LucyApiError(401, LucyErrorCodes.UNAUTHORIZED, 'Unauthorized');
    }
  }
}
