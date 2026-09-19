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

      setStatus((prev) => (prev === 'error' ? 'reconnecting' : 'active'));
      setLastPollTime(Date.now());

      try {
        // 1. Fetch notification via HTTP Long-Polling
        const notification = await GreenApiService.receiveNotification(
          creds,
          abortController.signal
        );

        if (!isSubscribed) return;

        setPollCount((c) => c + 1);
        consecutiveErrors = 0;
        setErrorMessage(null);

        if (notification && notification.receiptId) {
          const { receiptId, body } = notification;

          // 2. Incoming Notification Processing
          if (body && body.typeWebhook === 'incomingMessageReceived') {
            // Extract text from textMessageData or extendedTextMessageData
            const text =
              body.messageData?.textMessageData?.textMessage ||
              body.messageData?.extendedTextMessageData?.text ||
              '';

            // Identify sender phone / senderId
            const rawSender =
              body.senderData?.chatId ||
              body.senderData?.sender ||
              '';
            const cleanSenderPhone = sanitizePhone(rawSender);

            if (text && cleanSenderPhone) {
              const messageId =
                body.idMessage ||
                `in_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
              const timestamp = (body.timestamp ? body.timestamp * 1000 : Date.now());

              // Receiving an incoming message naturally ends any active typing state
              typingRef.current?.({
                chatId: cleanSenderPhone,
                isTyping: false,
              });

              incomingMsgRef.current({
                id: messageId,
                chatId: cleanSenderPhone,
                senderPhone: cleanSenderPhone,
                text,
                timestamp,
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

          // If there was a notification, next poll quickly (300ms) to drain any backlog
          if (isSubscribed) {
            timeoutId = setTimeout(executePollCycle, 300);
          }
        } else {
          // Queue is empty: wait configurable delay (default 2000ms)
          if (isSubscribed) {
            timeoutId = setTimeout(executePollCycle, pollingIntervalMs);
          }
        }
      } catch (err: any) {
        if (!isSubscribed || err.name === 'AbortError') return;

        consecutiveErrors++;
        const errMsg = err?.message || 'Network error occurred during polling';
        setErrorMessage(errMsg);
        setStatus(consecutiveErrors > 2 ? 'error' : 'reconnecting');

        // Safeguard: 2-3 second delay / exponential backoff on network failure
        const delay = Math.min(2500 * Math.pow(1.4, Math.min(consecutiveErrors - 1, 4)), 10000);
        
        if (isSubscribed) {
          timeoutId = setTimeout(executePollCycle, delay);
        }
      }
    };

    executePollCycle();

    return () => {
      isSubscribed = false;
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
  };
}
