import { describe, expect, it } from 'vitest';
import { extractTypingInfo } from './typing';

describe('extractTypingInfo', () => {
  it('parses presence typing webhook', () => {
    expect(
      extractTypingInfo({
        typeWebhook: 'presenceChanged',
        presenceData: { chatId: '79991234567@c.us', presence: 'typing' },
      })
    ).toEqual({ chatId: '79991234567', isTyping: true });
  });

  it('maps paused presence to isTyping=false', () => {
    expect(
      extractTypingInfo({
        typeWebhook: 'presenceChanged',
        presenceData: { chatId: '79991234567', presence: 'paused' },
      })
    ).toEqual({ chatId: '79991234567', isTyping: false });
  });

  it('returns null for message bodies and garbage', () => {
    expect(
      extractTypingInfo({ typeWebhook: 'incomingMessageReceived', chatId: '79991234567' })
    ).toBeNull();
    expect(extractTypingInfo(null)).toBeNull();
    expect(extractTypingInfo({})).toBeNull();
  });
});
