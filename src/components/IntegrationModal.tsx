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
  const [includeCreds, setIncludeCreds] = useState(true);
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
  const iframeCode = `<iframe\n  src="${embedUrl}"\n  width="100%"\n  height="700"\n  style="border: none; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.08);"\n  allow="clipboard-write; camera; microphone"\n></iframe>`;

  const postMessageSampleCode = `// 1. Слушаем события из MAX Web Messenger в родительском окне (CRM, портал)
window.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || !data.type) return;

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
const maxIframe = document.querySelector('iframe').contentWindow;

// Открыть конкретный чат с клиентом:
maxIframe.postMessage({
  type: 'MAX_OPEN_CHAT',
  payload: {
    chatId: '79991234567',
    name: 'Иван Иванов',
    text: 'Здравствуйте! Заказ #1402 подтвержден.'
  }
}, '*');

// Отправить сообщение напрямую через шлюз:
maxIframe.postMessage({
  type: 'MAX_SEND_MESSAGE',
  payload: {
    chatId: '79991234567',
    text: 'Ваш курьер прибудет через 15 минут.'
  }
}, '*');`;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((curr) => (curr === key ? null : curr));
    }, 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-3xl max-h-[90vh] bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-[#471AFF] flex items-center justify-center shadow-2xs">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                {lang === 'ru' ? 'Интеграция MAX в любые сервисы' : 'Integrate MAX into Any Service'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {lang === 'ru'
                  ? 'Iframe-виджет, URL параметры, postMessage API и шлюз GREEN-API'
                  : 'Iframe widget, URL parameters, postMessage API & GREEN-API gateway'}
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

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-5 gap-1 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('iframe')}
            className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'iframe'
                ? 'border-[#471AFF] text-[#471AFF] bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {lang === 'ru' ? 'Iframe Виджет' : 'Iframe Embed'}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('params')}
            className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'params'
                ? 'border-[#471AFF] text-[#471AFF] bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {lang === 'ru' ? 'Параметры URL' : 'URL Parameters'}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('postmessage')}
            className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'postmessage'
                ? 'border-[#471AFF] text-[#471AFF] bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {lang === 'ru' ? 'postMessage SDK' : 'postMessage SDK'}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('api')}
            className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'api'
                ? 'border-[#471AFF] text-[#471AFF] bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
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
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-3">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                  <Sliders className="w-4 h-4 text-[#471AFF]" />
                  <span>{lang === 'ru' ? 'Конфигуратор встраивания в CRM / Портал' : 'CRM & Portal Embed Configurator'}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includeCreds}
                      onChange={(e) => setIncludeCreds(e.target.checked)}
                      className="rounded text-[#471AFF] focus:ring-[#471AFF]"
                    />
                    <span>{lang === 'ru' ? 'Включить ключи авторизации (авто-вход)' : 'Auto-login credentials in URL'}</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={embedMode}
                      onChange={(e) => setEmbedMode(e.target.checked)}
                      className="rounded text-[#471AFF] focus:ring-[#471AFF]"
                    />
                    <span>{lang === 'ru' ? 'Компактный режим виджета (embedded=true)' : 'Compact embed mode'}</span>
                  </label>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      {lang === 'ru' ? 'Открыть номер клиента (chatId):' : 'Pre-opened Client Phone:'}
                    </label>
                    <input
                      type="text"
                      value={customPhone}
                      onChange={(e) => setCustomPhone(e.target.value)}
                      placeholder="79991234567"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      {lang === 'ru' ? 'Текст черновика (text):' : 'Pre-filled message text:'}
                    </label>
                    <input
                      type="text"
                      value={prefillMessage}
                      onChange={(e) => setPrefillMessage(e.target.value)}
                      placeholder="Здравствуйте..."
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Ready HTML Code */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-700">
                    {lang === 'ru' ? 'Готовый HTML-код для вставки на сайт / в CRM:' : 'HTML Embed Code for CRM or Webpage:'}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(iframeCode, 'iframe')}
                    className="flex items-center gap-1 text-xs text-[#471AFF] hover:underline font-semibold cursor-pointer"
                  >
                    {copiedKey === 'iframe' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-600">{lang === 'ru' ? 'Скопировано!' : 'Copied!'}</span>
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
                  <span className="text-xs font-semibold text-slate-700">
                    {lang === 'ru' ? 'Прямая ссылка для открытия в новой вкладке:' : 'Direct Shareable Link:'}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(embedUrl, 'link')}
                    className="flex items-center gap-1 text-xs text-[#471AFF] hover:underline font-semibold cursor-pointer"
                  >
                    {copiedKey === 'link' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-600">{lang === 'ru' ? 'Скопировано!' : 'Copied!'}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>{lang === 'ru' ? 'Копировать ссылку' : 'Copy URL'}</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="p-2.5 bg-slate-100 text-slate-800 rounded-lg text-xs font-mono break-all select-all border border-slate-200">
                  {embedUrl}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: URL PARAMETERS */}
          {activeTab === 'params' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                {lang === 'ru'
                  ? 'Веб-мессенджер MAX поддерживает полную инициализацию через параметры строки запроса URL. Любая CRM-система (Битрикс24, amoCRM, 1С, личный кабинет) может сформировать ссылку или открыть iframe с нужными данными:'
                  : 'MAX Web Messenger supports full initialization via URL query parameters for deep CRM integration:'}
              </p>

              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <tr>
                      <th className="p-3">Параметр</th>
                      <th className="p-3">Пример</th>
                      <th className="p-3">Назначение</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-slate-800">
                    <tr>
                      <td className="p-3 font-bold text-[#471AFF]">idInstance</td>
                      <td className="p-3 text-slate-600">1101823456</td>
                      <td className="p-3 font-sans text-slate-700">Идентификатор инстанса GREEN-API (авто-вход)</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-bold text-[#471AFF]">apiTokenInstance</td>
                      <td className="p-3 text-slate-600">e3b0c44298fc1c149...</td>
                      <td className="p-3 font-sans text-slate-700">Секретный API токен для доступа к шлюзу</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-bold text-[#471AFF]">chatId / phone</td>
                      <td className="p-3 text-slate-600">79991234567</td>
                      <td className="p-3 font-sans text-slate-700">Номер телефона клиента (мгновенно открывает диалог)</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-bold text-[#471AFF]">name</td>
                      <td className="p-3 text-slate-600">Алексей Смирнов</td>
                      <td className="p-3 font-sans text-slate-700">Имя контакта для сохранения в записную книжку</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-bold text-[#471AFF]">text</td>
                      <td className="p-3 text-slate-600">Заказ 104 подтверждён</td>
                      <td className="p-3 font-sans text-slate-700">Предзаполнение поля ввода сообщения</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-bold text-[#471AFF]">embedded</td>
                      <td className="p-3 text-slate-600">true</td>
                      <td className="p-3 font-sans text-slate-700">Режим компактного виджета для iframe</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-bold text-[#471AFF]">apiUrl</td>
                      <td className="p-3 text-slate-600">https://api.green-api.com</td>
                      <td className="p-3 font-sans text-slate-700">Кастомный хост шлюза (опционально)</td>
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
                <p className="text-xs text-slate-600">
                  {lang === 'ru'
                    ? 'Двустороннее управление веб-мессенджером из JavaScript вашей CRM или сайта:'
                    : 'Bi-directional JavaScript postMessage communication with parent window:'}
                </p>
                <button
                  type="button"
                  onClick={() => copyToClipboard(postMessageSampleCode, 'postmessage')}
                  className="flex items-center gap-1 text-xs text-[#471AFF] hover:underline font-semibold cursor-pointer shrink-0"
                >
                  {copiedKey === 'postmessage' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-600">{lang === 'ru' ? 'Скопировано!' : 'Copied!'}</span>
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
            <div className="space-y-4 text-xs text-slate-700">
              <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-xl space-y-2">
                <div className="font-bold text-[#471AFF] flex items-center gap-1.5">
                  <Globe className="w-4 h-4" />
                  <span>Шлюз GREEN-API для экосистемы MAX.ru</span>
                </div>
                <p className="leading-relaxed">
                  Все вызовы выполняются напрямую через защищённый HTTPS шлюз. В приложении используются нативные методы:
                </p>
                <ul className="list-disc pl-4 space-y-1 text-slate-800 font-mono">
                  <li><code>GET /getContacts</code> — получение записной книжки пользователя</li>
                  <li><code>POST /getContactInfo</code> — детальные сведения и аватар контакта</li>
                  <li><code>POST /sendMessage</code> — отправка сообщений (chatId: "79991234567")</li>
                  <li><code>GET /receiveNotification</code> — получение входящих сообщений</li>
                  <li><code>DELETE /deleteNotification</code> — подтверждение очереди сообщений</li>
                </ul>
              </div>

              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="font-medium text-slate-800">Официальная документация шлюза:</span>
                <a
                  href="https://green-api.com/docs/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[#471AFF] font-bold hover:underline"
                >
                  <span>green-api.com/docs</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>
              {lang === 'ru'
                ? 'Готово к интеграции в Битрикс24, amoCRM, 1C и любые веб-сайты'
                : 'Ready for integration into Bitrix24, amoCRM, 1C and web apps'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-slate-200/80 hover:bg-slate-300/80 text-slate-700 text-xs font-semibold cursor-pointer transition-colors"
          >
            {lang === 'ru' ? 'Закрыть' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
