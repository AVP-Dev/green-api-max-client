import React, { useState, useMemo, useRef } from 'react';
import {
  Search,
  UserPlus,
  LogOut,
  Globe,
  Radio,
  Trash2,
  Check,
  CheckCheck,
  Clock,
  Sparkles,
  AlertCircle,
  Settings as SettingsIcon,
  Pin,
  X,
  BookUser,
  Code2,
  RotateCw
} from 'lucide-react';
import { ChatDialog, Contact, GreenApiCredentials, Language, PollingStatus } from '../types';
import { translations } from '../i18n/translations';
import { formatDisplayPhone, formatMessageTime } from '../utils/formatters';
import { Avatar } from './Avatar';
import { MaxLogo } from './MaxLogo';
import { MobileBottomNav } from './MobileBottomNav';

interface SidebarProps {
  creds: GreenApiCredentials;
  dialogs: ChatDialog[];
  activeChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onOpenNewChat: () => void;
  onDeleteChat: (chatId: string) => void;
  onSignOut: () => void;
  pollingStatus: PollingStatus;
  pollingErrorMessage?: string | null;
  onRetryPolling?: () => void;
  lang: Language;
  onToggleLang: () => void;
  receiptCount?: number;
  onOpenSettings: () => void;
  onOpenAddressBook?: () => void;
  onOpenIntegration?: () => void;
  contactsCount?: number;
  contactsMap?: Map<string, Contact>;
  showPhoneFormatting?: boolean;
  onTogglePinChat?: (chatId: string) => void;
  typingChats?: Record<string, boolean>;
}

export const Sidebar: React.FC<SidebarProps> = ({
  creds,
  dialogs,
  activeChatId,
  onSelectChat,
  onOpenNewChat,
  onDeleteChat,
  onSignOut,
  pollingStatus,
  pollingErrorMessage,
  onRetryPolling,
  lang,
  onToggleLang,
  onOpenSettings,
  onOpenAddressBook,
  onOpenIntegration,
  contactsCount = 0,
  contactsMap,
  showPhoneFormatting = true,
  onTogglePinChat,
  typingChats = {},
}) => {
  const t = translations[lang];
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = () => {
    setIsRetrying(true);
    onRetryPolling?.();
    setTimeout(() => setIsRetrying(false), 800);
  };

  const totalUnreadCount = useMemo(() => {
    return dialogs.reduce((acc, d) => acc + (d.unreadCount || 0), 0);
  }, [dialogs]);

  const sortedAndFilteredDialogs = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    const list = dialogs.filter((d) => {
      if (!query) return true;
      const contact = contactsMap?.get(d.chatId);
      return (
        d.chatId.includes(query) ||
        (d.displayName && d.displayName.toLowerCase().includes(query)) ||
        (contact?.contactName && contact.contactName.toLowerCase().includes(query)) ||
        (contact?.name && contact.name.toLowerCase().includes(query)) ||
        d.lastMessageText.toLowerCase().includes(query)
      );
    });

    return [...list].sort((a, b) => {
      // 1. Pinned chats sort to the top
      const aPinned = a.isPinned ? 1 : 0;
      const bPinned = b.isPinned ? 1 : 0;
      if (aPinned !== bPinned) {
        return bPinned - aPinned;
      }
      // 2. Sort by latest message timestamp descending
      return (b.lastMessageTimestamp || 0) - (a.lastMessageTimestamp || 0);
    });
  }, [dialogs, searchQuery, contactsMap]);

  const getStatusBadge = () => {
    switch (pollingStatus) {
      case 'active':
        return (
          <span className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-medium min-w-0 truncate" title={t.statusActive}>
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="truncate">{t.statusActive}</span>
          </span>
        );
      case 'reconnecting':
        return (
          <span className="flex items-center gap-1.5 text-[11px] text-amber-600 font-medium min-w-0 truncate" title={t.statusReconnecting}>
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0"></span>
            <span className="truncate">{t.statusReconnecting}</span>
          </span>
        );
      case 'error':
        return (
          <button
            type="button"
            onClick={handleRetry}
            className="flex items-center gap-1.5 text-[11px] text-rose-600 font-medium min-w-0 truncate hover:text-rose-700 transition-colors cursor-pointer"
            title={`${pollingErrorMessage || t.statusError} (${lang === 'ru' ? 'Нажмите для повтора' : 'Click to retry'})`}
          >
            <span className="inline-block w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
            <span className="truncate">{t.statusError}</span>
            <RotateCw className={`w-2.5 h-2.5 ml-0.5 text-rose-500 ${isRetrying ? 'animate-spin' : ''}`} />
          </button>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium min-w-0 truncate">
            <span className="inline-block w-2 h-2 rounded-full bg-slate-300 shrink-0"></span>
            <span className="truncate">{t.statusPaused}</span>
          </span>
        );
    }
  };

  return (
    <aside className="w-full md:w-[340px] lg:w-[380px] h-full flex flex-col bg-white border-r border-slate-200 shrink-0 select-none">
      {/* Profile Bar Header */}
      <div className="p-3.5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <MaxLogo id="sidebar-logo" size="md" variant="icon" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-bold text-xs text-slate-900 truncate shrink-0">
                {t.appName}
              </span>
              <span className="text-[10px] font-mono text-slate-500 truncate">
                #{creds.idInstance}
              </span>
            </div>
            <div className="mt-0.5 min-w-0">{getStatusBadge()}</div>
          </div>
        </div>

        {/* Header Action icons: Address Book, Integration, Settings */}
        <div className="flex items-center gap-1 shrink-0">
          {onOpenAddressBook && (
            <button
              id="sidebar-address-book-button"
              type="button"
              onClick={onOpenAddressBook}
              className="relative p-2 text-slate-500 hover:text-[#471AFF] hover:bg-indigo-50 rounded-xl transition-colors cursor-pointer"
              title={lang === 'ru' ? 'Записная книжка MAX' : 'MAX Address Book'}
            >
              <BookUser className="w-4 h-4" />
              {contactsCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 rounded-full bg-[#471AFF] text-white text-[9px] font-bold flex items-center justify-center leading-none">
                  {contactsCount > 99 ? '99+' : contactsCount}
                </span>
              )}
            </button>
          )}

          {onOpenIntegration && (
            <button
              id="sidebar-integration-button"
              type="button"
              onClick={onOpenIntegration}
              className="p-2 text-slate-500 hover:text-[#471AFF] hover:bg-indigo-50 rounded-xl transition-colors cursor-pointer"
              title={lang === 'ru' ? 'Интеграция в сервисы (iframe, API)' : 'Service Integration (iframe, API)'}
            >
              <Code2 className="w-4 h-4" />
            </button>
          )}

          <button
            id="sidebar-settings-button"
            type="button"
            onClick={onOpenSettings}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
            title={t.settingsTitle}
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search & New Chat Bar */}
      <div className="p-3 border-b border-slate-100 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full pl-9 pr-8 py-2 sm:py-1.5 bg-slate-100/80 border border-transparent hover:border-slate-200 focus:border-[#471AFF] focus:ring-1 focus:ring-[#471AFF]/20 rounded-xl text-[16px] sm:text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white transition-all"
          />
          {searchQuery && (
            <button
              id="sidebar-clear-search-button"
              type="button"
              onClick={() => {
                setSearchQuery('');
                searchInputRef.current?.focus();
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-md cursor-pointer transition-colors"
              title={lang === 'ru' ? 'Очистить поиск' : 'Clear search'}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <button
          id="sidebar-new-chat-button"
          type="button"
          onClick={onOpenNewChat}
          className="flex items-center justify-center p-2.5 sm:p-2 min-h-[40px] min-w-[40px] sm:min-h-0 sm:min-w-0 max-gradient-primary text-white rounded-xl shadow-xs hover:opacity-95 transition-all cursor-pointer shrink-0"
          title={t.newChatButton}
        >
          <UserPlus className="w-4 h-4" />
        </button>
      </div>

      {/* Network Error Alert Banner with instant Retry and Settings button */}
      {pollingStatus === 'error' && (
        <div className="mx-3 my-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200/80 flex flex-col gap-1.5 text-[11px] text-rose-900 animate-in fade-in duration-200">
          <div className="flex items-start gap-1.5 min-w-0">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <span className="font-semibold">{t.statusError}: </span>
              <span className="text-rose-700 break-words [overflow-wrap:anywhere]">
                {pollingErrorMessage || (lang === 'ru' ? 'Сбой соединения со шлюзом' : 'Gateway connection failure')}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-end gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={handleRetry}
              disabled={isRetrying}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-rose-200 text-rose-700 font-medium hover:bg-rose-100/70 transition-colors cursor-pointer shadow-2xs text-[11px]"
            >
              <RotateCw className={`w-3 h-3 ${isRetrying ? 'animate-spin' : ''}`} />
              <span>{lang === 'ru' ? 'Повторить попытку' : 'Retry now'}</span>
            </button>
            <button
              type="button"
              onClick={onOpenSettings}
              className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-medium hover:bg-rose-700 transition-colors cursor-pointer text-[11px]"
            >
              {lang === 'ru' ? 'Диагностика' : 'Diagnostics'}
            </button>
          </div>
        </div>
      )}

      {/* Dialogs List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100/80">
        {sortedAndFilteredDialogs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50/70 flex items-center justify-center text-[#471AFF] mb-3">
              <Sparkles className="w-5 h-5" />
            </div>
            <h4 className="font-semibold text-xs text-slate-700 mb-1">
              {searchQuery ? (lang === 'ru' ? 'Ничего не найдено' : 'No chats found') : t.noChatsTitle}
            </h4>
            <p className="text-[11px] text-slate-400 leading-relaxed max-w-[220px] mb-4">
              {searchQuery 
                ? (lang === 'ru' ? `По запросу «${searchQuery}» нет диалогов` : `No chats match "${searchQuery}"`)
                : t.noChatsHint}
            </p>
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                <span>{lang === 'ru' ? 'Сбросить поиск' : 'Reset search'}</span>
              </button>
            ) : (
              <button
                id="sidebar-empty-new-chat-button"
                type="button"
                onClick={onOpenNewChat}
                className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-[#471AFF] text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{t.newChatButton}</span>
              </button>
            )}
          </div>
        ) : (
          sortedAndFilteredDialogs.map((dialog) => {
            const isActive = dialog.chatId === activeChatId;
            const displayPhone = showPhoneFormatting 
              ? formatDisplayPhone(dialog.chatId) 
              : dialog.chatId;

            const contact = contactsMap?.get(dialog.chatId);
            const resolvedName = dialog.displayName || contact?.contactName || contact?.name || displayPhone;
            const hasCustomName = Boolean(dialog.displayName || contact?.contactName || contact?.name);

            return (
              <div
                key={dialog.chatId}
                onClick={() => onSelectChat(dialog.chatId)}
                className={`group relative flex items-center gap-3 p-3 cursor-pointer transition-colors ${
                  isActive
                    ? 'bg-indigo-50/70 border-l-[3px] border-[#471AFF]'
                    : dialog.isPinned
                    ? 'bg-slate-50/50 hover:bg-slate-100/70 border-l-[3px] border-transparent'
                    : 'hover:bg-slate-50/80 border-l-[3px] border-transparent'
                }`}
              >
                {/* Avatar */}
                <Avatar
                  elementId={`chat-avatar-${dialog.chatId}`}
                  id={dialog.chatId}
                  name={resolvedName}
                  avatarUrl={contact?.avatarUrl}
                  size="lg"
                  className="shadow-2xs"
                />

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span
                      className={`text-xs font-semibold truncate ${
                        isActive ? 'text-[#471AFF]' : 'text-slate-900'
                      }`}
                      title={hasCustomName ? `${resolvedName} (${displayPhone})` : resolvedName}
                    >
                      {resolvedName}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {dialog.isPinned && (
                        <span title={t.pinned} className="text-[#471AFF] flex items-center">
                          <Pin className="w-3 h-3 fill-[#471AFF] rotate-45" />
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 font-mono">
                        {dialog.lastMessageTimestamp
                          ? formatMessageTime(dialog.lastMessageTimestamp)
                          : ''}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    {typingChats[dialog.chatId] ? (
                      <p className="text-[11px] font-semibold text-[#471AFF] flex items-center gap-1 leading-relaxed">
                        <span>{t.typing}</span>
                        <span className="inline-flex items-center gap-0.5">
                          <span className="w-1 h-1 rounded-full bg-[#471AFF] animate-bounce [animation-delay:-0.3s]" />
                          <span className="w-1 h-1 rounded-full bg-[#471AFF] animate-bounce [animation-delay:-0.15s]" />
                          <span className="w-1 h-1 rounded-full bg-[#471AFF] animate-bounce" />
                        </span>
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-500 truncate leading-relaxed">
                        {dialog.lastMessageDirection === 'outgoing' && (
                          <span className="text-slate-400 font-medium mr-0.5">{t.youPrefix}</span>
                        )}
                        {dialog.lastMessageText || '...'}
                      </p>
                    )}

                    {/* Unread badge */}
                    {dialog.unreadCount > 0 && (
                      <span className="h-4 min-w-[16px] px-1 max-gradient-primary text-white rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 shadow-2xs">
                        {dialog.unreadCount}
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Group: Pin/Unpin + Delete (visible on desktop hover) */}
                <div className="hidden md:group-hover:flex transition-opacity absolute right-2 top-2 items-center gap-0.5 bg-white/95 backdrop-blur-xs rounded-lg shadow-xs border border-slate-200/80 p-0.5 z-10">
                  {onTogglePinChat && (
                    <button
                      id={`pin-chat-${dialog.chatId}`}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTogglePinChat(dialog.chatId);
                      }}
                      className={`p-1.5 sm:p-1 rounded-md transition-colors cursor-pointer ${
                        dialog.isPinned
                          ? 'text-[#471AFF] hover:bg-indigo-50'
                          : 'text-slate-400 hover:text-[#471AFF] hover:bg-indigo-50'
                      }`}
                      title={dialog.isPinned ? t.unpinChat : t.pinChat}
                    >
                      <Pin className={`w-3.5 h-3.5 ${dialog.isPinned ? 'fill-[#471AFF]' : ''} rotate-45`} />
                    </button>
                  )}
                  <button
                    id={`delete-chat-${dialog.chatId}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteChat(dialog.chatId);
                    }}
                    className="p-1.5 sm:p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                    title={t.deleteChat}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Mobile Bottom Navigation Bar (Control buttons at bottom) */}
      <MobileBottomNav
        activeTab="chats"
        unreadCount={totalUnreadCount}
        lang={lang}
        onSelectChats={() => {
          setSearchQuery('');
        }}
        onOpenNewChat={onOpenNewChat}
        onOpenSettings={onOpenSettings}
      />
    </aside>
  );
};
