import type { ChatSseEvent, ChatSseEventName } from '../domain/chat-sse.types';

export function formatChatSseEvent(event: ChatSseEventName, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function formatChatSsePayload(event: ChatSseEvent): string {
  return formatChatSseEvent(event.event, event.data);
}

/** SSE comment heartbeat (spec §4.4 — every 15s during long streams). */
export function formatChatSsePing(): string {
  return ': ping\n\n';
}
