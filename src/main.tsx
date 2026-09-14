import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 1.0, 
  tracePropagationTargets: ["localhost", /^https:\/\/ais-dev-.*\.run\.app/],
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

// Plain HTML recovery fallback function in case React tree fails to mount or crashes catastrophically
const renderHTMLFallback = (title: string, subtitle: string, errorName: string, errorMessage: string) => {
  const container = document.getElementById('root');
  if (container) {
    // Check if container already has rendered content (if React boundary is already running, don't overwrite)
    const hasReactRendered = container.children.length > 0 && !container.innerHTML.includes('recovery-fallback-active');
    if (hasReactRendered) return;

    container.innerHTML = `
      <div class="recovery-fallback-active" style="min-height: 100vh; background-color: #0f0f11; display: flex; align-items: center; justify-content: center; padding: 24px; color: white; font-family: system-ui, -apple-system, sans-serif; text-align: center; box-sizing: border-box;">
        <div style="max-width: 500px; width: 100%; background-color: #1c1c20; border: 1px solid #2e2e33; border-radius: 24px; padding: 32px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); box-sizing: border-box;">
          <div style="width: 64px; height: 64px; background-color: rgba(244, 63, 94, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px;">
            <span style="font-size: 32px; color: #f43f5e; line-height: 1; display: block; margin-top: -2px;">⚠️</span>
          </div>
          <h1 style="font-size: 24px; font-weight: bold; margin: 0 0 12px 0; color: #ffffff;">${title}</h1>
          <p style="color: #a3a3a3; font-size: 14px; margin: 0 0 24px 0; line-height: 1.6;">${subtitle}</p>
          <div style="background-color: rgba(0,0,0,0.4); border-radius: 16px; padding: 16px; text-align: left; margin-bottom: 24px; border: 1px solid rgba(255,255,255,0.05); box-sizing: border-box;">
            <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #0084DF; font-weight: bold; margin-bottom: 8px;">Detalhes do Erro</div>
            <p style="font-family: monospace; font-size: 13px; color: #fca5a5; margin: 0; word-break: break-all; line-height: 1.4;"><strong>${errorName}:</strong> ${errorMessage}</p>
          </div>
          <button onclick="window.location.reload()" style="display: block; width: 100%; padding: 14px; background-color: #0084DF; color: white; border: none; border-radius: 14px; font-weight: bold; font-size: 14px; cursor: pointer; transition: background-color 0.2s; box-sizing: border-box; outline: none; font-family: inherit;">
            Recarregar Página
          </button>
        </div>
      </div>
    `;
  }
};

// Diagnostic and fallback triggers for unhandled runtime errors before/during execution
window.addEventListener('error', (event) => {
  // Capture-phase resource errors (like script/stylesheet load failures due to network or rate limits)
  const target = event.target as any;
  if (target && (target.tagName === 'SCRIPT' || target.tagName === 'LINK')) {
    const container = document.getElementById('root');
    if (container && container.children.length === 0) {
      renderHTMLFallback(
        'Limite de requisições excedido (Erro 429)',
        'O servidor do ambiente de desenvolvimento atingiu o limite temporário de requisições. Aguarde 5 a 10 segundos e recarregue a página para reestabelecer o serviço.',
        'NetworkError',
        `Falha ao carregar o arquivo estático: ${target.src || target.href || 'recurso de renderização'}`
      );
    }
    return;
  }

  const err = event.error || { name: 'Error', message: event.message };
  console.error('[GLOBAL ERROR]', err);
  
  // Try to render a pure HTML/CSS recovery page if the root container is empty
  const container = document.getElementById('root');
  if (container && container.children.length === 0) {
    const isRateLimit = err.message && (
      err.message.includes('429') || 
      err.message.includes('Rate limit') || 
      err.message.includes('dynamic import') ||
      err.message.includes('Failed to fetch')
    );
    
    renderHTMLFallback(
      isRateLimit ? 'Limite de requisições excedido' : 'Ops, algo deu errado.',
      isRateLimit 
        ? 'Ocorreu um limite temporário de tráfego de rede no servidor. Aguarde alguns instantes antes de atualizar.' 
        : 'O ZENO encontrou uma falha crítica de carregamento que impediu a inicialização do aplicativo.',
      err.name || 'RuntimeException',
      err.message || 'Erro inesperado do navegador'
    );
  }
}, true); // Use capture phase to intercept resource errors

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason || {};
  console.warn('[UNHANDLED REJECTION]', reason);
  event.preventDefault();
  
  const container = document.getElementById('root');
  if (container && container.children.length === 0) {
    const reasonStr = typeof reason === 'string' ? reason : (reason.message || '');
    const isRateLimit = reasonStr.includes('429') || reasonStr.includes('Rate limit') || reasonStr.includes('Failed to fetch');

    renderHTMLFallback(
      isRateLimit ? 'Limite de requisições excedido' : 'Ops, algo deu errado.',
      isRateLimit
        ? 'Ocorreu uma restrição temporária de rede durante a comunicação assíncrona. Aguarde alguns instantes.'
        : 'Ocorreu uma falha de carregamento assíncrono durante a inicialização do ZENO.',
      reason.name || 'PromiseRejection',
      reasonStr || 'Rejeição de promessa não tratada'
    );
  }
});

try {
  const container = document.getElementById('root');
  if (!container) throw new Error("Elemento container '#root' não foi encontrado no DOM.");
  
  const root = createRoot(container);
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
} catch (err: any) {
  console.error('[FATAL MOUNT ERROR]', err);
  renderHTMLFallback(
    'Ops, algo deu errado.',
    'Não foi possível inicializar o aplicativo do ZENO (falha de montagem).',
    err?.name || 'MountError',
    err?.message || 'Erro na criação do root container'
  );
}

