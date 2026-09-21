import { GreenApiCredentials, GreenApiNotification, GreenApiJournalMessage } from '../types';
import { sanitizePhone } from '../utils/formatters';
import { DEFAULT_API_URL as CONFIG_DEFAULT_API_URL } from '../config';
import { parseJournalList, parseNotification, rawContactSchema } from '../utils/greenApiSchemas';
import { bffDeleteNotification, bffReceiveNotification, bffSendMessage, shouldUseBff } from '../utils/bffClient';

// Re-export единого дефолта из src/config.ts (источник truth + VITE_DEFAULT_API_URL).
export const DEFAULT_API_URL = CONFIG_DEFAULT_API_URL;

/**
 * Allowlist шлюзов GREEN-API.
 * Покрывает api.green-api.com, 3100.api.green-api.com, 7103.api.greenapi.com и т.п.
 */
export const ALLOWED_GATEWAY_PATTERN = /(^|\.)green-api\.com$|(^|\.)greenapi\.com$/;

function isLocalhostHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1';
}

/**
 * Проверяет, принадлежит ли URL доверенному шлюзу (allowlist) либо localhost (для локальной разработки).
 * Возвращает false для любых других хостов, невалидных URL и http-схемы на внешних хостах.
 */
export function isTrustedGatewayUrl(url: string): boolean {
  try {
    validateGatewayUrlOrThrow(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Нормализует и валидирует URL шлюза.
 * - trim; добавляет https:// если схемы нет;
 * - отклоняет http:// на внешних хостах (разрешён только для localhost/127.0.0.1);
 * - отклоняет хосты вне allowlist *.green-api.com / *.greenapi.com (+ localhost для dev).
 * @throws Error с bilingual (RU/EN) сообщением при невалидном URL.
 * @returns нормализованный URL без завершающих слэшей.
 */
export function validateGatewayUrlOrThrow(url: string): string {
  const trimmed = (url || '').trim();
  if (!trimmed) {
    throw new Error('Пустой URL шлюза / Empty gateway URL');
  }
  let normalized = trimmed;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(normalized)) {
    normalized = `https://${normalized}`;
  }
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error(`Некорректный URL шлюза: ${trimmed} / Invalid gateway URL: ${trimmed}`);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(
      `Недопустимая схема URL шлюза (разрешены только https, http для localhost): ${trimmed} / Unsupported gateway URL scheme (https only, http for localhost): ${trimmed}`
    );
  }
  const hostname = parsed.hostname.toLowerCase();
  if (parsed.protocol === 'http:' && !isLocalhostHostname(hostname)) {
    throw new Error(
      `Небезопасная схема http:// запрещена — используйте https://: ${trimmed} / Insecure http:// scheme is forbidden — use https://: ${trimmed}`
    );
  }
  // localhost разрешён только для локальной разработки (http или https)
  if (isLocalhostHostname(hostname)) {
    return normalized.replace(/\/+$/, '');
  }
  if (!ALLOWED_GATEWAY_PATTERN.test(hostname)) {
    throw new Error(
      `Домен шлюза вне allowlist (разрешены только *.green-api.com и *.greenapi.com): ${hostname} / Gateway domain is not allowlisted (only *.green-api.com and *.greenapi.com are allowed): ${hostname}`
    );
  }
  return normalized.replace(/\/+$/, '');
}

export function getBaseUrl(creds?: Partial<GreenApiCredentials> | null): string {
  if (creds?.apiUrl && creds.apiUrl.trim()) {
    try {
      return validateGatewayUrlOrThrow(creds.apiUrl);
    } catch (e) {
      console.warn(
        '[security] Untrusted gateway apiUrl rejected, falling back to default. Токены НЕ будут отправлены на недоверенный хост.',
        creds.apiUrl,
        e
      );
      return DEFAULT_API_URL;
    }
  }
  return DEFAULT_API_URL;
}

/**
 * GreenApi Service Layer tailored specifically for MAX messenger ecosystem.
 * All chatIds are strictly plain numeric phone IDs (no @c.us suffix).
 */
export class GreenApiService {
  /**
   * Validate or check instance connection state
   */
  static async checkInstanceStatus(
    creds: GreenApiCredentials,
    signal?: AbortSignal
  ): Promise<{ stateInstance: string }> {
    const { idInstance, apiTokenInstance } = creds;
    const baseUrl = getBaseUrl(creds);
    const url = `${baseUrl}/waInstance${idInstance.trim()}/getStateInstance/${apiTokenInstance.trim()}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Instance check failed (${response.status}): ${errText || response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Send a text message to a MAX user
   * Payload uses strictly plain numeric phone ID: { chatId: "79991234567", message: text }
   */
  static async sendMessage(
    creds: GreenApiCredentials,
    chatId: string,
    message: string,
    signal?: AbortSignal
  ): Promise<{ idMessage: string }> {
    const { idInstance, apiTokenInstance } = creds;
    const cleanPhone = sanitizePhone(chatId);

    if (!cleanPhone) {
      throw new Error('Invalid recipient phone number');
    }

    // BFF-режим: токен остаётся в vault на сервере, браузер шлёт только idInstance.
    if (shouldUseBff()) {
      return bffSendMessage(idInstance.trim(), cleanPhone, message, signal);
    }

    const baseUrl = getBaseUrl(creds);
    const url = `${baseUrl}/waInstance${idInstance.trim()}/sendMessage/${apiTokenInstance.trim()}`;
    
    // MAX messenger strictly requires plain numeric phone string
    const payload = {
      chatId: cleanPhone,
      message,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Failed to send message (${response.status}): ${errorText || response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Send typing notification to a recipient via GREEN-API
   */
  static async sendTyping(
    creds: GreenApiCredentials,
    chatId: string,
    signal?: AbortSignal
  ): Promise<{ result: boolean }> {
    const { idInstance, apiTokenInstance } = creds;
    const cleanPhone = sanitizePhone(chatId);

    if (!cleanPhone) {
      return { result: false };
    }

    const baseUrl = getBaseUrl(creds);
    const url = `${baseUrl}/waInstance${idInstance.trim()}/sendTyping/${apiTokenInstance.trim()}`;
    // MAX-экосистема требует plain numeric ID без суффиксов (как в sendMessage).
    const payload = {
      chatId: cleanPhone,
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal,
      });

      if (!response.ok) {
        return { result: false };
      }

      return await response.json();
    } catch {
      return { result: false };
    }
  }

  /**
   * Receive single notification from GREEN-API queue (HTTP long-polling)
   * Returns GreenApiNotification object or null when queue is empty.
   * Handles empty body (0 bytes) and 204 gracefully without SyntaxError.
   */
  static async receiveNotification(
    creds: GreenApiCredentials,
    signal?: AbortSignal,
    receiveTimeoutSeconds = 5
  ): Promise<GreenApiNotification | null> {
    const { idInstance, apiTokenInstance } = creds;
    if (shouldUseBff()) {
      return (await bffReceiveNotification(
        idInstance.trim(),
        receiveTimeoutSeconds,
        signal
      )) as GreenApiNotification | null;
    }
    const baseUrl = getBaseUrl(creds);
    const url = `${baseUrl}/waInstance${idInstance.trim()}/receiveNotification/${apiTokenInstance.trim()}?receiveTimeout=${receiveTimeoutSeconds}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal,
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Лимит запросов к GREEN-API исчерпан (429 Too Many Requests)');
      }
      if (response.status === 401) {
        throw new Error('Ошибка авторизации (401): проверьте idInstance и токен');
      }
      const errText = await response.text().catch(() => '');
      throw new Error(`Ошибка опроса очереди (${response.status}): ${errText || response.statusText}`);
    }

    // Safely parse body text — GREEN-API returns empty 0-byte string or "null" when queue has no pending items
    const text = await response.text().catch(() => '');
    if (!text || !text.trim() || text.trim() === 'null') {
      return null;
    }

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      // Body was not JSON (e.g. whitespace or empty)
      return null;
    }

    // GREEN-API returns null or object without receiptId when no notification is pending.
    // Zod-валидация: повреждённые тела без числового receiptId — в null (очередь пуста),
    // с receiptId — возвращаем как есть, хук обработает известное и сделает ack.
    if (!parseNotification(data)) {
      return null;
    }

    return data as GreenApiNotification;
  }

  /**
   * Delete / Acknowledge notification from GREEN-API queue
   * Must be called immediately after receiving any notification to avoid queue freeze.
   */
  static async deleteNotification(
    creds: GreenApiCredentials,
    receiptId: number,
    signal?: AbortSignal
  ): Promise<{ result: boolean }> {
    const { idInstance, apiTokenInstance } = creds;
    if (shouldUseBff()) {
      return bffDeleteNotification(idInstance.trim(), receiptId, signal);
    }
    const baseUrl = getBaseUrl(creds);
    const url = `${baseUrl}/waInstance${idInstance.trim()}/deleteNotification/${apiTokenInstance.trim()}/${receiptId}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.warn(`Failed to acknowledge notification ${receiptId} (${response.status}): ${errText}`);
      return { result: false };
    }

    const text = await response.text().catch(() => '');
    if (!text || !text.trim()) {
      return { result: true };
    }
    try {
      return JSON.parse(text);
    } catch {
      return { result: true };
    }
  }

  /**
   * Get settings of GREEN-API instance (incomingWebhook, outgoingWebhook, webhookUrl, etc.)
   */
  static async getSettings(
    creds: GreenApiCredentials,
    signal?: AbortSignal
  ): Promise<{
    wid?: string;
    incomingWebhook?: string;
    outgoingMessageWebhook?: string;
    outgoingAPIMessageWebhook?: string;
    stateWebhook?: string;
    incomingWebhookUrl?: string;
    webhookUrl?: string;
    webhookUrlToken?: string;
    deviceInfo?: string;
    typeAccount?: string;
  } | null> {
    const { idInstance, apiTokenInstance } = creds;
    const baseUrl = getBaseUrl(creds);
    const url = `${baseUrl}/waInstance${idInstance.trim()}/getSettings/${apiTokenInstance.trim()}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal,
      });

      if (!response.ok) return null;
      const text = await response.text().catch(() => '');
      if (!text || !text.trim()) return null;
      return JSON.parse(text);
    } catch (e) {
      console.warn('Failed to get instance settings:', e);
      return null;
    }
  }

  /**
   * Set settings of GREEN-API instance (enable webhooks, clear external webhookUrl if needed)
   */
  static async setSettings(
    creds: GreenApiCredentials,
    settings: {
      incomingWebhook?: 'yes' | 'no';
      outgoingMessageWebhook?: 'yes' | 'no';
      outgoingAPIMessageWebhook?: 'yes' | 'no';
      stateWebhook?: 'yes' | 'no';
      incomingWebhookUrl?: string;
      webhookUrl?: string;
    },
    signal?: AbortSignal
  ): Promise<{ saveSettings?: boolean } | null> {
    const { idInstance, apiTokenInstance } = creds;
    const baseUrl = getBaseUrl(creds);
    const url = `${baseUrl}/waInstance${idInstance.trim()}/setSettings/${apiTokenInstance.trim()}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
        signal,
      });

      if (!response.ok) return null;
      const text = await response.text().catch(() => '');
      if (!text || !text.trim()) return { saveSettings: true };
      return JSON.parse(text);
    } catch (e) {
      console.warn('Failed to set instance settings:', e);
      return null;
    }
  }

  /**
   * Get count of notifications currently queued in GREEN-API
   */
  static async getWebhooksCount(
    creds: GreenApiCredentials,
    signal?: AbortSignal
  ): Promise<{ countWebhooks: number } | null> {
    const { idInstance, apiTokenInstance } = creds;
    const baseUrl = getBaseUrl(creds);
    const url = `${baseUrl}/waInstance${idInstance.trim()}/getWebhooksCount/${apiTokenInstance.trim()}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal,
      });

      if (!response.ok) return null;
      const text = await response.text().catch(() => '');
      if (!text || !text.trim()) return null;
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  /**
   * Clear notification queue in GREEN-API
   */
  static async clearWebhooksQueue(
    creds: GreenApiCredentials,
    signal?: AbortSignal
  ): Promise<boolean> {
    const { idInstance, apiTokenInstance } = creds;
    const baseUrl = getBaseUrl(creds);
    const url = `${baseUrl}/waInstance${idInstance.trim()}/clearWebhooksQueue/${apiTokenInstance.trim()}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal,
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Reboot instance connection
   */
  static async rebootInstance(
    creds: GreenApiCredentials,
    signal?: AbortSignal
  ): Promise<{ isReboot?: boolean } | null> {
    const { idInstance, apiTokenInstance } = creds;
    const baseUrl = getBaseUrl(creds);
    const url = `${baseUrl}/waInstance${idInstance.trim()}/reboot/${apiTokenInstance.trim()}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal,
      });

      if (!response.ok) return null;
      const text = await response.text().catch(() => '');
      if (!text || !text.trim()) return { isReboot: true };
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  /**
   * Retrieve address book / contacts list from GREEN-API (getContacts)
   * Converts all raw chatIds (e.g. 79991234567@c.us) to clean MAX numeric IDs.
   */
  static async getContacts(
    creds: GreenApiCredentials,
    signal?: AbortSignal
  ): Promise<import('../types').Contact[]> {
    const { idInstance, apiTokenInstance } = creds;
    const baseUrl = getBaseUrl(creds);
    const url = `${baseUrl}/waInstance${idInstance.trim()}/getContacts/${apiTokenInstance.trim()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Failed to fetch contacts (${response.status}): ${errText || response.statusText}`);
    }

    const rawList: unknown = await response.json();
    if (!Array.isArray(rawList)) {
      return [];
    }

    const now = Date.now();
    const contactMap = new Map<string, import('../types').Contact>();

    rawList.forEach((raw) => {
      // Zod-валидация: элементы без id-строки отбрасываются.
      const parsed = rawContactSchema.safeParse(raw);
      if (!parsed.success) return;
      const item = parsed.data;
      const cleanPhone = sanitizePhone(item.id);
      if (!cleanPhone) return;

      const existing = contactMap.get(cleanPhone);
      const contactName = (item.contactName || item.name || '').trim();
      const name = (item.name || '').trim();

      if (!existing) {
        contactMap.set(cleanPhone, {
          id: cleanPhone,
          name: name || undefined,
          contactName: contactName || undefined,
          type: item.type === 'group' ? 'group' : 'user',
          source: 'api',
          updatedAt: now,
        });
      } else {
        // Upgrade with better name if available
        if (contactName && !existing.contactName) {
          existing.contactName = contactName;
        }
        if (name && !existing.name) {
          existing.name = name;
        }
      }
    });

    return Array.from(contactMap.values());
  }

  /**
   * Get detailed contact info including name, contactName, and avatar (getContactInfo)
   */
  static async getContactInfo(
    creds: GreenApiCredentials,
    chatId: string,
    signal?: AbortSignal
  ): Promise<{
    avatar?: string;
    name?: string;
    contactName?: string;
    email?: string;
  } | null> {
    const { idInstance, apiTokenInstance } = creds;
    const cleanPhone = sanitizePhone(chatId);
    if (!cleanPhone) return null;

    const baseUrl = getBaseUrl(creds);
    const url = `${baseUrl}/waInstance${idInstance.trim()}/getContactInfo/${apiTokenInstance.trim()}`;

    try {
      // Try with cleanPhone first (MAX format)
      let response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chatId: cleanPhone }),
        signal,
      });

      // Fallback with @c.us if standard WhatsApp instance requires it
      if (!response.ok && response.status === 400) {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ chatId: `${cleanPhone}@c.us` }),
          signal,
        });
      }

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch {
      return null;
    }
  }

  /**
   * Get avatar for a contact (getAvatar)
   */
  static async getAvatar(
    creds: GreenApiCredentials,
    chatId: string,
    signal?: AbortSignal
  ): Promise<{ urlAvatar: string; available: boolean }> {
    const { idInstance, apiTokenInstance } = creds;
    const cleanPhone = sanitizePhone(chatId);
    if (!cleanPhone) return { urlAvatar: '', available: false };

    const baseUrl = getBaseUrl(creds);
    const url = `${baseUrl}/waInstance${idInstance.trim()}/getAvatar/${apiTokenInstance.trim()}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chatId: cleanPhone }),
        signal,
      });

      if (!response.ok) {
        return { urlAvatar: '', available: false };
      }

      return await response.json();
    } catch {
      return { urlAvatar: '', available: false };
    }
  }

  /**
   * Get last incoming messages for up to specified minutes (default 24h = 1440m)
   * This fetches messages even if webhook queue is empty or messages arrived offline.
   */
  static async getLastIncomingMessages(
    creds: GreenApiCredentials,
    minutes: number = 1440,
    signal?: AbortSignal
  ): Promise<GreenApiJournalMessage[]> {
    const { idInstance, apiTokenInstance } = creds;
    const baseUrl = getBaseUrl(creds);
    const url = `${baseUrl}/waInstance${idInstance.trim()}/lastIncomingMessages/${apiTokenInstance.trim()}?minutes=${minutes}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal,
      });

      if (!response.ok) {
        return [];
      }

      const list: unknown = await response.json();
      return parseJournalList(list) as GreenApiJournalMessage[];
    } catch (e) {
      console.warn('Failed to fetch last incoming messages:', e);
      return [];
    }
  }

  /**
   * Get last outgoing messages for up to specified minutes (default 24h = 1440m)
   */
  static async getLastOutgoingMessages(
    creds: GreenApiCredentials,
    minutes: number = 1440,
    signal?: AbortSignal
  ): Promise<GreenApiJournalMessage[]> {
    const { idInstance, apiTokenInstance } = creds;
    const baseUrl = getBaseUrl(creds);
    const url = `${baseUrl}/waInstance${idInstance.trim()}/lastOutgoingMessages/${apiTokenInstance.trim()}?minutes=${minutes}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal,
      });

      if (!response.ok) {
        return [];
      }

      const list: unknown = await response.json();
      return parseJournalList(list) as GreenApiJournalMessage[];
    } catch (e) {
      console.warn('Failed to fetch last outgoing messages:', e);
      return [];
    }
  }

  /**
   * Get chat history for a specific chat
   */
  static async getChatHistory(
    creds: GreenApiCredentials,
    chatId: string,
    count: number = 100,
    signal?: AbortSignal
  ): Promise<GreenApiJournalMessage[]> {
    const { idInstance, apiTokenInstance } = creds;
    const cleanPhone = sanitizePhone(chatId);
    if (!cleanPhone) return [];

    const baseUrl = getBaseUrl(creds);
    const url = `${baseUrl}/waInstance${idInstance.trim()}/getChatHistory/${apiTokenInstance.trim()}`;

    try {
      // First attempt with clean numeric phone (MAX format)
      let response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: cleanPhone, count }),
        signal,
      });

      // Fallback with @c.us if standard instance
      if (!response.ok && response.status === 400) {
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId: `${cleanPhone}@c.us`, count }),
          signal,
        });
      }

      if (!response.ok) {
        return [];
      }

      const list: unknown = await response.json();
      return parseJournalList(list) as GreenApiJournalMessage[];
    } catch (e) {
      console.warn('Failed to fetch chat history:', e);
      return [];
    }
  }

  /**
   * Fetches recent chats list with contact names from GREEN-API
   */
  static async getChats(
    creds: GreenApiCredentials,
    count: number = 50,
    signal?: AbortSignal
  ): Promise<Array<{ id: string; name?: string }>> {
    const { idInstance, apiTokenInstance } = creds;
    const baseUrl = getBaseUrl(creds);
    const url = `${baseUrl}/waInstance${idInstance.trim()}/getChats/${apiTokenInstance.trim()}?count=${count}`;

    try {
      const response = await fetch(url, { signal });
      if (!response.ok) return [];
      const list = await response.json();
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }
}
