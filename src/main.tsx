import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

// Diagnostic for unhandled runtime errors
window.addEventListener('error', (event) => {
  console.error('[GLOBAL ERROR]', event.error || event.message);
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:white;color:red;padding:20px;z-index:9999;font-family:monospace;overflow:auto;border:10px solid red;";
  errorDiv.innerHTML = `<h1>Erro de Runtime (Client-side)</h1>
                        <p><strong>Mensagem:</strong> ${event.message}</p>
                        <pre>${event.error?.stack || 'No stack trace available'}</pre>`;
  document.body.appendChild(errorDiv);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[UNHANDLED REJECTION]', event.reason);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
