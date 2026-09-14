import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false
    };
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[CRITICAL ERROR] Uncaught error in React tree:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, showDetails: false });
    window.location.reload();
  };

  private toggleDetails = () => {
    this.setState((prevState) => ({ showDetails: !prevState.showDetails }));
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const errorName = this.state.error?.name || 'Error';
      const errorMessage = this.state.error?.message || 'Ocorreu um erro desconhecido na renderização.';
      const errorStack = this.state.error?.stack || '';
      const componentStack = this.state.errorInfo?.componentStack || '';

      return (
        <div className="min-h-screen bg-[#0f0f11] flex items-center justify-center p-6 text-white font-sans selection:bg-[#0084DF]/20 selection:text-[#0084DF]">
          <div className="max-w-xl w-full bg-[#1c1c20] border border-neutral-800 rounded-3xl p-8 shadow-2xl text-center animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-rose-500" />
            </div>
            
            <h1 className="text-2xl font-bold mb-3 text-white">Ops, algo deu errado.</h1>
            <p className="text-neutral-400 text-sm mb-6 leading-relaxed">
              O ZENO encontrou um erro inesperado de renderização. Você pode tentar recarregar a página para restaurar o sistema.
            </p>

            {/* Error Message Box */}
            <div className="bg-black/40 rounded-2xl p-5 mb-6 text-left border border-neutral-800/50">
              <div className="text-[10px] uppercase tracking-wider text-[#0084DF] font-bold mb-2">Mensagem do Erro</div>
              <p className="text-sm font-mono text-rose-400 break-words">
                <strong>{errorName}:</strong> {errorMessage}
              </p>
            </div>

            {/* Collapsible Details */}
            <div className="mb-6 border border-neutral-800/60 rounded-2xl overflow-hidden text-left bg-neutral-900/40">
              <button
                onClick={this.toggleDetails}
                className="w-full flex items-center justify-between px-5 py-4 text-xs font-semibold text-neutral-400 hover:text-white hover:bg-neutral-800/20 transition-all"
              >
                <span>DETALHES TÉCNICOS</span>
                {this.state.showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {this.state.showDetails && (
                <div className="px-5 pb-5 pt-1 border-t border-neutral-800/40 max-h-60 overflow-y-auto font-mono text-[11px] text-neutral-400 space-y-4">
                  {errorStack && (
                    <div>
                      <div className="text-neutral-500 font-bold mb-1 uppercase text-[9px] tracking-wider">Stack Trace:</div>
                      <pre className="whitespace-pre-wrap break-all bg-black/30 p-3 rounded-xl border border-neutral-800/30">
                        {errorStack}
                      </pre>
                    </div>
                  )}
                  {componentStack && (
                    <div>
                      <div className="text-neutral-500 font-bold mb-1 uppercase text-[9px] tracking-wider">Component Stack:</div>
                      <pre className="whitespace-pre-wrap break-all bg-black/30 p-3 rounded-xl border border-neutral-800/30">
                        {componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={this.handleReset}
                className="flex items-center justify-center gap-2 px-5 py-3 bg-[#0084DF] hover:bg-[#0084DF]/90 text-white rounded-xl font-semibold text-sm transition-all active:scale-95 shadow-lg shadow-[#0084DF]/10"
              >
                <RefreshCw className="w-4 h-4" />
                Recarregar
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="flex items-center justify-center gap-2 px-5 py-3 bg-neutral-800 text-neutral-200 rounded-xl font-semibold text-sm hover:bg-neutral-700 transition-all active:scale-95"
              >
                <Home className="w-4 h-4" />
                Início
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

