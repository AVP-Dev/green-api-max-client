/**
 * typing.ts — чистая логика извлечения статуса печати из тела вебхука.
 *
 * ВАЖНО (проверено по официальным докам GREEN-API, раздел type-webhook):
 * входящего presence/typing вебхука НЕ СУЩЕСТВУЕТ — сервер шлёт только
 * incoming/outgoing-сообщения, статусы, звонки и состояния инстанса.
 * Поэтому «собеседник печатает» из сети приехать не может; этот парсер —
 * задел на будущее (MAX-инстансы) + покрытие кнопкой «Тест: собеседник
 * печатает» в меню чата. Исходящий typing работает через sendTyping.
 */
import type { GreenApiLooseBody } from '../types';
import { sanitizePhone } from './formatters';

export interface TypingInfo {
  chatId: string;
  isTyping: boolean;
}

/** Извлекает { chatId, isTyping } из тела уведомления либо null (не typing-событие). */
export function extractTypingInfo(body: GreenApiLooseBody | null | undefined): TypingInfo | null {
  if (!body || typeof body !== 'object') return null;

  const typeWebhookLower = (body.typeWebhook || '').toLowerCase();
  const isPresenceOrTypingWebhook =
    typeWebhookLower.includes('presence') || typeWebhookLower.includes('typing');

  const rawChat =
    body.chatId ||
    body.presenceData?.chatId ||
    body.chatData?.chatId ||
    body.senderData?.chatId ||
    body.senderData?.sender ||
    '';
  const cleanPresenceChatId = sanitizePhone(rawChat);

  const presenceVal = String(
    body.presence || body.presenceData?.presence || body.status || body.state || ''
  ).toLowerCase();

  if (
    !cleanPresenceChatId ||
    !(
      isPresenceOrTypingWebhook ||
      presenceVal.includes('typing') ||
      presenceVal.includes('composing') ||
      presenceVal.includes('recording')
    )
  ) {
    return null;
  }

  const isTypingNow =
    presenceVal === 'typing' ||
    presenceVal === 'composing' ||
    presenceVal === 'recording' ||
    presenceVal === 'recording_audio' ||
    typeWebhookLower.includes('typing') ||
    (isPresenceOrTypingWebhook &&
      presenceVal !== 'paused' &&
      presenceVal !== 'stop' &&
      presenceVal !== 'available' &&
      presenceVal !== 'offline');

  return { chatId: cleanPresenceChatId, isTyping: isTypingNow };
}
