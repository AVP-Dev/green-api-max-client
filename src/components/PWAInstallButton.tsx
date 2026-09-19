import React, { useState } from 'react';
import { Download, CheckCircle2, Share2, PlusSquare, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Language } from '../types';

interface PWAInstallButtonProps {
  lang: Language;
  variant?: 'button' | 'card' | 'compact';
  onInstalled?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  lang,
  variant = 'button',
  onInstalled,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [installing, setInstalling] = useState(false);

  const isRu = lang === 'ru';

  const handleInstallClick = async () => {
    if (isInstallable) {
      setInstalling(true);
      try {
        const success = await install();
        if (success && onInstalled) {
          onInstalled();
        }
      } finally {
        setInstalling(false);
      }
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  if (isInstalled) {
    if (variant === 'card') {
      return (
        <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-emerald-800">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div className="text-xs">
            <p className="font-semibold">
              {isRu ? 'Приложение установлено' : 'App is installed'}
            </p>
            <p className="text-emerald-700/80 text-[11px] mt-0.5">
              {isRu ? 'MAX Web работает в автономном режиме PWA' : 'MAX Web is running as a standalone PWA'}
            </p>
          </div>
        </div>
      );
    }
    return null;
  }

  // Variant: Card (used in SettingsModal)
  if (variant === 'card') {
    return (
      <>
        <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/50 border border-indigo-100 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl max-gradient-primary flex items-center justify-center text-white shadow-xs shrink-0">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">
                  {isRu ? 'Установить MAX Web' : 'Install MAX Web'}
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  {isRu
                    ? 'Запускайте мессенджер с экрана «Домой» без адресной строки браузера и с мгновенным доступом'
                    : 'Launch the messenger from your Home screen like a native app with zero browser chrome'}
                </p>
              </div>
            </div>

            <button
              id="settings-pwa-install-button"
              type="button"
              onClick={handleInstallClick}
              disabled={installing}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold max-gradient-primary text-white hover:opacity-95 active:scale-95 transition-all shadow-xs shrink-0 cursor-pointer flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isRu ? 'Установить' : 'Install'}</span>
            </button>
          </div>
        </div>

        {/* iOS Instruction Modal */}
        {showIOSGuide && (
          <div
            className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150"
            onClick={() => setShowIOSGuide(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-[#471AFF]" />
                  {isRu ? 'Установка на iPhone / iPad' : 'Install on iPhone / iPad'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="py-4 space-y-3.5 text-xs text-slate-600">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-indigo-50 text-[#471AFF] font-bold flex items-center justify-center shrink-0 text-xs">
                    1
                  </div>
                  <div className="leading-tight">
                    <p className="font-semibold text-slate-800">
                      {isRu ? 'Нажмите «Поделиться»' : 'Tap Share button'}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                      {isRu ? 'Иконка' : 'Icon'} <Share2 className="w-3.5 h-3.5 text-blue-600 inline" /> {isRu ? 'в нижней панели Safari' : 'in Safari toolbar'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-indigo-50 text-[#471AFF] font-bold flex items-center justify-center shrink-0 text-xs">
                    2
                  </div>
                  <div className="leading-tight">
                    <p className="font-semibold text-slate-800">
                      {isRu ? 'Выберите «На экран Домой»' : 'Choose «Add to Home Screen»'}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                      <PlusSquare className="w-3.5 h-3.5 text-slate-700 inline" /> {isRu ? 'Прокрутите список действий вниз' : 'Scroll down the actions list'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-indigo-50 text-[#471AFF] font-bold flex items-center justify-center shrink-0 text-xs">
                    3
                  </div>
                  <div className="leading-tight">
                    <p className="font-semibold text-slate-800">
                      {isRu ? 'Нажмите «Добавить»' : 'Tap «Add»'}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {isRu ? 'MAX Web появится на вашем рабочем столе' : 'MAX Web will appear on your Home Screen'}
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2.5 rounded-xl max-gradient-primary text-white text-xs font-semibold hover:opacity-95 transition-all shadow-xs cursor-pointer"
              >
                {isRu ? 'Понятно' : 'Got it'}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Default button variant
  return (
    <>
      <button
        id="pwa-install-button"
        type="button"
        onClick={handleInstallClick}
        disabled={installing}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold max-gradient-primary text-white hover:opacity-95 active:scale-95 transition-all shadow-xs cursor-pointer"
        title={isRu ? 'Установить приложение' : 'Install App'}
      >
        <Download className="w-3.5 h-3.5" />
        <span>{isRu ? 'Приложение' : 'Install App'}</span>
      </button>

      {showIOSGuide && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
          onClick={() => setShowIOSGuide(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                {isRu ? 'Установка на iOS' : 'Install on iOS'}
              </h3>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-600 leading-relaxed">
              {isRu
                ? 'Нажмите кнопку «Поделиться» (иконка со стрелкой вверх) в Safari и выберите «На экран Домой».'
                : 'Tap the Share icon in Safari toolbar, then select «Add to Home Screen».'}
            </p>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="mt-4 w-full py-2 rounded-xl bg-slate-100 text-slate-800 text-xs font-semibold hover:bg-slate-200 transition-all"
            >
              {isRu ? 'Закрыть' : 'Close'}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
