import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  GreenApiCredentials,
  ChatMessage,
  ChatDialog,
  Language,
  AppSettings,
  Contact,
} from './types';
import { AuthScreen } from './components/AuthScreen';
import { Sidebar } from './components/Sidebar';
import { ChatView } from './components/ChatView';
import { NewChatModal } from './components/NewChatModal';
import { SettingsModal } from './components/SettingsModal';
import { AddressBookModal } from './components/AddressBookModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PopupNotification, PopupNotificationData } from './components/PopupNotification';
import { useTabNotification } from './hooks/useTabNotification';
import { useGreenApiPolling } from './hooks/useGreenApiPolling';
import { GreenApiService, DEFAULT_API_URL } from './services/greenApi';
import { sanitizePhone, formatDisplayPhone } from './utils/formatters';
import { playNotificationSound } from './utils/sound';
import { safeStorage } from './utils/storage';
import { translations } from './i18n/translations';

const STORAGE_KEYS = {
  CREDS: 'max_messenger_creds',
  ACTIVE_CHAT: 'max_messenger_active_chat',
  DIALOGS: 'max_messenger_dialogs',
  MESSAGES: 'max_messenger_messages',
  LANG: 'max_messenger_lang',
  SETTINGS: 'max_messenger_settings',
  CONTACTS: 'max_messenger_contacts',
  LAST_SYNC: 'max_messenger_last_sync',
};

const DEFAULT_SETTINGS: AppSettings = {
  pollingIntervalMs: 2000,
  soundEnabled: true,
  sendShortcut: 'enter',
  fontSize: 'medium',
  showPhoneFormatting: true,
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

  // 1.1 App Settings state
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = safeStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch {
      // ignore
    }
    return DEFAULT_SETTINGS;
  });

  // 2. Credentials state (default gateway: https://3100.api.green-api.com)
  const [creds, setCreds] = useState<GreenApiCredentials | null>(() => {
    try {
      const saved = safeStorage.getItem(STORAGE_KEYS.CREDS);
      if (saved) {
        const parsed = JSON.parse(saved);
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
      safeStorage.setItem(STORAGE_KEYS.CREDS, JSON.stringify(creds));
    } else {
      safeStorage.removeItem(STORAGE_KEYS.CREDS);
    }
  }, [creds]);

  useEffect(() => {
    safeStorage.setItem(STORAGE_KEYS.DIALOGS, JSON.stringify(dialogs));
  }, [dialogs]);

  useEffect(() => {
    safeStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages));
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

  // Browser Tab Notification controller (Page title prefix + Dynamic badged Favicon)
  const { notifyNewIncoming } = useTabNotification({
    unreadCount: totalUnreadCount,
    baseTitle: 'MAX Web Messenger',
    lang,
  });

  // When tab/window gains focus or becomes visible, mark active chat as read
  useEffect(() => {
    const handleClearActiveUnread = () => {
      if (activeChatId) {
        setDialogs((prev) =>
          prev.map((d) =>
            d.chatId === activeChatId && d.unreadCount > 0 ? { ...d, unreadCount: 0 } : d
          )
        );
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

      // PostMessage notification if embedded
      if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
        window.parent.postMessage(
          {
            type: 'MAX_CONTACTS_SYNCED',
            payload: { count: fetchedContacts.length, timestamp: Date.now() },
          },
          '*'
        );
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
        (typeof document.hasFocus === 'function' ? document.hasFocus() : true);
      const isActivelyViewing = activeChatId === cleanChatId && isDocumentActive;

      setDialogs((prev) => {
        const existingIndex = prev.findIndex((d) => d.chatId === cleanChatId);

        let updatedList: ChatDialog[];
        if (existingIndex >= 0) {
          const updated = [...prev];
          const existing = updated[existingIndex];
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

          // Notify browser tab (flashing title if tab is inactive)
          notifyNewIncoming(resolvedSender);

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
                icon: contactObj?.avatarUrl || '/favicon.ico',
              });
              notif.onclick = () => {
                window.focus();
                setActiveChatId(cleanChatId);
                notif.close();
              };
            } catch (err) {
              console.warn('Desktop notification error:', err);
            }
          }
        }
      }

      // Dispatch postMessage for embedded CRM/app integration
      if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
        window.parent.postMessage(
          {
            type: isIncoming ? 'MAX_MESSAGE_RECEIVED' : 'MAX_MESSAGE_SENT',
            payload: {
              chatId: cleanChatId,
              senderPhone: newMsg.senderPhone || cleanChatId,
              text: newMsg.text,
              timestamp: newMsg.timestamp,
              senderName: newMsg.senderName,
              direction,
            },
          },
          '*'
        );
      }

      if (!newMsg.silent) {
        showToast(
          isIncoming
            ? (lang === 'ru'
                ? `Входящее сообщение от ${newMsg.senderName || '+' + cleanChatId}`
                : `Incoming message from ${newMsg.senderName || '+' + cleanChatId}`)
            : (lang === 'ru' ? 'Исходящее сообщение синхронизировано' : 'Outgoing message synchronized')
        );
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

  // 7b. Continuous Real-time Background Message Auto-Reconciliation Loop (every 3.5 seconds)
  // Ensures incoming and outgoing messages are automatically discovered and displayed
  // in real-time, matching modern messengers (Telegram/WhatsApp), even if webhooks are delayed
  useEffect(() => {
    if (!creds?.idInstance || !creds?.apiTokenInstance) return;

    let isSubscribed = true;
    let isChecking = false;

    const performBackgroundCheck = async () => {
      if (!isSubscribed || isChecking) return;
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

    // Check window focus for instant sync on returning to browser tab
    const handleFocus = () => {
      performBackgroundCheck();
    };
    window.addEventListener('focus', handleFocus);

    // Continuous interval: 3.5s when active tab, 6s when backgrounded
    const intervalId = setInterval(
      () => {
        performBackgroundCheck();
      },
      typeof document !== 'undefined' && document.visibilityState === 'visible' ? 3500 : 6000
    );

    return () => {
      isSubscribed = false;
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [creds?.idInstance, creds?.apiTokenInstance, creds?.apiUrl, activeChatId, handleIncomingMessage]);

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
  const handleSendMessage = async (text: string) => {
    if (!creds || !activeChatId || !text.trim()) return;

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

      // Dispatch postMessage for embedded CRM integrations
      if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
        window.parent.postMessage(
          {
            type: 'MAX_MESSAGE_SENT',
            payload: {
              chatId: cleanPhone,
              text,
              timestamp,
              messageId: response.idMessage || tempId,
            },
          },
          '*'
        );
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
    // A. Parse URL search params for deep linking from external systems
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlIdInstance = params.get('idInstance');
      const urlApiToken = params.get('apiTokenInstance');
      const urlApiUrl = params.get('apiUrl');
      const urlPhone = params.get('chatId') || params.get('phone');
      const urlName = params.get('name');
      const urlText = params.get('text');

      if (urlIdInstance && urlApiToken) {
        const newCreds: GreenApiCredentials = {
          idInstance: urlIdInstance.trim(),
          apiTokenInstance: urlApiToken.trim(),
          apiUrl: urlApiUrl ? urlApiUrl.trim() : undefined,
        };
        setCreds(newCreds);
        safeStorage.setItem(STORAGE_KEYS.CREDS, JSON.stringify(newCreds));
      }

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
        }
      }
    }

    // B. PostMessage event listener for parent applications (Bitrix24, amoCRM, Custom Portals)
    const handleMessageEvent = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      switch (data.type) {
        case 'MAX_OPEN_CHAT': {
          const { chatId, name } = data.payload || {};
          if (chatId) {
            const clean = sanitizePhone(chatId);
            if (clean) {
              handleStartNewChat(clean, name);
              if (name) {
                handleSaveContact({
                  id: clean,
                  contactName: name,
                  source: 'manual',
                  updatedAt: Date.now(),
                });
              }
            }
          }
          break;
        }

        case 'MAX_SEND_MESSAGE': {
          const { chatId, text } = data.payload || {};
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
          const { idInstance, apiTokenInstance, apiUrl } = data.payload || {};
          if (idInstance && apiTokenInstance) {
            const updated: GreenApiCredentials = {
              idInstance: String(idInstance).trim(),
              apiTokenInstance: String(apiTokenInstance).trim(),
              apiUrl: apiUrl ? String(apiUrl).trim() : undefined,
            };
            setCreds(updated);
            safeStorage.setItem(STORAGE_KEYS.CREDS, JSON.stringify(updated));
            showToast(lang === 'ru' ? 'Ключи шлюза получены из родительской системы' : 'Gateway credentials received from host');
          }
          break;
        }
      }
    };

    window.addEventListener('message', handleMessageEvent);

    // Announce readiness to parent container
    if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
      window.parent.postMessage(
        {
          type: 'MAX_READY',
          payload: {
            app: 'MAX Web Messenger for GREEN-API',
            version: '2.0.0',
            connected: !!creds,
          },
        },
        '*'
      );
    }

    return () => {
      window.removeEventListener('message', handleMessageEvent);
    };
  }, [creds, handleSaveContact, handleStartNewChat, handleSyncContacts, lang]);

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
    safeStorage.removeItem(STORAGE_KEYS.CREDS);
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
    safeStorage.setItem(STORAGE_KEYS.CREDS, JSON.stringify(newCreds));
    showToast(lang === 'ru' ? 'Параметры связи и шлюза обновлены' : 'Connection and gateway settings updated');
  };

  // If not authenticated, display Auth Screen
  if (!creds) {
    return (
      <AuthScreen
        onConnect={(newCreds) => setCreds(newCreds)}
        lang={lang}
        onToggleLang={toggleLanguage}
      />
    );
  }

  const activeMessages = activeChatId
    ? messages.filter((m) => m.chatId === activeChatId)
    : [];

  const activeDialog = dialogs.find((d) => d.chatId === activeChatId);

  return (
    <div className="fixed inset-0 w-full h-full flex overflow-hidden bg-white select-none font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white text-xs px-4 py-2.5 rounded-xl shadow-lg border border-slate-700 animate-in fade-in slide-in-from-top-2 duration-200">
          {toastMessage}
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
          />
        </div>
      </div>

      {/* New Chat Modal */}
      <NewChatModal
        isOpen={isNewChatModalOpen}
        onClose={() => setIsNewChatModalOpen(false)}
        onStartChat={handleStartNewChat}
        contacts={contacts}
        onOpenAddressBook={() => setIsAddressBookOpen(true)}
        lang={lang}
      />

      {/* Address Book Modal (Записная книжка) */}
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

      {/* Settings Modal (including MAX Integration, Connection, Sound & Storage) */}
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
      />

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
