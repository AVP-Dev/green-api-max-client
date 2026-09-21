import React, { useState, useMemo } from 'react';
import {
  X,
  BookUser,
  Search,
  RefreshCw,
  UserPlus,
  Phone,
  MessageSquare,
  Trash2,
  Edit2,
  Check,
  Building,
  FileText,
  Clock,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { Contact, Language } from '../types';
import { translations } from '../i18n/translations';
import { formatDisplayPhone, sanitizePhone } from '../utils/formatters';
import { Avatar } from './Avatar';

interface AddressBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: Contact[];
  onSelectContact: (chatId: string, displayName?: string) => void;
  onSaveContact: (contact: Contact) => void;
  onDeleteContact: (id: string) => void;
  onSyncContacts: () => Promise<number>;
  isSyncing: boolean;
  lastSyncTime?: number | null;
  lang: Language;
}

export const AddressBookModal: React.FC<AddressBookModalProps> = ({
  isOpen,
  onClose,
  contacts,
  onSelectContact,
  onSaveContact,
  onDeleteContact,
  onSyncContacts,
  isSyncing,
  lastSyncTime,
  lang,
}) => {
  const t = translations[lang];
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);

  // Form inputs
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formCompany, setFormCompany] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const filteredContacts = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return contacts;

    return contacts.filter((c) => {
      const nameMatch =
        (c.contactName && c.contactName.toLowerCase().includes(query)) ||
        (c.name && c.name.toLowerCase().includes(query));
      const phoneMatch = c.id.includes(query);
      const companyMatch = c.company && c.company.toLowerCase().includes(query);
      const noteMatch = c.note && c.note.toLowerCase().includes(query);
      return Boolean(nameMatch || phoneMatch || companyMatch || noteMatch);
    });
  }, [contacts, searchQuery]);

  if (!isOpen) return null;

  const showFeedback = (msg: string) => {
    setFeedbackMessage(msg);
    setTimeout(() => {
      setFeedbackMessage((curr) => (curr === msg ? null : curr));
    }, 4000);
  };

  const handleStartAdd = () => {
    setEditingContactId(null);
    setFormName('');
    setFormPhone('');
    setFormCompany('');
    setFormNote('');
    setFormError(null);
    setIsAdding(true);
  };

  const handleStartEdit = (contact: Contact) => {
    setEditingContactId(contact.id);
    setFormName(contact.contactName || contact.name || '');
    setFormPhone(contact.id);
    setFormCompany(contact.company || '');
    setFormNote(contact.note || '');
    setFormError(null);
    setIsAdding(true);
  };

  const handleCancelForm = () => {
    setIsAdding(false);
    setEditingContactId(null);
    setFormError(null);
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = sanitizePhone(formPhone);

    if (!cleanId || cleanId.length < 10) {
      setFormError(
        lang === 'ru'
          ? 'Введите корректный номер телефона (не менее 10 цифр)'
          : 'Please enter a valid phone number (at least 10 digits)'
      );
      return;
    }

    const trimmedName = formName.trim();
    const existing = contacts.find((c) => c.id === cleanId);

    const updatedContact: Contact = {
      id: cleanId,
      name: existing?.name || trimmedName || undefined,
      contactName: trimmedName || undefined,
      company: formCompany.trim() || undefined,
      note: formNote.trim() || undefined,
      source: existing?.source || 'manual',
      type: existing?.type || 'user',
      updatedAt: Date.now(),
    };

    onSaveContact(updatedContact);
    setIsAdding(false);
    setEditingContactId(null);
    showFeedback(
      lang === 'ru'
        ? `Контакт ${trimmedName || cleanId} успешно сохранён`
        : `Contact ${trimmedName || cleanId} saved successfully`
    );
  };

  const handleTriggerSync = async () => {
    try {
      const count = await onSyncContacts();
      showFeedback(
        lang === 'ru'
          ? `Синхронизировано ${count} контактов из MAX / GREEN-API`
          : `Synced ${count} contacts from MAX / GREEN-API`
      );
    } catch (err: any) {
      showFeedback(
        lang === 'ru'
          ? `Ошибка синхронизации: ${err?.message || 'Не удалось связаться со шлюзом'}`
          : `Sync error: ${err?.message || 'Failed to reach API gateway'}`
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-[#471AFF] flex items-center justify-center shadow-2xs">
              <BookUser className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                  {lang === 'ru' ? 'Записная книжка MAX' : 'MAX Address Book'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-100 text-[#471AFF]">
                  {contacts.length}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                {lang === 'ru'
                  ? 'Синхронизация контактов через API для веб-мессенджера и интеграций'
                  : 'Contacts synchronized via API for web messenger & embed integrations'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Feedback Banner */}
        {feedbackMessage && (
          <div className="px-5 py-2.5 bg-emerald-50 border-b border-emerald-100 text-emerald-800 text-xs flex items-center gap-2 transition-all">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{feedbackMessage}</span>
          </div>
        )}

        {/* Top Controls: Search & Sync */}
        <div className="p-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                lang === 'ru'
                  ? 'Поиск по имени, номеру телефона, компании...'
                  : 'Search by name, phone number, company...'
              }
              className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#471AFF]/20 focus:border-[#471AFF] focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTriggerSync}
              disabled={isSyncing}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer shadow-2xs active:scale-95"
              title={
                lastSyncTime
                  ? `${lang === 'ru' ? 'Последняя синхронизация:' : 'Last sync:'} ${new Date(lastSyncTime).toLocaleTimeString()}`
                  : undefined
              }
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#471AFF] ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? (lang === 'ru' ? 'Синхронизация...' : 'Syncing...') : (lang === 'ru' ? 'Синхронизировать' : 'Sync Contacts')}</span>
            </button>

            <button
              type="button"
              onClick={handleStartAdd}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#471AFF] hover:bg-[#3b15d6] text-white text-xs font-semibold transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{lang === 'ru' ? 'Добавить контакт' : 'Add Contact'}</span>
            </button>
          </div>
        </div>

        {/* Add/Edit Form Overlay / Panel */}
        {isAdding && (
          <form
            onSubmit={handleSubmitForm}
            className="p-4 bg-indigo-50/50 border-b border-indigo-100 flex flex-col gap-3 shrink-0 animate-in slide-in-from-top-2 duration-150"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#471AFF]">
                {editingContactId
                  ? (lang === 'ru' ? 'Редактировать контакт' : 'Edit Contact')
                  : (lang === 'ru' ? 'Новый контакт в записную книжку' : 'New Contact')}
              </span>
              <button
                type="button"
                onClick={handleCancelForm}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                {t.cancel}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  {lang === 'ru' ? 'Имя или контактное лицо' : 'Full Name'}
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={lang === 'ru' ? 'Алексей Смирнов' : 'John Doe'}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#471AFF]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  {lang === 'ru' ? 'Номер телефона (MAX ID)' : 'Phone Number'}
                </label>
                <input
                  type="text"
                  required
                  disabled={Boolean(editingContactId)}
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="79991234567"
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-[#471AFF] disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  {lang === 'ru' ? 'Компания / Отдел (опционально)' : 'Company / Role (optional)'}
                </label>
                <input
                  type="text"
                  value={formCompany}
                  onChange={(e) => setFormCompany(e.target.value)}
                  placeholder={lang === 'ru' ? 'ООО «Технологии»' : 'Acme Corp'}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#471AFF]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  {lang === 'ru' ? 'Заметка / Тег (опционально)' : 'Note / Tag (optional)'}
                </label>
                <input
                  type="text"
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  placeholder={lang === 'ru' ? 'Клиент по интеграции API' : 'Key client'}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#471AFF]"
                />
              </div>
            </div>

            {formError && (
              <p className="text-xs text-rose-600 font-medium">{formError}</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleCancelForm}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-[#471AFF] hover:bg-[#3b15d6] text-white text-xs font-semibold shadow-xs cursor-pointer"
              >
                {lang === 'ru' ? 'Сохранить' : 'Save'}
              </button>
            </div>
          </form>
        )}

        {/* Contacts List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 divide-y divide-slate-100/80">
          {filteredContacts.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-[#471AFF] flex items-center justify-center mx-auto mb-3 shadow-2xs">
                <BookUser className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800 mb-1">
                {contacts.length === 0
                  ? (lang === 'ru' ? 'Записная книжка пуста' : 'Address book is empty')
                  : (lang === 'ru' ? 'Контакты не найдены' : 'No contacts found')}
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
                {contacts.length === 0
                  ? (lang === 'ru'
                      ? 'Нажмите «Синхронизировать» для загрузки списка контактов из вашего аккаунта MAX через GREEN-API, либо добавьте контакт вручную.'
                      : 'Click "Sync Contacts" to pull contacts from your MAX account via GREEN-API, or add a contact manually.')
                  : (lang === 'ru'
                      ? 'Попробуйте изменить поисковый запрос.'
                      : 'Try changing your search query.')}
              </p>
              {contacts.length === 0 && (
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={handleTriggerSync}
                    disabled={isSyncing}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#471AFF] text-white text-xs font-semibold shadow-xs hover:bg-[#3b15d6] cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{lang === 'ru' ? 'Загрузить контакты из MAX' : 'Load from MAX'}</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            filteredContacts.map((contact) => {
              const displayName = contact.contactName || contact.name || formatDisplayPhone(contact.id);
              const formattedPhone = formatDisplayPhone(contact.id);

              return (
                <div
                  key={contact.id}
                  className="pt-2.5 first:pt-0 flex items-center justify-between gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Avatar
                      id={contact.id}
                      name={displayName}
                      avatarUrl={contact.avatarUrl}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900 text-xs sm:text-sm truncate">
                          {displayName}
                        </span>
                        {/* Source Badge */}
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium tracking-tight ${
                            contact.source === 'api'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              : contact.source === 'manual'
                              ? 'bg-indigo-50 text-[#471AFF] border border-indigo-100'
                              : 'bg-amber-50 text-amber-800 border border-amber-100'
                          }`}
                        >
                          {contact.source === 'api'
                            ? 'MAX API'
                            : contact.source === 'manual'
                            ? (lang === 'ru' ? 'Вручную' : 'Manual')
                            : (lang === 'ru' ? 'Из чата' : 'Chat')}
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5 text-[11px] text-slate-500 mt-0.5">
                        <span className="font-mono text-slate-600">{formattedPhone}</span>
                        {contact.company && (
                          <span className="hidden sm:inline-flex items-center gap-1 text-slate-500 truncate">
                            <Building className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{contact.company}</span>
                          </span>
                        )}
                        {contact.note && (
                          <span className="hidden md:inline-flex items-center gap-1 text-slate-400 italic truncate max-w-[140px]">
                            <FileText className="w-3 h-3 shrink-0" />
                            <span className="truncate">{contact.note}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectContact(contact.id, displayName);
                        onClose();
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#471AFF] hover:bg-[#3b15d6] text-white text-xs font-semibold shadow-2xs transition-all active:scale-95 cursor-pointer"
                      title={lang === 'ru' ? 'Открыть чат' : 'Open chat'}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{lang === 'ru' ? 'Написать' : 'Message'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleStartEdit(contact)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors cursor-pointer"
                      title={lang === 'ru' ? 'Редактировать' : 'Edit'}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteContact(contact.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      title={lang === 'ru' ? 'Удалить из книжки' : 'Delete'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#471AFF]" />
            <span>
              {lang === 'ru'
                ? 'Контакты доступны для интеграции через REST API и postMessage'
                : 'Contacts available for integration via REST API and postMessage'}
            </span>
          </div>
          {lastSyncTime && (
            <span className="text-slate-400 hidden sm:inline">
              {lang === 'ru' ? 'Обновлено:' : 'Updated:'} {new Date(lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
