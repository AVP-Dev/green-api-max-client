import { describe, it, expect } from 'vitest';
import {
  getLastIncomingTimestamp,
  formatLastSeen,
  getPresenceInfo,
  ONLINE_THRESHOLD_MS,
} from './presence';

describe('presence (как в больших мессенджерах)', () => {
  it('игнорирует исходящие: без входящих — unknown, без фейкового online', () => {
    const ts = getLastIncomingTimestamp([
      { timestamp: Date.now(), direction: 'outgoing' },
    ]);
    expect(ts).toBeNull();

    const p = formatLastSeen(null, 'ru', Date.now());
    expect(p.kind).toBe('unknown');
    expect(p.isOnline).toBe(false);
    expect(p.text).toBe('пользователь MAX');
  });

  it('свежее входящее — в сети', () => {
    const now = Date.now();
    const p = formatLastSeen(now - 10_000, 'ru', now);
    expect(p.kind).toBe('online');
    expect(p.isOnline).toBe(true);
    expect(p.text).toBe('в сети');
  });

  it('online гаснет после порога', () => {
    const now = Date.now();
    const p = formatLastSeen(now - ONLINE_THRESHOLD_MS - 1000, 'ru', now);
    expect(p.isOnline).toBe(false);
    expect(p.kind).not.toBe('online');
  });

  it('давняя активность — сегодня/вчера/дата', () => {
    const now = new Date('2026-09-21T18:00:00').getTime();
    const todayMorning = new Date('2026-09-21T09:15:00').getTime();
    expect(formatLastSeen(todayMorning, 'ru', now).text).toContain('сегодня');

    const yesterday = new Date('2026-09-20T22:10:00').getTime();
    expect(formatLastSeen(yesterday, 'ru', now).text).toContain('вчера');

    const old = new Date('2026-09-10T12:00:00').getTime();
    const dated = formatLastSeen(old, 'ru', now);
    expect(dated.kind).toBe('date');
    expect(dated.text).toContain('12:00');
  });

  it('группа не показывает online', () => {
    const now = Date.now();
    const p = getPresenceInfo({
      messages: [{ timestamp: now - 1000, direction: 'incoming' }],
      contactType: 'group',
      lang: 'ru',
      nowMs: now,
    });
    expect(p.kind).toBe('group');
    expect(p.isOnline).toBe(false);
  });

  it('en-локализация работает', () => {
    const now = Date.now();
    expect(formatLastSeen(now - 5000, 'en', now).text).toBe('online');
    expect(formatLastSeen(null, 'en', now).text).toBe('MAX user');
  });
});
