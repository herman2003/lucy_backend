import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
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
import { parseCreateChatRequest } from './dto/create-chat.dto';
import { parseListChatMessagesQuery } from './dto/list-chat-messages-query.dto';
import { parseStreamChatMessageRequest } from './dto/stream-chat-message.dto';
import { formatChatSsePayload } from './utils/chat-sse';
import { ChatService } from './services/chat.service';
import { ChatStreamService } from './services/chat-stream.service';

@Controller('chats')
@UseGuards(FirebaseAuthGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatStreamService: ChatStreamService,
  ) {}

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

  @Post(':chatId/messages/stream')
  async streamMessage(
    @Req() request: FirebaseAuthRequest,
    @Param('chatId') chatId: string,
    @Body() body: unknown,
    @Res() response: Response,
  ): Promise<void> {
    const uid = this.requireUid(request);
    const input = parseStreamChatMessageRequest(body);
    await this.chatStreamService.assertCanStream(uid, chatId);

    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');
    response.flushHeaders?.();

    for await (const event of this.chatStreamService.streamMessage(
      uid,
      chatId,
      input.content,
    )) {
      response.write(formatChatSsePayload(event));
    }

    response.end();
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
