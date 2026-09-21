import React, { useState } from 'react';
import {
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
import { getBaseUrl } from '../services/greenApi';

interface IntegrationPanelProps {
  creds: GreenApiCredentials | null;
  activeChatId?: string | null;
  lang: Language;
}

export const IntegrationPanel: React.FC<IntegrationPanelProps> = ({
  creds,
  activeChatId,
  lang,
}) => {
  const [activeTab, setActiveTab] = useState<'iframe' | 'params' | 'postmessage' | 'api'>('iframe');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Embed Customizer options
  // NB: includeCreds=false по умолчанию — ключи в URL утекают в историю/логи/Referer.
  // Рекомендуется postMessage MAX_SET_CREDS или ручной ввод.
  const [includeCreds, setIncludeCreds] = useState(false);
  const [includeActiveChat, setIncludeActiveChat] = useState(true);
  const [embedMode, setEmbedMode] = useState(true);
  const [customPhone, setCustomPhone] = useState(activeChatId || '79991234567');
  const [prefillMessage, setPrefillMessage] = useState('Здравствуйте! Сообщение из CRM.');
  // Доверенный origin родителя для postMessage-allowlist (?parentOrigin=).
  // Пусто = виджет в dev принимает всех (с warn), в prod — отбрасывает все входящие.
  const [parentOrigin, setParentOrigin] = useState('');

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://web.max.ru';
  const baseUrl = getBaseUrl(creds);

  // Generate embed URL
  const queryParams = new URLSearchParams();
  if (parentOrigin.trim()) {
    queryParams.set('parentOrigin', parentOrigin.trim().replace(/\/+$/, ''));
  }
  if (includeCreds && creds) {
    queryParams.set('idInstance', creds.idInstance);
    queryParams.set('apiTokenInstance', creds.apiTokenInstance);
    if (creds.apiUrl && creds.apiUrl !== 'https://3100.api.green-api.com') {
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
}, MAX_WIDGET_ORIGIN);

// Передать ключи шлюза без URL (рекомендуется вместо ?idInstance= в адресной строке):
maxIframe.postMessage({
  type: 'MAX_SET_CREDS',
  payload: {
    idInstance: '310022742216',
    apiTokenInstance: '***',
    apiUrl: 'https://3100.api.green-api.com' // опционально, обязан пройти allowlist *.green-api.com
  }
}, MAX_WIDGET_ORIGIN);

// Запустить синхронизацию контактов:
maxIframe.postMessage({ type: 'MAX_SYNC_CONTACTS', payload: {} }, MAX_WIDGET_ORIGIN);`;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((curr) => (curr === key ? null : curr));
    }, 2500);
  };

  return (
    <div className="space-y-4">
      {/* Intro Header */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-50/80 to-purple-50/80 border border-indigo-100/80 flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-white shadow-2xs text-[#471AFF] flex items-center justify-center shrink-0">
          <Code2 className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-xs sm:text-sm font-bold text-slate-900">
            {lang === 'ru' ? 'Интеграция MAX в любые сервисы' : 'MAX Integration for Any Service'}
          </h4>
          <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
            {lang === 'ru'
              ? 'Встраивайте полнофункциональный веб-клиент MAX в Bitrix24, amoCRM, 1С, внутренние дашборды или сайты через Iframe, URL-параметры или postMessage SDK.'
              : 'Embed the full-featured MAX web client into CRMs, dashboards, and internal portals using Iframe, URL parameters, or postMessage SDK.'}
          </p>
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="flex border-b border-slate-200 bg-slate-50/80 rounded-xl p-1 gap-1 shrink-0 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('iframe')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'iframe'
              ? 'bg-white text-[#471AFF] shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {lang === 'ru' ? 'Iframe Виджет' : 'Iframe Embed'}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('params')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'params'
              ? 'bg-white text-[#471AFF] shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {lang === 'ru' ? 'Параметры URL' : 'URL Parameters'}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('postmessage')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'postmessage'
              ? 'bg-white text-[#471AFF] shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {lang === 'ru' ? 'postMessage SDK' : 'postMessage SDK'}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('api')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'api'
              ? 'bg-white text-[#471AFF] shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {lang === 'ru' ? 'REST API шлюза' : 'REST Gateway'}
        </button>
      </div>

      {/* Sub-Tab Content */}
      <div className="space-y-4">
        {/* TAB 1: IFRAME EMBED */}
        {activeTab === 'iframe' && (
          <div className="space-y-4">
            <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-3">
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
                {includeCreds && (
                  <div className="col-span-1 sm:col-span-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 leading-relaxed">
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
                    {lang === 'ru' ? 'Шаблон текста сообщения (text):' : 'Pre-filled Text Template:'}
                  </label>
                  <input
                    type="text"
                    value={prefillMessage}
                    onChange={(e) => setPrefillMessage(e.target.value)}
                    placeholder="Здравствуйте!"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                  />
                </div>

                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    {lang === 'ru' ? 'Доверенный origin родителя (parentOrigin):' : 'Trusted parent origin (parentOrigin):'}
                  </label>
                  <input
                    type="text"
                    value={parentOrigin}
                    onChange={(e) => setParentOrigin(e.target.value)}
                    placeholder="https://crm.example.com"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    {lang === 'ru'
                      ? 'Без него postMessage в проде отбрасывает входящие (fail-closed). Дублируется сборкой VITE_TRUSTED_PARENT_ORIGINS.'
                      : 'Without it postMessage drops inbound commands in prod (fail-closed). Mirrored by build-time VITE_TRUSTED_PARENT_ORIGINS.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Generated Iframe Code */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-800">
                  {lang === 'ru' ? 'HTML-код для вставки (iframe):' : 'HTML Embed Code (iframe):'}
                </label>
                <button
                  type="button"
                  onClick={() => copyToClipboard(iframeCode, 'iframe')}
                  className="inline-flex items-center gap-1.5 text-xs text-[#471AFF] hover:underline font-semibold cursor-pointer"
                >
                  {copiedKey === 'iframe' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'iframe' ? (lang === 'ru' ? 'Скопировано!' : 'Copied!') : (lang === 'ru' ? 'Скопировать код' : 'Copy code')}</span>
                </button>
              </div>
              <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl text-[11px] font-mono overflow-x-auto whitespace-pre leading-relaxed border border-slate-800">
                {iframeCode}
              </pre>
            </div>

            {/* Direct Web URL */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-800">
                  {lang === 'ru' ? 'Прямая ссылка для открытия:' : 'Direct Web Link:'}
                </label>
                <div className="flex items-center gap-3">
                  <a
                    href={embedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 font-medium"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{lang === 'ru' ? 'Тест в новой вкладке' : 'Open in new tab'}</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(embedUrl, 'url')}
                    className="inline-flex items-center gap-1.5 text-xs text-[#471AFF] hover:underline font-semibold cursor-pointer"
                  >
                    {copiedKey === 'url' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'url' ? (lang === 'ru' ? 'Скопировано!' : 'Copied!') : (lang === 'ru' ? 'Скопировать ссылку' : 'Copy link')}</span>
                  </button>
                </div>
              </div>
              <input
                type="text"
                readOnly
                value={embedUrl}
                className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-mono text-slate-700 select-all"
              />
            </div>
          </div>
        )}

        {/* TAB 2: URL PARAMETERS */}
        {activeTab === 'params' && (
          <div className="space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              {lang === 'ru'
                ? 'Вы можете передавать любые параметры через GET-запрос URL для автоматической авторизации и открытия диалогов с клиентами из вашей системы:'
                : 'You can pass query parameters to automate login and open specific chats directly from external systems:'}
            </p>
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 leading-relaxed">
              {lang === 'ru'
                ? '⚠️ Deprecated/unsafe: idInstance и apiTokenInstance в URL — утечка в историю/логи/Referer. Параметры стираются из адресной строки после чтения, но для новых интеграций используйте postMessage MAX_SET_CREDS или ручной ввод.'
                : '⚠️ Deprecated/unsafe: idInstance and apiTokenInstance in the URL leak to history/logs/Referer. They are stripped from the address bar after reading, but for new integrations use postMessage MAX_SET_CREDS or manual entry.'}
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white text-xs">
              <div className="p-3 bg-slate-50 font-bold grid grid-cols-12 gap-2 text-slate-800 text-[11px]">
                <div className="col-span-3">Параметр</div>
                <div className="col-span-4">Пример</div>
                <div className="col-span-5">Описание</div>
              </div>

              <div className="p-3 grid grid-cols-12 gap-2 items-center text-slate-700">
                <div className="col-span-3 font-mono text-[#471AFF] font-bold">idInstance</div>
                <div className="col-span-4 font-mono text-slate-500">310022742216</div>
                <div className="col-span-5 text-slate-600">ID инстанса GREEN-API для авто-подключения</div>
              </div>

              <div className="p-3 grid grid-cols-12 gap-2 items-center text-slate-700">
                <div className="col-span-3 font-mono text-[#471AFF] font-bold">apiTokenInstance</div>
                <div className="col-span-4 font-mono text-slate-500">abcdef1234567890...</div>
                <div className="col-span-5 text-slate-600">Секретный токен API для доступа к шлюзу</div>
              </div>

              <div className="p-3 grid grid-cols-12 gap-2 items-center text-slate-700">
                <div className="col-span-3 font-mono text-[#471AFF] font-bold">apiUrl</div>
                <div className="col-span-4 font-mono text-slate-500">https://3100.api.green-api.com</div>
                <div className="col-span-5 text-slate-600">Кастомный хост шлюза ноды (опционально)</div>
              </div>

              <div className="p-3 grid grid-cols-12 gap-2 items-center text-slate-700">
                <div className="col-span-3 font-mono text-[#471AFF] font-bold">chatId</div>
                <div className="col-span-4 font-mono text-slate-500">79991234567</div>
                <div className="col-span-5 text-slate-600">Номер телефона клиента (открыть диалог сразу)</div>
              </div>

              <div className="p-3 grid grid-cols-12 gap-2 items-center text-slate-700">
                <div className="col-span-3 font-mono text-[#471AFF] font-bold">name</div>
                <div className="col-span-4 font-mono text-slate-500">Алексей Иванов</div>
                <div className="col-span-5 text-slate-600">Имя контакта для сохранения в записную книжку</div>
              </div>

              <div className="p-3 grid grid-cols-12 gap-2 items-center text-slate-700">
                <div className="col-span-3 font-mono text-[#471AFF] font-bold">text</div>
                <div className="col-span-4 font-mono text-slate-500">Здравствуйте! Ваш заказ готов</div>
                <div className="col-span-5 text-slate-600">Предзаполненный текст в строке ввода</div>
              </div>

              <div className="p-3 grid grid-cols-12 gap-2 items-center text-slate-700">
                <div className="col-span-3 font-mono text-[#471AFF] font-bold">embedded</div>
                <div className="col-span-4 font-mono text-slate-500">true</div>
                <div className="col-span-5 text-slate-600">Скрывает внешние рамки для компактного встраивания в окно CRM</div>
              </div>

              <div className="p-3 grid grid-cols-12 gap-2 items-center text-slate-700">
                <div className="col-span-3 font-mono text-[#471AFF] font-bold">parentOrigin</div>
                <div className="col-span-4 font-mono text-slate-500">https://crm.example.com</div>
                <div className="col-span-5 text-slate-600">Доверенный origin родителя для postMessage (fail-closed в проде без него)</div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: POSTMESSAGE SDK */}
        {activeTab === 'postmessage' && (
          <div className="space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              {lang === 'ru'
                ? 'Двусторонняя интеграция через postMessage API позволяет родительскому окну (CRM) управлять мессенджером и реагировать на входящие сообщения в реальном времени:'
                : 'Bidirectional postMessage API integration allows CRM parent window to control chats and react to incoming messages in real-time:'}
            </p>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-800">
                  {lang === 'ru' ? 'JavaScript-код для CRM (Родительское окно):' : 'Parent window JavaScript code:'}
                </label>
                <button
                  type="button"
                  onClick={() => copyToClipboard(postMessageSampleCode, 'postmessage')}
                  className="inline-flex items-center gap-1.5 text-xs text-[#471AFF] hover:underline font-semibold cursor-pointer"
                >
                  {copiedKey === 'postmessage' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'postmessage' ? (lang === 'ru' ? 'Скопировано!' : 'Copied!') : (lang === 'ru' ? 'Скопировать код' : 'Copy code')}</span>
                </button>
              </div>
              <pre className="p-3.5 bg-slate-900 text-emerald-400 rounded-xl text-[11px] font-mono overflow-x-auto whitespace-pre leading-relaxed border border-slate-800">
                {postMessageSampleCode}
              </pre>
            </div>
          </div>
        )}

        {/* TAB 4: REST API GATEWAY */}
        {activeTab === 'api' && (
          <div className="space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              {lang === 'ru'
                ? 'Прямое взаимодействие с сервером шлюза без суффиксов @c.us. Все номера передаются в чистом формате (например, 79991234567):'
                : 'Direct server gateway interaction with plain numeric phone numbers:'}
            </p>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    POST {baseUrl}/waInstance{creds?.idInstance || '{id}'}/sendMessage/{creds?.apiTokenInstance ? '***' : '{token}'}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        `curl -X POST "${baseUrl}/waInstance${creds?.idInstance || '{id}'}/sendMessage/${creds?.apiTokenInstance || '{token}'}" \\\n-H "Content-Type: application/json" \\\n-d '{\n  "chatId": "79991234567",\n  "message": "Привет от MAX!"\n}'`,
                        'curl_send'
                      )
                    }
                    className="text-[11px] text-[#471AFF] hover:underline cursor-pointer flex items-center gap-1"
                  >
                    {copiedKey === 'curl_send' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>cURL</span>
                  </button>
                </div>
                <pre className="p-2.5 bg-slate-900 text-slate-100 rounded-lg text-[10px] font-mono overflow-x-auto mt-2">
{`{
  "chatId": "79991234567",
  "message": "Привет от MAX!"
}`}
                </pre>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    GET {baseUrl}/waInstance{creds?.idInstance || '{id}'}/receiveNotification/{creds?.apiTokenInstance ? '***' : '{token}'}?receiveTimeout=5
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        `curl -X GET "${baseUrl}/waInstance${creds?.idInstance || '{id}'}/receiveNotification/${creds?.apiTokenInstance || '{token}'}?receiveTimeout=5"`,
                        'curl_poll'
                      )
                    }
                    className="text-[11px] text-[#471AFF] hover:underline cursor-pointer flex items-center gap-1"
                  >
                    {copiedKey === 'curl_poll' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>cURL</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {lang === 'ru'
                    ? 'Long-polling метод получения входящих сообщений. Возвращает receiptId и тело вебхука.'
                    : 'HTTP long-polling endpoint for incoming messages. Returns receiptId and notification body.'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
