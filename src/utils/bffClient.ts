/**
 * bffClient.ts — tokenless-клиент BFF-прокси (см. bff/README.md).
 * В BFF-режиме браузер НЕ хранит и НЕ передаёт apiTokenInstance:
 * сервер маппит idInstance -> токен из своего vault.
 */
import { BFF_URL } from '../config';

let routeViaBff = false;

/** Включается из App при settings.bffEnabled && isBffConfigured(). */
export function setBffRouteEnabled(enabled: boolean): void {
  routeViaBff = enabled && BFF_URL.length > 0;
}

export function shouldUseBff(): boolean {
  return routeViaBff && BFF_URL.length > 0;
}

async function bffPost<T>(path: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${BFF_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`BFF ${path} failed (${res.status}): ${text || res.statusText}`);
  }
  return (await res.json()) as T;
}

export async function bffSendMessage(
  idInstance: string,
  chatId: string,
  message: string,
  signal?: AbortSignal
): Promise<{ idMessage: string }> {
  return bffPost('/api/send-message', { idInstance, chatId, message }, signal);
}

export async function bffReceiveNotification(
  idInstance: string,
  receiveTimeoutSeconds = 5,
  signal?: AbortSignal
): Promise<{ receiptId: number; body: Record<string, unknown> } | null> {
  const res = await fetch(
    `${BFF_URL}/api/notification?idInstance=${encodeURIComponent(idInstance)}&timeout=${receiveTimeoutSeconds}`,
    { signal }
  );
  if (!res.ok) {
    if (res.status === 429) throw new Error('Лимит запросов к шлюзу исчерпан (429)');
    if (res.status === 401) throw new Error('BFF: инстанс не настроен на сервере (401)');
    const text = await res.text().catch(() => '');
    throw new Error(`BFF poll failed (${res.status}): ${text || res.statusText}`);
  }
  const text = await res.text().catch(() => '');
  if (!text || !text.trim() || text.trim() === 'null') return null;
  try {
    const data = JSON.parse(text);
    if (!data || typeof data !== 'object' || typeof data.receiptId !== 'number') return null;
    return data as { receiptId: number; body: Record<string, unknown> };
  } catch {
    return null;
  }
}

export async function bffDeleteNotification(
  idInstance: string,
  receiptId: number,
  signal?: AbortSignal
): Promise<{ result: boolean }> {
  try {
    return await bffPost('/api/ack', { idInstance, receiptId }, signal);
  } catch {
    return { result: false };
  }
}
