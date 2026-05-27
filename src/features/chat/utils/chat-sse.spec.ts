import { formatChatSsePing } from './chat-sse';

describe('chat-sse utils', () => {
  it('formatChatSsePing returns SSE comment heartbeat', () => {
    expect(formatChatSsePing()).toBe(': ping\n\n');
  });
});
