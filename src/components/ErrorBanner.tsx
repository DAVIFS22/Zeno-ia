import React, { useState } from 'react';
import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp, Send, CheckCircle2 } from 'lucide-react';

interface ErrorBannerProps {
  errorMessage: string;
  rawDetails?: string;
  onRetry?: () => void;
  theme: 'dark' | 'light';
}

export function ErrorBanner({ errorMessage, rawDetails, onRetry, theme }: ErrorBannerProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [reportSent, setReportSent] = useState(false);

  const handleSendReport = () => {
    setReportSent(true);
    setTimeout(() => {
      setReportSent(false);
    }, 4000);
  };

  const isDark = theme === 'dark';

  return (
    <div className={`my-3 p-4 rounded-2xl border transition-all animate-fadeIn ${
      isDark
        ? 'bg-[#121212]/20 border-neutral-500/30 text-neutral-200'
        : 'bg-neutral-50 border-neutral-200 text-neutral-900'
    }`}>
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-neutral-500/20 text-neutral-400 flex-shrink-0 mt-0.5">
          <AlertTriangle className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-sm text-neutral-400">Não foi possível concluir a solicitação</h4>
          <p className="text-xs sm:text-sm mt-1 leading-relaxed opacity-90">
            {errorMessage || 'Ocorreu um problema temporário na conexão com os servidores do ZENO.'}
          </p>

          {/* Actions Bar */}
          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            {onRetry && (
              <button
                onClick={onRetry}
                className="px-3.5 py-1.5 rounded-xl bg-neutral-600 hover:bg-neutral-700 text-white font-semibold text-xs flex items-center gap-1.5 transition-all shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Tentar novamente</span>
              </button>
            )}

            {rawDetails && (
              <button
                onClick={() => setShowDetails(!showDetails)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1 transition-all ${
                  isDark
                    ? 'border-neutral-500/30 hover:bg-neutral-500/10 text-neutral-300'
                    : 'border-neutral-300 hover:bg-neutral-100 text-neutral-800'
                }`}
              >
                <span>{showDetails ? 'Ocultar detalhes' : 'Ver detalhes'}</span>
                {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}

            <button
              onClick={handleSendReport}
              disabled={reportSent}
              className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all ${
                reportSent
                  ? 'bg-sky-500/20 border-sky-500/40 text-sky-300'
                  : isDark
                    ? 'border-[#2C2C2E] hover:bg-[#232326] text-neutral-300'
                    : 'border-neutral-300 hover:bg-neutral-100 text-neutral-700'
              }`}
            >
              {reportSent ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
                  <span>Relatório enviado à Zeno Inc.</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar relatório</span>
                </>
              )}
            </button>
          </div>

          {/* Collapsible Details */}
          {showDetails && rawDetails && (
            <div className={`mt-3 p-3 rounded-xl font-mono text-[11px] overflow-x-auto max-h-36 scrollbar-custom border ${
              isDark ? 'bg-black/50 border-neutral-500/20 text-neutral-300' : 'bg-neutral-100/50 border-neutral-300 text-neutral-950'
            }`}>
              {rawDetails}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
