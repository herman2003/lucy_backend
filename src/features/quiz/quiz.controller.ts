import { Controller, Get, Req, UseGuards } from '@nestjs/common';

import {
  FirebaseAuthGuard,
  type FirebaseAuthRequest,
} from '../../core/auth/firebase-auth.guard';
import { LucyErrorCodes } from '../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../core/errors/lucy-api.error';
import { QuizService } from './quiz.service';

@Controller('quizzes')
@UseGuards(FirebaseAuthGuard)
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  @Get('eligibility')
  async getEligibility(@Req() request: FirebaseAuthRequest) {
    const uid = this.requireUid(request);
    return this.quizService.getEligibility(uid);
  }

  private requireUid(request: FirebaseAuthRequest): string {
    const uid = request.user?.uid;
    if (!uid) {
      throw new LucyApiError(401, LucyErrorCodes.UNAUTHORIZED, 'Unauthorized');
    }
    return uid;
  }
}
