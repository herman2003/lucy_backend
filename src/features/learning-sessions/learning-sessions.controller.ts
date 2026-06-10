import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';

import {
  FirebaseAuthGuard,
  type FirebaseAuthRequest,
} from '../../core/auth/firebase-auth.guard';
import { LucyErrorCodes } from '../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../core/errors/lucy-api.error';
import { buildLearningSessionResponse } from './dto/learning-session-response.dto';
import { LearningSessionsService } from './services/learning-sessions.service';

@Controller('learning-sessions')
@UseGuards(FirebaseAuthGuard)
export class LearningSessionsController {
  constructor(private readonly learningSessionsService: LearningSessionsService) {}

  @Post('generate')
  async generate(
    @Req() request: FirebaseAuthRequest,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const uid = this.requireUid(request);
    const session = await this.learningSessionsService.generate(uid, body);
    response.status(201);
    return buildLearningSessionResponse(session);
  }

  private requireUid(request: FirebaseAuthRequest): string {
    const uid = request.user?.uid;
    if (!uid) {
      throw new LucyApiError(401, LucyErrorCodes.UNAUTHORIZED, 'Unauthorized');
    }
    return uid;
  }
}
