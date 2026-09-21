import React, { useState } from 'react';
import {
  X,
  Plus,
  Edit2,
  Trash2,
  Check,
  RotateCcw,
  Sparkles,
  Zap,
  MessageSquare,
  AlertCircle,
} from 'lucide-react';
import { QuickReply, Language } from '../types';
import { translations } from '../i18n/translations';
import { getDefaultQuickReplies } from '../utils/quickReplies';

// Re-export для обратной совместимости существующих импортов.
export { getDefaultQuickReplies };

interface QuickRepliesModalProps {
  isOpen: boolean;
  onClose: () => void;
  quickReplies: QuickReply[];
  onSaveQuickReplies: (replies: QuickReply[]) => void;
  onSelectQuickReply?: (text: string) => void;
  lang: Language;
}

export const QuickRepliesModal: React.FC<QuickRepliesModalProps> = ({
  isOpen,
  onClose,
  quickReplies,
  onSaveQuickReplies,
  onSelectQuickReply,
  lang,
}) => {
  const t = translations[lang];

  // Editor mode: null = list, 'new' = creating new, string = editing id
  const [editingId, setEditingId] = useState<string | null>(null);
  const [titleInput, setTitleInput] = useState('');
  const [textInput, setTextInput] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const startCreate = () => {
    setEditingId('new');
    setTitleInput('');
    setTextInput('');
  };

  const startEdit = (reply: QuickReply) => {
    setEditingId(reply.id);
    setTitleInput(reply.title);
    setTextInput(reply.text);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setTitleInput('');
    setTextInput('');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanText = textInput.trim();
    if (!cleanText) return;

    const cleanTitle = titleInput.trim() || cleanText.slice(0, 20);

    if (editingId === 'new') {
      const newReply: QuickReply = {
        id: `qr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: cleanTitle,
        text: cleanText,
        createdAt: Date.now(),
      };
      onSaveQuickReplies([...quickReplies, newReply]);
    } else if (editingId) {
      const updated = quickReplies.map((qr) =>
        qr.id === editingId ? { ...qr, title: cleanTitle, text: cleanText } : qr
      );
      onSaveQuickReplies(updated);
    }

    setEditingId(null);
    setTitleInput('');
    setTextInput('');
  };

  const handleDelete = (id: string) => {
    onSaveQuickReplies(quickReplies.filter((qr) => qr.id !== id));
    if (editingId === id) {
      setEditingId(null);
    }
    setDeleteConfirmId(null);
  };

  const handleResetDefaults = () => {
    const defaults = getDefaultQuickReplies(lang);
    onSaveQuickReplies(defaults);
    setEditingId(null);
  };

  const filteredReplies = quickReplies.filter(
    (qr) =>
      qr.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      qr.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-50 via-white to-slate-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#00BFFF]/20 via-[#471AFF]/20 to-[#9500FF]/20 flex items-center justify-center text-[#471AFF] shadow-2xs">
              <Zap className="w-5 h-5 fill-[#471AFF]/10" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight flex items-center gap-2">
                <span>{t.quickRepliesTitle}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-[#471AFF] dark:text-indigo-300 font-semibold border border-indigo-100 dark:border-indigo-800">
                  {quickReplies.length}
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t.quickRepliesSubtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Create / Edit Form */}
          {editingId !== null ? (
            <form
              onSubmit={handleSave}
              className="bg-indigo-50/40 dark:bg-indigo-950/30 border border-indigo-100/90 dark:border-indigo-800 rounded-2xl p-4 space-y-3.5 animate-in fade-in duration-150"
            >
              <div className="flex items-center justify-between pb-1 border-b border-indigo-100/60 dark:border-indigo-800/60">
                <span className="text-xs font-bold text-[#471AFF] dark:text-indigo-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  {editingId === 'new' ? t.newQuickReply : t.editQuickReply}
                </span>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
                >
                  {t.cancel}
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  {t.quickReplyTitleLabel}
                </label>
                <input
                  type="text"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  placeholder={t.quickReplyTitlePlaceholder}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl focus:outline-none focus:border-[#471AFF] focus:ring-2 focus:ring-[#471AFF]/15 transition-all"
                  maxLength={40}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1 flex items-center justify-between">
                  <span>{t.quickReplyTextLabel}</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    {textInput.length}/1000
                  </span>
                </label>
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder={t.quickReplyTextPlaceholder}
                  rows={3}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl focus:outline-none focus:border-[#471AFF] focus:ring-2 focus:ring-[#471AFF]/15 transition-all resize-none"
                  maxLength={1000}
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="px-3.5 py-1.5 rounded-xl text-xs text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={!textInput.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-[#471AFF] to-indigo-600 text-white shadow-xs hover:opacity-95 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{editingId === 'new' ? t.addQuickReply : t.editQuickReply}</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <button
                type="button"
                onClick={startCreate}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#471AFF] to-indigo-600 text-white text-xs font-semibold shadow-xs hover:opacity-95 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{t.addQuickReply}</span>
              </button>

              <div className="flex items-center gap-2">
                {quickReplies.length > 3 && (
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={lang === 'ru' ? 'Поиск шаблонов...' : 'Search templates...'}
                    className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl focus:outline-none focus:border-[#471AFF] focus:bg-white dark:focus:bg-slate-800 w-full sm:w-44"
                  />
                )}
                <button
                  type="button"
                  onClick={handleResetDefaults}
                  title={t.resetQuickReplies}
                  className="px-2.5 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t.resetQuickReplies}</span>
                </button>
              </div>
            </div>
          )}

          {/* Quick Replies List */}
          <div className="space-y-2 pt-1">
            {filteredReplies.length === 0 ? (
              <div className="text-center py-10 px-4 bg-slate-50/60 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                <MessageSquare className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{t.noQuickReplies}</p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                  {t.noQuickRepliesDesc}
                </p>
                {editingId === null && (
                  <button
                    type="button"
                    onClick={startCreate}
                    className="mt-3.5 px-3 py-1.5 text-xs text-[#471AFF] dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 font-semibold rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t.addQuickReply}</span>
                  </button>
                )}
              </div>
            ) : (
              filteredReplies.map((reply) => {
                const isConfirmingDelete = deleteConfirmId === reply.id;
                const isCurrentlyEditing = editingId === reply.id;

                return (
                  <div
                    key={reply.id}
                    className={`group p-3 sm:p-3.5 rounded-2xl border transition-all ${
                      isCurrentlyEditing
                        ? 'border-[#471AFF] bg-indigo-50/30 dark:bg-indigo-950/30'
                        : 'border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                            {reply.title}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-mono">
                            {reply.text.length} {lang === 'ru' ? 'зн.' : 'chars'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2 select-text">
                          {reply.text}
                        </p>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1 shrink-0 pt-0.5">
                        {isConfirmingDelete ? (
                          <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl px-2 py-1 animate-in fade-in duration-150">
                            <span className="text-[10px] text-rose-600 dark:text-rose-300 font-medium">
                              {lang === 'ru' ? 'Удалить?' : 'Delete?'}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDelete(reply.id)}
                              className="px-1.5 py-0.5 bg-rose-600 text-white text-[10px] font-bold rounded-lg hover:bg-rose-700 cursor-pointer"
                            >
                              Да
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(null)}
                              className="px-1.5 py-0.5 text-slate-600 dark:text-slate-300 text-[10px] hover:bg-slate-200/60 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                            >
                              Нет
                            </button>
                          </div>
                        ) : (
                          <>
                            {onSelectQuickReply && (
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectQuickReply(reply.text);
                                  onClose();
                                }}
                                title={t.quickReplyInsert}
                                className="px-2 py-1 text-[11px] font-medium text-[#471AFF] dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 rounded-lg transition-colors cursor-pointer"
                              >
                                {t.quickReplyInsert}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => startEdit(reply)}
                              title={t.editQuickReply}
                              className="p-1.5 text-slate-400 hover:text-[#471AFF] dark:hover:text-indigo-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(reply.id)}
                              title={t.deleteQuickReply}
                              className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1 text-[11px]">
            <AlertCircle className="w-3.5 h-3.5 text-indigo-400" />
            {lang === 'ru'
              ? 'Шаблоны сохраняются локально и доступны во всех чатах'
              : 'Templates are saved locally and available across all chats'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
          >
            {lang === 'ru' ? 'Закрыть' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
