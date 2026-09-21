import React, { useState, useEffect } from 'react';
import { 
  X, 
  Settings as SettingsIcon, 
  Wifi, 
  Bell, 
  Database, 
  Volume2, 
  Check, 
  Download, 
  Trash2, 
  LogOut, 
  RotateCw,
  Globe,
  KeyRound,
  Eye,
  EyeOff,
  Save,
  Server,
  AlertTriangle,
  Activity,
  Wrench,
  Layers,
  Code2,
  Zap,
  MessageSquare,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { AppSettings, GreenApiCredentials, Language, ChatDialog, ChatMessage } from '../types';
import { translations } from '../i18n/translations';
import { GreenApiService, DEFAULT_API_URL, isTrustedGatewayUrl, validateGatewayUrlOrThrow } from '../services/greenApi';
import { playNotificationSound } from '../utils/sound';
import {
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
} from '../utils/notifications';
import { IntegrationPanel } from './IntegrationPanel';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  creds: GreenApiCredentials | null;
  onUpdateCreds: (newCreds: GreenApiCredentials) => void;
  lang: Language;
  onToggleLanguage: () => void;
  dialogs: ChatDialog[];
  messages: ChatMessage[];
  onClearAllChats: () => void;
  onSignOut: () => void;
  activeChatId?: string | null;
  onSyncMessages?: () => Promise<number>;
  isSyncingMessages?: boolean;
  onOpenQuickReplies?: () => void;
  quickRepliesCount?: number;
  onTestNotification?: () => void;
  /** Forced native OS test (bypasses focus routing). Returns true when shown. */
  onTestBrowserNotification?: () => boolean;
}

type TabType = 'chat' | 'notifications' | 'connection' | 'integration' | 'data';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  creds,
  onUpdateCreds,
  lang,
  onToggleLanguage,
  dialogs,
  messages,
  onClearAllChats,
  onSignOut,
  activeChatId,
  onSyncMessages,
  isSyncingMessages = false,
  onOpenQuickReplies,
  quickRepliesCount,
  onTestNotification,
  onTestBrowserNotification,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('chat');
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [statusResult, setStatusResult] = useState<string | null>(null);
  const [statusState, setStatusState] = useState<'success' | 'warning' | 'error' | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  // SECURITY: бэкап содержит переписку в plaintext — по умолчанию выгружаем без
  // текстов сообщений (только список диалогов), чтобы файл можно было безопасно
  // пересылать. Токен apiTokenInstance не выгружается никогда.
  const [exportWithMessages, setExportWithMessages] = useState(false);
  const [isPlayingSound, setIsPlayingSound] = useState(false);
  const [browserPermission, setBrowserPermission] = useState<'default' | 'granted' | 'denied' | 'unsupported'>('default');
  const [testNotifSuccess, setTestNotifSuccess] = useState(false);
  const [testBrowserMsg, setTestBrowserMsg] = useState<string | null>(null);

  // Refresh the real OS permission state every time the modal opens —
  // the user may have changed it in the browser site settings meanwhile.
  const refreshBrowserPermission = () => {
    setBrowserPermission(getBrowserNotificationPermission());
  };

  useEffect(() => {
    if (isOpen) refreshBrowserPermission();
  }, [isOpen]);

  const handleRequestBrowserPermission = async () => {
    // Must run inside the click gesture — Chrome blocks non-gesture prompts.
    const result = await requestBrowserNotificationPermission();
    setBrowserPermission(result);
    if (result === 'granted' && onTestBrowserNotification) {
      // Immediately prove the browser channel works with a real OS notification.
      const shown = onTestBrowserNotification();
      setTestBrowserMsg(
        shown
          ? (lang === 'ru' ? 'Системное уведомление отправлено — проверьте область уведомлений ОС.' : 'System notification sent — check your OS notification area.')
          : (lang === 'ru' ? 'Не удалось показать системное уведомление.' : 'Could not display the system notification.')
      );
    }
  };

  const handleForcedBrowserTest = () => {
    setTestBrowserMsg(null);
    if (browserPermission !== 'granted') {
      setTestBrowserMsg(
        lang === 'ru'
          ? 'Сначала разрешите уведомления в браузере кнопкой выше.'
          : 'Allow browser notifications with the button above first.'
      );
      return;
    }
    if (settings.browserNotificationsEnabled === false) {
      setTestBrowserMsg(
        lang === 'ru'
          ? 'Системный канал отключен тумблером ниже — включите его для проверки.'
          : 'The system channel is switched off below — enable it to test.'
      );
      return;
    }
    const shown = onTestBrowserNotification ? onTestBrowserNotification() : false;
    setTestBrowserMsg(
      shown
        ? (lang === 'ru' ? 'Системное уведомление отправлено — проверьте область уведомлений ОС.' : 'System notification sent — check your OS notification area.')
        : (lang === 'ru' ? 'Браузер отклонил уведомление. Проверьте настройки сайта.' : 'The browser rejected the notification. Check site settings.')
    );
  };

  // Connection & Gateway editing state
  const [editIdInstance, setEditIdInstance] = useState(creds?.idInstance || '');
  const [editApiToken, setEditApiToken] = useState(creds?.apiTokenInstance || '');
  const [editApiUrl, setEditApiUrl] = useState(creds?.apiUrl || DEFAULT_API_URL);
  const [showToken, setShowToken] = useState(false);
  const [isSavedRecently, setIsSavedRecently] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Deep Diagnostic State
  const [diagnosticData, setDiagnosticData] = useState<{
    stateInstance?: string;
    incomingWebhook?: string;
    outgoingMessageWebhook?: string;
    outgoingAPIMessageWebhook?: string;
    webhookUrl?: string;
    countWebhooks?: number;
    testPollSuccess?: boolean;
    testPollMessage?: string;
  } | null>(null);
  const [isFixingSettings, setIsFixingSettings] = useState(false);
  const [fixSettingsMessage, setFixSettingsMessage] = useState<string | null>(null);
  const [isClearingQueue, setIsClearingQueue] = useState(false);

  // Synchronize inputs when modal opens or creds change
  useEffect(() => {
    if (isOpen && creds) {
      setEditIdInstance(creds.idInstance || '');
      setEditApiToken(creds.apiTokenInstance || '');
      setEditApiUrl(creds.apiUrl || DEFAULT_API_URL);
      setSaveError(null);
      setIsSavedRecently(false);
      setStatusResult(null);
      setStatusState(null);
      setDiagnosticData(null);
      setFixSettingsMessage(null);
    }
  }, [isOpen, creds]);

  if (!isOpen) return null;

  const t = translations[lang];
  const isRu = lang === 'ru';

  const hasCredsChanges = 
    editIdInstance.trim() !== (creds?.idInstance || '') ||
    editApiToken.trim() !== (creds?.apiTokenInstance || '') ||
    editApiUrl.trim() !== (creds?.apiUrl || DEFAULT_API_URL);

  const handleTestSound = () => {
    setIsPlayingSound(true);
    playNotificationSound();
    setTimeout(() => setIsPlayingSound(false), 500);
  };

  const handleSaveConnection = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanId = editIdInstance.trim();
    const cleanToken = editApiToken.trim();
    const cleanUrl = editApiUrl.trim() || DEFAULT_API_URL;

    if (!cleanId) {
      setSaveError(isRu ? 'Пожалуйста, введите idInstance' : 'Please enter idInstance');
      return;
    }
    if (!cleanToken) {
      setSaveError(isRu ? 'Пожалуйста, введите apiTokenInstance' : 'Please enter apiTokenInstance');
      return;
    }

    // Allowlist-валидация шлюза до сохранения
    try {
      validateGatewayUrlOrThrow(cleanUrl);
    } catch (err: any) {
      setSaveError(err?.message || (isRu ? 'Недопустимый URL шлюза' : 'Invalid gateway URL'));
      return;
    }

    setSaveError(null);
    onUpdateCreds({
      idInstance: cleanId,
      apiTokenInstance: cleanToken,
      apiUrl: cleanUrl,
    });
    setIsSavedRecently(true);
    setTimeout(() => setIsSavedRecently(false), 3000);
  };

  const handleDiagnosticCheck = async () => {
    const testId = editIdInstance.trim();
    const testToken = editApiToken.trim();
    const testUrl = editApiUrl.trim() || DEFAULT_API_URL;

    if (!testId || !testToken) {
      setStatusResult(isRu ? 'Укажите idInstance и токен для проверки' : 'Provide idInstance and token to test');
      setStatusState('warning');
      return;
    }

    setCheckingStatus(true);
    setStatusResult(null);
    setStatusState(null);
    setDiagnosticData(null);
    setFixSettingsMessage(null);

    const testCreds = {
      idInstance: testId,
      apiTokenInstance: testToken,
      apiUrl: testUrl,
    };

    try {
      // 1. Check instance status
      const state = await GreenApiService.checkInstanceStatus(testCreds);
      
      let incomingWebhook: string | undefined;
      let outgoingMessageWebhook: string | undefined;
      let outgoingAPIMessageWebhook: string | undefined;
      let webhookUrl: string | undefined;
      let countWebhooks: number | undefined;
      let testPollSuccess = false;
      let testPollMessage = '';

      // 2. Try to get instance settings
      try {
        const settingsRes = await GreenApiService.getSettings(testCreds);
        if (settingsRes) {
          incomingWebhook = settingsRes.incomingWebhook;
          outgoingMessageWebhook = settingsRes.outgoingMessageWebhook;
          outgoingAPIMessageWebhook = settingsRes.outgoingAPIMessageWebhook;
          webhookUrl = settingsRes.webhookUrl || settingsRes.incomingWebhookUrl;
        }
      } catch (err: any) {
        console.warn('Failed to fetch settings during diagnostics:', err);
      }

      // 3. Try to get webhooks count
      try {
        const countRes = await GreenApiService.getWebhooksCount(testCreds);
        if (countRes && typeof countRes.countWebhooks === 'number') {
          countWebhooks = countRes.countWebhooks;
        }
      } catch (err: any) {
        console.warn('Failed to fetch webhooks count during diagnostics:', err);
      }

      // 4. Test receiveNotification
      try {
        const notification = await GreenApiService.receiveNotification(testCreds, undefined, 1);
        testPollSuccess = true;
        testPollMessage = notification 
          ? (isRu 
              ? `Получено уведомление #${notification.receiptId} (тип: ${notification.body?.typeWebhook || 'webhook'})` 
              : `Received notification #${notification.receiptId}`)
          : (isRu 
              ? 'Опрос успешен: очередь активна (ожидающих новых сообщений нет)' 
              : 'Poll check succeeded: queue is active (no waiting messages)');
      } catch (err: any) {
        testPollSuccess = false;
        testPollMessage = err?.message || 'Polling request failed';
      }

      setDiagnosticData({
        stateInstance: state.stateInstance,
        incomingWebhook,
        outgoingMessageWebhook,
        outgoingAPIMessageWebhook,
        webhookUrl,
        countWebhooks,
        testPollSuccess,
        testPollMessage,
      });

      if (state.stateInstance === 'authorized') {
        setStatusResult(t.statusResultAuthorized);
        setStatusState('success');
      } else if (state.stateInstance === 'notAuthorized') {
        setStatusResult(t.statusResultNotAuthorized);
        setStatusState('warning');
      } else if (state.stateInstance === 'blocked') {
        setStatusResult(t.statusResultBlocked);
        setStatusState('error');
      } else {
        setStatusResult(`${t.statusResultUnknown}${state.stateInstance || 'unknown'}`);
        setStatusState('warning');
      }
    } catch (err: any) {
      setStatusResult(err?.message || 'Error communicating with GREEN-API');
      setStatusState('error');
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleFixInstanceSettings = async () => {
    const testId = editIdInstance.trim();
    const testToken = editApiToken.trim();
    const testUrl = editApiUrl.trim() || DEFAULT_API_URL;
    if (!testId || !testToken) return;

    setIsFixingSettings(true);
    setFixSettingsMessage(null);
    try {
      const testCreds = { idInstance: testId, apiTokenInstance: testToken, apiUrl: testUrl };
      await GreenApiService.setSettings(testCreds, {
        incomingWebhook: 'yes',
        outgoingMessageWebhook: 'yes',
        outgoingAPIMessageWebhook: 'yes',
        stateWebhook: 'yes',
        webhookUrl: '',
        incomingWebhookUrl: '',
      });
      setFixSettingsMessage(
        isRu 
          ? 'Настройки инстанса успешно оптимизированы! Вебхуки включены в HTTP-очередь.' 
          : 'Instance settings optimized! Webhooks enabled in HTTP queue.'
      );
      await handleDiagnosticCheck();
    } catch (err: any) {
      setFixSettingsMessage(err?.message || (isRu ? 'Ошибка обновления настроек' : 'Error updating settings'));
    } finally {
      setIsFixingSettings(false);
    }
  };

  const handleClearQueue = async () => {
    const testId = editIdInstance.trim();
    const testToken = editApiToken.trim();
    const testUrl = editApiUrl.trim() || DEFAULT_API_URL;
    if (!testId || !testToken) return;

    setIsClearingQueue(true);
    try {
      const testCreds = { idInstance: testId, apiTokenInstance: testToken, apiUrl: testUrl };
      await GreenApiService.clearWebhooksQueue(testCreds);
      await handleDiagnosticCheck();
    } catch (err: any) {
      console.error('Failed to clear queue:', err);
    } finally {
      setIsClearingQueue(false);
    }
  };

  const handleExportData = () => {
    try {
      // NB: apiTokenInstance сюда намеренно НЕ включается — файл бэкапа
      // часто пересылают, а токен = полный доступ к инстансу.
      const exportObject = {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        instanceId: creds?.idInstance,
        dialogs,
        messages: exportWithMessages ? messages : [],
        messagesExcluded: !exportWithMessages,
      };
      const blob = new Blob([JSON.stringify(exportObject, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `max-web-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to export data', e);
    }
  };

  return (
    <div 
      id="settings-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        id="settings-modal-card"
        className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-[85dvh] sm:h-[530px] max-h-[92dvh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/80 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl max-gradient-primary text-white flex items-center justify-center shadow-xs">
              <SettingsIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-800 leading-tight">
                {t.settingsTitle}
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5 hidden sm:block">
                {t.settingsSubtitle}
              </p>
            </div>
          </div>
          <button
            id="close-settings-button"
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
            title={t.closeBtn}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Tabs and Content */}
        <div className="flex flex-col sm:flex-row flex-1 min-h-0 overflow-hidden">
          {/* Navigation Tabs */}
          <div className="w-full sm:w-52 bg-slate-50/70 border-b sm:border-b-0 sm:border-r border-slate-100 p-2 sm:p-3 flex sm:flex-col gap-1 overflow-x-auto sm:overflow-y-auto shrink-0">
            {/* 1. Interface & Language */}
            <button
              id="tab-chat-button"
              type="button"
              onClick={() => setActiveTab('chat')}
              className={`flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-left transition-all shrink-0 sm:shrink cursor-pointer ${
                activeTab === 'chat'
                  ? 'max-gradient-primary text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Globe className="w-4 h-4 shrink-0" />
              <span className="truncate sm:whitespace-normal leading-tight">{t.settingsSectionChat}</span>
            </button>

            {/* 2. Notifications */}
            <button
              id="tab-notifications-button"
              type="button"
              onClick={() => setActiveTab('notifications')}
              className={`flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-left transition-all shrink-0 sm:shrink cursor-pointer ${
                activeTab === 'notifications'
                  ? 'max-gradient-primary text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Bell className="w-4 h-4 shrink-0" />
              <span className="truncate sm:whitespace-normal leading-tight">{t.settingsSectionNotifications}</span>
            </button>

            {/* 3. Connection & Gateway */}
            <button
              id="tab-connection-button"
              type="button"
              onClick={() => setActiveTab('connection')}
              className={`flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-left transition-all shrink-0 sm:shrink cursor-pointer ${
                activeTab === 'connection'
                  ? 'max-gradient-primary text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Wifi className="w-4 h-4 shrink-0" />
              <span className="truncate sm:whitespace-normal leading-tight">{t.settingsSectionConnection}</span>
            </button>

            {/* 4. Integration MAX */}
            <button
              id="tab-integration-button"
              type="button"
              onClick={() => setActiveTab('integration')}
              className={`flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-left transition-all shrink-0 sm:shrink cursor-pointer ${
                activeTab === 'integration'
                  ? 'max-gradient-primary text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Code2 className="w-4 h-4 shrink-0" />
              <span className="truncate sm:whitespace-normal leading-tight">
                {lang === 'ru' ? 'Интеграция MAX' : 'MAX Integration'}
              </span>
            </button>

            {/* 5. Data & Account */}
            <button
              id="tab-data-button"
              type="button"
              onClick={() => setActiveTab('data')}
              className={`flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-left transition-all shrink-0 sm:shrink cursor-pointer ${
                activeTab === 'data'
                  ? 'max-gradient-primary text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Database className="w-4 h-4 shrink-0" />
              <span className="truncate sm:whitespace-normal leading-tight">{t.settingsSectionData}</span>
            </button>
          </div>

          {/* Active Tab Panel */}
          <div className="flex-1 min-h-0 p-4 sm:p-5 overflow-y-auto bg-white space-y-5">
            {/* 1. Interface & Language */}
            {activeTab === 'chat' && (
              <div className="space-y-5">
                {/* Language Switcher Section */}
                <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80">
                  <div className="flex items-center gap-2 mb-1">
                    <Globe className="w-4 h-4 text-[#471AFF]" />
                    <label className="text-xs font-bold text-slate-800">
                      {t.interfaceLanguage}
                    </label>
                  </div>
                  <p className="text-[11px] text-slate-500 mb-3">
                    {t.interfaceLanguageDesc}
                  </p>

                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      id="language-select-ru"
                      type="button"
                      onClick={() => {
                        if (lang !== 'ru') onToggleLanguage();
                      }}
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                        lang === 'ru'
                          ? 'border-[#471AFF] bg-indigo-50/80 text-[#471AFF] shadow-xs'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100/70'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">🇷🇺</span>
                        <span>Русский</span>
                      </div>
                      {lang === 'ru' && <Check className="w-4 h-4 text-[#471AFF]" />}
                    </button>

                    <button
                      id="language-select-en"
                      type="button"
                      onClick={() => {
                        if (lang !== 'en') onToggleLanguage();
                      }}
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                        lang === 'en'
                          ? 'border-[#471AFF] bg-indigo-50/80 text-[#471AFF] shadow-xs'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100/70'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">🇬🇧</span>
                        <span>English</span>
                      </div>
                      {lang === 'en' && <Check className="w-4 h-4 text-[#471AFF]" />}
                    </button>
                  </div>
                </div>

                {/* Send shortcut */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.sendShortcutLabel}
                  </label>
                  <div className="space-y-2 mt-2">
                    <label className="flex items-center space-x-2.5 cursor-pointer p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                      <input
                        type="radio"
                        name="sendShortcut"
                        checked={settings.sendShortcut === 'enter'}
                        onChange={() => onUpdateSettings({ ...settings, sendShortcut: 'enter' })}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs text-slate-700 font-medium">
                        {t.sendShortcutEnter}
                      </span>
                    </label>

                    <label className="flex items-center space-x-2.5 cursor-pointer p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                      <input
                        type="radio"
                        name="sendShortcut"
                        checked={settings.sendShortcut === 'ctrl_enter'}
                        onChange={() => onUpdateSettings({ ...settings, sendShortcut: 'ctrl_enter' })}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs text-slate-700 font-medium">
                        {t.sendShortcutCtrlEnter}
                      </span>
                    </label>
                  </div>
                </div>

                {/* Font Size */}
                <div className="pt-3 border-t border-slate-100">
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    {t.fontSizeLabel}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['small', 'medium', 'large'] as const).map((size) => (
                      <button
                        key={size}
                        id={`font-size-${size}`}
                        type="button"
                        onClick={() => onUpdateSettings({ ...settings, fontSize: size })}
                        className={`px-3 py-2 rounded-xl text-xs font-semibold border text-center transition-all cursor-pointer ${
                          settings.fontSize === size
                            ? 'border-[#471AFF] bg-indigo-50/70 text-[#471AFF] shadow-xs'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {size === 'small' ? t.fontSizeSmall : size === 'medium' ? t.fontSizeMedium : t.fontSizeLarge}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Phone formatting */}
                <div className="pt-3 border-t border-slate-100">
                  <label className="flex items-start justify-between cursor-pointer">
                    <div className="pr-4">
                      <span className="text-xs font-semibold text-slate-700 block">
                        {t.showPhoneFormattingLabel}
                      </span>
                      <span className="text-xs text-slate-500 block mt-0.5">
                        {t.showPhoneFormattingDesc}
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.showPhoneFormatting}
                      onChange={(e) => onUpdateSettings({ ...settings, showPhoneFormatting: e.target.checked })}
                      className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                  </label>
                </div>

                {/* Quick Replies / Templates section */}
                {onOpenQuickReplies && (
                  <div className="pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-100/80">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-indigo-100 text-[#471AFF] flex items-center justify-center shrink-0 mt-0.5">
                          <Zap className="w-4 h-4 fill-[#471AFF]/20" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-800">
                              {t.quickRepliesTitle}
                            </span>
                            {typeof quickRepliesCount === 'number' && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white text-[#471AFF] font-bold border border-indigo-200">
                                {quickRepliesCount}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5 truncate sm:whitespace-normal">
                            {t.quickRepliesSubtitle}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenQuickReplies();
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#471AFF] text-white hover:bg-indigo-700 transition-colors shrink-0 cursor-pointer shadow-2xs"
                      >
                        {lang === 'ru' ? 'Настроить' : 'Configure'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 2. Sound & Notifications */}
            {activeTab === 'notifications' && (
              <div className="space-y-6">
                {/* Sound Alerts */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 pr-2">
                      <span className="text-xs font-bold text-slate-800 block break-words flex items-center gap-1.5">
                        <Volume2 className="w-4 h-4 text-[#471AFF]" />
                        <span>{t.soundNotificationsLabel}</span>
                      </span>
                      <span className="text-xs text-slate-500 block mt-1 break-words">
                        {t.soundNotificationsDesc}
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.soundEnabled}
                      onChange={(e) => onUpdateSettings({ ...settings, soundEnabled: e.target.checked })}
                      className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer shrink-0"
                    />
                  </div>

                  <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-600">
                      {isRu ? 'Проверка воспроизведения звука' : 'Test sound playback'}
                    </span>
                    <button
                      id="test-sound-button"
                      type="button"
                      onClick={handleTestSound}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                        isPlayingSound
                          ? 'bg-[#471AFF] text-white shadow-xs'
                          : 'bg-white text-[#471AFF] hover:bg-indigo-50 border border-indigo-200 shadow-2xs'
                      }`}
                    >
                      <Volume2 className={`w-3.5 h-3.5 ${isPlayingSound ? 'animate-bounce' : ''}`} />
                      <span>{isPlayingSound ? (isRu ? 'Звучит...' : 'Playing...') : t.testSoundBtn}</span>
                    </button>
                  </div>
                </div>

                {/* Notification channels: smart single-channel routing, no duplication */}
                <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100/90 space-y-4">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Bell className="w-4 h-4 text-[#471AFF]" />
                        <h4 className="text-xs font-bold text-slate-800">
                          {isRu ? 'Каналы уведомлений — без задвоения' : 'Notification channels — no duplication'}
                        </h4>
                      </div>

                      {/* Permission status badge */}
                      {browserPermission === 'granted' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>{isRu ? 'Разрешены' : 'Granted'}</span>
                        </span>
                      )}
                      {browserPermission === 'default' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          <span>{isRu ? 'Требуется разрешение' : 'Permission needed'}</span>
                        </span>
                      )}
                      {browserPermission === 'denied' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                          <X className="w-3 h-3 text-rose-600" />
                          <span>{isRu ? 'Заблокированы' : 'Blocked'}</span>
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-500 mt-1">
                      {isRu
                        ? 'Работает только один канал за раз: красивая карточка внутри вкладки — когда вы смотрите на неё, системное уведомление браузера — когда вкладка свёрнута или свернуто окно. Плюс всегда горят счётчик на иконке вкладки и мигание заголовка.'
                        : 'Only one channel fires at a time: a beautiful in-app card while you are looking at the tab, a system browser notification while the tab is minimized or in the background. The tab icon badge and flashing title always stay on.'}
                    </p>
                  </div>

                  {/* Channel toggles */}
                  <div className="space-y-2">
                    <label className="flex items-start justify-between gap-3 p-3 rounded-xl bg-white border border-slate-200 cursor-pointer hover:border-indigo-200 transition-colors">
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-slate-800 block">
                          {isRu ? 'Системные уведомления браузера' : 'System browser notifications'}
                        </span>
                        <span className="text-[11px] text-slate-500 block mt-0.5">
                          {isRu
                            ? 'Приходят от ОС, когда вкладка неактивна. Требуют разрешения ниже.'
                            : 'Delivered by the OS when the tab is inactive. Requires permission below.'}
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.browserNotificationsEnabled !== false}
                        onChange={(e) => onUpdateSettings({ ...settings, browserNotificationsEnabled: e.target.checked })}
                        className="mt-0.5 rounded text-[#471AFF] focus:ring-[#471AFF]/30 w-4 h-4 cursor-pointer shrink-0"
                      />
                    </label>

                    <label className="flex items-start justify-between gap-3 p-3 rounded-xl bg-white border border-slate-200 cursor-pointer hover:border-indigo-200 transition-colors">
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-slate-800 block">
                          {isRu ? 'Всплывающая карточка внутри вкладки' : 'In-app popup card'}
                        </span>
                        <span className="text-[11px] text-slate-500 block mt-0.5">
                          {isRu
                            ? 'Красивое уведомление в правом верхнем углу, только когда вы в мессенджере.'
                            : 'Beautiful card in the top-right corner, only while you are in the messenger.'}
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.inAppPopupsEnabled !== false}
                        onChange={(e) => onUpdateSettings({ ...settings, inAppPopupsEnabled: e.target.checked })}
                        className="mt-0.5 rounded text-[#471AFF] focus:ring-[#471AFF]/30 w-4 h-4 cursor-pointer shrink-0"
                      />
                    </label>
                  </div>

                  {/* Permission request action if default */}
                  {browserPermission === 'default' && (
                    <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white border border-amber-200">
                      <div className="text-[11px] text-slate-600">
                        {isRu
                          ? 'Разрешите всплывающие системные уведомления для фоновых оповещений'
                          : 'Allow system notifications for background message alerts'}
                      </div>
                      <button
                        type="button"
                        onClick={handleRequestBrowserPermission}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#471AFF] text-white hover:bg-indigo-700 transition-colors shrink-0 cursor-pointer shadow-xs"
                      >
                        {isRu ? 'Включить в браузере' : 'Enable in browser'}
                      </button>
                    </div>
                  )}

                  {/* Tip if denied */}
                  {browserPermission === 'denied' && (
                    <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200 text-[11px] text-rose-700 space-y-1">
                      <p className="font-semibold">
                        {isRu ? 'Уведомления заблокированы в браузере' : 'Notifications blocked by browser'}
                      </p>
                      <p>
                        {isRu
                          ? 'Нажмите на значок настроек сайта в левой части адресной строки браузера и переключите «Уведомления» в положение «Разрешить».'
                          : 'Click the site settings lock icon in the browser URL address bar and allow "Notifications".'}
                      </p>
                    </div>
                  )}

                  {/* Tip if unsupported */}
                  {browserPermission === 'unsupported' && (
                    <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-[11px] text-slate-600">
                      {isRu
                        ? 'Этот браузер не поддерживает системные уведомления — будет работать только всплывающая карточка внутри вкладки.'
                        : 'This browser does not support system notifications — only the in-app popup card will work.'}
                    </div>
                  )}

                  {/* Verification: smart test + forced system test */}
                  <div className="pt-2 border-t border-indigo-100 space-y-2.5">
                    <div className="text-[11px] text-slate-600">
                      {isRu
                        ? 'Проверка: первая кнопка показывает то, что придёт прямо сейчас (карточка, т.к. вкладка открыта), вторая — принудительно системное уведомление.'
                        : 'Verification: the first button shows what would arrive right now (the card, since the tab is open); the second forces a system notification.'}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        id="test-notification-button"
                        type="button"
                        onClick={() => {
                          if (onTestNotification) {
                            onTestNotification();
                            setTestNotifSuccess(true);
                            setTimeout(() => setTestNotifSuccess(false), 4000);
                          }
                        }}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-white text-[#471AFF] hover:bg-indigo-50 border border-indigo-200 transition-all cursor-pointer shadow-2xs flex items-center gap-1.5 shrink-0"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-[#471AFF]" />
                        <span>
                          {testNotifSuccess
                            ? (isRu ? 'Уведомление отправлено!' : 'Notification sent!')
                            : (isRu ? 'Проверить текущее' : 'Test current channel')}
                        </span>
                      </button>

                      <button
                        id="test-browser-notification-button"
                        type="button"
                        onClick={handleForcedBrowserTest}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#471AFF] text-white hover:bg-indigo-700 transition-all cursor-pointer shadow-xs flex items-center gap-1.5 shrink-0"
                      >
                        <Bell className="w-3.5 h-3.5" />
                        <span>{isRu ? 'Проверить системное' : 'Test system one'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={refreshBrowserPermission}
                        title={isRu ? 'Обновить статус разрешения' : 'Refresh permission status'}
                        className="px-2.5 py-1.5 rounded-xl text-[11px] font-medium bg-white text-slate-500 hover:text-slate-700 hover:bg-slate-100 border border-slate-200 transition-all cursor-pointer flex items-center gap-1 shrink-0"
                      >
                        <RotateCw className="w-3 h-3" />
                        <span>{isRu ? 'Обновить статус' : 'Refresh status'}</span>
                      </button>
                    </div>

                    {testBrowserMsg && (
                      <div className="p-2.5 rounded-xl text-[11px] bg-white border border-indigo-200 text-slate-700">
                        {testBrowserMsg}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 3. Connection & Gateway */}
            {activeTab === 'connection' && (
              <div className="space-y-4">
                {/* Editable Instance & Gateway form */}
                <div className="space-y-3">
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 break-words flex items-center gap-1.5">
                      <Server className="w-3.5 h-3.5 text-[#471AFF]" />
                      <span>{t.editConnectionTitle}</span>
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5 break-words">
                      {t.editConnectionDesc}
                    </p>
                  </div>

                  {/* ID Instance input */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      {t.idInstanceLabel}
                    </label>
                    <div className="relative">
                      <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="settings-id-instance-input"
                        type="text"
                        value={editIdInstance}
                        onChange={(e) => {
                          setEditIdInstance(e.target.value);
                          setSaveError(null);
                        }}
                        placeholder="1101823456"
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:bg-white focus:border-[#471AFF] focus:ring-1 focus:ring-[#471AFF]/20 focus:outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* API Token Instance input with show/hide toggle */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      {t.apiTokenLabel}
                    </label>
                    <div className="relative">
                      <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="settings-api-token-input"
                        type={showToken ? 'text' : 'password'}
                        value={editApiToken}
                        onChange={(e) => {
                          setEditApiToken(e.target.value);
                          setSaveError(null);
                        }}
                        placeholder={t.apiTokenPlaceholder}
                        className="w-full pl-9 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:bg-white focus:border-[#471AFF] focus:ring-1 focus:ring-[#471AFF]/20 focus:outline-none transition-all"
                      />
                      <button
                        id="settings-toggle-token-button"
                        type="button"
                        onClick={() => setShowToken(!showToken)}
                        title={t.toggleShowToken}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors cursor-pointer"
                      >
                        {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Gateway URL input with presets */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-semibold text-slate-700">
                        {t.gatewayUrlLabel}
                      </label>
                    </div>
                    <div className="relative">
                      <Globe className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="settings-gateway-url-input"
                        type="text"
                        value={editApiUrl}
                        onChange={(e) => {
                          setEditApiUrl(e.target.value);
                          setSaveError(null);
                        }}
                        placeholder="https://api.green-api.com"
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:bg-white focus:border-[#471AFF] focus:ring-1 focus:ring-[#471AFF]/20 focus:outline-none transition-all"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <span className="text-[10px] text-slate-400 mr-0.5">
                        {isRu ? 'Пресеты шлюза:' : 'Gateway presets:'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditApiUrl('https://api.green-api.com');
                          setSaveError(null);
                        }}
                        className={`text-[10px] px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                          editApiUrl === 'https://api.green-api.com'
                            ? 'bg-indigo-50 border-[#471AFF]/30 text-[#471AFF] font-medium'
                            : 'bg-slate-100/80 border-slate-200/80 text-slate-600 hover:bg-slate-200/60'
                        }`}
                      >
                        api.green-api.com
                      </button>
                      {editIdInstance.trim().length >= 4 && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditApiUrl(`https://${editIdInstance.trim().slice(0, 4)}.api.green-api.com`);
                            setSaveError(null);
                          }}
                          className={`text-[10px] px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                            editApiUrl === `https://${editIdInstance.trim().slice(0, 4)}.api.green-api.com`
                              ? 'bg-indigo-50 border-[#471AFF]/30 text-[#471AFF] font-medium'
                              : 'bg-slate-100/80 border-slate-200/80 text-slate-600 hover:bg-slate-200/60'
                          }`}
                        >
                          {editIdInstance.trim().slice(0, 4)}.api.green-api.com
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setEditApiUrl('https://7103.api.greenapi.com');
                          setSaveError(null);
                        }}
                        className={`text-[10px] px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                          editApiUrl === 'https://7103.api.greenapi.com'
                            ? 'bg-indigo-50 border-[#471AFF]/30 text-[#471AFF] font-medium'
                            : 'bg-slate-100/80 border-slate-200/80 text-slate-600 hover:bg-slate-200/60'
                        }`}
                      >
                        7103.api.greenapi.com
                      </button>
                    </div>
                    {editApiUrl.trim() && !isTrustedGatewayUrl(editApiUrl.trim()) && (
                      <p className="text-[11px] text-rose-600 leading-relaxed mt-1.5">
                        {isRu
                          ? '⚠️ Домен вне allowlist — разрешены только *.green-api.com и *.greenapi.com (https). HTTP запрещён.'
                          : '⚠️ Domain not allowlisted — only *.green-api.com and *.greenapi.com (https) are allowed. HTTP is forbidden.'}
                      </p>
                    )}
                  </div>

                  {/* Save and Test Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      id="save-connection-button"
                      type="button"
                      onClick={handleSaveConnection}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-xs ${
                        isSavedRecently
                          ? 'bg-emerald-600 text-white'
                          : hasCredsChanges
                          ? 'max-gradient-primary text-white hover:opacity-95'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {isSavedRecently ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>{t.connectionSaved}</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" />
                          <span>{t.saveConnectionBtn}</span>
                        </>
                      )}
                    </button>

                    <button
                      id="diagnostic-check-button"
                      type="button"
                      onClick={handleDiagnosticCheck}
                      disabled={checkingStatus || !editIdInstance.trim() || !editApiToken.trim()}
                      className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <RotateCw className={`w-3.5 h-3.5 ${checkingStatus ? 'animate-spin' : ''}`} />
                      <span>{checkingStatus ? t.checkingStatus : t.checkStatusBtn}</span>
                    </button>
                  </div>

                  {saveError && (
                    <div className="p-2.5 rounded-xl text-xs bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-2">
                      <span className="break-words">{saveError}</span>
                    </div>
                  )}

                  {statusResult && (
                    <div className={`p-2.5 rounded-xl text-xs flex items-center space-x-2 ${
                      statusState === 'success' 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : statusState === 'error'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      <div className={`w-2 h-2 rounded-full shrink-0 ${
                        statusState === 'success' ? 'bg-emerald-500' : statusState === 'error' ? 'bg-rose-500' : 'bg-amber-500'
                      }`} />
                      <span className="break-words [overflow-wrap:anywhere]">{statusResult}</span>
                    </div>
                  )}

                  {/* Deep Diagnostics & Troubleshooting Panel */}
                  {diagnosticData && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs text-slate-700 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/80">
                        <div className="flex items-center gap-1.5 font-bold text-slate-800">
                          <Activity className="w-3.5 h-3.5 text-[#471AFF]" />
                          <span>{isRu ? 'Диагностика инстанса и очереди' : 'Instance & Queue Diagnostics'}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500">
                          {diagnosticData.stateInstance || 'unknown'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="bg-white p-2 rounded-lg border border-slate-100">
                          <span className="text-slate-400 block text-[10px]">{isRu ? 'Очередь уведомлений:' : 'Notification Queue:'}</span>
                          <span className="font-semibold text-slate-800">
                            {diagnosticData.countWebhooks !== undefined ? `${diagnosticData.countWebhooks} сообщ.` : (isRu ? 'недоступно' : 'n/a')}
                          </span>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-100">
                          <span className="text-slate-400 block text-[10px]">{isRu ? 'Тест опроса (Receive):' : 'Polling Test (Receive):'}</span>
                          <span className={`font-semibold ${diagnosticData.testPollSuccess ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {diagnosticData.testPollSuccess ? (isRu ? 'Работает' : 'Success') : (isRu ? 'Сбой' : 'Failed')}
                          </span>
                        </div>
                      </div>

                      {/* Webhook Configuration Inspection */}
                      <div className="bg-white p-2 rounded-lg border border-slate-100 text-[11px] space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">{isRu ? 'Входящие вебхуки (incomingWebhook):' : 'Incoming Webhook:'}</span>
                          <span className={`font-mono font-medium ${diagnosticData.incomingWebhook === 'yes' ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {diagnosticData.incomingWebhook || 'no'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">{isRu ? 'Исходящие вебхуки (outgoingWebhook):' : 'Outgoing Webhook:'}</span>
                          <span className={`font-mono font-medium ${diagnosticData.outgoingMessageWebhook === 'yes' ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {diagnosticData.outgoingMessageWebhook || 'no'}
                          </span>
                        </div>
                        {diagnosticData.webhookUrl && (
                          <div className="mt-1.5 p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[10px] flex items-start gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-semibold">{isRu ? 'Внимание: указан внешний Webhook URL: ' : 'Warning: External Webhook URL set: '}</span>
                              <span className="font-mono break-words [overflow-wrap:anywhere]">{diagnosticData.webhookUrl}</span>
                              <p className="mt-0.5 text-amber-700">
                                {isRu 
                                  ? 'GREEN-API отправляет вебхуки на внешний сервер, поэтому они не попадают в веб-очередь. Нажмите «Оптимизировать для MAX Web», чтобы перенаправить их в веб-интерфейс.'
                                  : 'GREEN-API is redirecting webhooks to an external server. Click Optimize for MAX Web to route them to the web queue.'}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Polling diagnostic detail */}
                      <div className="text-[10px] text-slate-500 bg-slate-100/80 p-1.5 rounded-lg font-mono break-words [overflow-wrap:anywhere]">
                        {diagnosticData.testPollMessage}
                      </div>

                      {/* Action buttons: auto-fix, sync, and queue clear */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {onSyncMessages && (
                          <button
                            type="button"
                            onClick={() => onSyncMessages()}
                            disabled={isSyncingMessages}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-indigo-50 border border-[#471AFF]/30 text-[#471AFF] hover:bg-indigo-100 text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <RotateCw className={`w-3 h-3 ${isSyncingMessages ? 'animate-spin' : ''}`} />
                            <span>{isSyncingMessages ? (isRu ? 'Синхронизация...' : 'Syncing...') : (isRu ? 'Синхронизировать сообщения (24ч)' : 'Sync Messages (24h)')}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={handleFixInstanceSettings}
                          disabled={isFixingSettings}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Wrench className={`w-3 h-3 ${isFixingSettings ? 'animate-spin' : ''}`} />
                          <span>{isFixingSettings ? (isRu ? 'Настройка...' : 'Configuring...') : (isRu ? 'Оптимизировать для MAX Web' : 'Optimize for MAX Web')}</span>
                        </button>

                        {(diagnosticData.countWebhooks || 0) > 0 && (
                          <button
                            type="button"
                            onClick={handleClearQueue}
                            disabled={isClearingQueue}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>{isClearingQueue ? (isRu ? 'Очистка...' : 'Clearing...') : (isRu ? 'Очистить очередь' : 'Clear Queue')}</span>
                          </button>
                        )}
                      </div>

                      {fixSettingsMessage && (
                        <div className="p-2 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px]">
                          {fixSettingsMessage}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Polling Interval Setting */}
                <div className="pt-3 border-t border-slate-100">
                  <label className="block text-xs font-semibold text-slate-700 mb-1 break-words">
                    {t.pollingIntervalLabel}
                  </label>
                  <p className="text-[11px] text-slate-500 mb-2.5 break-words">
                    {t.pollingIntervalHint}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { ms: 1000, label: t.pollingInterval1s },
                      { ms: 2000, label: t.pollingInterval2s },
                      { ms: 5000, label: t.pollingInterval5s },
                    ].map((opt) => (
                      <button
                        key={opt.ms}
                        id={`polling-interval-${opt.ms}`}
                        type="button"
                        onClick={() => onUpdateSettings({ ...settings, pollingIntervalMs: opt.ms })}
                        className={`px-2 py-2 rounded-xl text-xs font-semibold border text-center transition-all cursor-pointer truncate ${
                          settings.pollingIntervalMs === opt.ms
                            ? 'border-[#471AFF] bg-indigo-50/70 text-[#471AFF] shadow-xs'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                        title={opt.label}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 4. Data & Account (Sign Out moved here!) */}
            {activeTab === 'data' && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 break-words">
                    {t.accountSectionTitle}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5 break-words">
                    {t.accountSectionDesc}
                  </p>
                </div>

                {/* Export Data */}
                <div className="flex flex-col gap-3 p-3.5 rounded-xl border border-slate-100 bg-slate-50/50">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-semibold text-slate-700 block break-words">
                        {t.exportChatsBtn}
                      </span>
                      <span className="text-[11px] text-slate-500 block mt-0.5 break-words">
                        {t.exportChatsDesc} ({dialogs.length} {lang === 'ru' ? 'диалогов' : 'chats'})
                      </span>
                    </div>
                    <button
                      id="export-chats-button"
                      type="button"
                      onClick={handleExportData}
                      className="inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors shadow-xs cursor-pointer shrink-0 self-start sm:self-auto"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>JSON</span>
                    </button>
                  </div>
                  <label className="flex items-start gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={exportWithMessages}
                      onChange={(e) => setExportWithMessages(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded accent-[#471AFF] cursor-pointer"
                    />
                    <span className="text-[11px] leading-relaxed text-slate-600">
                      {lang === 'ru'
                        ? 'Включить тексты сообщений (по умолчанию выключено — файл с перепиской в открытом виде нельзя пересылать посторонним). Токен доступа никогда не включается в выгрузку.'
                        : 'Include message texts (off by default — a plaintext backup must not be shared with third parties). The access token is never included in the export.'}
                    </span>
                  </label>
                </div>

                {/* Clear local chat history */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-rose-100 bg-rose-50/30">
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-semibold text-rose-700 block break-words">
                      {t.clearAllDataBtn}
                    </span>
                    <span className="text-[11px] text-slate-500 block mt-0.5 break-words">
                      {t.clearAllDataDesc}
                    </span>
                  </div>
                  {confirmClearAll ? (
                    <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setConfirmClearAll(false)}
                        className="px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                      >
                        {t.cancel}
                      </button>
                      <button
                        id="confirm-clear-all-chats-button"
                        type="button"
                        onClick={() => {
                          onClearAllChats();
                          setConfirmClearAll(false);
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-xs cursor-pointer flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>{isRu ? 'Да, очистить' : 'Yes, clear'}</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      id="clear-all-chats-button"
                      type="button"
                      onClick={() => setConfirmClearAll(true)}
                      className="inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-rose-600 bg-white hover:bg-rose-50 border border-rose-200 transition-colors shadow-xs cursor-pointer shrink-0 self-start sm:self-auto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{t.clearHistory}</span>
                    </button>
                  )}
                </div>

                {/* Sign Out Card (Dedicated, clear, prominent) */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-50/80 to-pink-50/50 border border-rose-200/70">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                          <LogOut className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          <span className="break-words">{t.signOutButtonText}</span>
                        </h4>
                        <p className="text-[11px] text-rose-700/80 mt-1 leading-relaxed break-words">
                          {isRu
                            ? 'Завершение текущей сессии. Ключи доступа инстанса будут безопасно удалены с этого устройства.'
                            : 'End your session. Instance credentials and tokens will be safely cleared.'}
                        </p>
                      </div>

                      {confirmSignOut ? (
                        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                          <button
                            type="button"
                            onClick={() => setConfirmSignOut(false)}
                            className="px-3 py-2 rounded-xl text-xs font-medium text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
                          >
                            {t.cancel}
                          </button>
                          <button
                            id="confirm-signout-button"
                            type="button"
                            onClick={() => {
                              onSignOut();
                              onClose();
                            }}
                            className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                            <span>{isRu ? 'Да, выйти' : 'Confirm'}</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          id="settings-signout-button"
                          type="button"
                          onClick={() => setConfirmSignOut(true)}
                          className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 active:scale-95 text-white transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1.5 shrink-0 self-start sm:self-auto"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>{t.signOut}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 5. Integration MAX */}
            {activeTab === 'integration' && (
              <IntegrationPanel creds={creds} activeChatId={activeChatId} lang={lang} />
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-400 font-mono">
            MAX Web • v1.2.0
          </div>
          <button
            id="save-settings-button"
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold max-gradient-primary text-white hover:opacity-95 transition-all shadow-xs cursor-pointer"
          >
            {t.closeBtn}
          </button>
        </div>
      </div>
    </div>
  );
};
