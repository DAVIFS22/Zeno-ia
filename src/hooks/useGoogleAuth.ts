import { useState, useEffect, useCallback } from 'react';
import { ConnectedAccount, MultiAccountSession } from '../types';
import { getUserRole, isAdminUser } from '../config/admin';

const STORAGE_KEY = 'zeno_auth_session';

declare global {
  interface Window {
    google: any;
  }
}

export function useGoogleAuth() {
  const [session, setSession] = useState<MultiAccountSession>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : { accounts: [], activeUid: null };
    } catch (e) {
      console.error('Failed to parse auth session', e);
      return { accounts: [], activeUid: null };
    }
  });
  const [loading, setLoading] = useState(true);

  const saveSession = useCallback((newSession: MultiAccountSession) => {
    setSession(newSession);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSession));
  }, []);

  const refreshAccount = useCallback(async (account: ConnectedAccount): Promise<ConnectedAccount> => {
    // Refresh only if expiring in less than 5 minutes
    if (Date.now() < account.expiresAt - 5 * 60 * 1000) {
      return account;
    }

    if (!account.refreshToken) {
       // If no refresh token, we can't refresh automatically. 
       // This might happen if the user didn't grant offline access or we already used it.
       return account;
    }

    try {
      const res = await fetch('/api/auth/google/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: account.refreshToken }),
      });

      if (!res.ok) throw new Error('Refresh failed');
      const data = await res.json();
      
      const updated: ConnectedAccount = {
        ...account,
        accessToken: data.tokens.access_token,
        expiresAt: data.tokens.expiry_date || (Date.now() + 3600 * 1000),
      };
      
      // Update refreshToken if a new one is returned
      if (data.tokens.refresh_token) {
        updated.refreshToken = data.tokens.refresh_token;
      }
      
      return updated;
    } catch (err) {
      console.error('Refresh error for', account.email, err);
      // In case of refresh failure, we might want to log out or just return as is
      return account;
    }
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      if (session.accounts.length > 0) {
        const updatedAccounts = await Promise.all(
          session.accounts.map(async (acc) => {
            try {
              return await refreshAccount(acc);
            } catch {
              return acc;
            }
          })
        );
        
        const hasChanges = JSON.stringify(updatedAccounts) !== JSON.stringify(session.accounts);
        if (hasChanges) {
          saveSession({ ...session, accounts: updatedAccounts });
        }
      }
      setLoading(false);
    };

    checkSession();

    // Auto-refresh timer every 15 minutes
    const interval = setInterval(checkSession, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const login = useCallback((isAddingAccount: boolean = false) => {
    return new Promise<void>((resolve, reject) => {
      if (!window.google) {
        const script = document.createElement('script');
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        script.onload = () => {
          triggerLogin(isAddingAccount, resolve, reject);
        };
        document.head.appendChild(script);
      } else {
        triggerLogin(isAddingAccount, resolve, reject);
      }
    });
  }, [saveSession]);

  const triggerLogin = (isAddingAccount: boolean, resolve: any, reject: any) => {
    try {
      const client = window.google.accounts.oauth2.initCodeClient({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '102711019013-149jto22j3r76t40scfkkve10u7t928s.apps.googleusercontent.com',
        scope: 'openid profile email',
        ux_mode: 'popup',
        select_account: true,
        callback: async (response: any) => {
          if (response.code) {
            try {
              const res = await fetch('/api/auth/google/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: response.code }),
              });

              if (!res.ok) throw new Error('Token exchange failed');
              const data = await res.json();

              const newAccount: ConnectedAccount = {
                uid: data.user.uid,
                email: data.user.email,
                displayName: data.user.displayName,
                photoURL: data.user.photoURL,
                accessToken: data.tokens.access_token,
                refreshToken: data.tokens.refresh_token,
                expiresAt: data.tokens.expiry_date || (Date.now() + 3600 * 1000),
                role: getUserRole(data.user.email),
                isAdmin: isAdminUser(data.user.email),
              };

              setSession(prev => {
                const filtered = prev.accounts.filter(a => a.uid !== newAccount.uid);
                const next = {
                  accounts: [newAccount, ...filtered],
                  activeUid: newAccount.uid
                };
                localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
                return next;
              });
              resolve();
            } catch (err) {
              console.error('Login exchange error:', err);
              reject(err);
            }
          } else if (response.error) {
            reject(new Error(response.error_description || response.error));
          }
        },
      });

      client.requestCode();
    } catch (e) {
      console.error('GIS init error:', e);
      reject(e);
    }
  };

  const switchAccount = useCallback((uid: string) => {
    saveSession({ ...session, activeUid: uid });
  }, [session, saveSession]);

  const logout = useCallback((uid?: string) => {
    const targetUid = uid || session.activeUid;
    if (!targetUid) return;

    const nextAccounts = session.accounts.filter(a => a.uid !== targetUid);
    const nextActiveUid = nextAccounts.length > 0 ? nextAccounts[0].uid : null;
    
    saveSession({
      accounts: nextAccounts,
      activeUid: nextActiveUid
    });
  }, [session, saveSession]);

  const activeAccount = session.accounts.find(a => a.uid === session.activeUid) || null;

  return {
    session,
    activeAccount,
    loading,
    login,
    logout,
    switchAccount
  };
}
