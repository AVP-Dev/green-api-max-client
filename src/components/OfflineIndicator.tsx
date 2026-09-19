import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { Language } from '../types';

interface OfflineIndicatorProps {
  lang: Language;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ lang }) => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      id="pwa-offline-indicator"
      className="fixed bottom-16 md:bottom-4 left-4 right-4 md:right-auto md:left-4 z-40 flex items-center justify-between gap-2.5 rounded-2xl bg-slate-900/90 backdrop-blur-md px-4 py-2.5 text-xs font-medium text-white shadow-xl border border-slate-700/80 animate-in slide-in-from-bottom-3 duration-200"
    >
      <div className="flex items-center gap-2 min-w-0 truncate">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
        <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
        <span className="truncate">
          {lang === 'ru'
            ? 'Оффлайн-режим — нет подключения к сети'
            : 'Offline mode — no internet connection'}
        </span>
      </div>
    </div>
  );
};
