import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  signInWithPopup,
  signInWithRedirect, 
  onAuthStateChanged, 
  signOut, 
  User,
  getIdToken,
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, googleProvider, db, extractDisplayNameFromEmail } from '../lib/firebase';
import { syncUserProfile } from '../lib/firebase';
import { ConnectedAccount, MultiAccountSession } from '../types';
import { getUserRole, isAdminUser, ADMIN_EMAIL } from '../config/admin';

const STORAGE_KEY = 'zeno_auth_session';

export function useFirebaseAuth() {
  const [session, setSession] = useState<MultiAccountSession>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : { accounts: [], activeUid: null };
    } catch (e) {
      console.error('Failed to parse auth session', e);
      return { accounts: [], activeUid: null };
    }
  });
  
  const [loading, setLoading] = useState(true);

  const saveSession = useCallback((newSession: MultiAccountSession, remember: boolean = true) => {
    setSession(newSession);
    if (remember) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSession));
      sessionStorage.removeItem(STORAGE_KEY);
    } else {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(newSession));
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Sync Firebase Auth with our multi-account session
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        await syncUserProfile(firebaseUser);
        const token = await getIdToken(firebaseUser);
        const email = firebaseUser.email || '';
        let isAdmin = isAdminUser(email) || email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
        let isPro = isAdmin;
        let unlimited = isAdmin;
        let role = isAdmin ? 'owner' : getUserRole(email);

        try {
          const adminDocRef = doc(db, 'admins', email.toLowerCase());
          const adminSnap = await getDoc(adminDocRef);
          if (adminSnap.exists()) {
            const data = adminSnap.data();
            if (data.isAdmin || data.role === 'owner') {
              isAdmin = true;
              isPro = true;
              unlimited = true;
              role = data.role || 'owner';
            }
          } else if (isAdmin) {
            await setDoc(adminDocRef, {
              role: 'owner',
              isAdmin: true,
              isPro: true,
              unlimited: true,
              email: ADMIN_EMAIL,
              createdAt: serverTimestamp()
            }, { merge: true });
          }
        } catch (e: any) {
          if (e?.message?.includes('offline') || e?.code === 'unavailable') {
             console.warn('Cannot check admin doc, client is offline.');
          } else {
             console.error('Error checking admin doc:', e);
          }
        }

        if (isAdmin) {
          console.log("ADMIN:", firebaseUser.email);
        }

        const newAccount: ConnectedAccount = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || (firebaseUser.email ? extractDisplayNameFromEmail(firebaseUser.email) : 'Usuário ZENO'),
          photoURL: firebaseUser.photoURL || '',
          accessToken: token, // Using ID token as access token for Firebase
          expiresAt: Date.now() + 3600 * 1000, // Firebase tokens roughly 1h
          role: role as any,
          isAdmin,
          isPro,
          unlimited,
          bypassStripe: isAdmin,
          subscriptionStatus: isAdmin ? 'active' : 'free',
        };

        setSession(prev => {
          const isExisting = prev.accounts.some(a => a.uid === newAccount.uid && a.accessToken === newAccount.accessToken);
          if (isExisting && prev.activeUid === newAccount.uid) {
            return prev;
          }

          const filtered = prev.accounts.filter(a => a.uid !== newAccount.uid);
          const next = {
            accounts: [newAccount, ...filtered],
            activeUid: newAccount.uid
          };
          
          // Determine persistence based on where it's currently saved
          const isLocal = !!localStorage.getItem(STORAGE_KEY);
          if (isLocal) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          } else {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          }
          
          return next;
        });
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = useCallback(async (options: { isAddingAccount?: boolean; rememberDevice?: boolean } = {}) => {
    const { isAddingAccount = false, rememberDevice = true } = options;
    
    try {
      await setPersistence(auth, rememberDevice ? browserLocalPersistence : browserSessionPersistence);
      
      // Forces account selection if adding another account
      if (isAddingAccount) {
        googleProvider.setCustomParameters({ prompt: 'select_account' });
      } else {
        googleProvider.setCustomParameters({});
      }

      try {
        await signInWithPopup(auth, googleProvider);
      } catch (popupErr: any) {
        if (popupErr?.code === 'auth/network-request-failed' || popupErr?.code === 'auth/popup-blocked') {
          await signInWithRedirect(auth, googleProvider);
          return;
        }
        throw popupErr;
      }
    } catch (error: any) {
      if (error?.code === 'auth/cancelled-popup-request' || error?.code === 'auth/popup-closed-by-user') {
        console.warn('Google sign-in popup was closed by user.');
        return;
      }
      if (error?.code === 'auth/network-request-failed') {
        throw new Error('Falha de rede no Firebase Auth. Abra o aplicativo em uma nova aba ou use E-mail e Senha.');
      }
      console.error('Firebase login error:', error);
      throw error;
    }
  }, []);

  const switchAccount = useCallback(async (uid: string) => {
    // In Firebase, switching usually means re-authenticating if we want the actual 'auth.currentUser' to change.
    // However, for this UI, we can just change the activeUid in the session.
    // If we need the actual Firebase token for a specific user, we might need to re-login.
    // For now, let's just update the local state.
    saveSession({ ...session, activeUid: uid });
    
    // Note: To fully switch the Firebase Auth user context, we would need to re-auth.
    // But since we are storing account info in the session, components can use activeAccount.
  }, [session, saveSession]);

  const logout = useCallback(async (uid?: string) => {
    const targetUid = uid || session.activeUid;
    if (!targetUid) return;

    // If the target is the currently authenticated Firebase user, sign out from Firebase
    if (auth.currentUser?.uid === targetUid) {
      await signOut(auth);
    }

    const nextAccounts = session.accounts.filter(a => a.uid !== targetUid);
    const nextActiveUid = nextAccounts.length > 0 ? nextAccounts[0].uid : null;
    
    const isLocal = !!localStorage.getItem(STORAGE_KEY);
    saveSession({
      accounts: nextAccounts,
      activeUid: nextActiveUid
    }, isLocal);
  }, [session, saveSession]);

  const activeAccount = useMemo(() => 
    session.accounts.find(a => a.uid === session.activeUid) || null,
  [session]);

  return useMemo(() => ({
    session,
    activeAccount,
    loading,
    login,
    logout,
    switchAccount
  }), [session, activeAccount, loading, login, logout, switchAccount]);
}
