import React, { useState } from 'react';
import { X, UserPlus, Phone, ArrowRight, ShieldAlert, BookUser } from 'lucide-react';
import { Contact, Language } from '../types';
import { translations } from '../i18n/translations';
import { sanitizePhone, formatDisplayPhone } from '../utils/formatters';
import { Avatar } from './Avatar';

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartChat: (cleanPhone: string, displayName?: string) => void;
  contacts?: Contact[];
  onOpenAddressBook?: () => void;
  lang: Language;
}

export const NewChatModal: React.FC<NewChatModalProps> = ({
  isOpen,
  onClose,
  onStartChat,
  contacts = [],
  onOpenAddressBook,
  lang,
}) => {
  const t = translations[lang];
  const [phoneInput, setPhoneInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const sanitized = sanitizePhone(phoneInput);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (sanitized.length < 10) {
      setError(t.phoneError);
      return;
    }
    setError(null);
    const matched = contacts.find((c) => c.id === sanitized);
    const resolvedName = matched?.contactName || matched?.name;
    onStartChat(sanitized, resolvedName);
    setPhoneInput('');
    onClose();
  };

  const handleQuickPreset = (presetPhone: string, displayName?: string) => {
    onStartChat(presetPhone, displayName);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-[#471AFF] dark:text-indigo-300 flex items-center justify-center">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">{t.newChatModalTitle}</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{t.newChatModalSubtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
              {t.phoneLabel}
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                autoFocus
                value={phoneInput}
                onChange={(e) => {
                  setPhoneInput(e.target.value);
                  if (error) setError(null);
                }}
                placeholder={t.phonePlaceholder}
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#471AFF]/20 focus:border-[#471AFF] focus:bg-white dark:focus:bg-slate-800 transition-all font-mono"
              />
            </div>
          </div>

          {/* Sanitized Live Preview */}
          {sanitized && (
            <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-xl border border-indigo-100/80 dark:border-indigo-800 text-xs text-slate-900 dark:text-slate-100 flex flex-col gap-1">
              <div className="text-[11px] text-[#471AFF] dark:text-indigo-300 font-semibold">
                {lang === 'ru' ? 'Идентификатор в MAX (строго цифры):' : 'MAX Identifier (plain numeric):'}
              </div>
              <div className="font-mono font-bold text-sm text-slate-950 dark:text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Avatar id={sanitized} size="xs" />
                  <span>{sanitized}</span>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-sans font-normal">
                  {formatDisplayPhone(sanitized)}
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Selection from Address Book if contacts exist */}
          {contacts.length > 0 && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between text-[11px] mb-2">
                <span className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <BookUser className="w-3.5 h-3.5 text-[#471AFF] dark:text-indigo-400" />
                  <span>{t.chooseFromContacts || (lang === 'ru' ? 'Или выберите из записной книжки:' : 'Or select from address book:')}</span>
                </span>
                {onOpenAddressBook && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAddressBook();
                    }}
                    className="text-[#471AFF] dark:text-indigo-300 hover:underline font-semibold cursor-pointer"
                  >
                    {lang === 'ru' ? `Все (${contacts.length}) →` : `All (${contacts.length}) →`}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-0.5">
                {contacts.slice(0, 6).map((c) => {
                  const name = c.contactName || c.name || formatDisplayPhone(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleQuickPreset(c.id, name)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-indigo-50/70 dark:bg-indigo-950/50 hover:bg-indigo-100/90 dark:hover:bg-indigo-900 text-slate-800 dark:text-slate-100 rounded-xl transition-all cursor-pointer border border-indigo-100 dark:border-indigo-800 shadow-2xs group active:scale-95"
                    >
                      <Avatar id={c.id} name={name} avatarUrl={c.avatarUrl} size="xs" />
                      <span className="font-medium truncate max-w-[120px]">{name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick presets for testing */}
          <div className="pt-1">
            <div className="text-[11px] text-slate-400 dark:text-slate-500 mb-1.5 font-medium">
              {lang === 'ru' ? 'Быстрый пример номера:' : 'Quick sample number:'}
            </div>
            <div className="flex flex-wrap gap-2">
              {['79991234567', '79260001122', '79851112233'].map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => handleQuickPreset(sample)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  <Avatar id={sample} size="xs" />
                  <span>+{sample}</span>
                </button>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed pt-1">
            {t.phoneHint}
          </p>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={sanitized.length < 10}
              className="px-4 py-2 max-gradient-primary text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer hover:opacity-95"
            >
              <span>{t.startChatButton}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
