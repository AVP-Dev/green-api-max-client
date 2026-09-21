import type { GreenApiCredentials } from '../types';
import { safeStorage } from './storage';
import { STORAGE_KEYS } from '../config';

/**
 * Безопасное хранение кредов GREEN-API.
 *
 * Проблема: idInstance + apiTokenInstance в localStorage живут вечно
 * и доступны любому скрипту при XSS. Полностью убрать риск в pure-frontend
 * нельзя (бэкенда нет), но можно дать выбор:
 *  - persistent=true  -> localStorage (переживает перезапуск, как раньше);
 *  - persistent=false -> sessionStorage (стирается при закрытии вкладки).
 *
 * Ключ один и тот же для обратной совместимости со старыми установками.
 */
export const CREDS_KEY = STORAGE_KEYS.CREDS;

const sessionMemory: Record<string, string> = {};

function sessionGet(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return window.sessionStorage.getItem(key);
    }
  } catch {
    // sessionStorage недоступен (iframe/incognito) — memory fallback
  }
  return sessionMemory[key] ?? null;
}

function sessionSet(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(key, value);
      return;
    }
  } catch {
    // ignore
  }
  sessionMemory[key] = value;
}

function sessionRemove(key: string): void {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
  delete sessionMemory[key];
}

function parseCreds(raw: string | null): GreenApiCredentials | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.idInstance !== 'string' || typeof parsed.apiTokenInstance !== 'string') {
      return null;
    }
    if (!parsed.idInstance.trim() || !parsed.apiTokenInstance.trim()) return null;
    return parsed as GreenApiCredentials;
  } catch {
    return null;
  }
}

/** Загрузить креды: сначала localStorage (persistent), затем sessionStorage. */
export function loadCreds(): GreenApiCredentials | null {
  return parseCreds(safeStorage.getItem(CREDS_KEY)) ?? parseCreds(sessionGet(CREDS_KEY));
}

/** True, если креды лежат в persistent-хранилище (localStorage). */
export function isCredsPersistent(): boolean {
  return parseCreds(safeStorage.getItem(CREDS_KEY)) !== null;
}

/**
 * Сохранить креды.
 * При persistent=false чистим localStorage-копию, чтобы не оставалось двух копий токена.
 */
export function saveCreds(creds: GreenApiCredentials, persistent: boolean): void {
  const raw = JSON.stringify(creds);
  if (persistent) {
    sessionRemove(CREDS_KEY);
    safeStorage.setItem(CREDS_KEY, raw);
  } else {
    safeStorage.removeItem(CREDS_KEY);
    sessionSet(CREDS_KEY, raw);
  }
}

/** Удалить креды из обоих хранилищ (использовать при SignOut). */
export function clearCreds(): void {
  safeStorage.removeItem(CREDS_KEY);
  sessionRemove(CREDS_KEY);
}
