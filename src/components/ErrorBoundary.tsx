import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[CRITICAL ERROR] Uncaught error in React tree:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-screen bg-[#0f0f11] flex items-center justify-center p-6 text-white font-sans">
          <div className="max-w-md w-full bg-[#1c1c20] border border-neutral-800 rounded-3xl p-8 shadow-2xl text-center animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-rose-500" />
            </div>
            
            <h1 className="text-2xl font-bold mb-3">Algo deu errado</h1>
            <p className="text-neutral-400 text-sm mb-8 leading-relaxed">
              O ZENO encontrou um erro inesperado que impediu a renderização da interface. 
              Nossos engenheiros foram notificados.
            </p>

            <div className="bg-black/40 rounded-xl p-4 mb-8 text-left overflow-hidden">
              <div className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold mb-2">Detalhes do Erro</div>
              <p className="text-xs font-mono text-rose-400/80 truncate">
                {this.state.error?.name}: {this.state.error?.message}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={this.handleReset}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-zeno text-white rounded-xl font-semibold text-sm hover:bg-zeno/90 transition-all active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
                Recarregar
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-neutral-800 text-neutral-200 rounded-xl font-semibold text-sm hover:bg-neutral-700 transition-all active:scale-95"
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
