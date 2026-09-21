/**
 * postMessageSecurity.ts
 *
 * OWASP-совместимые хелперы для безопасного postMessage-моста между
 * MAX Web Messenger (iframe) и родительским окном (CRM / портал).
 *
 * Правила (OWASP HTML5 Security Cheat Sheet, раздел postMessage):
 *  1. Никогда не использовать targetOrigin '*' в продакшене — только точный origin.
 *  2. Проверять event.origin входящего сообщения по allowlist доверенных origins.
 *  3. Валидировать структуру и типы event.data ({ type, payload }).
 *
 * Доверенные origins родителя настраиваются двумя способами:
 *  - query-параметр URL виджета:  ?parentOrigin=https://crm.example.com
 *  - env-переменная сборки (comma-separated):
 *      VITE_TRUSTED_PARENT_ORIGINS=https://crm.example.com,https://portal.example.com
 */

/** Максимальная длина строковых полей payload (защита от DoS через гигантские строки). */
export const MAX_PAYLOAD_STRING_LENGTH = 5000;

/** Команды, которые виджет принимает от родительского окна. Всё остальное отбрасывается. */
export const ALLOWED_INCOMING_TYPES = [
  'MAX_OPEN_CHAT',
  'MAX_SEND_MESSAGE',
  'MAX_SYNC_CONTACTS',
  'MAX_SET_CREDS',
] as const;

export type AllowedIncomingType = (typeof ALLOWED_INCOMING_TYPES)[number];

function isLocalhostHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1';
}

/** Нормализовать строку-кандидат в origin вида `scheme://host[:port]`. Вернёт null если невалидно. */
function normalizeOrigin(candidate: string): string | null {
  const trimmed = candidate.trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    // http разрешён только для localhost (локальная разработка).
    // Внешний http запрещён — защита от MITM при встраивании виджета.
    if (url.protocol === 'http:' && !isLocalhostHostname(url.hostname)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function isProd(): boolean {
  try {
    return typeof import.meta !== 'undefined' && (import.meta as any).env?.PROD === true;
  } catch {
    return false;
  }
}

/**
 * Доверенные origins родительского окна.
 * Источники: ?parentOrigin= в URL + VITE_TRUSTED_PARENT_ORIGINS (comma-separated).
 * Пустой массив = allowlist не настроен (режим обратной совместимости).
 */
export function getTrustedParentOrigins(): string[] {
  const collected: string[] = [];

  if (typeof window !== 'undefined') {
    try {
      const param = new URLSearchParams(window.location.search).get('parentOrigin');
      if (param) {
        for (const part of param.split(',')) {
          const origin = normalizeOrigin(part);
          if (origin) collected.push(origin);
        }
      }
    } catch {
      // ignore malformed URL — env allowlist всё равно будет учтён ниже
    }
  }

  const envRaw = import.meta.env.VITE_TRUSTED_PARENT_ORIGINS as string | undefined;
  if (typeof envRaw === 'string' && envRaw.trim()) {
    for (const part of envRaw.split(',')) {
      const origin = normalizeOrigin(part);
      if (origin) collected.push(origin);
    }
  }

  return [...new Set(collected)];
}

/** Настроен ли allowlist доверенных origins (хотя бы один источник). */
export function hasTrustedOriginsConfigured(): boolean {
  return getTrustedParentOrigins().length > 0;
}

/**
 * Проверка origin входящего сообщения по allowlist.
 * Fail-closed в production: если allowlist пуст — недоверяем всем.
 * Fail-open только в dev для обратной совместимости (caller обязан залогировать warn).
 */
export function isTrustedOrigin(origin: string): boolean {
  if (typeof origin !== 'string' || !origin) return false;
  const trusted = getTrustedParentOrigins();
  if (trusted.length === 0) return !isProd();
  return trusted.includes(origin);
}

/** True, когда allowlist не настроен, но мы в dev и временно принимаем всех. */
export function isInsecureDevFallback(): boolean {
  return getTrustedParentOrigins().length === 0 && !isProd();
}

/** Origin из document.referrer, только если это https (защита от утечки в http). */
function getReferrerOrigin(): string | null {
  if (typeof document === 'undefined' || !document.referrer) return null;
  try {
    const url = new URL(document.referrer);
    if (url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Безопасная отправка сообщения родителю: только в доверенные origins.
 * В production без allowlist — НЕ отправляем ничего (fail-closed, защита от утечки
 * текстов сообщений и метаданных в неизвестный родитель).
 * В dev сохранён fallback для обратной совместимости:
 *  1) https-origin из document.referrer, если есть;
 *  2) '*' с console.warn (явный сигнал настроить parentOrigin / env).
 */
export function safePostToParent(message: unknown): void {
  if (typeof window === 'undefined' || !window.parent || window.parent === window) return;
  if (!message || typeof message !== 'object') return;

  const trusted = getTrustedParentOrigins();
  if (trusted.length > 0) {
    for (const origin of trusted) {
      window.parent.postMessage(message, origin);
    }
    return;
  }

  if (isProd()) {
    console.warn(
      '[postMessage] Dropped outbound message: trusted parent origins not configured. ' +
        'Pass ?parentOrigin=https://your-crm.example.com in the iframe URL or set ' +
        'VITE_TRUSTED_PARENT_ORIGINS.'
    );
    return;
  }

  const referrerOrigin = getReferrerOrigin();
  if (referrerOrigin) {
    window.parent.postMessage(message, referrerOrigin);
    return;
  }

  console.warn(
    '[postMessage] Trusted parent origins not configured. ' +
      'Pass ?parentOrigin=https://your-crm.example.com in the iframe URL or set ' +
      'VITE_TRUSTED_PARENT_ORIGINS. Falling back to "*" for backward compatibility (dev only).'
  );
  window.parent.postMessage(message, '*');
}

interface IncomingBridgeMessage {
  type: AllowedIncomingType;
  payload?: unknown;
}

/**
 * Проверка входящего MessageEvent: origin по allowlist + структура data { type, payload }.
 * Тип обязан входить в ALLOWED_INCOMING_TYPES, payload (если есть) — plain object.
 */
export function validateIncomingMessage(event: MessageEvent): event is MessageEvent & {
  data: IncomingBridgeMessage;
} {
  if (!event || typeof event.origin !== 'string') return false;
  if (!isTrustedOrigin(event.origin)) return false;

  const data = event.data as Partial<IncomingBridgeMessage> | null | undefined;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  if (typeof data.type !== 'string' || !ALLOWED_INCOMING_TYPES.includes(data.type as AllowedIncomingType)) {
    return false;
  }
  if (data.payload !== undefined) {
    if (!data.payload || typeof data.payload !== 'object' || Array.isArray(data.payload)) return false;
  }
  return true;
}

/**
 * Валидация строкового поля payload: обязана быть строкой в пределах maxLength.
 * Возвращает trimmed строку или null (невалидно / слишком длинно / пусто).
 */
export function toSafePayloadString(value: unknown, maxLength: number = MAX_PAYLOAD_STRING_LENGTH): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLength) return null;
  return trimmed;
}
