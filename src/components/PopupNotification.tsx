import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, X, ArrowRight, Bell } from 'lucide-react';
import { Avatar } from './Avatar';
import { formatDisplayPhone } from '../utils/formatters';
import { Language } from '../types';

export interface PopupNotificationData {
  id: string;
  chatId: string;
  senderName?: string;
  text: string;
  timestamp: number;
  avatarUrl?: string;
}

interface PopupNotificationProps {
  notification: PopupNotificationData | null;
  lang: Language;
  onOpenChat: (chatId: string) => void;
  onDismiss: () => void;
}

export const PopupNotification: React.FC<PopupNotificationProps> = ({
  notification,
  lang,
  onOpenChat,
  onDismiss,
}) => {
  const isRu = lang === 'ru';
  const [canRequestPermission, setCanRequestPermission] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setCanRequestPermission(Notification.permission === 'default');
    }
  }, []);

  // Auto-dismiss after 7 seconds
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 7000);
    return () => clearTimeout(timer);
  }, [notification, onDismiss]);

  const handleRequestDesktopPermission = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const result = await Notification.requestPermission();
        if (result === 'granted') {
          setCanRequestPermission(false);
          new Notification(isRu ? 'Уведомления включены' : 'Notifications enabled', {
            body: isRu
              ? 'Теперь вы будете получать уведомления о новых сообщениях'
              : 'You will now receive desktop notifications for new messages',
          });
        }
      } catch (err) {
        console.warn('Failed to request notification permission:', err);
      }
    }
  };

  const displayName = notification?.senderName || (notification ? formatDisplayPhone(notification.chatId) : '');
  const displayPhone = notification ? formatDisplayPhone(notification.chatId) : '';

  return (
    <div className="fixed top-4 right-4 z-[9999] max-w-sm w-full pointer-events-none px-3 sm:px-0">
      <AnimatePresence>
        {notification && (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, y: -24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="pointer-events-auto bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-2xl shadow-2xl border-2 border-indigo-200/80 dark:border-indigo-700/60 p-3.5 flex flex-col gap-2.5 cursor-pointer hover:shadow-indigo-500/10 transition-all group ring-1 ring-black/5"
            onClick={() => onOpenChat(notification.chatId)}
          >
            {/* Top Row: App info, badge & close button */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700 pb-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#471AFF] animate-ping" />
                <span className="text-[11px] font-bold tracking-wide uppercase text-[#471AFF] dark:text-indigo-300 flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5" />
                  {isRu ? 'Новое сообщение' : 'New Message'}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono font-medium">
                  {new Date(notification.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDismiss();
                  }}
                  className="p-1 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer ml-1"
                  title={isRu ? 'Закрыть' : 'Dismiss'}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Middle Row: Avatar & Message Details */}
            <div className="flex items-start gap-3">
              <Avatar
                id={notification.chatId}
                name={displayName}
                avatarUrl={notification.avatarUrl}
                size="md"
                className="shrink-0 ring-2 ring-indigo-100 dark:ring-indigo-800 shadow-xs"
              />

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                    {displayName}
                  </h4>
                </div>

                {notification.senderName && (
                  <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 truncate">
                    {displayPhone}
                  </p>
                )}

                <p className="text-[12px] text-slate-700 dark:text-slate-200 mt-1 line-clamp-2 leading-snug font-normal break-words [overflow-wrap:anywhere]">
                  {notification.text}
                </p>
              </div>
            </div>

            {/* Bottom Row: Actions */}
            <div className="flex items-center justify-between pt-1">
              {canRequestPermission ? (
                <button
                  type="button"
                  onClick={handleRequestDesktopPermission}
                  className="text-[11px] text-indigo-600 dark:text-indigo-300 hover:text-indigo-800 dark:hover:text-indigo-200 flex items-center gap-1 font-semibold hover:underline cursor-pointer bg-indigo-50/80 dark:bg-indigo-950/60 px-2 py-0.5 rounded-lg border border-indigo-100 dark:border-indigo-800"
                  title={isRu ? 'Включить системные уведомления рабочего стола' : 'Enable desktop notifications'}
                >
                  <Bell className="w-3 h-3 text-[#471AFF] dark:text-indigo-300" />
                  <span>{isRu ? 'Включить в браузере' : 'Enable in browser'}</span>
                </button>
              ) : (
                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                  {isRu ? 'Нажмите, чтобы открыть диалог' : 'Click to open chat'}
                </span>
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenChat(notification.chatId);
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#471AFF] to-indigo-600 text-white text-[11px] font-bold hover:opacity-95 active:scale-95 transition-all shadow-xs cursor-pointer ml-auto"
              >
                <span>{isRu ? 'Открыть' : 'Open'}</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
