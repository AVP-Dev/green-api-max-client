import React, { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from 'react';
import {
  GreenApiCredentials,
  ChatMessage,
  ChatDialog,
  Language,
  AppSettings,
  Contact,
  QuickReply,
} from './types';
import { AuthScreen } from './components/AuthScreen';
import { Sidebar } from './components/Sidebar';
import { ChatView } from './components/ChatView';
import { getDefaultQuickReplies } from './utils/quickReplies';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PopupNotification, PopupNotificationData } from './components/PopupNotification';

// Тяжёлые модалки грузим лениво, чтобы уменьшить стартовый бандл (был 573kB).
const NewChatModal = lazy(() =>
  import('./components/NewChatModal').then((m) => ({ default: m.NewChatModal }))
);
const SettingsModal = lazy(() =>
  import('./components/SettingsModal').then((m) => ({ default: m.SettingsModal }))
);
const AddressBookModal = lazy(() =>
  import('./components/AddressBookModal').then((m) => ({ default: m.AddressBookModal }))
);
const QuickRepliesModal = lazy(() =>
  import('./components/QuickRepliesModal').then((m) => ({ default: m.QuickRepliesModal }))
);
import { useTabNotification } from './hooks/useTabNotification';
import { useGreenApiPolling } from './hooks/useGreenApiPolling';
import { GreenApiService, DEFAULT_API_URL, validateGatewayUrlOrThrow } from './services/greenApi';
import { sanitizePhone, formatDisplayPhone } from './utils/formatters';
import { playNotificationSound } from './utils/sound';
import { safeStorage } from './utils/storage';
import { loadCreds, saveCreds, clearCreds, isCredsPersistent } from './utils/credentialStorage';
import {
  getTrustedParentOrigins,
  isTrustedOrigin,
  safePostToParent,
  toSafePayloadString,
  validateIncomingMessage,
} from './utils/postMessageSecurity';
import { translations } from './i18n/translations';
import {
  APP_VERSION,
  BG_SYNC_MIN_ACTIVE_MS,
  BG_SYNC_MIN_HIDDEN_MS,
  DEFAULT_POLLING_MS,
  DIALOG_RETENTION_LIMIT,
  MAX_MESSAGE_LENGTH,
  MESSAGE_RETENTION_LIMIT,
  STORAGE_KEYS,
  sanitizePollingInterval,
} from './config';

const DEFAULT_SETTINGS: AppSettings = {
  pollingIntervalMs: DEFAULT_POLLING_MS,
  soundEnabled: true,
  sendShortcut: 'enter',
  fontSize: 'medium',
  showPhoneFormatting: true,
  browserNotificationsEnabled: true,
  inAppPopupsEnabled: true,
};

// Initial welcome dialogue if empty
const DEFAULT_INITIAL_PHONE = '79991234567';

export const sortDialogsWithPinnedFirst = (list: ChatDialog[]): ChatDialog[] => {
  return [...list].sort((a, b) => {
    const aPinned = a.isPinned ? 1 : 0;
    const bPinned = b.isPinned ? 1 : 0;
    if (aPinned !== bPinned) {
      return bPinned - aPinned;
    }
    return (b.lastMessageTimestamp || 0) - (a.lastMessageTimestamp || 0);
  });
};

export default function App() {
  // 1. Language state
  const [lang, setLang] = useState<Language>(() => {
    const saved = safeStorage.getItem(STORAGE_KEYS.LANG);
    return saved === 'en' ? 'en' : 'ru';
  });

  const t = translations[lang];

  // 1.1 App Settings state (polling санитизируем — битый localStorage не должен ронять опрос)
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = safeStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          pollingIntervalMs: sanitizePollingInterval(parsed?.pollingIntervalMs),
        };
      }
    } catch {
      // ignore
    }
    return DEFAULT_SETTINGS;
  });

  // 2. Credentials state (default gateway: https://3100.api.green-api.com)
  // Хранение: localStorage (persistent) или sessionStorage (до закрытия вкладки).
  const [credsPersistent, setCredsPersistent] = useState<boolean>(() => {
    try {
      return isCredsPersistent();
    } catch {
      return true;
    }
  });
  const [creds, setCreds] = useState<GreenApiCredentials | null>(() => {
    try {
      const parsed = loadCreds();
      if (parsed) {
        if (!parsed.apiUrl || parsed.apiUrl === 'https://api.green-api.com') {
          parsed.apiUrl = DEFAULT_API_URL;
        }
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  });

  // 3. Dialogs list state
  const [dialogs, setDialogs] = useState<ChatDialog[]>(() => {
    try {
      const saved = safeStorage.getItem(STORAGE_KEYS.DIALOGS);
      if (saved) return sortDialogsWithPinnedFirst(JSON.parse(saved));
    } catch {
      // ignore
    }
    return [
      {
        chatId: DEFAULT_INITIAL_PHONE,
        displayName: lang === 'ru' ? 'Служба поддержки MAX' : 'MAX Support Service',
        lastMessageText:
          lang === 'ru'
            ? 'Добро пожаловать в MAX Web Messenger! Сообщения отправляются через шлюз GREEN-API.'
            : 'Welcome to MAX Web Messenger! Messages are sent via GREEN-API gateway.',
        lastMessageTimestamp: Date.now() - 3600000,
        lastMessageDirection: 'incoming',
        unreadCount: 0,
        isPinned: false,
      },
    ];
  });

  // 4. Messages list state
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = safeStorage.getItem(STORAGE_KEYS.MESSAGES);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [
      {
        id: 'welcome_1',
        chatId: DEFAULT_INITIAL_PHONE,
        senderPhone: DEFAULT_INITIAL_PHONE,
        text:
          lang === 'ru'
            ? 'Добро пожаловать в MAX Web Messenger! Сообщения отправляются через шлюз GREEN-API без суффиксов @c.us.'
            : 'Welcome to MAX Web Messenger! Messages are transmitted via GREEN-API gateway using plain numeric IDs.',
        timestamp: Date.now() - 3600000,
        direction: 'incoming',
        status: 'sent',
      },
    ];
  });

  // Fast ID tracking for instant deduplication
  const knownMessageIdsRef = useRef<Set<string>>(new Set(messages.map((m) => m.id)));

  useEffect(() => {
    messages.forEach((m) => knownMessageIdsRef.current.add(m.id));
  }, [messages]);

  // 5. Active chat ID
  const [activeChatId, setActiveChatId] = useState<string | null>(() => {
    const saved = safeStorage.getItem(STORAGE_KEYS.ACTIVE_CHAT);
    return saved || DEFAULT_INITIAL_PHONE;
  });

  // 5.1 Address Book (Contacts) state
  const [contacts, setContacts] = useState<Contact[]>(() => {
    try {
      const saved = safeStorage.getItem(STORAGE_KEYS.CONTACTS);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [
      {
        id: DEFAULT_INITIAL_PHONE,
        name: 'Служба поддержки MAX',
        contactName: 'Служба поддержки MAX',
        source: 'manual',
        updatedAt: Date.now(),
      },
    ];
  });

  const [lastSyncTime, setLastSyncTime] = useState<number | null>(() => {
    try {
      const saved = safeStorage.getItem(STORAGE_KEYS.LAST_SYNC);
      return saved ? Number(saved) : null;
    } catch {
      return null;
    }
  });

  const [isSyncingContacts, setIsSyncingContacts] = useState(false);
  const [isAddressBookOpen, setIsAddressBookOpen] = useState(false);

  // 5.2 Quick Replies (Шаблоны быстрых ответов)
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>(() => {
    try {
      const saved = safeStorage.getItem(STORAGE_KEYS.QUICK_REPLIES);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return getDefaultQuickReplies(lang);
  });

  useEffect(() => {
    safeStorage.setItem(STORAGE_KEYS.QUICK_REPLIES, JSON.stringify(quickReplies));
  }, [quickReplies]);

  const [isQuickRepliesModalOpen, setIsQuickRepliesModalOpen] = useState(false);

  // Fast map lookup
  const contactsMap = useMemo(() => {
    const map = new Map<string, Contact>();
    contacts.forEach((c) => map.set(c.id, c));
    return map;
  }, [contacts]);

  // 6. UI modals & states
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [popupNotification, setPopupNotification] = useState<PopupNotificationData | null>(null);
  const enrichedChatIdsRef = useRef<Set<string>>(new Set());
  const [typingChats, setTypingChats] = useState<Record<string, boolean>>({});
  const typingTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    return () => {
      Object.values(typingTimeoutsRef.current).forEach((t) => {
        if (t) clearTimeout(t);
      });
    };
  }, []);

  const handleTypingEvent = useCallback(
    ({ chatId, isTyping }: { chatId: string; isTyping: boolean }) => {
      const cleanId = sanitizePhone(chatId);
      if (!cleanId) return;

      if (typingTimeoutsRef.current[cleanId]) {
        clearTimeout(typingTimeoutsRef.current[cleanId]);
        delete typingTimeoutsRef.current[cleanId];
      }

      if (isTyping) {
        setTypingChats((prev) => ({ ...prev, [cleanId]: true }));
        // Automatically reset typing status after 5s if no new typing event is received
        typingTimeoutsRef.current[cleanId] = setTimeout(() => {
          setTypingChats((prev) => {
            if (!prev[cleanId]) return prev;
            const next = { ...prev };
            delete next[cleanId];
            return next;
          });
        }, 5000);
      } else {
        setTypingChats((prev) => {
          if (!prev[cleanId]) return prev;
          const next = { ...prev };
          delete next[cleanId];
          return next;
        });
      }
    },
    []
  );

  // Sync to safeStorage
  useEffect(() => {
    safeStorage.setItem(STORAGE_KEYS.LANG, lang);
  }, [lang]);

  useEffect(() => {
    safeStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (creds) {
      saveCreds(creds, credsPersistent);
    } else {
      clearCreds();
    }
  }, [creds, credsPersistent]);

  // Retention caps — защита от QuotaExceededError: храним только свежие данные.
  useEffect(() => {
    const capped =
      dialogs.length > DIALOG_RETENTION_LIMIT ? dialogs.slice(0, DIALOG_RETENTION_LIMIT) : dialogs;
    safeStorage.setItem(STORAGE_KEYS.DIALOGS, JSON.stringify(capped));
  }, [dialogs]);

  useEffect(() => {
    const capped =
      messages.length > MESSAGE_RETENTION_LIMIT
        ? messages.slice(-MESSAGE_RETENTION_LIMIT)
        : messages;
    safeStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(capped));
  }, [messages]);

  useEffect(() => {
    safeStorage.setItem(STORAGE_KEYS.CONTACTS, JSON.stringify(contacts));
  }, [contacts]);

  useEffect(() => {
    if (lastSyncTime) {
      safeStorage.setItem(STORAGE_KEYS.LAST_SYNC, String(lastSyncTime));
    }
  }, [lastSyncTime]);

  useEffect(() => {
    if (activeChatId) {
      safeStorage.setItem(STORAGE_KEYS.ACTIVE_CHAT, activeChatId);
    } else {
      safeStorage.removeItem(STORAGE_KEYS.ACTIVE_CHAT);
    }
  }, [activeChatId]);

  // Total unread messages across all conversations for browser tab badge & title
  const totalUnreadCount = useMemo(() => {
    return dialogs.reduce((acc, d) => acc + (d.unreadCount || 0), 0);
  }, [dialogs]);

  // Window/tab focus tracking ref to reliably detect if user is looking at this tab
  const isWindowFocusedRef = useRef<boolean>(true);
  useEffect(() => {
    const handleFocus = () => {
      isWindowFocusedRef.current = true;
    };
    const handleBlur = () => {
      isWindowFocusedRef.current = false;
    };
    const handleVisibility = () => {
      isWindowFocusedRef.current = !document.hidden;
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Browser Tab Notification controller (Page title prefix + Dynamic Canvas badged Favicon)
  const { notifyNewIncoming } = useTabNotification({
    unreadCount: totalUnreadCount,
    baseTitle: 'MAX Web Messenger',
    lang,
  });

  // When tab/window gains focus, mark active chat as read with a short delay so user notices the unread count
  useEffect(() => {
    let focusTimeout: any = null;
    const handleClearActiveUnread = () => {
      if (activeChatId) {
        if (focusTimeout) clearTimeout(focusTimeout);
        focusTimeout = setTimeout(() => {
          setDialogs((prev) =>
            prev.map((d) =>
              d.chatId === activeChatId && d.unreadCount > 0 ? { ...d, unreadCount: 0 } : d
            )
          );
        }, 1500);
      }
    };

    window.addEventListener('focus', handleClearActiveUnread);
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        handleClearActiveUnread();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (focusTimeout) clearTimeout(focusTimeout);
      window.removeEventListener('focus', handleClearActiveUnread);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activeChatId]);

  const toggleLanguage = () => {
    setLang((prev) => (prev === 'ru' ? 'en' : 'ru'));
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 3500);
  };

  // Contact book management handlers
  const handleSaveContact = useCallback((contact: Contact) => {
    const cleanId = sanitizePhone(contact.id);
    if (!cleanId) return;

    setContacts((prev) => {
      const existingIdx = prev.findIndex((c) => c.id === cleanId);
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = {
          ...next[existingIdx],
          ...contact,
          id: cleanId,
          updatedAt: Date.now(),
        };
        return next;
      }
      return [
        {
          ...contact,
          id: cleanId,
          updatedAt: Date.now(),
        },
        ...prev,
      ];
    });

    // Also update any matching dialog's displayName
    const resolvedName = contact.contactName || contact.name;
    if (resolvedName) {
      setDialogs((prev) =>
        prev.map((d) =>
          d.chatId === cleanId ? { ...d, displayName: resolvedName } : d
        )
      );
    }

    showToast(
      lang === 'ru'
        ? 'Контакт сохранен в записную книжку'
        : 'Contact saved to address book'
    );
  }, [lang]);

  const handleDeleteContact = useCallback((contactId: string) => {
    const cleanId = sanitizePhone(contactId);
    setContacts((prev) => prev.filter((c) => c.id !== cleanId));
    showToast(
      lang === 'ru'
        ? 'Контакт удален из записной книжки'
        : 'Contact removed from address book'
    );
  }, [lang]);

  const handleSyncContacts = useCallback(async (): Promise<number> => {
    if (!creds) {
      showToast(
        lang === 'ru'
          ? 'Для синхронизации подключите шлюз GREEN-API'
          : 'Connect GREEN-API gateway to sync contacts'
      );
      return 0;
    }

    setIsSyncingContacts(true);
    try {
      const fetchedContacts = await GreenApiService.getContacts(creds);

      if (!fetchedContacts || fetchedContacts.length === 0) {
        setLastSyncTime(Date.now());
        showToast(
          lang === 'ru'
            ? 'Синхронизация завершена: контактов в шлюзе не обнаружено'
            : 'Sync complete: no contacts returned from gateway'
        );
        return 0;
      }

      setContacts((prev) => {
        const map = new Map<string, Contact>();
        // Keep existing contacts
        prev.forEach((c) => map.set(c.id, c));

        // Merge incoming contacts from Green-API
        fetchedContacts.forEach((incoming) => {
          const cleanId = sanitizePhone(incoming.id);
          if (!cleanId) return;

          const existing = map.get(cleanId);
          map.set(cleanId, {
            ...existing,
            id: cleanId,
            name: incoming.name || existing?.name,
            contactName: incoming.contactName || existing?.contactName || incoming.name,
            avatarUrl: incoming.avatarUrl || existing?.avatarUrl,
            source: 'green_api',
            updatedAt: Date.now(),
          });
        });

        return Array.from(map.values());
      });

      // Update dialogs with contact names
      setDialogs((prev) =>
        prev.map((d) => {
          const match = fetchedContacts.find((c) => sanitizePhone(c.id) === d.chatId);
          if (match && (match.contactName || match.name)) {
            return {
              ...d,
              displayName: match.contactName || match.name,
            };
          }
          return d;
        })
      );

      setLastSyncTime(Date.now());
      showToast(
        lang === 'ru'
          ? `Успешно синхронизировано ${fetchedContacts.length} контактов!`
          : `Successfully synced ${fetchedContacts.length} contacts!`
      );

      // PostMessage notification if embedded (targetOrigin ограничен allowlist, см. postMessageSecurity)
      if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
        safePostToParent({
          type: 'MAX_CONTACTS_SYNCED',
          payload: { count: fetchedContacts.length, timestamp: Date.now() },
        });
      }

      return fetchedContacts.length;
    } catch (err: any) {
      console.error('Failed to sync contacts:', err);
      showToast(
        lang === 'ru'
          ? `Ошибка синхронизации: ${err.message || 'Сбой запроса'}`
          : `Sync error: ${err.message || 'Request failed'}`
      );
      return 0;
    } finally {
      setIsSyncingContacts(false);
    }
  }, [creds, lang]);

  // Auto-enrich contact information using GREEN-API getContactInfo
  const enrichContactInfo = useCallback(
    async (chatId: string) => {
      const cleanId = sanitizePhone(chatId);
      if (!creds?.idInstance || !creds?.apiTokenInstance || !cleanId || enrichedChatIdsRef.current.has(cleanId)) {
        return;
      }
      enrichedChatIdsRef.current.add(cleanId);
      try {
        const info = await GreenApiService.getContactInfo(creds, cleanId);
        if (info && (info.contactName || info.name || info.avatar)) {
          const bestName = info.contactName || info.name;
          if (bestName) {
            setContacts((prev) => {
              const existing = prev.find((c) => c.id === cleanId);
              if (existing) {
                return prev.map((c) =>
                  c.id === cleanId
                    ? {
                        ...c,
                        name: info.name || c.name,
                        contactName: info.contactName || c.contactName || info.name,
                        avatarUrl: info.avatar || c.avatarUrl,
                        updatedAt: Date.now(),
                      }
                    : c
                );
              }
              return [
                ...prev,
                {
                  id: cleanId,
                  name: info.name,
                  contactName: bestName,
                  avatarUrl: info.avatar,
                  source: 'green_api',
                  updatedAt: Date.now(),
                },
              ];
            });

            setDialogs((prev) =>
              prev.map((d) =>
                d.chatId === cleanId
                  ? { ...d, displayName: d.displayName || bestName }
                  : d
              )
            );
          }
        }
      } catch (err) {
        console.warn('Failed to enrich contact info:', err);
      }
    },
    [creds]
  );

  useEffect(() => {
    if (activeChatId) {
      enrichContactInfo(activeChatId);
    }
  }, [activeChatId, enrichContactInfo]);

  // 7. Incoming message processor from long-polling hook & background reconciliation
  const handleIncomingMessage = useCallback(
    (newMsg: {
      id: string;
      chatId: string;
      senderPhone: string;
      text: string;
      timestamp: number;
      senderName?: string;
      direction?: 'incoming' | 'outgoing';
      silent?: boolean;
    }) => {
      const cleanChatId = sanitizePhone(newMsg.chatId);
      if (!cleanChatId) return false;

      // Check if message ID was already processed
      if (knownMessageIdsRef.current.has(newMsg.id)) {
        return false;
      }
      knownMessageIdsRef.current.add(newMsg.id);

      const direction = newMsg.direction || 'incoming';
      const isIncoming = direction === 'incoming';

      const incomingMsg: ChatMessage = {
        id: newMsg.id,
        chatId: cleanChatId,
        senderPhone: newMsg.senderPhone || cleanChatId,
        text: newMsg.text,
        timestamp: newMsg.timestamp,
        direction,
        status: 'sent',
      };

      setMessages((prev) => {
        if (prev.some((m) => m.id === incomingMsg.id)) {
          return prev;
        }
        return [...prev, incomingMsg];
      });

      // Auto-register sender into Address Book if senderName exists
      if (newMsg.senderName) {
        setContacts((prev) => {
          const existing = prev.find((c) => c.id === cleanChatId);
          if (!existing) {
            return [
              ...prev,
              {
                id: cleanChatId,
                contactName: newMsg.senderName,
                name: newMsg.senderName,
                source: 'chat',
                updatedAt: Date.now(),
              },
            ];
          }
          if (!existing.contactName && !existing.name) {
            return prev.map((c) =>
              c.id === cleanChatId
                ? {
                    ...c,
                    contactName: newMsg.senderName,
                    name: newMsg.senderName,
                    updatedAt: Date.now(),
                  }
                : c
            );
          }
          return prev;
        });
      }

      // Update dialogs
      const isDocumentActive =
        typeof document !== 'undefined' &&
        !document.hidden &&
        isWindowFocusedRef.current &&
        (typeof document.hasFocus === 'function' ? document.hasFocus() : true);
      const isActivelyViewing = activeChatId === cleanChatId && isDocumentActive;

      setDialogs((prev) => {
        const existingIndex = prev.findIndex((d) => d.chatId === cleanChatId);

        let updatedList: ChatDialog[];
        if (existingIndex >= 0) {
          const updated = [...prev];
          const existing = updated[existingIndex];
          if (!existing) return prev;
          updated[existingIndex] = {
            ...existing,
            displayName: existing.displayName || newMsg.senderName,
            lastMessageText: newMsg.text,
            lastMessageTimestamp: newMsg.timestamp,
            lastMessageDirection: direction,
            unreadCount:
              isActivelyViewing || !isIncoming
                ? existing.unreadCount || 0
                : (existing.unreadCount || 0) + 1,
          };
          updatedList = updated;
        } else {
          // New conversation discovered via incoming notification
          const newDialog: ChatDialog = {
            chatId: cleanChatId,
            displayName: newMsg.senderName,
            lastMessageText: newMsg.text,
            lastMessageTimestamp: newMsg.timestamp,
            lastMessageDirection: direction,
            unreadCount: isActivelyViewing || !isIncoming ? 0 : 1,
            isPinned: false,
          };
          updatedList = [newDialog, ...prev];
        }
        return sortDialogsWithPinnedFirst(updatedList);
      });

      // Clear active typing indicator for sender
      if (typingTimeoutsRef.current[cleanChatId]) {
        clearTimeout(typingTimeoutsRef.current[cleanChatId]);
        delete typingTimeoutsRef.current[cleanChatId];
      }
      setTypingChats((prev) => {
        if (!prev[cleanChatId]) return prev;
        const next = { ...prev };
        delete next[cleanChatId];
        return next;
      });

      // Sound alert if enabled and incoming and not silent
      if (isIncoming && settings.soundEnabled && !newMsg.silent) {
        playNotificationSound();
      }

      // Popup notification & native desktop notification for incoming messages
      if (isIncoming) {
        enrichContactInfo(cleanChatId);

        if (!newMsg.silent) {
          const contactObj = contacts.find((c) => c.id === cleanChatId);
          const resolvedSender = contactObj?.contactName || contactObj?.name || newMsg.senderName;

          // Notify browser tab (flashing title if tab is inactive or new message)
          notifyNewIncoming(resolvedSender, newMsg.text);

          // In-app popup notification with high visibility
          setPopupNotification({
            id: newMsg.id,
            chatId: cleanChatId,
            senderName: resolvedSender,
            text: newMsg.text,
            timestamp: newMsg.timestamp,
            avatarUrl: contactObj?.avatarUrl,
          });

          // Browser desktop notification
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            try {
              const displayTitle = resolvedSender || formatDisplayPhone(cleanChatId);
              const notif = new Notification(displayTitle, {
                body: newMsg.text,
                icon: contactObj?.avatarUrl || '/favicon.svg',
              });
              notif.onclick = () => {
                window.focus();
                handleSelectChat(cleanChatId);
                notif.close();
              };
            } catch (err) {
              console.warn('Desktop notification error:', err);
            }
          }
        }
      }

      // Dispatch postMessage for embedded CRM/app integration (безопасный targetOrigin)
      if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
        safePostToParent({
          type: isIncoming ? 'MAX_MESSAGE_RECEIVED' : 'MAX_MESSAGE_SENT',
          payload: {
            chatId: cleanChatId,
            senderPhone: newMsg.senderPhone || cleanChatId,
            text: newMsg.text,
            timestamp: newMsg.timestamp,
            senderName: newMsg.senderName,
            direction,
          },
        });
      }

      // Only show top sync toast for outgoing sync to avoid covering the incoming PopupNotification
      if (!newMsg.silent && !isIncoming) {
        showToast(lang === 'ru' ? 'Исходящее сообщение синхронизировано' : 'Outgoing message synchronized');
      }

      return true;
    },
    [activeChatId, lang, settings.soundEnabled, contacts, enrichContactInfo, notifyNewIncoming]
  );

  // Journal & history synchronization engines
  const [isSyncingMessages, setIsSyncingMessages] = useState(false);
  const [isSyncingChatHistory, setIsSyncingChatHistory] = useState(false);

  const syncRecentMessages = useCallback(
    async (showNotice = false) => {
      if (!creds?.idInstance || !creds?.apiTokenInstance) return 0;
      setIsSyncingMessages(true);
      try {
        const [incomingList, outgoingList] = await Promise.all([
          GreenApiService.getLastIncomingMessages(creds, 1440).catch((e) => {
            console.warn('[Sync] Failed to fetch last incoming messages:', e);
            return [];
          }),
          GreenApiService.getLastOutgoingMessages(creds, 1440).catch((e) => {
            console.warn('[Sync] Failed to fetch last outgoing messages:', e);
            return [];
          }),
        ]);

        const allItems = [...incomingList, ...outgoingList];
        if (allItems.length === 0) {
          if (showNotice) {
            showToast(
              lang === 'ru'
                ? 'Новых сообщений на сервере за 24 ч не найдено'
                : 'No new messages found on server for 24h'
            );
          }
          return 0;
        }

        // Sort chronologically ascending
        allItems.sort((a, b) => {
          const tA = (a.timestamp || 0) > 1e11 ? (a.timestamp || 0) : (a.timestamp || 0) * 1000;
          const tB = (b.timestamp || 0) > 1e11 ? (b.timestamp || 0) : (b.timestamp || 0) * 1000;
          return tA - tB;
        });

        let newMessagesAdded = 0;

        allItems.forEach((item) => {
          const rawChat = item.chatId || item.senderId || '';
          const cleanChat = sanitizePhone(rawChat);
          if (!cleanChat) return;

          const text =
            item.textMessage ||
            item.extendedTextMessage?.text ||
            item.fileMessage?.caption ||
            (item.fileMessage?.fileName ? `📎 ${item.fileMessage.fileName}` : '') ||
            '';
          if (!text) return;

          const isOutgoing = item.type === 'outgoing' || item.sendByApi;
          const msgId = item.idMessage || `hist_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          const timestamp = item.timestamp
            ? (item.timestamp > 1e11 ? item.timestamp : item.timestamp * 1000)
            : Date.now();

          const senderName = item.senderContactName || item.senderName || undefined;

          handleIncomingMessage({
            id: msgId,
            chatId: cleanChat,
            senderPhone: isOutgoing ? creds.idInstance : cleanChat,
            text,
            timestamp,
            senderName,
            direction: isOutgoing ? 'outgoing' : 'incoming',
            silent: !showNotice, // silent when doing background/initial sync
          });
          newMessagesAdded++;
        });

        if (showNotice) {
          showToast(
            lang === 'ru'
              ? `Синхронизировано сообщений: ${allItems.length}`
              : `Successfully synced ${allItems.length} messages`
          );
        }
        return newMessagesAdded;
      } catch (err: any) {
        console.warn('Error syncing recent messages:', err);
        if (showNotice) {
          showToast(
            lang === 'ru'
              ? `Ошибка синхронизации: ${err.message || 'Сбой'}`
              : `Sync error: ${err.message || 'Error'}`
          );
        }
        return 0;
      } finally {
        setIsSyncingMessages(false);
      }
    },
    [creds, handleIncomingMessage, lang]
  );

  const syncChatHistory = useCallback(
    async (chatId: string) => {
      if (!creds || !chatId) return;
      const cleanPhone = sanitizePhone(chatId);
      if (!cleanPhone) return;

      setIsSyncingChatHistory(true);
      try {
        const history = await GreenApiService.getChatHistory(creds, cleanPhone, 100);
        if (Array.isArray(history) && history.length > 0) {
          // Sort ascending
          history.sort((a, b) => {
            const tA = (a.timestamp || 0) > 1e11 ? (a.timestamp || 0) : (a.timestamp || 0) * 1000;
            const tB = (b.timestamp || 0) > 1e11 ? (b.timestamp || 0) : (b.timestamp || 0) * 1000;
            return tA - tB;
          });

          history.forEach((item) => {
            const text =
              item.textMessage ||
              item.extendedTextMessage?.text ||
              item.fileMessage?.caption ||
              (item.fileMessage?.fileName ? `📎 ${item.fileMessage.fileName}` : '') ||
              '';
            if (!text) return;

            const isOutgoing = item.type === 'outgoing' || item.sendByApi;
            const msgId = item.idMessage || `hist_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            const timestamp = item.timestamp
              ? (item.timestamp > 1e11 ? item.timestamp : item.timestamp * 1000)
              : Date.now();

            handleIncomingMessage({
              id: msgId,
              chatId: cleanPhone,
              senderPhone: isOutgoing ? creds.idInstance : cleanPhone,
              text,
              timestamp,
              senderName: item.senderContactName || item.senderName,
              direction: isOutgoing ? 'outgoing' : 'incoming',
              silent: true,
            });
          });
        }
      } catch (err) {
        console.warn('Failed to load chat history for', cleanPhone, err);
      } finally {
        setIsSyncingChatHistory(false);
      }
    },
    [creds, handleIncomingMessage]
  );

  // Automatic journal sync on credentials connection/startup
  const initialSyncDoneRef = useRef<string | null>(null);
  useEffect(() => {
    if (creds?.idInstance && creds?.apiTokenInstance) {
      const credsKey = `${creds.idInstance}_${creds.apiTokenInstance}`;
      if (initialSyncDoneRef.current !== credsKey) {
        initialSyncDoneRef.current = credsKey;
        const timer = setTimeout(() => {
          syncRecentMessages(false);
        }, 1200);
        return () => clearTimeout(timer);
      }
    }
  }, [creds?.idInstance, creds?.apiTokenInstance, syncRecentMessages]);

  // 7b. Background journal reconciliation (дополняет long-poll, не заменяет его).
  // Нагрузка: 3 запроса за тик, поэтому интервал растёт от настройки пользователя
  // settings.pollingIntervalMs (минимум 5с на активной вкладке, минимум 10с в фоне),
  // чтобы не упереться в 429 GREEN-API. На скрытой вкладке тики пропускаются.
  useEffect(() => {
    if (!creds?.idInstance || !creds?.apiTokenInstance) return;

    let isSubscribed = true;
    let isChecking = false;

    const performBackgroundCheck = async () => {
      if (!isSubscribed || isChecking) return;
      // Не дёргаем журнал в фоне — long-poll и так держит очередь.
      if (typeof document !== 'undefined' && document.hidden) return;
      isChecking = true;

      try {
        const incomingPromise = GreenApiService.getLastIncomingMessages(creds, 60).catch(() => []);
        const outgoingPromise = GreenApiService.getLastOutgoingMessages(creds, 60).catch(() => []);
        const historyPromise = activeChatId
          ? GreenApiService.getChatHistory(creds, activeChatId, 15).catch(() => [])
          : Promise.resolve([]);

        const [incomingList, outgoingList, chatHistoryList] = await Promise.all([
          incomingPromise,
          outgoingPromise,
          historyPromise,
        ]);

        if (!isSubscribed) return;

        const combinedList = [...incomingList, ...outgoingList, ...chatHistoryList];

        // Sort chronologically ascending
        combinedList.sort((a, b) => {
          const tA = (a.timestamp || 0) > 1e11 ? (a.timestamp || 0) : (a.timestamp || 0) * 1000;
          const tB = (b.timestamp || 0) > 1e11 ? (b.timestamp || 0) : (b.timestamp || 0) * 1000;
          return tA - tB;
        });

        for (const item of combinedList) {
          if (!item?.idMessage) continue;
          if (knownMessageIdsRef.current.has(item.idMessage)) continue;

          const rawChat = item.chatId || item.senderId || '';
          const cleanChat = sanitizePhone(rawChat);
          if (!cleanChat) continue;

          const text =
            item.textMessage ||
            item.extendedTextMessage?.text ||
            item.fileMessage?.caption ||
            (item.fileMessage?.fileName ? `📎 ${item.fileMessage.fileName}` : '') ||
            '';
          if (!text) continue;

          const isOutgoing = item.type === 'outgoing' || item.sendByApi;
          const timestamp = item.timestamp
            ? (item.timestamp > 1e11 ? item.timestamp : item.timestamp * 1000)
            : Date.now();

          // Newly discovered message! Add it and alert user with sound & toast
          handleIncomingMessage({
            id: item.idMessage,
            chatId: cleanChat,
            senderPhone: isOutgoing ? creds.idInstance : cleanChat,
            text,
            timestamp,
            senderName: item.senderContactName || item.senderName,
            direction: isOutgoing ? 'outgoing' : 'incoming',
            silent: false,
          });
        }
      } catch (err) {
        // Silent failure in background - next tick will retry
      } finally {
        isChecking = false;
      }
    };

    // Immediate check on mount or when switching chats
    performBackgroundCheck();

    // Instant sync on returning to the tab (focus + visibility).
    const handleFocus = () => {
      performBackgroundCheck();
    };
    const handleVisibility = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        performBackgroundCheck();
      }
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    // Интервал наследуется от пользовательской настройки long-poll, но не чаще 5с
    // (журнал тяжелее очереди). В фоне — минимум 10с.
    const baseMs = sanitizePollingInterval(settings.pollingIntervalMs);
    const intervalMs =
      typeof document !== 'undefined' && document.visibilityState === 'visible'
        ? Math.max(BG_SYNC_MIN_ACTIVE_MS, baseMs * 2)
        : Math.max(BG_SYNC_MIN_HIDDEN_MS, baseMs * 3);
    const intervalId = setInterval(() => {
      performBackgroundCheck();
    }, intervalMs);

    return () => {
      isSubscribed = false;
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [creds?.idInstance, creds?.apiTokenInstance, creds?.apiUrl, activeChatId, handleIncomingMessage, settings.pollingIntervalMs]);

  // 8. Long-polling engine initialization
  const { status: pollingStatus, lastReceiptId, errorMessage: pollingErrorMessage, retry: retryPolling } = useGreenApiPolling({
    creds,
    enabled: !!creds,
    pollingIntervalMs: settings.pollingIntervalMs,
    onIncomingMessage: handleIncomingMessage,
    onTyping: handleTypingEvent,
    onReceiptAcknowledged: (receiptId) => {
      console.log(`[GREEN-API] Notification acknowledged: ${receiptId}`);
    },
  });

  // Client typing notification sender
  const handleSendTyping = useCallback(
    (recipientPhone: string) => {
      if (!creds || !recipientPhone) return;
      GreenApiService.sendTyping(creds, recipientPhone).catch(() => {
        // Non-critical, ignore typing transmission failure
      });
    },
    [creds]
  );

  // 9. Send message handler
  const handleSendMessage = async (rawText: string) => {
    if (!creds || !activeChatId || !rawText.trim()) return;
    // Defense-in-depth: режем сверхдлинные тексты до лимита мессенджера (DoS/API-abuse).
    const text = rawText.trim().slice(0, MAX_MESSAGE_LENGTH);
    if (!text) return;

    const tempId = `out_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const timestamp = Date.now();
    const cleanPhone = sanitizePhone(activeChatId);

    const pendingMsg: ChatMessage = {
      id: tempId,
      chatId: cleanPhone,
      senderPhone: creds.idInstance,
      text,
      timestamp,
      direction: 'outgoing',
      status: 'sending',
    };

    // Optimistically add message
    setMessages((prev) => [...prev, pendingMsg]);

    // Update dialog list preview
    setDialogs((prev) => {
      const existingIdx = prev.findIndex((d) => d.chatId === cleanPhone);
      let updatedList: ChatDialog[];
      if (existingIdx >= 0) {
        const updated = [...prev];
        const current = updated[existingIdx];
        if (!current) return prev;
        updated[existingIdx] = {
          ...current,
          lastMessageText: text,
          lastMessageTimestamp: timestamp,
          lastMessageDirection: 'outgoing',
        };
        updatedList = updated;
      } else {
        updatedList = [
          {
            chatId: cleanPhone,
            lastMessageText: text,
            lastMessageTimestamp: timestamp,
            lastMessageDirection: 'outgoing',
            unreadCount: 0,
            isPinned: false,
          },
          ...prev,
        ];
      }
      return sortDialogsWithPinnedFirst(updatedList);
    });

    setIsSending(true);

    try {
      const response = await GreenApiService.sendMessage(creds, cleanPhone, text);

      // Update message status to sent
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? { ...m, status: 'sent', id: response.idMessage || tempId }
            : m
        )
      );

      // Dispatch postMessage for embedded CRM integrations (безопасный targetOrigin)
      if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
        safePostToParent({
          type: 'MAX_MESSAGE_SENT',
          payload: {
            chatId: cleanPhone,
            text,
            timestamp,
            messageId: response.idMessage || tempId,
          },
        });
      }
    } catch (err: any) {
      console.error('Send message failed:', err);
      // Mark message as failed
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: 'failed' } : m))
      );
      showToast(
        lang === 'ru'
          ? `Ошибка отправки: ${err.message || 'Проверьте инстанс'}`
          : `Send error: ${err.message || 'Check instance'}`
      );
    } finally {
      setIsSending(false);
    }
  };

  // 10. Start or select chat
  const handleSelectChat = (chatId: string) => {
    setActiveChatId(chatId);
    // Mark as read
    setDialogs((prev) =>
      prev.map((d) => (d.chatId === chatId ? { ...d, unreadCount: 0 } : d))
    );
    syncChatHistory(chatId);
  };

  const handleStartNewChat = useCallback((cleanPhone: string, displayName?: string) => {
    const sanitized = sanitizePhone(cleanPhone);
    if (!sanitized) return;

    setActiveChatId(sanitized);
    syncChatHistory(sanitized);
    const existingContact = contactsMap.get(sanitized);
    const resolvedName = displayName || existingContact?.contactName || existingContact?.name;

    setDialogs((prev) => {
      const exists = prev.find((d) => d.chatId === sanitized);
      if (exists) {
        if (resolvedName && !exists.displayName) {
          return prev.map((d) =>
            d.chatId === sanitized ? { ...d, displayName: resolvedName } : d
          );
        }
        return prev;
      }
      const newDialog: ChatDialog = {
        chatId: sanitized,
        displayName: resolvedName,
        lastMessageText:
          lang === 'ru' ? 'Новый созданный диалог' : 'New conversation created',
        lastMessageTimestamp: Date.now(),
        lastMessageDirection: 'outgoing',
        unreadCount: 0,
        isPinned: false,
      };
      return sortDialogsWithPinnedFirst([newDialog, ...prev]);
    });
  }, [contactsMap, lang]);

  // 11. CRM / Iframe integration bridge (URL query params & window.postMessage API)
  useEffect(() => {
    // A. Parse URL search params for deep linking from external systems.
    // Секреты (?idInstance=&apiTokenInstance=) больше НЕ поддерживаются:
    // они утекают в историю браузера, логи серверов/прокси и Referer.
    // Используйте postMessage MAX_SET_CREDS или ручной ввод.
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.has('idInstance') || params.has('apiTokenInstance') || params.has('apiUrl')) {
        console.warn(
          '[security] Credentials via URL are no longer supported and were ignored. ' +
            'Use postMessage MAX_SET_CREDS instead. Scrubbing secrets from the address bar now.'
        );
        try {
          const cleanParams = new URLSearchParams(window.location.search);
          cleanParams.delete('idInstance');
          cleanParams.delete('apiTokenInstance');
          cleanParams.delete('apiUrl');
          const remaining = cleanParams.toString();
          const cleanUrl = `${window.location.pathname}${remaining ? `?${remaining}` : ''}${window.location.hash}`;
          window.history.replaceState(null, '', cleanUrl);
        } catch {
          // Не роняем приложение, если history API недоступен
        }
      }
      const urlPhone = params.get('chatId') || params.get('phone');
      const urlName = params.get('name');
      // ?text= — черновик для поля ввода (генераторы IntegrationPanel/Modal).
      // Хранится как dialog.draft, в сеть ничего не отправляется до Enter.
      const urlTextRaw = params.get('text');
      const urlText = urlTextRaw ? urlTextRaw.trim().slice(0, MAX_MESSAGE_LENGTH) : '';

      if (urlPhone) {
        const cleanPhone = sanitizePhone(urlPhone);
        if (cleanPhone) {
          handleStartNewChat(cleanPhone, urlName ? urlName.trim() : undefined);
          if (urlName) {
            handleSaveContact({
              id: cleanPhone,
              contactName: urlName.trim(),
              source: 'manual',
              updatedAt: Date.now(),
            });
          }
          if (urlText) {
            setDialogs((prev) =>
              prev.map((d) => (d.chatId === cleanPhone ? { ...d, draft: urlText } : d))
            );
          }
        }
      }
    }

    // B. PostMessage event listener for parent applications (Bitrix24, amoCRM, Custom Portals)
    // OWASP: первой строкой проверяем event.origin по allowlist, затем структуру и типы payload.
    // Fail-closed в production: без настроенного allowlist все входящие команды отбрасываются.
    const handleMessageEvent = (event: MessageEvent) => {
      if (!isTrustedOrigin(event.origin)) {
        console.warn('[postMessage] Blocked message from untrusted origin:', event.origin);
        return;
      }
      if (getTrustedParentOrigins().length === 0) {
        console.warn(
          '[postMessage] Trusted parent origins not configured ' +
            '(?parentOrigin= / VITE_TRUSTED_PARENT_ORIGINS). Dev-only fallback accepts message from:',
          event.origin
        );
      }

      if (!validateIncomingMessage(event)) return;
      const data = event.data;

      switch (data.type) {
        case 'MAX_OPEN_CHAT': {
          const payload = (data.payload || {}) as Record<string, unknown>;
          const chatId = toSafePayloadString(payload.chatId);
          const name = toSafePayloadString(payload.name);
          // text в MAX_OPEN_CHAT — черновик (не авто-отправка; для отправки есть MAX_SEND_MESSAGE).
          const draftRaw = toSafePayloadString(payload.text, MAX_MESSAGE_LENGTH);
          const draft = draftRaw ? draftRaw.slice(0, MAX_MESSAGE_LENGTH) : null;
          if (chatId) {
            const clean = sanitizePhone(chatId);
            if (clean) {
              handleStartNewChat(clean, name || undefined);
              if (name) {
                handleSaveContact({
                  id: clean,
                  contactName: name,
                  source: 'manual',
                  updatedAt: Date.now(),
                });
              }
              if (draft) {
                setDialogs((prev) =>
                  prev.map((d) => (d.chatId === clean ? { ...d, draft } : d))
                );
              }
            }
          }
          break;
        }

        case 'MAX_SEND_MESSAGE': {
          const payload = (data.payload || {}) as Record<string, unknown>;
          const chatId = toSafePayloadString(payload.chatId);
          const text = toSafePayloadString(payload.text);
          if (chatId && text) {
            const clean = sanitizePhone(chatId);
            if (clean) {
              handleStartNewChat(clean);
              handleSendMessage(text);
            }
          }
          break;
        }

        case 'MAX_SYNC_CONTACTS': {
          handleSyncContacts();
          break;
        }

        case 'MAX_SET_CREDS': {
          const payload = (data.payload || {}) as Record<string, unknown>;
          const idInstance = toSafePayloadString(payload.idInstance);
          const apiTokenInstance = toSafePayloadString(payload.apiTokenInstance);
          const apiUrlRaw = toSafePayloadString(payload.apiUrl);
          if (idInstance && apiTokenInstance) {
            // Не даём родителю увести токены на левый хост: apiUrl обязан пройти allowlist.
            if (apiUrlRaw) {
              try {
                validateGatewayUrlOrThrow(apiUrlRaw);
              } catch {
                console.warn('[postMessage] Blocked MAX_SET_CREDS with untrusted apiUrl:', apiUrlRaw);
                break;
              }
            }
            const updated: GreenApiCredentials = {
              idInstance,
              apiTokenInstance,
              apiUrl: apiUrlRaw || undefined,
            };
            setCreds(updated);
            saveCreds(updated, credsPersistent);
            showToast(lang === 'ru' ? 'Ключи шлюза получены из родительской системы' : 'Gateway credentials received from host');
          }
          break;
        }
      }
    };

    window.addEventListener('message', handleMessageEvent);

    // Announce readiness to parent container (только доверенные origins)
    if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
      safePostToParent({
        type: 'MAX_READY',
        payload: {
          app: 'MAX Web Messenger for GREEN-API',
          version: APP_VERSION,
          connected: !!creds,
        },
      });
    }

    return () => {
      window.removeEventListener('message', handleMessageEvent);
    };
  }, [creds, credsPersistent, handleSaveContact, handleStartNewChat, handleSyncContacts, lang]);

  const handleTogglePinChat = (chatId: string) => {
    setDialogs((prev) => {
      const updated = prev.map((d) =>
        d.chatId === chatId ? { ...d, isPinned: !d.isPinned } : d
      );
      return sortDialogsWithPinnedFirst(updated);
    });
  };

  const handleDeleteChat = (chatId: string) => {
    setDialogs((prev) => prev.filter((d) => d.chatId !== chatId));
    setMessages((prev) => prev.filter((m) => m.chatId !== chatId));
    if (activeChatId === chatId) {
      setActiveChatId(null);
    }
    showToast(lang === 'ru' ? 'Диалог удален' : 'Chat deleted');
  };

  const handleClearHistory = (chatId: string) => {
    setMessages((prev) => prev.filter((m) => m.chatId !== chatId));
    setDialogs((prev) =>
      prev.map((d) =>
        d.chatId === chatId
          ? {
              ...d,
              lastMessageText:
                lang === 'ru' ? 'История очищена' : 'History cleared',
              unreadCount: 0,
            }
          : d
      )
    );
    showToast(lang === 'ru' ? 'История сообщений очищена' : 'Chat history cleared');
  };

  const handleSignOut = () => {
    setCreds(null);
    setActiveChatId(null);
    clearCreds();
    showToast(lang === 'ru' ? 'Вы вышли из сессии' : 'Signed out successfully');
  };

  const handleClearAllChats = () => {
    setDialogs([]);
    setMessages([]);
    setActiveChatId(null);
    safeStorage.removeItem(STORAGE_KEYS.DIALOGS);
    safeStorage.removeItem(STORAGE_KEYS.MESSAGES);
    safeStorage.removeItem(STORAGE_KEYS.ACTIVE_CHAT);
    showToast(lang === 'ru' ? 'Все диалоги и сообщения очищены' : 'All chats and messages cleared');
  };

  const handleUpdateCreds = (newCreds: GreenApiCredentials) => {
    setCreds(newCreds);
    saveCreds(newCreds, credsPersistent);
    showToast(lang === 'ru' ? 'Параметры связи и шлюза обновлены' : 'Connection and gateway settings updated');
  };

  // Переключение sessionStorage <-> localStorage для уже введённых ключей.
  const handleUpdateCredsPersistence = useCallback(
    (persistent: boolean) => {
      setCredsPersistent(persistent);
      setCreds((current) => {
        if (current) saveCreds(current, persistent);
        return current;
      });
      showToast(
        persistent
          ? lang === 'ru'
            ? 'Ключи будут сохраняться на устройстве (localStorage)'
            : 'Keys will persist on this device (localStorage)'
          : lang === 'ru'
            ? 'Ключи только до закрытия вкладки (sessionStorage)'
            : 'Keys kept only until the tab closes (sessionStorage)'
      );
    },
    [lang]
  );

  // If not authenticated, display Auth Screen
  if (!creds) {
    return (
      <AuthScreen
        onConnect={(newCreds, opts) => {
          setCredsPersistent(opts?.persistent ?? true);
          setCreds(newCreds);
        }}
        lang={lang}
        onToggleLang={toggleLanguage}
      />
    );
  }

  const activeMessages = activeChatId
    ? messages.filter((m) => m.chatId === activeChatId)
    : [];

  const activeDialog = dialogs.find((d) => d.chatId === activeChatId);

  const handleTestNotification = () => {
    if (settings.soundEnabled) {
      playNotificationSound();
    }

    notifyNewIncoming(
      lang === 'ru' ? 'MAX Ассистент' : 'MAX Assistant',
      lang === 'ru' ? 'Тестовое входящее сообщение' : 'Test incoming message'
    );

    setPopupNotification({
      id: `test_${Date.now()}`,
      chatId: '79991234567',
      senderName: lang === 'ru' ? 'MAX Ассистент' : 'MAX Assistant',
      text:
        lang === 'ru'
          ? 'Привет! Всплывающее уведомление и бейдж на вкладке работают отлично!'
          : 'Hello! Visual popup notification and tab badge are working great!',
      timestamp: Date.now(),
    });

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const notif = new Notification('MAX Web Messenger', {
          body:
            lang === 'ru'
              ? 'Тестовое системное уведомление рабочего стола'
              : 'Test system notification',
          icon: '/favicon.svg',
        });
        notif.onclick = () => {
          window.focus();
          notif.close();
        };
      } catch (err) {
        console.warn('Test notification error:', err);
      }
    }
  };

  return (
    <div className="fixed inset-0 w-full h-full flex overflow-hidden bg-white select-none font-sans">
      {/* Toast Notification (centered at top so it never overlaps right-side PopupNotification) */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[10000] bg-slate-900/95 backdrop-blur-md text-white text-xs font-medium px-4 py-2 rounded-full shadow-xl border border-slate-700/80 animate-in fade-in slide-in-from-top-2 duration-200 pointer-events-none flex items-center gap-2">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* PWA Offline Mode Indicator */}
      <OfflineIndicator lang={lang} />

      {/* Main Container */}
      <div className="w-full h-full flex overflow-hidden bg-white">
        {/* Left Sidebar (hidden on mobile if chat is active) */}
        <div
          className={`${
            activeChatId ? 'hidden md:flex' : 'flex'
          } w-full md:w-[360px] lg:w-[400px] shrink-0 h-full flex-col border-r border-slate-200 bg-white z-10`}
        >
          <Sidebar
            creds={creds}
            dialogs={dialogs}
            activeChatId={activeChatId}
            onSelectChat={handleSelectChat}
            onOpenNewChat={() => setIsNewChatModalOpen(true)}
            onDeleteChat={handleDeleteChat}
            onSignOut={handleSignOut}
            pollingStatus={pollingStatus}
            pollingErrorMessage={pollingErrorMessage}
            onRetryPolling={retryPolling}
            lang={lang}
            onToggleLang={toggleLanguage}
            onOpenSettings={() => setIsSettingsModalOpen(true)}
            showPhoneFormatting={settings.showPhoneFormatting}
            onTogglePinChat={handleTogglePinChat}
            typingChats={typingChats}
            contactsMap={contactsMap}
            contactsCount={contacts.length}
            onOpenAddressBook={() => setIsAddressBookOpen(true)}
            onSyncMessages={() => syncRecentMessages(true)}
            isSyncingMessages={isSyncingMessages}
          />
        </div>

        {/* Right Chat Viewport (hidden on mobile if no active chat) */}
        <div
          className={`${
            activeChatId ? 'flex' : 'hidden md:flex'
          } flex-1 min-w-0 h-full flex-col overflow-hidden bg-[#F7F8FA]`}
        >
          <ChatView
            chatId={activeChatId}
            messages={activeMessages}
            onSendMessage={handleSendMessage}
            onBackToSidebar={() => setActiveChatId(null)}
            onClearHistory={handleClearHistory}
            isSending={isSending}
            lang={lang}
            settings={settings}
            onOpenSettings={() => setIsSettingsModalOpen(true)}
            onOpenAddressBook={() => setIsAddressBookOpen(true)}
            onQuickSaveContact={(id, name, _phone, note) => {
              handleSaveContact({
                id,
                contactName: name,
                note: note || undefined,
                source: 'manual',
                updatedAt: Date.now(),
              });
              setDialogs((prev) =>
                prev.map((d) => (d.chatId === id ? { ...d, displayName: name } : d))
              );
              showToast(
                lang === 'ru'
                  ? `Собеседник «${name}» сохранён`
                  : `Contact "${name}" saved`
              );
            }}
            contact={activeChatId ? contactsMap.get(activeChatId) : undefined}
            isPinned={activeDialog?.isPinned || false}
            onTogglePin={handleTogglePinChat}
            isTyping={!!(activeChatId && typingChats[activeChatId])}
            onSimulateTyping={(cid) => handleTypingEvent({ chatId: cid, isTyping: true })}
            onSendTyping={handleSendTyping}
            onSyncHistory={(cid) => syncChatHistory(cid)}
            isSyncingHistory={isSyncingChatHistory}
            quickReplies={quickReplies}
            onOpenQuickReplies={() => setIsQuickRepliesModalOpen(true)}
            initialDraft={activeDialog?.draft ?? null}
            onDraftConsumed={(cid) =>
              setDialogs((prev) =>
                prev.map((d) => (d.chatId === cid ? { ...d, draft: undefined } : d))
              )
            }
          />
        </div>
      </div>

      {/* Lazy modals — подгружаются по требованию */}
      <Suspense fallback={null}>
        {isNewChatModalOpen && (
          <NewChatModal
            isOpen={isNewChatModalOpen}
            onClose={() => setIsNewChatModalOpen(false)}
            onStartChat={handleStartNewChat}
            contacts={contacts}
            onOpenAddressBook={() => setIsAddressBookOpen(true)}
            lang={lang}
          />
        )}

        {isAddressBookOpen && (
          <AddressBookModal
            isOpen={isAddressBookOpen}
            onClose={() => setIsAddressBookOpen(false)}
            contacts={contacts}
            onSelectContact={(phone, name) => handleStartNewChat(phone, name)}
            onSaveContact={handleSaveContact}
            onDeleteContact={handleDeleteContact}
            onSyncContacts={handleSyncContacts}
            isSyncing={isSyncingContacts}
            lastSyncTime={lastSyncTime}
            lang={lang}
          />
        )}

        {isSettingsModalOpen && (
          <SettingsModal
            isOpen={isSettingsModalOpen}
            onClose={() => setIsSettingsModalOpen(false)}
            settings={settings}
            onUpdateSettings={setSettings}
            creds={creds}
            onUpdateCreds={handleUpdateCreds}
            lang={lang}
            onToggleLanguage={toggleLanguage}
            dialogs={dialogs}
            messages={messages}
            onClearAllChats={handleClearAllChats}
            onSignOut={handleSignOut}
            activeChatId={activeChatId}
            onSyncMessages={() => syncRecentMessages(true)}
            isSyncingMessages={isSyncingMessages}
            onOpenQuickReplies={() => setIsQuickRepliesModalOpen(true)}
            quickRepliesCount={quickReplies.length}
            onTestNotification={handleTestNotification}
            credsPersistent={credsPersistent}
            onUpdateCredsPersistence={handleUpdateCredsPersistence}
          />
        )}

        {isQuickRepliesModalOpen && (
          <QuickRepliesModal
            isOpen={isQuickRepliesModalOpen}
            onClose={() => setIsQuickRepliesModalOpen(false)}
            quickReplies={quickReplies}
            onSaveQuickReplies={(updated) => {
              setQuickReplies(updated);
              showToast(t.quickRepliesSaved);
            }}
            onSelectQuickReply={(text) => {
              handleSendMessage(text);
            }}
            lang={lang}
          />
        )}
      </Suspense>

      {/* Popup Notification for Incoming Messages */}
      <PopupNotification
        notification={popupNotification}
        lang={lang}
        onOpenChat={(cid) => {
          handleSelectChat(cid);
          setPopupNotification(null);
        }}
        onDismiss={() => setPopupNotification(null)}
      />
    </div>
  );
}
