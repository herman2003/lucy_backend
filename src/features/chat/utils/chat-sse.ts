import type { ChatSseEvent, ChatSseEventName } from '../domain/chat-sse.types';

export function formatChatSseEvent(event: ChatSseEventName, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function formatChatSsePayload(event: ChatSseEvent): string {
  return formatChatSseEvent(event.event, event.data);
}
