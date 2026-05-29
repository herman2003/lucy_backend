import {
  Body,
  Controller,
  Get,
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
import { UsersService } from './services/users.service';

@Controller('users')
@UseGuards(FirebaseAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@Req() request: FirebaseAuthRequest) {
    const uid = this.requireUid(request);
    return this.usersService.getMe(uid);
  }

  @Post('me')
  async createMe(
    @Req() request: FirebaseAuthRequest,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const uid = this.requireUid(request);
    const result = await this.usersService.createMe(uid, body);
    response.status(result.created ? 201 : 200);
    return result.profile;
  }

  private requireUid(request: FirebaseAuthRequest): string {
    const uid = request.user?.uid;
    if (!uid) {
      throw new Error('FirebaseAuthGuard must set request.user.uid');
    }
    return uid;
  }
}
