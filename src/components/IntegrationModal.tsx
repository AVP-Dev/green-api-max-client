import React, { useState } from 'react';
import {
  X,
  Code2,
  Copy,
  Check,
  ExternalLink,
  Layers,
  Sparkles,
  Terminal,
  Globe,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import { GreenApiCredentials, Language } from '../types';
import { translations } from '../i18n/translations';
import { getBaseUrl } from '../services/greenApi';

interface IntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  creds: GreenApiCredentials | null;
  activeChatId?: string | null;
  lang: Language;
}

export const IntegrationModal: React.FC<IntegrationModalProps> = ({
  isOpen,
  onClose,
  creds,
  activeChatId,
  lang,
}) => {
  const t = translations[lang];
  const [activeTab, setActiveTab] = useState<'iframe' | 'params' | 'postmessage' | 'api'>('iframe');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Embed Customizer options
  // SECURITY: includeCreds=false по умолчанию — ключи в URL утекают в историю/логи/Referer.
  // Рекомендуется postMessage MAX_SET_CREDS или ручной ввод.
  const [includeCreds, setIncludeCreds] = useState(false);
  const [includeActiveChat, setIncludeActiveChat] = useState(true);
  const [embedMode, setEmbedMode] = useState(true);
  const [customPhone, setCustomPhone] = useState(activeChatId || '79991234567');
  const [prefillMessage, setPrefillMessage] = useState('Здравствуйте! Сообщение из CRM.');

  if (!isOpen) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://web.max.ru';
  const baseUrl = getBaseUrl(creds);

  // Generate embed URL
  const queryParams = new URLSearchParams();
  if (includeCreds && creds) {
    queryParams.set('idInstance', creds.idInstance);
    queryParams.set('apiTokenInstance', creds.apiTokenInstance);
    if (creds.apiUrl && creds.apiUrl !== 'https://api.green-api.com') {
      queryParams.set('apiUrl', creds.apiUrl);
    }
  }
  if (includeActiveChat && customPhone.trim()) {
    queryParams.set('chatId', customPhone.trim());
  }
  if (prefillMessage.trim()) {
    queryParams.set('text', prefillMessage.trim());
  }
  if (embedMode) {
    queryParams.set('embedded', 'true');
  }

  const embedUrl = `${origin}?${queryParams.toString()}`;
  const iframeCode = `<iframe\n  src="${embedUrl}"\n  width="100%"\n  height="700"\n  style="border: none; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.08);"\n  allow="clipboard-write"\n  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"\n></iframe>`;

  const postMessageSampleCode = `// 0. Безопасность (OWASP): никогда не используйте '*' как targetOrigin в продакшене.
//    Подставьте точный origin iframe с мессенджером в MAX_WIDGET_ORIGIN.
//    Со стороны виджета доверенные origins родителя задаются через
//    ?parentOrigin=https://your-crm.example.com в URL iframe и/или
//    VITE_TRUSTED_PARENT_ORIGINS (см. src/utils/postMessageSecurity.ts).
const MAX_WIDGET_ORIGIN = 'https://your-max-widget.example.com';

// 1. Слушаем события из MAX Web Messenger в родительском окне (CRM, портал)
window.addEventListener('message', (event) => {
  // Принимаем события только от нашего виджета — сообщения с чужих origin отбрасываем.
  if (event.origin !== MAX_WIDGET_ORIGIN) return;

  const data = event.data;
  if (!data || typeof data !== 'object' || typeof data.type !== 'string') return;

  switch (data.type) {
    case 'MAX_READY':
      console.log('MAX Web Messenger готов к работе');
      break;

    case 'MAX_MESSAGE_RECEIVED':
      console.log('Новое входящее сообщение от:', data.payload.senderPhone, data.payload.text);
      // Например: обновить карточку лида или показать уведомление в CRM
      break;

    case 'MAX_MESSAGE_SENT':
      console.log('Сообщение отправлено пользователю:', data.payload.chatId);
      break;

    case 'MAX_CHAT_OPENED':
      console.log('Открыт чат с пользователем:', data.payload.chatId);
      break;
  }
});

// 2. Управление мессенджером из вашей CRM (через iframe window)
// Всегда указываем точный targetOrigin вместо '*'.
const maxIframe = document.querySelector('iframe').contentWindow;

// Открыть конкретный чат с клиентом:
maxIframe.postMessage({
  type: 'MAX_OPEN_CHAT',
  payload: {
    chatId: '79991234567',
    name: 'Иван Иванов',
    text: 'Здравствуйте! Заказ #1402 подтвержден.'
  }
}, MAX_WIDGET_ORIGIN);

// Отправить сообщение напрямую через шлюз:
maxIframe.postMessage({
  type: 'MAX_SEND_MESSAGE',
  payload: {
    chatId: '79991234567',
    text: 'Ваш курьер прибудет через 15 минут.'
  }
}, MAX_WIDGET_ORIGIN);`;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((curr) => (curr === key ? null : curr));
    }, 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-3xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-[#471AFF] dark:text-indigo-300 flex items-center justify-center shadow-2xs">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 dark:text-white text-sm sm:text-base">
                {lang === 'ru' ? 'Интеграция MAX в любые сервисы' : 'Integrate MAX into Any Service'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {lang === 'ru'
                  ? 'Iframe-виджет, URL параметры, postMessage API и шлюз GREEN-API'
                  : 'Iframe widget, URL parameters, postMessage API & GREEN-API gateway'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-5 gap-1 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('iframe')}
            className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'iframe'
                ? 'border-[#471AFF] text-[#471AFF] dark:text-indigo-300 bg-white dark:bg-slate-800 rounded-t-lg'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {lang === 'ru' ? 'Iframe Виджет' : 'Iframe Embed'}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('params')}
            className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'params'
                ? 'border-[#471AFF] text-[#471AFF] dark:text-indigo-300 bg-white dark:bg-slate-800 rounded-t-lg'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {lang === 'ru' ? 'Параметры URL' : 'URL Parameters'}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('postmessage')}
            className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'postmessage'
                ? 'border-[#471AFF] text-[#471AFF] dark:text-indigo-300 bg-white dark:bg-slate-800 rounded-t-lg'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {lang === 'ru' ? 'postMessage SDK' : 'postMessage SDK'}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('api')}
            className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'api'
                ? 'border-[#471AFF] text-[#471AFF] dark:text-indigo-300 bg-white dark:bg-slate-800 rounded-t-lg'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {lang === 'ru' ? 'REST API шлюза' : 'REST Gateway'}
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* TAB 1: IFRAME EMBED */}
          {activeTab === 'iframe' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 space-y-3">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100 text-xs">
                  <Sliders className="w-4 h-4 text-[#471AFF] dark:text-indigo-300 dark:text-indigo-400" />
                  <span>{lang === 'ru' ? 'Конфигуратор встраивания в CRM / Портал' : 'CRM & Portal Embed Configurator'}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includeCreds}
                      onChange={(e) => setIncludeCreds(e.target.checked)}
                      className="rounded text-[#471AFF] dark:text-indigo-300 focus:ring-[#471AFF]"
                    />
                    <span>{lang === 'ru' ? 'Включить ключи авторизации (авто-вход)' : 'Auto-login credentials in URL'}</span>
                  </label>
                  {includeCreds && (
                    <div className="col-span-1 sm:col-span-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-200 dark:text-amber-300 leading-relaxed">
                      {lang === 'ru'
                        ? '⚠️ Небезопасно: ключи в URL сохраняются в истории браузера, логах серверов/прокси и передаются в заголовке Referer. Рекомендуется postMessage MAX_SET_CREDS или ручной ввод — отключите эту опцию.'
                        : '⚠️ Unsafe: credentials in the URL persist in browser history, server/proxy logs and leak via the Referer header. Prefer postMessage MAX_SET_CREDS or manual entry — turn this option off.'}
                    </div>
                  )}

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={embedMode}
                      onChange={(e) => setEmbedMode(e.target.checked)}
                      className="rounded text-[#471AFF] dark:text-indigo-300 focus:ring-[#471AFF]"
                    />
                    <span>{lang === 'ru' ? 'Компактный режим виджета (embedded=true)' : 'Compact embed mode'}</span>
                  </label>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      {lang === 'ru' ? 'Открыть номер клиента (chatId):' : 'Pre-opened Client Phone:'}
                    </label>
                    <input
                      type="text"
                      value={customPhone}
                      onChange={(e) => setCustomPhone(e.target.value)}
                      placeholder="79991234567"
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      {lang === 'ru' ? 'Текст черновика (text):' : 'Pre-filled message text:'}
                    </label>
                    <input
                      type="text"
                      value={prefillMessage}
                      onChange={(e) => setPrefillMessage(e.target.value)}
                      placeholder="Здравствуйте..."
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Ready HTML Code */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {lang === 'ru' ? 'Готовый HTML-код для вставки на сайт / в CRM:' : 'HTML Embed Code for CRM or Webpage:'}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(iframeCode, 'iframe')}
                    className="flex items-center gap-1 text-xs text-[#471AFF] dark:text-indigo-300 hover:underline font-semibold cursor-pointer"
                  >
                    {copiedKey === 'iframe' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-emerald-600 dark:text-emerald-400">{lang === 'ru' ? 'Скопировано!' : 'Copied!'}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>{lang === 'ru' ? 'Копировать HTML' : 'Copy HTML'}</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-3.5 bg-slate-900 text-slate-100 rounded-xl text-[11px] font-mono overflow-x-auto leading-relaxed border border-slate-800">
                  {iframeCode}
                </pre>
              </div>

              {/* Direct Link */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {lang === 'ru' ? 'Прямая ссылка для открытия в новой вкладке:' : 'Direct Shareable Link:'}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(embedUrl, 'link')}
                    className="flex items-center gap-1 text-xs text-[#471AFF] dark:text-indigo-300 hover:underline font-semibold cursor-pointer"
                  >
                    {copiedKey === 'link' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-emerald-600 dark:text-emerald-400">{lang === 'ru' ? 'Скопировано!' : 'Copied!'}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>{lang === 'ru' ? 'Копировать ссылку' : 'Copy URL'}</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 dark:text-slate-200 rounded-lg text-xs font-mono break-all select-all border border-slate-200 dark:border-slate-700">
                  {embedUrl}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: URL PARAMETERS */}
          {activeTab === 'params' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {lang === 'ru'
                  ? 'Веб-мессенджер MAX поддерживает полную инициализацию через параметры строки запроса URL. Любая CRM-система (Битрикс24, amoCRM, 1С, личный кабинет) может сформировать ссылку или открыть iframe с нужными данными:'
                  : 'MAX Web Messenger supports full initialization via URL query parameters for deep CRM integration:'}
              </p>

              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold">
                    <tr>
                      <th className="p-3">Параметр</th>
                      <th className="p-3">Пример</th>
                      <th className="p-3">Назначение</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-slate-800 dark:text-slate-100 dark:text-slate-200">
                    <tr>
                      <td className="p-3 font-bold text-[#471AFF] dark:text-indigo-300">idInstance</td>
                      <td className="p-3 text-slate-600 dark:text-slate-300 dark:text-slate-400">1101823456</td>
                      <td className="p-3 font-sans text-slate-700 dark:text-slate-200 dark:text-slate-300">Идентификатор инстанса GREEN-API (авто-вход)</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-bold text-[#471AFF] dark:text-indigo-300">apiTokenInstance</td>
                      <td className="p-3 text-slate-600 dark:text-slate-300 dark:text-slate-400">e3b0c44298fc1c149...</td>
                      <td className="p-3 font-sans text-slate-700 dark:text-slate-200 dark:text-slate-300">Секретный API токен для доступа к шлюзу</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-bold text-[#471AFF] dark:text-indigo-300">chatId / phone</td>
                      <td className="p-3 text-slate-600 dark:text-slate-300 dark:text-slate-400">79991234567</td>
                      <td className="p-3 font-sans text-slate-700 dark:text-slate-200 dark:text-slate-300">Номер телефона клиента (мгновенно открывает диалог)</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-bold text-[#471AFF] dark:text-indigo-300">name</td>
                      <td className="p-3 text-slate-600 dark:text-slate-300 dark:text-slate-400">Алексей Смирнов</td>
                      <td className="p-3 font-sans text-slate-700 dark:text-slate-200 dark:text-slate-300">Имя контакта для сохранения в записную книжку</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-bold text-[#471AFF] dark:text-indigo-300">text</td>
                      <td className="p-3 text-slate-600 dark:text-slate-300 dark:text-slate-400">Заказ 104 подтверждён</td>
                      <td className="p-3 font-sans text-slate-700 dark:text-slate-200 dark:text-slate-300">Предзаполнение поля ввода сообщения</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-bold text-[#471AFF] dark:text-indigo-300">embedded</td>
                      <td className="p-3 text-slate-600 dark:text-slate-300 dark:text-slate-400">true</td>
                      <td className="p-3 font-sans text-slate-700 dark:text-slate-200 dark:text-slate-300">Режим компактного виджета для iframe</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-bold text-[#471AFF] dark:text-indigo-300">apiUrl</td>
                      <td className="p-3 text-slate-600 dark:text-slate-300 dark:text-slate-400">https://api.green-api.com</td>
                      <td className="p-3 font-sans text-slate-700 dark:text-slate-200 dark:text-slate-300">Кастомный хост шлюза (опционально)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: POSTMESSAGE API */}
          {activeTab === 'postmessage' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {lang === 'ru'
                    ? 'Двустороннее управление веб-мессенджером из JavaScript вашей CRM или сайта:'
                    : 'Bi-directional JavaScript postMessage communication with parent window:'}
                </p>
                <button
                  type="button"
                  onClick={() => copyToClipboard(postMessageSampleCode, 'postmessage')}
                  className="flex items-center gap-1 text-xs text-[#471AFF] dark:text-indigo-300 hover:underline font-semibold cursor-pointer shrink-0"
                >
                  {copiedKey === 'postmessage' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-emerald-600 dark:text-emerald-400">{lang === 'ru' ? 'Скопировано!' : 'Copied!'}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>{lang === 'ru' ? 'Копировать JS код' : 'Copy JS Code'}</span>
                    </>
                  )}
                </button>
              </div>

              <pre className="p-4 bg-slate-900 text-emerald-300 rounded-xl text-[11px] font-mono overflow-x-auto leading-relaxed border border-slate-800">
                {postMessageSampleCode}
              </pre>
            </div>
          )}

          {/* TAB 4: REST API */}
          {activeTab === 'api' && (
            <div className="space-y-4 text-xs text-slate-700 dark:text-slate-200 dark:text-slate-300">
              <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-800 rounded-xl space-y-2">
                <div className="font-bold text-[#471AFF] dark:text-indigo-300 flex items-center gap-1.5">
                  <Globe className="w-4 h-4" />
                  <span>Шлюз GREEN-API для экосистемы MAX.ru</span>
                </div>
                <p className="leading-relaxed">
                  Все вызовы выполняются напрямую через защищённый HTTPS шлюз. В приложении используются нативные методы:
                </p>
                <ul className="list-disc pl-4 space-y-1 text-slate-800 dark:text-slate-100 dark:text-slate-200 font-mono">
                  <li><code>GET /getContacts</code> — получение записной книжки пользователя</li>
                  <li><code>POST /getContactInfo</code> — детальные сведения и аватар контакта</li>
                  <li><code>POST /sendMessage</code> — отправка сообщений (chatId: "79991234567")</li>
                  <li><code>GET /receiveNotification</code> — получение входящих сообщений</li>
                  <li><code>DELETE /deleteNotification</code> — подтверждение очереди сообщений</li>
                </ul>
              </div>

              <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="font-medium text-slate-800 dark:text-slate-100 dark:text-slate-200">Официальная документация шлюза:</span>
                <a
                  href="https://green-api.com/docs/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[#471AFF] dark:text-indigo-300 font-bold hover:underline"
                >
                  <span>green-api.com/docs</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 shrink-0">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>
              {lang === 'ru'
                ? 'Готово к интеграции в Битрикс24, amoCRM, 1C и любые веб-сайты'
                : 'Ready for integration into Bitrix24, amoCRM, 1C and web apps'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-slate-200/80 dark:bg-slate-700 hover:bg-slate-300/80 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer transition-colors"
          >
            {lang === 'ru' ? 'Закрыть' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
