import React, { useState } from 'react';
import { KeyRound, ShieldCheck, ArrowRight, Loader2, Sparkles, Globe, HelpCircle, Server, Settings2 } from 'lucide-react';
import { GreenApiCredentials, Language } from '../types';
import { translations } from '../i18n/translations';
import { GreenApiService, DEFAULT_API_URL } from '../services/greenApi';
import { MaxLogo } from './MaxLogo';

interface AuthScreenProps {
  onConnect: (creds: GreenApiCredentials) => void;
  lang: Language;
  onToggleLang: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onConnect, lang, onToggleLang }) => {
  const t = translations[lang];
  const [idInstance, setIdInstance] = useState('');
  const [apiTokenInstance, setApiTokenInstance] = useState('');
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [showAdvancedGateway, setShowAdvancedGateway] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = idInstance.trim();
    const cleanToken = apiTokenInstance.trim();
    const cleanUrl = apiUrl.trim() || DEFAULT_API_URL;

    if (!cleanId || !cleanToken) {
      setError(t.authErrorEmpty);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Validate credentials by pinging getStateInstance
      await GreenApiService.checkInstanceStatus({
        idInstance: cleanId,
        apiTokenInstance: cleanToken,
        apiUrl: cleanUrl,
      });

      onConnect({ idInstance: cleanId, apiTokenInstance: cleanToken, apiUrl: cleanUrl });
    } catch (err: any) {
      console.warn('Instance validation warning:', err);
      // If it's a 401 / 403 or network issue, show error, but allow connect if user confirms
      setError(t.authErrorFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleBypassConnect = () => {
    const cleanId = idInstance.trim();
    const cleanToken = apiTokenInstance.trim();
    const cleanUrl = apiUrl.trim() || DEFAULT_API_URL;
    if (cleanId && cleanToken) {
      onConnect({ idInstance: cleanId, apiTokenInstance: cleanToken, apiUrl: cleanUrl });
    }
  };

  const handleFillDemo = () => {
    setIdInstance('1101823456');
    setApiTokenInstance('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    setApiUrl(DEFAULT_API_URL);
    setError(null);
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 relative overflow-hidden flex flex-col justify-between items-center p-4 sm:p-6 md:p-8">
      {/* Ambient MAX Brand Background Orbs */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#00BFFF]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/4 -right-32 w-96 h-96 bg-[#9500FF]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-[#471AFF]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
      <div className="w-full max-w-md flex justify-between items-center pt-2 relative z-10">
        <div className="flex items-center">
          <MaxLogo id="auth-header-logo" size="lg" variant="full" showDomain={true} />
        </div>

        {/* Language switch */}
        <button
          type="button"
          onClick={onToggleLang}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white/90 backdrop-blur-xs border border-slate-200/80 rounded-xl hover:border-slate-300 transition-colors shadow-2xs cursor-pointer"
          title={t.switchLanguage}
        >
          <Globe className="w-3.5 h-3.5 text-slate-400" />
          <span>{lang.toUpperCase()}</span>
        </button>
      </div>

      {/* Main Form Card */}
      <div className="w-full max-w-md bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-xl shadow-indigo-950/5 p-6 sm:p-8 my-auto relative z-10">
        <div className="text-center mb-6">
          <div className="w-13 h-13 rounded-2xl max-gradient-primary text-white flex items-center justify-center mx-auto mb-3.5 max-gradient-glow">
            <KeyRound className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">{t.authTitle}</h1>
          <p className="text-xs text-slate-500 mt-1.5 max-w-xs mx-auto leading-relaxed">
            {t.authSubtitle}
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex flex-col gap-2">
            <div className="flex items-start gap-2">
              <span className="font-semibold">{error}</span>
            </div>
            {idInstance && apiTokenInstance && (
              <button
                type="button"
                onClick={handleBypassConnect}
                className="self-start text-[11px] underline font-medium text-rose-800 hover:text-rose-900 mt-0.5 cursor-pointer"
              >
                {lang === 'ru' ? 'Продолжить всё равно (пропустить проверку)' : 'Continue anyway (skip check)'}
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t.idInstanceLabel}
            </label>
            <input
              type="text"
              required
              value={idInstance}
              onChange={(e) => setIdInstance(e.target.value)}
              placeholder={t.idInstancePlaceholder}
              className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#471AFF]/20 focus:border-[#471AFF] focus:bg-white transition-all font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t.apiTokenLabel}
            </label>
            <input
              type="password"
              required
              value={apiTokenInstance}
              onChange={(e) => setApiTokenInstance(e.target.value)}
              placeholder={t.apiTokenPlaceholder}
              className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#471AFF]/20 focus:border-[#471AFF] focus:bg-white transition-all font-mono text-xs"
            />
          </div>

          {/* Optional Gateway Settings Toggle */}
          <div className="pt-0.5">
            <button
              type="button"
              onClick={() => setShowAdvancedGateway(!showAdvancedGateway)}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#471AFF] transition-colors py-1 cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{t.gatewayUrlLabel}</span>
              <span className="text-[10px] text-slate-400 font-mono">
                {showAdvancedGateway ? '▲' : '▼'}
              </span>
            </button>

            {showAdvancedGateway && (
              <div className="mt-1.5 p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2 text-xs">
                <input
                  type="text"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  placeholder="https://api.green-api.com"
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#471AFF]/20 focus:border-[#471AFF]"
                />
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setApiUrl('https://api.green-api.com')}
                    className="text-[10px] px-2 py-0.5 rounded bg-white border border-slate-200 hover:border-slate-300 text-slate-600 cursor-pointer"
                  >
                    api.green-api.com
                  </button>
                  <button
                    type="button"
                    onClick={() => setApiUrl('https://7103.api.greenapi.com')}
                    className="text-[10px] px-2 py-0.5 rounded bg-white border border-slate-200 hover:border-slate-300 text-slate-600 cursor-pointer"
                  >
                    7103.api.greenapi.com
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 max-gradient-primary max-gradient-glow text-white font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed active:scale-[0.99]"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t.connectingButton}</span>
              </>
            ) : (
              <>
                <span>{t.connectButton}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Quick Demo Credentials Helper */}
        <div className="mt-5 pt-5 border-t border-slate-100 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={handleFillDemo}
            className="flex items-center justify-center gap-1.5 text-xs text-[#471AFF] hover:text-[#3812DE] font-semibold py-2 px-3 rounded-xl hover:bg-indigo-50/70 transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t.demoFillTip}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowHelp(!showHelp)}
            className="flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>{t.whereToGetCreds}</span>
          </button>

          {showHelp && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] text-slate-600 leading-relaxed mt-1 break-words [overflow-wrap:anywhere]">
              {t.credsHelp}
            </div>
          )}
        </div>
      </div>

      {/* Footer info */}
      <div className="w-full max-w-md text-center py-2 text-[11px] text-slate-400 flex flex-wrap items-center justify-center gap-1.5 px-2">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
        <span className="break-words">MAX Messenger Protocol · GREEN-API Gateway</span>
      </div>
    </div>
  );
};
