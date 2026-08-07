import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { ADMIN_EMAIL, maskEmail } from '../config/admin';
import { useTranslation } from '../i18n';

export interface WithAdminProps {
  userEmail?: string;
  [key: string]: any;
}

/**
 * Higher-Order Component (HOC) to protect administrative components.
 * Checks if userEmail matches the designated administrator email.
 * If the user is not an admin, blocks rendering and displays a 403 Forbidden Access Denied screen.
 */
export function withAdmin<P extends WithAdminProps>(
  WrappedComponent: React.ComponentType<P>
): React.FC<P> {
  const ProtectedComponent: React.FC<P> = (props: P) => {
    const { t } = useTranslation();
    const { profile: auth, loading } = useAuth();

    if (loading) return null;

    if (!auth || !auth.isAdmin) {
      return (
        <div className="w-full p-6 sm:p-8 rounded-2xl bg-[#121212]/30 border border-neutral-500/40 text-white space-y-5 animate-fadeIn">
          <div className="flex items-center gap-3 text-neutral-400">
            <ShieldAlert className="w-8 h-8 flex-shrink-0" />
            <div>
              <h3 className="text-xl font-bold tracking-tight text-white">403 - {t.admin.denied}</h3>
              <p className="text-xs text-neutral-300 font-mono mt-0.5">
                {t.admin.role}: {auth?.role || 'Visitante'} | {t.admin.session}: {maskEmail(auth?.email)}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-black/40 border border-neutral-500/20 text-sm leading-relaxed text-neutral-100/90 space-y-2">
            <p>
              {t.admin.noPermission}
            </p>
            <p className="text-xs text-neutral-300/80">
              {t.admin.onlyAdminTip} (<span className="font-mono text-white underline">{maskEmail(ADMIN_EMAIL)}</span>) {t.admin.unrestrictedAccess}
            </p>
          </div>

          <div className="flex items-center justify-between pt-2 text-xs text-neutral-400 border-t border-neutral-500/20">
            <span>{t.admin.securityCheck}</span>
            <span className="font-mono text-neutral-400">HTTP 403 FORBIDDEN</span>
          </div>
        </div>
      );
    }

    return <WrappedComponent {...props} />;
  };

  ProtectedComponent.displayName = `withAdmin(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;

  return ProtectedComponent;
}
