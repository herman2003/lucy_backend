import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import { buildLearningSessionListItem, buildLearningSessionResponse } from './dto/learning-session-response.dto';
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

  @Get()
  async list(@Req() request: FirebaseAuthRequest) {
    const uid = this.requireUid(request);
    const sessions = await this.learningSessionsService.list(uid);
    return sessions.map(buildLearningSessionListItem);
  }

  @Get(':sessionId')
  async getById(
    @Req() request: FirebaseAuthRequest,
    @Param('sessionId') sessionId: string,
  ) {
    const uid = this.requireUid(request);
    const session = await this.learningSessionsService.getById(uid, sessionId);
    return buildLearningSessionResponse(session);
  }

  @Delete(':sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Req() request: FirebaseAuthRequest,
    @Param('sessionId') sessionId: string,
  ): Promise<void> {
    const uid = this.requireUid(request);
    await this.learningSessionsService.delete(uid, sessionId);
  }

  private requireUid(request: FirebaseAuthRequest): string {
    const uid = request.user?.uid;
    if (!uid) {
      throw new LucyApiError(401, LucyErrorCodes.UNAUTHORIZED, 'Unauthorized');
    }
    return uid;
  }
}
