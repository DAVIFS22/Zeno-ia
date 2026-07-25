import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { ADMIN_EMAIL } from '../config/admin';

export interface WithAdminProps {
  userEmail?: string;
  [key: string]: any;
}

/**
 * Higher-Order Component (HOC) to protect administrative components.
 * Checks if userEmail matches the designated administrator email (davifernandes0024509@gmail.com).
 * If the user is not an admin, blocks rendering and displays a 403 Forbidden Access Denied screen.
 */
export function withAdmin<P extends WithAdminProps>(
  WrappedComponent: React.ComponentType<P>
): React.FC<P> {
  const ProtectedComponent: React.FC<P> = (props: P) => {
    const { profile: auth, loading } = useAuth();

    if (loading) return null;

    if (!auth || !auth.isAdmin) {
      return (
        <div className="w-full p-6 sm:p-8 rounded-2xl bg-rose-950/30 border border-rose-500/40 text-white space-y-5 animate-fadeIn">
          <div className="flex items-center gap-3 text-rose-400">
            <ShieldAlert className="w-8 h-8 flex-shrink-0" />
            <div>
              <h3 className="text-xl font-bold tracking-tight text-white">403 - Acesso Negado (Forbidden)</h3>
              <p className="text-xs text-rose-300 font-mono mt-0.5">
                Role: {auth?.role || 'Visitante'} | Email: {auth?.email || 'Anônimo'}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-black/40 border border-rose-500/20 text-sm leading-relaxed text-rose-100/90 space-y-2">
            <p>
              Acesso negado ao painel administrativo. Esta área é restrita exclusivamente ao administrador do sistema.
            </p>
            <p className="text-xs text-rose-300/80">
              Apenas o e-mail autorizado (<span className="font-mono text-white underline">{ADMIN_EMAIL}</span>) possui o papel <code className="text-red-400">admin</code>.
            </p>
          </div>

          <div className="flex items-center justify-between pt-2 text-xs text-neutral-400 border-t border-rose-500/20">
            <span>Guarda de Segurança HOC (withAdmin) Ativo</span>
            <span className="font-mono text-rose-400">HTTP 403 FORBIDDEN</span>
          </div>
        </div>
      );
    }

    return <WrappedComponent {...props} />;
  };

  ProtectedComponent.displayName = `withAdmin(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;

  return ProtectedComponent;
}
