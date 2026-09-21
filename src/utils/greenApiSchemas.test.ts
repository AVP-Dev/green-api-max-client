import { describe, expect, it } from 'vitest';
import { parseJournalList, parseNotification } from './greenApiSchemas';

describe('parseNotification', () => {
  it('accepts receiptId + body', () => {
    expect(parseNotification({ receiptId: 12, body: { typeWebhook: 'incomingMessageReceived' } })).not.toBeNull();
  });

  it('rejects missing/non-numeric receiptId', () => {
    expect(parseNotification({ body: {} })).toBeNull();
    expect(parseNotification({ receiptId: '12', body: {} })).toBeNull();
    expect(parseNotification(null)).toBeNull();
  });
});

describe('parseJournalList', () => {
  it('keeps valid items and drops garbage', () => {
    const out = parseJournalList([
      { idMessage: 'a', textMessage: 'hi' },
      'garbage',
      42,
      null,
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]?.idMessage).toBe('a');
  });

  it('returns [] for non-arrays', () => {
    expect(parseJournalList({})).toEqual([]);
  });
});
