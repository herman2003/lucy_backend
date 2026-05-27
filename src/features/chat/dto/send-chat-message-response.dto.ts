import type { ChatMessageDto } from '../services/chat.service';

export type SendChatMessageResponseDto = {
  userMessage: ChatMessageDto;
  assistantMessage: ChatMessageDto;
};
