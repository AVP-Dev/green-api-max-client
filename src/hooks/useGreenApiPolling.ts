import { useEffect, useRef, useState } from 'react';
import { GreenApiCredentials, PollingStatus } from '../types';
import { GreenApiService } from '../services/greenApi';
import { sanitizePhone } from '../utils/formatters';

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
}

export function useGreenApiPolling({
  creds,
  enabled = true,
  pollingIntervalMs = 2000,
  onIncomingMessage,
  onTyping,
  onReceiptAcknowledged,
}: UseGreenApiPollingOptions) {
  const [status, setStatus] = useState<PollingStatus>('idle');
  const [lastPollTime, setLastPollTime] = useState<number | null>(null);
  const [lastReceiptId, setLastReceiptId] = useState<number | null>(null);
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

          const typeWebhook = body?.typeWebhook || '';
          const isIncomingMsg = typeWebhook === 'incomingMessageReceived';
          const isOutgoingMsg =
            typeWebhook === 'outgoingMessageReceived' ||
            typeWebhook === 'outgoingAPIMessageReceived';

          // 2. Incoming or Outgoing Message Notification Processing
          if (body && (isIncomingMsg || isOutgoingMsg)) {
            // Extract text from textMessageData or extendedTextMessageData
            let text =
              body.messageData?.textMessageData?.textMessage ||
              body.messageData?.extendedTextMessageData?.text ||
              '';

            // Support attachments (photos, documents, audio, location, contact)
            if (!text && body.messageData?.fileMessageData) {
              const file = body.messageData.fileMessageData;
              text = file.caption || (file.fileName ? `📎 ${file.fileName}` : '📎 [Вложение]');
            } else if (!text && body.messageData?.locationMessageData) {
              const loc = body.messageData.locationMessageData;
              text = `📍 [Геолокация: ${loc.nameLocation || loc.address || `${loc.latitude}, ${loc.longitude}`}]`;
            } else if (!text && body.messageData?.contactMessageData) {
              text = `👤 [Контакт: ${body.messageData.contactMessageData.displayName || ''}]`;
            } else if (!text && body.messageData?.typeMessage) {
              text = `[${body.messageData.typeMessage}]`;
            }

            // Identify dialogue chatId:
            // For incoming messages: chatId is who sent it
            // For outgoing messages: chatId is who it was sent to
            const rawChat =
              body.senderData?.chatId ||
              body.chatId ||
              body.senderData?.sender ||
              '';
            const cleanChatId = sanitizePhone(rawChat);

            const rawSender =
              body.senderData?.sender ||
              body.senderData?.chatId ||
              body.sender ||
              '';
            const cleanSender = sanitizePhone(rawSender) || cleanChatId;

            if (text && cleanChatId) {
              const messageId =
                body.idMessage ||
                `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
              const timestamp = body.timestamp ? body.timestamp * 1000 : Date.now();

              // Receiving a message naturally ends any active typing indicator
              typingRef.current?.({
                chatId: cleanChatId,
                isTyping: false,
              });

              const senderDisplayName =
                body.senderData?.senderContactName ||
                body.senderData?.senderName ||
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

          // 2b. Incoming Typing & Presence Notifications
          if (body) {
            const typeWebhookLower = (body.typeWebhook || '').toLowerCase();
            const isPresenceOrTypingWebhook =
              typeWebhookLower.includes('presence') ||
              typeWebhookLower.includes('typing');

            const rawChat =
              body.chatId ||
              body.presenceData?.chatId ||
              body.chatData?.chatId ||
              body.senderData?.chatId ||
              body.senderData?.sender ||
              '';
            const cleanPresenceChatId = sanitizePhone(rawChat);

            const presenceVal = String(
              body.presence ||
              body.presenceData?.presence ||
              body.status ||
              body.state ||
              ''
            ).toLowerCase();

            if (
              cleanPresenceChatId &&
              (isPresenceOrTypingWebhook ||
                presenceVal.includes('typing') ||
                presenceVal.includes('composing') ||
                presenceVal.includes('recording'))
            ) {
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

              typingRef.current?.({
                chatId: cleanPresenceChatId,
                isTyping: isTypingNow,
              });
            }
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
    errorMessage,
    pollCount,
    retry: () => retryTriggerRef.current?.(),
  };
}
