import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';

import {
  FirebaseAuthGuard,
  type FirebaseAuthRequest,
} from '../../core/auth/firebase-auth.guard';
import { LucyErrorCodes } from '../../core/errors/lucy-error-codes';
import { LucyApiError } from '../../core/errors/lucy-api.error';
import { parseCreateChatRequest } from './dto/create-chat.dto';
import { parseListChatMessagesQuery } from './dto/list-chat-messages-query.dto';
import { ChatService } from './services/chat.service';

@Controller('chats')
@UseGuards(FirebaseAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get()
  async listThreads(@Req() request: FirebaseAuthRequest) {
    const uid = this.requireUid(request);
    return this.chatService.listThreads(uid);
  }

  @Get('eligibility')
  async getEligibility(@Req() request: FirebaseAuthRequest) {
    const uid = this.requireUid(request);
    return this.chatService.getEligibility(uid);
  }

  @Post()
  async createThread(
    @Req() request: FirebaseAuthRequest,
    @Body() body: unknown,
  ) {
    const uid = this.requireUid(request);
    const input = parseCreateChatRequest(body);
    return this.chatService.createThread(uid, input);
  }

  @Get(':chatId/messages')
  async listMessages(
    @Req() request: FirebaseAuthRequest,
    @Param('chatId') chatId: string,
    @Query() query: Record<string, unknown>,
  ) {
    const uid = this.requireUid(request);
    const parsedQuery = parseListChatMessagesQuery(query);
    return this.chatService.listMessages(uid, chatId, parsedQuery);
  }

  private requireUid(request: FirebaseAuthRequest): string {
    const uid = request.user?.uid;
    if (!uid) {
      throw new LucyApiError(401, LucyErrorCodes.UNAUTHORIZED, 'Unauthorized');
    }
    return uid;
  }
}
