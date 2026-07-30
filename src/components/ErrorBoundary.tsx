import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Exceção não capturada capturada pelo ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#121212] text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-[#1e1e1e] border border-[#2C2C2E] rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-neutral-500/10 border border-neutral-500/20 text-neutral-400 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-semibold text-white">Ops! Ocorreu um problema na interface</h2>
            <p className="text-sm text-neutral-400 leading-relaxed">
              Ocorreu um erro inesperado. Você pode tentar recarregar a aplicação.
            </p>
            {this.state.error && (
              <div className="w-full bg-[#141414] border border-[#2C2C2E] rounded-xl p-3 text-left overflow-auto max-h-32 text-xs font-mono text-neutral-300">
                {this.state.error.toString()}
              </div>
            )}
            <button
              onClick={this.handleReset}
              className="mt-2 w-full py-3 px-4 rounded-xl bg-white hover:bg-neutral-200 text-black font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Tentar Novamente</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
