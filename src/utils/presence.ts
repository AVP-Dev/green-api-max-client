import type { ChatMessage, Language } from '../types';
import { translations } from '../i18n/translations';
import { formatMessageTime } from './formatters';

/**
 * presence.ts — честный статус собеседника как в больших мессенджерах.
 *
 * Проблема: GREEN-API (MAX/WhatsApp) НЕ отдаёт реальный online/lastSeen —
 * нет ни поля в getContacts/getContactInfo, ни presence-вебхуков.
 * Поэтому старый код всегда рисовал фейковое «в сети».
 *
 * Правило (как в Telegram/WhatsApp/MAX, но без вранья):
 * - «в сети» — только если входящее сообщение было < ONLINE_THRESHOLD_MS назад
 *   (человек только что писал — точно был в сети) или идёт typing-событие;
 * - «был(а) недавно» — активность < RECENTLY_THRESHOLD_MS назад;
 * - «был(а) сегодня/вчера/дата в HH:MM» — по времени последнего ВХОДЯЩЕГО;
 * - «пользователь MAX» — входящих не было вообще (мы не знаем, когда человек был);
 * - для групп — «группа», без online.
 *
 * Важно: считаются только incoming-сообщения. Наши исходящие ничего
 * не говорят об активности собеседника.
 */

export const ONLINE_THRESHOLD_MS = 90 * 1000;
export const RECENTLY_THRESHOLD_MS = 60 * 60 * 1000;

export type PresenceKind =
  | 'online'
  | 'recently'
  | 'today'
  | 'yesterday'
  | 'date'
  | 'unknown'
  | 'group';

export interface PresenceInfo {
  kind: PresenceKind;
  text: string;
  isOnline: boolean;
  /** true, когда входящих не было — статус неизвестен, врать «в сети» нельзя. */
  isUnknown: boolean;
  lastIncomingAt: number | null;
}

/** Максимальный timestamp среди входящих — единственное честное «был в сети». */
export function getLastIncomingTimestamp(
  messages: Pick<ChatMessage, 'timestamp' | 'direction'>[]
): number | null {
  let last: number | null = null;
  for (const m of messages) {
    if (m.direction !== 'incoming') continue;
    if (typeof m.timestamp !== 'number' || !Number.isFinite(m.timestamp)) continue;
    if (last === null || m.timestamp > last) last = m.timestamp;
  }
  return last;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

export function formatLastSeen(
  lastIncomingAt: number | null,
  lang: Language,
  nowMs: number = Date.now()
): PresenceInfo {
  const t = translations[lang];

  if (lastIncomingAt === null || lastIncomingAt === undefined) {
    return { kind: 'unknown', text: t.maxUser, isOnline: false, isUnknown: true, lastIncomingAt: null };
  }

  const diff = Math.max(0, nowMs - lastIncomingAt);
  if (diff <= ONLINE_THRESHOLD_MS) {
    return { kind: 'online', text: t.online, isOnline: true, isUnknown: false, lastIncomingAt };
  }
  if (diff <= RECENTLY_THRESHOLD_MS) {
    return { kind: 'recently', text: t.lastSeenRecently, isOnline: false, isUnknown: false, lastIncomingAt };
  }

  const seen = new Date(lastIncomingAt);
  const now = new Date(nowMs);
  const time = formatMessageTime(lastIncomingAt);

  if (isSameDay(seen, now)) {
    return {
      kind: 'today',
      text: fill(t.lastSeenToday, { time }),
      isOnline: false,
      isUnknown: false,
      lastIncomingAt,
    };
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(seen, yesterday)) {
    return {
      kind: 'yesterday',
      text: fill(t.lastSeenYesterday, { time }),
      isOnline: false,
      isUnknown: false,
      lastIncomingAt,
    };
  }

  const locale = lang === 'ru' ? 'ru-RU' : 'en-US';
  const sameYear = seen.getFullYear() === now.getFullYear();
  const date = seen.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' as const }),
  });
  return {
    kind: 'date',
    text: fill(t.lastSeenDate, { date, time }),
    isOnline: false,
    isUnknown: false,
    lastIncomingAt,
  };
}

/** Верхнеуровневый хелпер для шапки чата: группы + unknown + lastSeen. */
export function getPresenceInfo(
  opts: {
    messages: Pick<ChatMessage, 'timestamp' | 'direction'>[];
    contactType?: string;
    lang: Language;
    nowMs?: number;
  }
): PresenceInfo {
  const t = translations[opts.lang];
  if (opts.contactType === 'group') {
    return { kind: 'group', text: t.groupStatus, isOnline: false, isUnknown: false, lastIncomingAt: null };
  }
  return formatLastSeen(getLastIncomingTimestamp(opts.messages), opts.lang, opts.nowMs ?? Date.now());
}
