import {
  Body,
  Controller,
  Get,
  Param,
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
import { buildQuizAttemptResponse } from './dto/quiz-attempt-response.dto';
import { LearningSessionAttemptsService } from './services/learning-session-attempts.service';

@Controller('learning-sessions/:sessionId/attempts')
@UseGuards(FirebaseAuthGuard)
export class LearningSessionAttemptsController {
  constructor(
    private readonly attemptsService: LearningSessionAttemptsService,
  ) {}

  @Post()
  async recordAttempt(
    @Req() request: FirebaseAuthRequest,
    @Param('sessionId') sessionId: string,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const uid = this.requireUid(request);
    const attempt = await this.attemptsService.recordAttempt(
      uid,
      sessionId,
      body,
    );
    response.status(201);
    return buildQuizAttemptResponse(attempt);
  }

  @Get()
  async listAttempts(
    @Req() request: FirebaseAuthRequest,
    @Param('sessionId') sessionId: string,
  ) {
    const uid = this.requireUid(request);
    const attempts = await this.attemptsService.listAttempts(uid, sessionId);
    return attempts.map(buildQuizAttemptResponse);
  }

  private requireUid(request: FirebaseAuthRequest): string {
    const uid = request.user?.uid;
    if (!uid) {
      throw new LucyApiError(401, LucyErrorCodes.UNAUTHORIZED, 'Unauthorized');
    }
    return uid;
  }
}
