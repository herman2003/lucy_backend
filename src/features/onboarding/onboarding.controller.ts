import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';

import {
  FirebaseAuthGuard,
  type FirebaseAuthRequest,
} from '../../core/auth/firebase-auth.guard';
import { OnboardingService } from './services/onboarding.service';

@Controller('onboarding')
@UseGuards(FirebaseAuthGuard)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('progress')
  getProgress(@Req() request: FirebaseAuthRequest) {
    const uid = request.user?.uid;
    if (!uid) {
      throw new Error('FirebaseAuthGuard must set request.user.uid');
    }
    return this.onboardingService.getProgress(uid);
  }

  @Post('validate-answer')
  validateAnswer(
    @Req() request: FirebaseAuthRequest,
    @Body() body: unknown,
  ) {
    const uid = request.user?.uid;
    if (!uid) {
      throw new Error('FirebaseAuthGuard must set request.user.uid');
    }
    return this.onboardingService.validateAnswer(uid, body);
  }

  @Post('confirm-turn')
  confirmTurn(@Req() request: FirebaseAuthRequest, @Body() body: unknown) {
    const uid = request.user?.uid;
    if (!uid) {
      throw new Error('FirebaseAuthGuard must set request.user.uid');
    }
    return this.onboardingService.confirmTurn(uid, body);
  }

  @Post('analyze')
  analyze(@Req() request: FirebaseAuthRequest, @Body() body: unknown) {
    const uid = request.user?.uid;
    if (!uid) {
      throw new Error('FirebaseAuthGuard must set request.user.uid');
    }
    return this.onboardingService.analyze(uid, body);
  }

  @Post('finalize')
  finalize(@Req() request: FirebaseAuthRequest, @Body() body: unknown) {
    const uid = request.user?.uid;
    if (!uid) {
      throw new Error('FirebaseAuthGuard must set request.user.uid');
    }
    return this.onboardingService.finalize(uid, body);
  }
}
