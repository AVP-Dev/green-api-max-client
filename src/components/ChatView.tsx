import React, { useState, useEffect, useRef } from 'react';
import {
  SendHorizonal,
  ArrowLeft,
  ShieldCheck,
  Check,
  CheckCheck,
  Clock,
  Sparkles,
  Phone,
  MoreVertical,
  Trash2,
  Smile,
  Settings as SettingsIcon,
  Pin,
  Plus,
  X,
  BookUser,
  UserPlus,
  RotateCw,
  Edit2,
  Zap,
} from 'lucide-react';
import { AppSettings, ChatMessage, Contact, Language, QuickReply } from '../types';
import { translations } from '../i18n/translations';
import {
  formatDisplayPhone,
  formatMessageTime,
  formatDateDivider,
} from '../utils/formatters';
import { Avatar } from './Avatar';
import { MaxLogo } from './MaxLogo';
import { ChatHistorySkeleton } from './Skeletons';
import { MAX_MESSAGE_LENGTH } from '../config';

interface ChatViewProps {
  chatId: string | null;
  messages: ChatMessage[];
  onSendMessage: (text: string) => Promise<void>;
  onBackToSidebar: () => void;
  onClearHistory: (chatId: string) => void;
  isSending: boolean;
  lang: Language;
  settings?: AppSettings;
  onOpenSettings?: () => void;
  onOpenAddressBook?: () => void;
  onQuickSaveContact?: (chatId: string, name: string, phone?: string, note?: string) => void;
  contact?: Contact;
  isPinned?: boolean;
  onTogglePin?: (chatId: string) => void;
  isTyping?: boolean;
  onSimulateTyping?: (chatId: string) => void;
  onSendTyping?: (chatId: string) => void;
  onSyncHistory?: (chatId: string) => void;
  isSyncingHistory?: boolean;
  quickReplies?: QuickReply[];
  onOpenQuickReplies?: () => void;
  /** Черновик из интеграции (?text= / MAX_OPEN_CHAT text). Подставляется один раз. */
  initialDraft?: string | null;
  onDraftConsumed?: (chatId: string) => void;
  /** Повторная отправка упавшего сообщения (клик по иконке ошибки). */
  onRetryMessage?: (msg: ChatMessage) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  chatId,
  messages,
  onSendMessage,
  onBackToSidebar,
  onClearHistory,
  isSending,
  lang,
  settings,
  onOpenSettings,
  onOpenAddressBook,
  onQuickSaveContact,
  contact,
  isPinned = false,
  onTogglePin,
  isTyping = false,
  onSimulateTyping,
  onSendTyping,
  onSyncHistory,
  isSyncingHistory = false,
  quickReplies = [],
  onOpenQuickReplies,
  initialDraft,
  onDraftConsumed,
  onRetryMessage,
}) => {
  const t = translations[lang];
  const [inputText, setInputText] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [showMobileActions, setShowMobileActions] = useState(false);
  const [isEditContactOpen, setIsEditContactOpen] = useState(false);
  const [editName, setEditName] = useState(contact?.contactName || contact?.name || '');
  const [editPhone, setEditPhone] = useState(chatId || '');
  const [editNote, setEditNote] = useState(contact?.note || contact?.company || '');

  useEffect(() => {
    setEditName(contact?.contactName || contact?.name || '');
    setEditPhone(chatId || '');
    setEditNote(contact?.note || contact?.company || '');
  }, [contact, chatId]);

  const handleSaveContactDetails = (e: React.FormEvent) => {
    e.preventDefault();
    if (onQuickSaveContact && chatId) {
      const displayPhone = settings?.showPhoneFormatting !== false ? formatDisplayPhone(chatId) : chatId;
      onQuickSaveContact(chatId, editName.trim() || displayPhone, editPhone.trim(), editNote.trim());
    }
    setIsEditContactOpen(false);
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastTypingSentRef = useRef<number>(0);
  const consumedDraftRef = useRef<string | null>(null);

  // Черновик из CRM-интеграции: подставить один раз при смене чата/появлении draft.
  // Не затирает уже набранный пользователем текст.
  useEffect(() => {
    if (!chatId || !initialDraft) return;
    const key = `${chatId}::${initialDraft}`;
    if (consumedDraftRef.current === key) return;
    setInputText((prev) => {
      if (prev.trim()) return prev;
      return initialDraft.slice(0, MAX_MESSAGE_LENGTH);
    });
    consumedDraftRef.current = key;
    onDraftConsumed?.(chatId);
  }, [chatId, initialDraft, onDraftConsumed]);

  // Auto-scroll to bottom upon messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  // Focus input on active chat change
  useEffect(() => {
    if (chatId) {
      inputRef.current?.focus();
    }
  }, [chatId]);

  if (!chatId) {
    return (
      <div className="flex-1 h-full bg-slate-50 dark:bg-slate-950 relative overflow-hidden flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="absolute top-1/3 left-1/4 w-80 h-80 bg-[#00BFFF]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#9500FF]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="w-18 h-18 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-sm flex items-center justify-center mb-4 relative z-10">
          <MaxLogo id="chatview-empty-logo" size="xl" variant="icon" />
        </div>
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-1.5 relative z-10">{t.selectChatTitle}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed mb-6 relative z-10">
          {t.selectChatSubtitle}
        </p>
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-xs border border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs shadow-2xs relative z-10">
          <ShieldCheck className="w-4 h-4 text-[#471AFF]" />
          <span className="font-medium">MAX Messenger · web.max.ru</span>
        </div>
      </div>
    );
  }

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim().slice(0, MAX_MESSAGE_LENGTH);
    if (!text || isSending) return;

    setInputText('');
    await onSendMessage(text);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const sendShortcut = settings?.sendShortcut || 'enter';

    if (sendShortcut === 'ctrl_enter') {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSend();
      }
    } else {
      // Default: Enter to send (unless shift or ctrl is pressed)
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
        e.preventDefault();
        handleSend();
      }
    }
  };

  const handleSendQuickPhrase = (phrase: string) => {
    onSendMessage(phrase);
  };

  const displayPhone = settings?.showPhoneFormatting !== false 
    ? formatDisplayPhone(chatId) 
    : chatId;

  const getFontSizeClass = () => {
    switch (settings?.fontSize) {
      case 'small':
        return 'text-xs';
      case 'large':
        return 'text-[15px]';
      case 'medium':
      default:
        return 'text-[13px]';
    }
  };

  // Group messages by calendar date
  const groupedMessages: { dateDivider: string; msgs: ChatMessage[] }[] = [];
  messages.forEach((msg) => {
    const divider = formatDateDivider(msg.timestamp, lang);
    const lastGroup = groupedMessages[groupedMessages.length - 1];
    if (!lastGroup || lastGroup.dateDivider !== divider) {
      groupedMessages.push({ dateDivider: divider, msgs: [msg] });
    } else {
      lastGroup.msgs.push(msg);
    }
  });

  return (
    <section className="flex-1 h-full flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden relative">
      {/* Top Bar Header */}
      <div className="h-16 px-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 shadow-2xs z-10">
        <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
          {/* Mobile back button */}
          <button
            type="button"
            onClick={onBackToSidebar}
            className="md:hidden min-w-[40px] min-h-[40px] flex items-center justify-center -ml-1 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white active:scale-95 rounded-xl transition-all cursor-pointer shrink-0"
            title={t.backToChats || 'Назад'}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Avatar */}
          <Avatar
            elementId={`chat-header-avatar-${chatId}`}
            id={chatId}
            name={contact?.contactName || contact?.name || displayPhone}
            avatarUrl={contact?.avatarUrl}
            size="md"
          />

          {/* Contact info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate flex items-center gap-1.5">
                <span className="truncate">{contact?.contactName || contact?.name || displayPhone}</span>
                {isPinned && (
                  <span title={t.pinned} className="inline-flex items-center text-[#471AFF] shrink-0">
                    <Pin className="w-3.5 h-3.5 fill-[#471AFF] rotate-45" />
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setIsEditContactOpen(true)}
                  className="p-1 rounded-md text-slate-400 hover:text-[#471AFF] dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition-colors cursor-pointer shrink-0"
                  title={lang === 'ru' ? 'Изменить имя или реальный номер' : 'Edit name or real number'}
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              </h2>
              {/* Secondary phone or notebook status */}
              {(contact?.contactName || contact?.name) ? (
                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 font-normal shrink-0 hidden sm:inline truncate">
                  {displayPhone}
                </span>
              ) : (
                <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 font-normal shrink-0 hidden sm:inline truncate">
                  ({chatId})
                </span>
              )}

              {/* Quick Book Tag */}
              {contact ? (
                <button
                  type="button"
                  onClick={onOpenAddressBook}
                  className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 dark:bg-indigo-950/60 text-[#471AFF] dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors cursor-pointer"
                  title={t.inAddressBook}
                >
                  <BookUser className="w-3 h-3" />
                  <span>{t.inAddressBook}</span>
                </button>
              ) : (
                onOpenAddressBook && (
                  <button
                    type="button"
                    onClick={onOpenAddressBook}
                    className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-[#471AFF] dark:hover:text-indigo-300 transition-colors cursor-pointer"
                    title={t.addToContacts}
                  >
                    <Plus className="w-3 h-3" />
                    <span>{t.addToContacts}</span>
                  </button>
                )
              )}
            </div>

            {isTyping ? (
              <div
                id="chat-header-typing-indicator"
                className="flex items-center gap-1.5 mt-0.5"
                role="status"
                aria-live="polite"
              >
                <span className="text-[11px] font-semibold text-[#471AFF] dark:text-indigo-300 flex items-center gap-1.5">
                  <span>{t.typing}</span>
                  <span className="inline-flex items-center gap-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#471AFF] animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#471AFF] animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#471AFF] animate-bounce" />
                  </span>
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 mt-0.5 min-w-0 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                <span className="text-[11px] text-emerald-700 font-medium truncate">
                  {t.online} · {contact?.company || t.maxUser}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1">
          {onSyncHistory && chatId && (
            <button
              id="chat-sync-history-button"
              type="button"
              onClick={() => onSyncHistory(chatId)}
              disabled={isSyncingHistory}
              title={t.syncHistory}
              className={`p-2 min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-400 hover:text-[#471AFF] dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-lg transition-colors cursor-pointer disabled:opacity-50 ${
                isSyncingHistory ? 'text-[#471AFF] dark:text-indigo-300' : ''
              }`}
            >
              <RotateCw className={`w-4 h-4 ${isSyncingHistory ? 'animate-spin' : ''}`} />
            </button>
          )}

          {onOpenAddressBook && (
            <button
              type="button"
              onClick={onOpenAddressBook}
              title={lang === 'ru' ? 'Записная книжка' : 'Address book'}
              className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-400 hover:text-[#471AFF] dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-lg transition-colors cursor-pointer hidden sm:flex"
            >
              <BookUser className="w-4 h-4" />
            </button>
          )}

          <div className="relative">
            <button
              id="chat-menu-trigger-button"
              type="button"
              onClick={() => setShowOptions(!showOptions)}
              title={t.quickActions}
              className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <MoreVertical className="w-5 h-5 sm:w-4 sm:h-4" />
            </button>

            {showOptions && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowOptions(false)} 
                />
                <div className="absolute right-0 mt-1 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-1 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
                  {onSyncHistory && chatId && (
                    <button
                      type="button"
                      onClick={() => {
                        onSyncHistory(chatId);
                        setShowOptions(false);
                      }}
                      disabled={isSyncingHistory}
                      className="w-full px-3 py-2 text-left text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-slate-700 hover:text-[#471AFF] dark:hover:text-indigo-300 flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <RotateCw className={`w-3.5 h-3.5 text-[#471AFF] ${isSyncingHistory ? 'animate-spin' : ''}`} />
                      <span>{t.syncHistory}</span>
                    </button>
                  )}
                  {onOpenAddressBook && (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenAddressBook();
                        setShowOptions(false);
                      }}
                      className="w-full px-3 py-2 text-left text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-slate-700 hover:text-[#471AFF] dark:hover:text-indigo-300 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <BookUser className="w-3.5 h-3.5 text-[#471AFF]" />
                      <span>{t.addressBookTitle}</span>
                    </button>
                  )}
                  {onSimulateTyping && chatId && (
                    <button
                      id="chat-menu-test-typing-button"
                      type="button"
                      onClick={() => {
                        onSimulateTyping(chatId);
                        setShowOptions(false);
                      }}
                      className="w-full px-3 py-2 text-left text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-slate-700 hover:text-[#471AFF] dark:hover:text-indigo-300 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#471AFF]" />
                      <span>{t.testTyping}</span>
                    </button>
                  )}
                  {onTogglePin && (
                    <button
                      id="chat-menu-pin-button"
                      type="button"
                      onClick={() => {
                        onTogglePin(chatId);
                        setShowOptions(false);
                      }}
                      className="w-full px-3 py-2 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <Pin className={`w-3.5 h-3.5 ${isPinned ? 'text-[#471AFF] fill-[#471AFF]' : 'text-slate-500'} rotate-45`} />
                      <span>{isPinned ? t.unpinChat : t.pinChat}</span>
                    </button>
                  )}
                  {onOpenSettings && (
                    <button
                      id="chat-menu-settings-button"
                      type="button"
                      onClick={() => {
                        onOpenSettings();
                        setShowOptions(false);
                      }}
                      className="w-full px-3 py-2 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <SettingsIcon className="w-3.5 h-3.5 text-slate-500" />
                      <span>{t.settingsTitle}</span>
                    </button>
                  )}
                  <button
                    id="chat-menu-clear-button"
                    type="button"
                    onClick={() => {
                      onClearHistory(chatId);
                      setShowOptions(false);
                    }}
                    className="w-full px-3 py-2 text-left text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t.clearHistory}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Тонкий индикатор догрузки истории поверх имеющихся сообщений */}
      {isSyncingHistory && messages.length > 0 && (
        <div
          className="px-4 pt-2 flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400"
          role="status"
          aria-live="polite"
        >
          <span className="w-3 h-3 rounded-full border-2 border-slate-300 dark:border-slate-600 border-t-[#471AFF] animate-spin shrink-0" />
          <span>{lang === 'ru' ? 'Загрузка истории…' : 'Loading history…'}</span>
        </div>
      )}

      {/* Chat Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {isSyncingHistory && messages.length === 0 ? (
          <ChatHistorySkeleton rows={5} />
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs flex items-center justify-center text-blue-600 mb-3">
              <Sparkles className="w-5 h-5" />
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-200 font-semibold mb-1">
              {lang === 'ru' ? 'Начните диалог с пользователем' : 'Start conversation with user'}
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 max-w-xs mb-4">
              {lang === 'ru'
                ? 'Отправьте приветственное сообщение или воспользуйтесь быстрыми шаблонами ниже.'
                : 'Send a greeting message or use the quick templates below.'}
            </p>

            {/* Quick templates */}
            <div className="flex flex-col gap-1.5 w-full max-w-xs">
              {[t.quickPhrase1, t.quickPhrase2, t.quickPhrase3].map((phrase, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendQuickPhrase(phrase)}
                  className="text-left text-xs text-[#471AFF] dark:text-indigo-300 bg-white dark:bg-slate-800 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/50 border border-slate-200/90 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-800 px-3 py-2 rounded-xl transition-all shadow-2xs cursor-pointer font-medium"
                >
                  "{phrase}"
                </button>
              ))}
            </div>
          </div>
        ) : (
          groupedMessages.map((group, groupIdx) => (
            <div key={groupIdx} className="space-y-3">
              {/* Date Divider */}
              <div className="flex justify-center my-3">
                <span className="px-3 py-1 bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full text-[11px] font-medium shadow-2xs">
                  {group.dateDivider}
                </span>
              </div>

              {/* Messages in Group */}
              {group.msgs.map((msg) => {
                const isOut = msg.direction === 'outgoing';

                return (
                  <div
                    key={msg.id}
                    className={`flex items-end gap-1.5 ${isOut ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`relative max-w-[85%] sm:max-w-[70%] min-w-0 px-3.5 py-2.5 shadow-xs ${getFontSizeClass()} leading-relaxed break-words [overflow-wrap:anywhere] ${
                        isOut
                          ? 'max-bubble-out text-white rounded-2xl rounded-br-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200/90 dark:border-slate-700 rounded-2xl rounded-bl-xs'
                      }`}
                    >
                      {/* Text */}
                      <p className="whitespace-pre-wrap select-text break-words [overflow-wrap:anywhere]">{msg.text}</p>

                      {/* Timestamp & Status footer */}
                      <div
                        className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                          isOut ? 'text-indigo-100/90' : 'text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        <span className="font-mono">{formatMessageTime(msg.timestamp)}</span>
                        {isOut && (
                          <span className="shrink-0">
                            {msg.status === 'sending' ? (
                              <Clock className="w-3 h-3 animate-spin opacity-75" />
                            ) : msg.status === 'failed' ? (
                              <button
                                type="button"
                                onClick={() => onRetryMessage?.(msg)}
                                title={lang === 'ru' ? 'Не отправлено. Нажмите, чтобы повторить' : 'Not sent. Click to retry'}
                                className="flex items-center gap-0.5 text-rose-200 hover:text-white hover:bg-white/20 rounded-md px-1 py-0.5 transition-colors cursor-pointer"
                              >
                                <span className="font-bold">!</span>
                                <RotateCw className="w-3 h-3" />
                              </button>
                            ) : (
                              <CheckCheck className="w-3.5 h-3.5 text-indigo-100" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Replies Bar */}
      {quickReplies && quickReplies.length > 0 && (
        <div className="px-3 sm:px-4 py-1.5 bg-slate-50/90 dark:bg-slate-900 border-t border-slate-200/60 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto text-[11px] scrollbar-none">
          <button
            type="button"
            onClick={onOpenQuickReplies}
            className="flex items-center gap-1 shrink-0 text-slate-500 dark:text-slate-400 hover:text-[#471AFF] dark:hover:text-indigo-300 transition-colors cursor-pointer mr-0.5"
            title={t.manageQuickReplies}
          >
            <Zap className="w-3.5 h-3.5 text-[#471AFF] dark:text-indigo-400 fill-[#471AFF]/20" />
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 hover:text-[#471AFF] dark:hover:text-indigo-300 hidden sm:inline">
              {t.quickRepliesTitle}:
            </span>
          </button>

          {quickReplies.map((qr) => (
            <div
              key={qr.id}
              className="group shrink-0 inline-flex items-center rounded-lg bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 text-slate-700 dark:text-slate-200 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/50 transition-all shadow-2xs overflow-hidden"
            >
              <button
                type="button"
                onClick={() => {
                  setInputText(qr.text);
                  inputRef.current?.focus();
                }}
                title={`${t.quickReplyInsert}: "${qr.text}"`}
                className="px-2.5 py-1 text-left cursor-pointer flex items-center gap-1 text-[11px] hover:text-[#471AFF] dark:hover:text-indigo-300"
              >
                <span className="font-semibold text-slate-800 dark:text-slate-100 group-hover:text-[#471AFF] dark:group-hover:text-indigo-300">{qr.title}</span>
                <span className="text-slate-400 dark:text-slate-500 group-hover:text-indigo-400 text-[10px] hidden md:inline max-w-[120px] truncate">
                  · {qr.text}
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleSendQuickPhrase(qr.text)}
                title={`${t.quickReplySend}: "${qr.text}"`}
                className="px-1.5 py-1 border-l border-slate-200/60 dark:border-slate-700 hover:bg-[#471AFF] text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <SendHorizonal className="w-3 h-3" />
              </button>
            </div>
          ))}

          {/* Quick Add / Manage Button */}
          {onOpenQuickReplies && (
            <button
              type="button"
              onClick={onOpenQuickReplies}
              title={t.manageQuickReplies}
              className="shrink-0 px-2 py-1 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-[#471AFF] dark:text-indigo-300 rounded-lg transition-colors cursor-pointer text-[10px] sm:text-[11px] font-semibold flex items-center gap-1 border border-indigo-100/80 dark:border-indigo-800"
            >
              <Plus className="w-3 h-3" />
              <span>{lang === 'ru' ? 'Настроить' : 'Manage'}</span>
            </button>
          )}
        </div>
      )}

      {/* Mobile Quick Actions Sheet (Bottom Control Panel) */}
      {showMobileActions && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs flex flex-col justify-end p-3 animate-in fade-in duration-150"
          onClick={() => setShowMobileActions(false)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden mb-2 animate-in slide-in-from-bottom-3 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{t.quickActions}</span>
              <button
                type="button"
                onClick={() => setShowMobileActions(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-1 divide-y divide-slate-100 dark:divide-slate-700 text-xs">
              {onOpenQuickReplies && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenQuickReplies();
                    setShowMobileActions(false);
                  }}
                  className="w-full px-3 py-3 text-left text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-slate-700 hover:text-[#471AFF] dark:hover:text-indigo-300 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <Zap className="w-4 h-4 text-[#471AFF]" />
                  <span className="font-medium">{t.quickRepliesTitle}</span>
                </button>
              )}
              {onSimulateTyping && chatId && (
                <button
                  type="button"
                  onClick={() => {
                    onSimulateTyping(chatId);
                    setShowMobileActions(false);
                  }}
                  className="w-full px-3 py-3 text-left text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-slate-700 hover:text-[#471AFF] dark:hover:text-indigo-300 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-[#471AFF]" />
                  <span className="font-medium">{t.testTyping}</span>
                </button>
              )}
              {onTogglePin && (
                <button
                  type="button"
                  onClick={() => {
                    onTogglePin(chatId);
                    setShowMobileActions(false);
                  }}
                  className="w-full px-3 py-3 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <Pin className={`w-4 h-4 ${isPinned ? 'text-[#471AFF] fill-[#471AFF]' : 'text-slate-500'} rotate-45`} />
                  <span className="font-medium">{isPinned ? t.unpinChat : t.pinChat}</span>
                </button>
              )}
              {onOpenSettings && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenSettings();
                    setShowMobileActions(false);
                  }}
                  className="w-full px-3 py-3 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <SettingsIcon className="w-4 h-4 text-slate-500" />
                  <span className="font-medium">{t.settingsTitle}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  onClearHistory(chatId);
                  setShowMobileActions(false);
                }}
                className="w-full px-3 py-3 text-left text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 flex items-center gap-2.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-rose-500" />
                <span className="font-medium">{t.clearHistory}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMobileActions(false);
                  onBackToSidebar();
                }}
                className="w-full px-3 py-3 text-left text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2.5 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 text-slate-400" />
                <span className="font-medium">{t.backToChats}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Input Bar */}
      <div className="p-2.5 sm:p-4 pb-safe bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
        <form
          onSubmit={handleSend}
          className="flex items-center gap-1.5 sm:gap-2 bg-slate-100/90 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-full px-2 sm:px-3 py-1.5 focus-within:border-[#471AFF] focus-within:bg-white dark:focus-within:bg-slate-800 focus-within:ring-2 focus-within:ring-[#471AFF]/15 transition-all shadow-2xs"
        >
          {/* Mobile Quick Action button */}
          <button
            type="button"
            onClick={() => setShowMobileActions(!showMobileActions)}
            className="md:hidden w-8.5 h-8.5 min-w-[34px] min-h-[34px] rounded-full text-slate-500 dark:text-slate-400 hover:text-[#471AFF] dark:hover:text-indigo-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title={t.quickActions}
          >
            <Plus className="w-4.5 h-4.5" />
          </button>

          <input
            ref={inputRef}
            type="text"
            disabled={isSending}
            value={inputText}
            maxLength={MAX_MESSAGE_LENGTH}
            autoComplete="off"
            onChange={(e) => {
              const val = e.target.value.slice(0, MAX_MESSAGE_LENGTH);
              setInputText(val);
              if (onSendTyping && chatId && val.trim() && Date.now() - lastTypingSentRef.current > 3500) {
                lastTypingSentRef.current = Date.now();
                onSendTyping(chatId);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder={t.typeMessagePlaceholder}
            className="flex-1 bg-transparent px-2 py-1 text-[16px] sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none disabled:opacity-60"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isSending}
            className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-full max-gradient-primary text-white flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0 shadow-xs hover:opacity-95 active:scale-95"
            title={t.send}
          >
            <SendHorizonal className="w-4 h-4 ml-0.5" />
          </button>
        </form>
      </div>

      {/* Quick Edit Contact Name & Real Phone Modal */}
      {isEditContactOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-[#471AFF] dark:text-indigo-400" />
                <span>{lang === 'ru' ? 'Редактировать контакт' : 'Edit Contact'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsEditContactOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveContactDetails} className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  {lang === 'ru' ? 'Имя или псевдоним собеседника' : 'Contact Name / Nickname'}
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder={lang === 'ru' ? 'например, Алексей' : 'e.g. Alex'}
                  className="w-full px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#471AFF] focus:ring-1 focus:ring-[#471AFF]"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  {lang === 'ru' ? 'Реальный номер телефона или ID' : 'Real Phone Number or ID'}
                </label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="+375 29 123-45-67 или 454641449"
                  className="w-full px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#471AFF] focus:ring-1 focus:ring-[#471AFF]"
                />
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                  {lang === 'ru' ? `Шлюз GREEN-API ID: ${chatId}` : `GREEN-API ID: ${chatId}`}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  {lang === 'ru' ? 'Заметка / Компания' : 'Note / Company'}
                </label>
                <input
                  type="text"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder={lang === 'ru' ? 'Клиент, коллега...' : 'Client, colleague...'}
                  className="w-full px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#471AFF] focus:ring-1 focus:ring-[#471AFF]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditContactOpen(false)}
                  className="px-3 py-1.5 rounded-xl text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium cursor-pointer"
                >
                  {lang === 'ru' ? 'Отмена' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl text-xs bg-gradient-to-r from-[#471AFF] to-indigo-600 text-white font-semibold hover:opacity-95 shadow-xs cursor-pointer"
                >
                  {lang === 'ru' ? 'Сохранить' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
