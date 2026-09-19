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
   * Returns GreenApiNotification object or null when queue is empty
   */
  static async receiveNotification(
    creds: GreenApiCredentials,
    signal?: AbortSignal
  ): Promise<GreenApiNotification | null> {
    const { idInstance, apiTokenInstance } = creds;
    const baseUrl = getBaseUrl(creds);
    const url = `${baseUrl}/waInstance${idInstance.trim()}/receiveNotification/${apiTokenInstance.trim()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal,
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Rate limit exceeded (429)');
      }
      const errText = await response.text().catch(() => '');
      throw new Error(`Failed to poll notification (${response.status}): ${errText || response.statusText}`);
    }

    const data = await response.json();
    // GREEN-API returns null or empty body when no notification is pending
    if (!data || !data.receiptId) {
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

    return await response.json();
  }
}
