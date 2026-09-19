import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  GreenApiCredentials,
  ChatMessage,
  ChatDialog,
  Language,
  AppSettings,
} from './types';
import { AuthScreen } from './components/AuthScreen';
import { Sidebar } from './components/Sidebar';
import { ChatView } from './components/ChatView';
import { NewChatModal } from './components/NewChatModal';
import { SettingsModal } from './components/SettingsModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { useGreenApiPolling } from './hooks/useGreenApiPolling';
import { GreenApiService } from './services/greenApi';
import { sanitizePhone } from './utils/formatters';
import { playNotificationSound } from './utils/sound';
import { translations } from './i18n/translations';

const STORAGE_KEYS = {
  CREDS: 'max_messenger_creds',
  ACTIVE_CHAT: 'max_messenger_active_chat',
  DIALOGS: 'max_messenger_dialogs',
  MESSAGES: 'max_messenger_messages',
  LANG: 'max_messenger_lang',
  SETTINGS: 'max_messenger_settings',
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
    const saved = localStorage.getItem(STORAGE_KEYS.LANG);
    return saved === 'en' ? 'en' : 'ru';
  });

  // 1.1 App Settings state
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch {
      // ignore
    }
    return DEFAULT_SETTINGS;
  });

  // 2. Credentials state
  const [creds, setCreds] = useState<GreenApiCredentials | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CREDS);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // 3. Dialogs list state
  const [dialogs, setDialogs] = useState<ChatDialog[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.DIALOGS);
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
      const saved = localStorage.getItem(STORAGE_KEYS.MESSAGES);
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

  // 5. Active chat ID
  const [activeChatId, setActiveChatId] = useState<string | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_CHAT);
    return saved || DEFAULT_INITIAL_PHONE;
  });

  // 6. UI modals & states
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
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

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.LANG, lang);
  }, [lang]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (creds) {
      localStorage.setItem(STORAGE_KEYS.CREDS, JSON.stringify(creds));
    } else {
      localStorage.removeItem(STORAGE_KEYS.CREDS);
    }
  }, [creds]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.DIALOGS, JSON.stringify(dialogs));
  }, [dialogs]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (activeChatId) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_CHAT, activeChatId);
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_CHAT);
    }
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

  // 7. Incoming message processor from long-polling hook
  const handleIncomingMessage = useCallback(
    (newMsg: {
      id: string;
      chatId: string;
      senderPhone: string;
      text: string;
      timestamp: number;
    }) => {
      const cleanChatId = sanitizePhone(newMsg.chatId);
      if (!cleanChatId) return;

      const incomingMsg: ChatMessage = {
        id: newMsg.id,
        chatId: cleanChatId,
        senderPhone: newMsg.senderPhone || cleanChatId,
        text: newMsg.text,
        timestamp: newMsg.timestamp,
        direction: 'incoming',
        status: 'sent',
      };

      setMessages((prev) => {
        // Prevent duplicate IDs
        if (prev.some((m) => m.id === incomingMsg.id)) {
          return prev;
        }
        return [...prev, incomingMsg];
      });

      // Update dialogs
      setDialogs((prev) => {
        const existingIndex = prev.findIndex((d) => d.chatId === cleanChatId);
        const isCurrentActive = activeChatId === cleanChatId;

        let updatedList: ChatDialog[];
        if (existingIndex >= 0) {
          const updated = [...prev];
          const existing = updated[existingIndex];
          updated[existingIndex] = {
            ...existing,
            lastMessageText: newMsg.text,
            lastMessageTimestamp: newMsg.timestamp,
            lastMessageDirection: 'incoming',
            unreadCount: isCurrentActive ? 0 : existing.unreadCount + 1,
          };
          updatedList = updated;
        } else {
          // New conversation discovered via incoming notification
          const newDialog: ChatDialog = {
            chatId: cleanChatId,
            lastMessageText: newMsg.text,
            lastMessageTimestamp: newMsg.timestamp,
            lastMessageDirection: 'incoming',
            unreadCount: isCurrentActive ? 0 : 1,
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

      // Sound alert if enabled
      if (settings.soundEnabled) {
        playNotificationSound();
      }

      showToast(
        lang === 'ru'
          ? `Входящее сообщение от +${cleanChatId}`
          : `Incoming message from +${cleanChatId}`
      );
    },
    [activeChatId, lang, settings.soundEnabled]
  );

  // 8. Long-polling engine initialization
  const { status: pollingStatus, lastReceiptId } = useGreenApiPolling({
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
  };

  const handleStartNewChat = (cleanPhone: string) => {
    setActiveChatId(cleanPhone);
    setDialogs((prev) => {
      const exists = prev.find((d) => d.chatId === cleanPhone);
      if (exists) {
        return prev;
      }
      const newDialog: ChatDialog = {
        chatId: cleanPhone,
        lastMessageText:
          lang === 'ru' ? 'Новый созданный диалог' : 'New conversation created',
        lastMessageTimestamp: Date.now(),
        lastMessageDirection: 'outgoing',
        unreadCount: 0,
        isPinned: false,
      };
      return sortDialogsWithPinnedFirst([newDialog, ...prev]);
    });
  };

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
    localStorage.removeItem(STORAGE_KEYS.CREDS);
    showToast(lang === 'ru' ? 'Вы вышли из сессии' : 'Signed out successfully');
  };

  const handleClearAllChats = () => {
    setDialogs([]);
    setMessages([]);
    setActiveChatId(null);
    localStorage.removeItem(STORAGE_KEYS.DIALOGS);
    localStorage.removeItem(STORAGE_KEYS.MESSAGES);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_CHAT);
    showToast(lang === 'ru' ? 'Все диалоги и сообщения очищены' : 'All chats and messages cleared');
  };

  const handleUpdateCreds = (newCreds: GreenApiCredentials) => {
    setCreds(newCreds);
    localStorage.setItem(STORAGE_KEYS.CREDS, JSON.stringify(newCreds));
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
    <div className="flex h-screen h-[100dvh] w-screen bg-slate-100 overflow-hidden font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white text-xs px-4 py-2.5 rounded-xl shadow-lg border border-slate-700 animate-in fade-in slide-in-from-top-2 duration-200">
          {toastMessage}
        </div>
      )}

      {/* PWA Offline Mode Indicator */}
      <OfflineIndicator lang={lang} />

      {/* Main Container */}
      <div className="w-full h-full max-w-[1600px] mx-auto flex overflow-hidden bg-white shadow-xs">
        {/* Left Sidebar (hidden on mobile if chat is active) */}
        <div
          className={`${
            activeChatId ? 'hidden md:flex' : 'flex'
          } w-full md:w-auto h-full`}
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
            lang={lang}
            onToggleLang={toggleLanguage}
            onOpenSettings={() => setIsSettingsModalOpen(true)}
            showPhoneFormatting={settings.showPhoneFormatting}
            onTogglePinChat={handleTogglePinChat}
            typingChats={typingChats}
          />
        </div>

        {/* Right Chat Viewport (hidden on mobile if no active chat) */}
        <div
          className={`${
            activeChatId ? 'flex' : 'hidden md:flex'
          } flex-1 h-full overflow-hidden`}
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
            isPinned={activeDialog?.isPinned || false}
            onTogglePin={handleTogglePinChat}
            isTyping={!!(activeChatId && typingChats[activeChatId])}
            onSimulateTyping={(cid) => handleTypingEvent({ chatId: cid, isTyping: true })}
            onSendTyping={handleSendTyping}
          />
        </div>
      </div>

      {/* New Chat Modal */}
      <NewChatModal
        isOpen={isNewChatModalOpen}
        onClose={() => setIsNewChatModalOpen(false)}
        onStartChat={handleStartNewChat}
        lang={lang}
      />

      {/* Settings Modal */}
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
      />
    </div>
  );
}
