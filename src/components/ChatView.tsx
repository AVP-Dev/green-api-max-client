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
  RotateCw
} from 'lucide-react';
import { AppSettings, ChatMessage, Contact, Language } from '../types';
import { translations } from '../i18n/translations';
import {
  formatDisplayPhone,
  formatMessageTime,
  formatDateDivider,
} from '../utils/formatters';
import { Avatar } from './Avatar';
import { MaxLogo } from './MaxLogo';

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
  onQuickSaveContact?: (chatId: string, name: string) => void;
  contact?: Contact;
  isPinned?: boolean;
  onTogglePin?: (chatId: string) => void;
  isTyping?: boolean;
  onSimulateTyping?: (chatId: string) => void;
  onSendTyping?: (chatId: string) => void;
  onSyncHistory?: (chatId: string) => void;
  isSyncingHistory?: boolean;
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
}) => {
  const t = translations[lang];
  const [inputText, setInputText] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [showMobileActions, setShowMobileActions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastTypingSentRef = useRef<number>(0);

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
      <div className="flex-1 h-full bg-slate-50 relative overflow-hidden flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="absolute top-1/3 left-1/4 w-80 h-80 bg-[#00BFFF]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#9500FF]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="w-18 h-18 rounded-3xl bg-white border border-slate-200/90 shadow-sm flex items-center justify-center mb-4 relative z-10">
          <MaxLogo id="chatview-empty-logo" size="xl" variant="icon" />
        </div>
        <h3 className="text-base font-bold text-slate-800 mb-1.5 relative z-10">{t.selectChatTitle}</h3>
        <p className="text-xs text-slate-500 max-w-sm leading-relaxed mb-6 relative z-10">
          {t.selectChatSubtitle}
        </p>
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/90 backdrop-blur-xs border border-slate-200/80 text-slate-600 text-xs shadow-2xs relative z-10">
          <ShieldCheck className="w-4 h-4 text-[#471AFF]" />
          <span className="font-medium">MAX Messenger · web.max.ru</span>
        </div>
      </div>
    );
  }

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
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
    <section className="flex-1 h-full flex flex-col bg-slate-50 overflow-hidden relative">
      {/* Top Bar Header */}
      <div className="h-16 px-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 shadow-2xs z-10">
        <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
          {/* Mobile back button */}
          <button
            type="button"
            onClick={onBackToSidebar}
            className="md:hidden min-w-[40px] min-h-[40px] flex items-center justify-center -ml-1 text-slate-600 hover:text-slate-900 active:scale-95 rounded-xl transition-all cursor-pointer shrink-0"
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
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 truncate flex items-center gap-1.5">
                <span className="truncate">{contact?.contactName || contact?.name || displayPhone}</span>
                {isPinned && (
                  <span title={t.pinned} className="inline-flex items-center text-[#471AFF] shrink-0">
                    <Pin className="w-3.5 h-3.5 fill-[#471AFF] rotate-45" />
                  </span>
                )}
              </h2>
              {/* Secondary phone or notebook status */}
              {(contact?.contactName || contact?.name) ? (
                <span className="text-[10px] font-mono text-slate-500 font-normal shrink-0 hidden sm:inline truncate">
                  {displayPhone}
                </span>
              ) : (
                <span className="text-[10px] font-mono text-slate-400 font-normal shrink-0 hidden sm:inline truncate">
                  ({chatId})
                </span>
              )}

              {/* Quick Book Tag */}
              {contact ? (
                <button
                  type="button"
                  onClick={onOpenAddressBook}
                  className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-[#471AFF] hover:bg-indigo-100 transition-colors cursor-pointer"
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
                    className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-[#471AFF] transition-colors cursor-pointer"
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
                <span className="text-[11px] font-semibold text-[#471AFF] flex items-center gap-1.5">
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
              className={`p-2 min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-400 hover:text-[#471AFF] hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50 ${
                isSyncingHistory ? 'text-[#471AFF]' : ''
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
              className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-400 hover:text-[#471AFF] hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer hidden sm:flex"
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
              className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              <MoreVertical className="w-5 h-5 sm:w-4 sm:h-4" />
            </button>

            {showOptions && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowOptions(false)} 
                />
                <div className="absolute right-0 mt-1 w-56 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
                  {onSyncHistory && chatId && (
                    <button
                      type="button"
                      onClick={() => {
                        onSyncHistory(chatId);
                        setShowOptions(false);
                      }}
                      disabled={isSyncingHistory}
                      className="w-full px-3 py-2 text-left text-slate-700 hover:bg-indigo-50 hover:text-[#471AFF] flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
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
                      className="w-full px-3 py-2 text-left text-slate-700 hover:bg-indigo-50 hover:text-[#471AFF] flex items-center gap-2 transition-colors cursor-pointer"
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
                      className="w-full px-3 py-2 text-left text-slate-700 hover:bg-indigo-50 hover:text-[#471AFF] flex items-center gap-2 transition-colors cursor-pointer"
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
                      className="w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer"
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
                      className="w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer"
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
                    className="w-full px-3 py-2 text-left text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors cursor-pointer"
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

      {/* Chat Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center text-blue-600 mb-3">
              <Sparkles className="w-5 h-5" />
            </div>
            <p className="text-xs text-slate-600 font-semibold mb-1">
              {lang === 'ru' ? 'Начните диалог с пользователем' : 'Start conversation with user'}
            </p>
            <p className="text-[11px] text-slate-400 max-w-xs mb-4">
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
                  className="text-left text-xs text-[#471AFF] bg-white hover:bg-indigo-50/70 border border-slate-200/90 hover:border-indigo-200 px-3 py-2 rounded-xl transition-all shadow-2xs cursor-pointer font-medium"
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
                <span className="px-3 py-1 bg-slate-200/80 text-slate-600 rounded-full text-[11px] font-medium shadow-2xs">
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
                          : 'bg-white text-slate-900 border border-slate-200/90 rounded-2xl rounded-bl-xs'
                      }`}
                    >
                      {/* Text */}
                      <p className="whitespace-pre-wrap select-text break-words [overflow-wrap:anywhere]">{msg.text}</p>

                      {/* Timestamp & Status footer */}
                      <div
                        className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                          isOut ? 'text-indigo-100/90' : 'text-slate-400'
                        }`}
                      >
                        <span className="font-mono">{formatMessageTime(msg.timestamp)}</span>
                        {isOut && (
                          <span className="shrink-0">
                            {msg.status === 'sending' ? (
                              <Clock className="w-3 h-3 animate-spin opacity-75" />
                            ) : msg.status === 'failed' ? (
                              <span className="text-rose-300 font-bold" title={t.sendFailed}>!</span>
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

      {/* Quick Template Chips (if messages exist) */}
      {messages.length > 0 && (
        <div className="px-4 py-1.5 bg-white/70 border-t border-slate-200/60 flex items-center gap-1.5 overflow-x-auto text-[11px] scrollbar-none">
          <span className="text-slate-400 shrink-0 text-[10px] font-medium hidden sm:inline">
            {t.quickPhrases}
          </span>
          {[t.quickPhrase1, t.quickPhrase2].map((phrase, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendQuickPhrase(phrase)}
              className="shrink-0 px-2.5 py-1 bg-slate-100/80 hover:bg-indigo-50 text-slate-600 hover:text-[#471AFF] rounded-lg transition-colors cursor-pointer font-medium"
            >
              {phrase.slice(0, 24)}...
            </button>
          ))}
        </div>
      )}

      {/* Mobile Quick Actions Sheet (Bottom Control Panel) */}
      {showMobileActions && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs flex flex-col justify-end p-3 animate-in fade-in duration-150"
          onClick={() => setShowMobileActions(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden mb-2 animate-in slide-in-from-bottom-3 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <span className="text-xs font-bold text-slate-800">{t.quickActions}</span>
              <button
                type="button"
                onClick={() => setShowMobileActions(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-1 divide-y divide-slate-100 text-xs">
              {onSimulateTyping && chatId && (
                <button
                  type="button"
                  onClick={() => {
                    onSimulateTyping(chatId);
                    setShowMobileActions(false);
                  }}
                  className="w-full px-3 py-3 text-left text-slate-700 hover:bg-indigo-50 hover:text-[#471AFF] flex items-center gap-2.5 transition-colors cursor-pointer"
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
                  className="w-full px-3 py-3 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer"
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
                  className="w-full px-3 py-3 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer"
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
                className="w-full px-3 py-3 text-left text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 transition-colors cursor-pointer"
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
                className="w-full px-3 py-3 text-left text-slate-600 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 text-slate-400" />
                <span className="font-medium">{t.backToChats}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Input Bar */}
      <div className="p-2.5 sm:p-4 pb-safe bg-white border-t border-slate-200">
        <form
          onSubmit={handleSend}
          className="flex items-center gap-1.5 sm:gap-2 bg-slate-100/90 border border-slate-200/80 rounded-full px-2 sm:px-3 py-1.5 focus-within:border-[#471AFF] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#471AFF]/15 transition-all shadow-2xs"
        >
          {/* Mobile Quick Action button */}
          <button
            type="button"
            onClick={() => setShowMobileActions(!showMobileActions)}
            className="md:hidden w-8.5 h-8.5 min-w-[34px] min-h-[34px] rounded-full text-slate-500 hover:text-[#471AFF] hover:bg-slate-200/70 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title={t.quickActions}
          >
            <Plus className="w-4.5 h-4.5" />
          </button>

          <input
            ref={inputRef}
            type="text"
            disabled={isSending}
            value={inputText}
            onChange={(e) => {
              const val = e.target.value;
              setInputText(val);
              if (onSendTyping && chatId && val.trim() && Date.now() - lastTypingSentRef.current > 3500) {
                lastTypingSentRef.current = Date.now();
                onSendTyping(chatId);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder={t.typeMessagePlaceholder}
            className="flex-1 bg-transparent px-2 py-1 text-[16px] sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none disabled:opacity-60"
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
    </section>
  );
};
