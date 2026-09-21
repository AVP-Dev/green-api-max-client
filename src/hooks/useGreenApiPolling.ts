import { useEffect, useRef, useState } from 'react';
import { GreenApiCredentials, GreenApiLooseBody, PollingStatus } from '../types';
import { GreenApiService } from '../services/greenApi';
import { sanitizePhone } from '../utils/formatters';
import { parseNotification } from '../utils/greenApiSchemas';
import { extractTypingInfo } from '../utils/typing';
import { DEFAULT_POLLING_MS } from '../config';

interface UseGreenApiPollingOptions {
  creds: GreenApiCredentials | null;
  enabled?: boolean;
  pollingIntervalMs?: number;
  onIncomingMessage: (msg: {
    id: string;
    chatId: string;
    senderPhone: string;
    text: string;
    timestamp: number;
    senderName?: string;
    direction?: 'incoming' | 'outgoing';
  }) => void;
  onTyping?: (data: { chatId: string; isTyping: boolean }) => void;
  onReceiptAcknowledged?: (receiptId: number) => void;
  /** Вызывается на каждое полученное уведомление (для диагностики: тип вебхука). */
  onNotification?: (typeWebhook: string, receiptId: number) => void;
}

export function useGreenApiPolling({
  creds,
  enabled = true,
  pollingIntervalMs = DEFAULT_POLLING_MS,
  onIncomingMessage,
  onTyping,
  onReceiptAcknowledged,
  onNotification,
}: UseGreenApiPollingOptions) {
  const [status, setStatus] = useState<PollingStatus>('idle');
  const [lastPollTime, setLastPollTime] = useState<number | null>(null);
  const [lastReceiptId, setLastReceiptId] = useState<number | null>(null);
  const [lastWebhookType, setLastWebhookType] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState<number>(0);

  // Manual trigger ref for instant retry
  const retryTriggerRef = useRef<(() => void) | null>(null);

  // Keep references to latest callbacks so effect doesn't re-trigger continuously
  const incomingMsgRef = useRef(onIncomingMessage);
  incomingMsgRef.current = onIncomingMessage;

  const typingRef = useRef(onTyping);
  typingRef.current = onTyping;

  const ackReceiptRef = useRef(onReceiptAcknowledged);
  ackReceiptRef.current = onReceiptAcknowledged;

  const notificationRef = useRef(onNotification);
  notificationRef.current = onNotification;

  useEffect(() => {
    if (!creds?.idInstance || !creds?.apiTokenInstance || !enabled) {
      setStatus('idle');
      return;
    }

    let isSubscribed = true;
    let abortController = new AbortController();
    let timeoutId: NodeJS.Timeout | null = null;
    let consecutiveErrors = 0;

    const executePollCycle = async () => {
      if (!isSubscribed) return;

      setLastPollTime(Date.now());

      try {
        // 1. Fetch notification via HTTP Long-Polling (5-second timeout on server side)
        const notification = await GreenApiService.receiveNotification(
          creds,
          abortController.signal,
          5
        );

        if (!isSubscribed) return;

        setPollCount((c) => c + 1);
        consecutiveErrors = 0;
        setErrorMessage(null);
        setStatus('active');

        if (notification && notification.receiptId) {
          const { receiptId, body } = notification;
          // Zod-гейт: повреждённое тело подтверждаем (ack) и пропускаем, очередь не виснет.
          if (!parseNotification(notification)) {
            try {
              await GreenApiService.deleteNotification(creds, receiptId, abortController.signal);
            } catch {
              // ignore ack failure — следующий тик повторит
            }
            if (isSubscribed) {
              timeoutId = setTimeout(executePollCycle, pollingIntervalMs);
            }
            return;
          }
          const rawBody = (body || {}) as GreenApiLooseBody;

          const rawTypeWebhook = rawBody.typeWebhook || '';
          // Видимость очереди для диагностики (DevTools + панель «Шлюз и связь»):
          // какой тип вебхука реально приехал последним.
          setLastWebhookType(rawTypeWebhook || '(без типа)');
          notificationRef.current?.(rawTypeWebhook || '', receiptId);
          if (typeof console !== 'undefined' && typeof console.debug === 'function') {
            console.debug('[poll] webhook:', rawTypeWebhook || '(без типа)', `#${receiptId}`);
          }
          const typeWebhookLower = rawTypeWebhook.toLowerCase();
          const bodyTypeLower = String(rawBody.type || '').toLowerCase();

          // Support standard Green-API webhooks, simplified webhooks, and direct journal notifications
          const isIncomingMsg =
            typeWebhookLower === 'incomingmessagereceived' ||
            typeWebhookLower.includes('incoming') ||
            bodyTypeLower === 'incoming';

          const isOutgoingMsg =
            typeWebhookLower === 'outgoingmessagereceived' ||
            typeWebhookLower === 'outgoingapimessagereceived' ||
            typeWebhookLower.includes('outgoing') ||
            bodyTypeLower === 'outgoing';

          // Extract dialogue chatId & sender
          const rawChat =
            rawBody.senderData?.chatId ||
            rawBody.chatId ||
            rawBody.senderId ||
            rawBody.senderData?.sender ||
            rawBody.sender ||
            '';
          const cleanChatId = sanitizePhone(rawChat);

          const rawSender =
            rawBody.senderData?.sender ||
            rawBody.senderId ||
            rawBody.senderData?.chatId ||
            rawBody.sender ||
            '';
          const cleanSender = sanitizePhone(rawSender) || cleanChatId;

          // Extract text from all possible formats (WhatsApp, MAX messenger, journal)
          let text =
            rawBody.messageData?.textMessageData?.textMessage ||
            rawBody.messageData?.extendedTextMessageData?.text ||
            rawBody.messageData?.textMessage ||
            rawBody.messageData?.text ||
            rawBody.textMessage ||
            rawBody.extendedTextMessage?.text ||
            rawBody.message ||
            '';

          // Support attachments (photos, documents, audio, location, contact)
          if (!text && rawBody.messageData?.fileMessageData) {
            const file = rawBody.messageData.fileMessageData;
            text = file.caption || (file.fileName ? `📎 ${file.fileName}` : '📎 [Вложение]');
          } else if (!text && (rawBody.fileMessage || rawBody.fileMessageData)) {
            const file = (rawBody.fileMessage || rawBody.fileMessageData) as
              | { caption?: string; fileName?: string }
              | undefined;
            text = file?.caption || (file?.fileName ? `📎 ${file.fileName}` : '📎 [Вложение]');
          } else if (!text && rawBody.messageData?.locationMessageData) {
            const loc = rawBody.messageData.locationMessageData;
            text = `📍 [Геолокация: ${loc.nameLocation || loc.address || `${loc.latitude}, ${loc.longitude}`}]`;
          } else if (!text && rawBody.messageData?.contactMessageData) {
            text = `👤 [Контакт: ${rawBody.messageData.contactMessageData.displayName || ''}]`;
          } else if (!text && (rawBody.messageData?.typeMessage || rawBody.typeMessage)) {
            text = `[${rawBody.messageData?.typeMessage || rawBody.typeMessage}]`;
          }

          const isGenericValidMsg =
            !isIncomingMsg &&
            !isOutgoingMsg &&
            Boolean(rawBody.idMessage && text && cleanChatId);

          // 2. Incoming or Outgoing Message Notification Processing
          if (rawBody && (isIncomingMsg || isOutgoingMsg || isGenericValidMsg)) {
            if (text && cleanChatId) {
              const messageId =
                rawBody.idMessage ||
                `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
              const timestamp = rawBody.timestamp
                ? (rawBody.timestamp > 1e11 ? rawBody.timestamp : rawBody.timestamp * 1000)
                : Date.now();

              // Receiving a message naturally ends any active typing indicator
              typingRef.current?.({
                chatId: cleanChatId,
                isTyping: false,
              });

              const senderDisplayName =
                rawBody.senderData?.senderContactName ||
                rawBody.senderData?.senderName ||
                rawBody.senderContactName ||
                rawBody.senderName ||
                undefined;

              incomingMsgRef.current({
                id: messageId,
                chatId: cleanChatId,
                senderPhone: cleanSender,
                text,
                timestamp,
                senderName: senderDisplayName,
                direction: isOutgoingMsg ? 'outgoing' : 'incoming',
              });
            }
          }

          // 2b. Incoming Typing & Presence Notifications.
          // NB: GREEN-API не шлёт presence-вебхуки (официальный список типов их
          // не содержит) — ветка заделом на будущее; см. utils/typing.ts.
          const typingInfo = extractTypingInfo(rawBody);
          if (typingInfo) {
            typingRef.current?.(typingInfo);
          }

          // 3. Immediately acknowledge (delete notification) to keep queue flowing
          try {
            await GreenApiService.deleteNotification(creds, receiptId, abortController.signal);
            setLastReceiptId(receiptId);
            ackReceiptRef.current?.(receiptId);
          } catch (delErr) {
            console.warn(`Could not acknowledge receipt ${receiptId}:`, delErr);
          }

          // Drain queue quickly (150ms) if messages were waiting
          if (isSubscribed) {
            timeoutId = setTimeout(executePollCycle, 150);
          }
        } else {
          // Queue is clean and empty: pause for configured interval
          if (isSubscribed) {
            timeoutId = setTimeout(executePollCycle, pollingIntervalMs);
          }
        }
      } catch (err: any) {
        if (!isSubscribed || err.name === 'AbortError') return;

        consecutiveErrors++;
        const errMsg = err?.message || 'Ошибка сети при обращении к шлюзу GREEN-API';
        setErrorMessage(errMsg);
        setStatus(consecutiveErrors > 2 ? 'error' : 'reconnecting');

        // Backoff retry delay
        const delay = Math.min(2000 * Math.pow(1.3, Math.min(consecutiveErrors - 1, 4)), 8000);
        
        if (isSubscribed) {
          timeoutId = setTimeout(executePollCycle, delay);
        }
      }
    };

    // Setup manual retry trigger
    retryTriggerRef.current = () => {
      if (timeoutId) clearTimeout(timeoutId);
      consecutiveErrors = 0;
      setErrorMessage(null);
      setStatus('reconnecting');
      executePollCycle();
    };

    executePollCycle();

    return () => {
      isSubscribed = false;
      retryTriggerRef.current = null;
      abortController.abort();
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [creds?.idInstance, creds?.apiTokenInstance, creds?.apiUrl, enabled, pollingIntervalMs]);

  return {
    status,
    lastPollTime,
    lastReceiptId,
    lastWebhookType,
    errorMessage,
    pollCount,
    retry: () => retryTriggerRef.current?.(),
  };
}
