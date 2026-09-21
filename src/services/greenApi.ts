import { GreenApiCredentials, GreenApiNotification } from '../types';
import { sanitizePhone } from '../utils/formatters';

export const DEFAULT_API_URL = 'https://api.green-api.com';

export function getBaseUrl(creds?: Partial<GreenApiCredentials> | null): string {
  if (creds?.apiUrl && creds.apiUrl.trim()) {
    let url = creds.apiUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }
    return url.replace(/\/+$/, '');
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
    const payload = {
      chatId: `${cleanPhone}@c.us`,
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

    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      // Body was not JSON (e.g. whitespace or empty)
      return null;
    }

    // GREEN-API returns null or object without receiptId when no notification is pending
    if (!data || typeof data !== 'object' || !data.receiptId) {
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

    const rawList: import('../types').GreenApiRawContact[] = await response.json();
    if (!Array.isArray(rawList)) {
      return [];
    }

    const now = Date.now();
    const contactMap = new Map<string, import('../types').Contact>();

    rawList.forEach((item) => {
      if (!item || !item.id) return;
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
          type: item.type || 'user',
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
}
