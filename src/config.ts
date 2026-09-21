/**
 * config.ts — единый источник truth для настроек приложения.
 *
 * Все магические числа/ключи/дефолты живут здесь, а не разбросаны
 * по компонентам. Переменные VITE_* вшиваются Vite на этапе BUILD
 * (не runtime!), поэтому для Docker они пробрасываются через
 * build.args (см. Dockerfile + docker-compose.yml).
 */

export const APP_NAME = 'MAX Web Messenger';
export const APP_VERSION = '1.2.0';

/** Максимальная длина одного сообщения (лимит мессенджера, защита от DoS/API-abuse). */
export const MAX_MESSAGE_LENGTH = 4096;

/** Лимиты локального хранилища — защита от QuotaExceededError. */
export const MESSAGE_RETENTION_LIMIT = 3000;
export const DIALOG_RETENTION_LIMIT = 300;

/** Шлюз GREEN-API по умолчанию. Может быть переопределён через VITE_DEFAULT_API_URL на этапе сборки. */
export const DEFAULT_API_URL =
  (import.meta.env.VITE_DEFAULT_API_URL as string | undefined)?.trim() ||
  'https://3100.api.green-api.com';

/** Trusted parent origins для postMessage-моста (comma-separated, build-time). */
export function getBuildTimeTrustedOrigins(): string {
  return ((import.meta.env.VITE_TRUSTED_PARENT_ORIGINS as string | undefined) || '').trim();
}

/** Допустимые интервалы опроса очереди (мс). */
export const POLLING_OPTIONS = [1000, 2000, 5000] as const;
export const DEFAULT_POLLING_MS = 2000;

/**
 * BFF (Backend for Frontend) — опциональный прокси для multi-user продакшена.
 * Когда задан VITE_BFF_URL, клиент может слать send/receive/ack БЕЗ токена:
 * токен хранится в vault на BFF-сервере (см. bff/README.md).
 * Build-time, как и остальные VITE_* (docker-compose build.args).
 */
export const BFF_URL =
  ((import.meta.env.VITE_BFF_URL as string | undefined) || '').trim().replace(/\/+$/, '');

export function isBffConfigured(): boolean {
  return BFF_URL.length > 0;
}

/** Фоновая сверка журнала тяжелее очереди: минимум 5с на активной вкладке, 10с в фоне. */
export const BG_SYNC_MIN_ACTIVE_MS = 5000;
export const BG_SYNC_MIN_HIDDEN_MS = 10000;

/** Ключи localStorage/sessionStorage. */
export const STORAGE_KEYS = {
  CREDS: 'max_messenger_creds',
  ACTIVE_CHAT: 'max_messenger_active_chat',
  DIALOGS: 'max_messenger_dialogs',
  MESSAGES: 'max_messenger_messages',
  LANG: 'max_messenger_lang',
  SETTINGS: 'max_messenger_settings',
  CONTACTS: 'max_messenger_contacts',
  LAST_SYNC: 'max_messenger_last_sync',
  QUICK_REPLIES: 'max_messenger_quick_replies',
} as const;

/** Санитизация интервала из (возможно битого) localStorage. */
export function sanitizePollingInterval(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if ((POLLING_OPTIONS as readonly number[]).includes(n)) return n;
  return DEFAULT_POLLING_MS;
}
