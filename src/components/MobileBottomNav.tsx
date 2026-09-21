import React from 'react';
import { 
  MessageSquare, 
  UserPlus, 
  Settings as SettingsIcon 
} from 'lucide-react';
import { Language } from '../types';
import { translations } from '../i18n/translations';

interface MobileBottomNavProps {
  activeTab?: 'chats' | 'newChat' | 'settings';
  unreadCount?: number;
  lang: Language;
  onSelectChats: () => void;
  onOpenNewChat: () => void;
  onOpenSettings: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab = 'chats',
  unreadCount = 0,
  lang,
  onSelectChats,
  onOpenNewChat,
  onOpenSettings,
}) => {
  const t = translations[lang];

  return (
    <nav
      id="mobile-bottom-navigation"
      aria-label="Mobile Navigation"
      className="md:hidden shrink-0 w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/90 dark:border-slate-800 shadow-[0_-4px_16px_rgba(0,0,0,0.04)] px-4 pt-2 pb-safe z-30 select-none"
    >
      <div className="grid grid-cols-3 gap-2 items-center max-w-sm mx-auto">
        {/* 1. Chats Tab */}
        <button
          id="mobile-nav-chats-button"
          type="button"
          onClick={onSelectChats}
          className={`flex flex-col items-center justify-center py-1 rounded-2xl transition-all cursor-pointer min-h-[52px] active:scale-95 ${
            activeTab === 'chats'
              ? 'text-[#471AFF] dark:text-indigo-300'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
          title={t.bottomNavChats}
        >
          <div className="relative flex items-center justify-center">
            <MessageSquare className={`w-5 h-5 transition-transform ${activeTab === 'chats' ? 'scale-105 stroke-[2.5]' : 'stroke-[1.8]'}`} />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-3 min-w-[18px] h-4.5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white shadow-xs animate-in zoom-in-50">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          <span className={`text-[11px] mt-1 tracking-tight transition-colors truncate max-w-full text-center px-0.5 ${
            activeTab === 'chats' ? 'font-bold text-[#471AFF] dark:text-indigo-300' : 'font-medium text-slate-600 dark:text-slate-400'
          }`}>
            {t.bottomNavChats}
          </span>
          {activeTab === 'chats' && (
            <div className="w-1.5 h-1.5 rounded-full bg-[#471AFF] mt-0.5" />
          )}
        </button>

        {/* 2. New Chat Action Tab */}
        <button
          id="mobile-nav-new-chat-button"
          type="button"
          onClick={onOpenNewChat}
          className="flex flex-col items-center justify-center py-1 rounded-2xl text-slate-600 dark:text-slate-400 hover:text-[#471AFF] dark:hover:text-indigo-300 transition-all cursor-pointer min-h-[52px] group active:scale-95"
          title={t.bottomNavNewChat}
        >
          <div className="w-8 h-8 rounded-full max-gradient-primary text-white flex items-center justify-center shadow-sm group-hover:shadow-indigo-300/40 transition-all">
            <UserPlus className="w-4 h-4 ml-0.5" />
          </div>
          <span className="text-[11px] mt-1 font-semibold text-slate-700 dark:text-slate-300 tracking-tight truncate max-w-full text-center px-0.5">
            {t.bottomNavNewChat}
          </span>
        </button>

        {/* 3. Settings Tab */}
        <button
          id="mobile-nav-settings-button"
          type="button"
          onClick={onOpenSettings}
          className={`flex flex-col items-center justify-center py-1 rounded-2xl transition-all cursor-pointer min-h-[52px] active:scale-95 ${
            activeTab === 'settings'
              ? 'text-[#471AFF] dark:text-indigo-300'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
          title={t.bottomNavSettings}
        >
          <div className="relative flex items-center justify-center">
            <SettingsIcon className={`w-5 h-5 transition-transform ${activeTab === 'settings' ? 'scale-105 stroke-[2.5]' : 'stroke-[1.8]'}`} />
          </div>
          <span className={`text-[11px] mt-1 tracking-tight transition-colors truncate max-w-full text-center px-0.5 ${
            activeTab === 'settings' ? 'font-bold text-[#471AFF] dark:text-indigo-300' : 'font-medium text-slate-600 dark:text-slate-400'
          }`}>
            {t.bottomNavSettings}
          </span>
          {activeTab === 'settings' && (
            <div className="w-1.5 h-1.5 rounded-full bg-[#471AFF] mt-0.5" />
          )}
        </button>
      </div>
    </nav>
  );
};
