import React from 'react';

/** Плейсхолдеры сообщений чата на время syncHistory (animate-pulse, без layout-shift). */
export const ChatHistorySkeleton: React.FC<{ rows?: number }> = ({ rows = 4 }) => (
  <div className="space-y-3 p-1" aria-hidden="true" data-testid="chat-history-skeleton">
    {Array.from({ length: rows }).map((_, i) => {
      const isOut = i % 2 === 1;
      return (
        <div key={i} className={`flex items-end gap-1.5 ${isOut ? 'justify-end' : 'justify-start'}`}>
          <div
            className={`max-w-[75%] sm:max-w-[60%] px-3.5 py-2.5 rounded-2xl animate-pulse ${
              isOut
                ? 'rounded-br-xs bg-indigo-200/70 dark:bg-indigo-900/50'
                : 'rounded-bl-xs bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700'
            }`}
          >
            <div
              className="h-2.5 rounded-full bg-slate-200 dark:bg-slate-700"
              style={{ width: `${120 + ((i * 53) % 120)}px` }}
            />
            <div
              className="h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 mt-1.5"
              style={{ width: `${70 + ((i * 37) % 90)}px` }}
            />
          </div>
        </div>
      );
    })}
  </div>
);

/** Плейсхолдеры списка диалогов на время синхронизации (Sidebar). */
export const DialogListSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <div className="divide-y divide-slate-100/80 dark:divide-slate-800" aria-hidden="true" data-testid="dialog-list-skeleton">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
        <div className="w-11 h-11 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0" />
        <div className="flex-1 min-w-0">
          <div
            className="h-2.5 rounded-full bg-slate-200 dark:bg-slate-700"
            style={{ width: `${40 + ((i * 29) % 35)}%` }}
          />
          <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 mt-2 w-3/4" />
        </div>
        <div className="w-8 h-2 rounded-full bg-slate-100 dark:bg-slate-800 shrink-0" />
      </div>
    ))}
  </div>
);
