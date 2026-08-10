import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithPopup,
  signInWithRedirect,
  GoogleAuthProvider, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut,
  signInAnonymously,
  User,
  UserCredential,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { app, db } from '../lib/firebase';
import { isAdminUser } from '../config/admin';

const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export interface AuthProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  isAdmin: boolean;
  isPro: boolean;
  isAnonymous: boolean;
  unlimited: boolean;
  role: string;
  rememberDevice: boolean;
  createdAt?: any;
  lastLogin?: any;
}

interface AuthContextType {
  user: User | null;
  profile: AuthProfile | null;
  loading: boolean;
  signInWithGoogle: (options?: { rememberDevice: boolean }) => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<UserCredential>;
  signUpWithEmail: (email: string, pass: string) => Promise<UserCredential>;
  signOut: () => Promise<void>;
  login: (options?: { rememberDevice: boolean }) => Promise<void>;
  logout: () => Promise<void>;
  session: any; 
  switchAccount: (uid: string) => void;
  authLogs: string[];
}

export const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [authLogs, setAuthLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    console.log(msg);
    setAuthLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
  };

  useEffect(() => {
    addLog('AuthProvider: Setting up authentication');
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      addLog(`AuthProvider: onAuthStateChanged triggered. User: ${currentUser ? (currentUser.isAnonymous ? 'Anonymous' : currentUser.email) : 'null'}`);
      
      if (currentUser) {
        const anonId = localStorage.getItem('zeno_anon_user_id');
        if (anonId && anonId !== currentUser.uid) {
          addLog(`AuthProvider: Found previous local anon ID (${anonId}), migrating to Firebase UID (${currentUser.uid})`);
          migrateAnonymousData(anonId, currentUser.uid).catch(console.warn);
        }
        
        setUser(currentUser);
        const isAdmin = isAdminUser(currentUser.email);
        setProfile({
          uid: currentUser.uid,
          displayName: currentUser.displayName || (currentUser.isAnonymous ? 'Convidado' : null),
          email: currentUser.email,
          photoURL: currentUser.photoURL,
          isAdmin: isAdmin,
          isPro: isAdmin,
          isAnonymous: currentUser.isAnonymous,
          unlimited: isAdmin,
          role: isAdmin ? 'admin' : 'user',
          rememberDevice: true,
          createdAt: null,
          lastLogin: null
        });
        setLoading(false);
      } else {
        addLog('AuthProvider: No user detected, clearing local auth state');
        // CRITICAL FIX: Clear state immediately before signing in anonymously
        setUser(null);
        setProfile(null);
        
        addLog('AuthProvider: Signing in anonymously');
        try {
          await signInAnonymously(auth);
        } catch (error) {
          addLog(`AuthProvider: Anonymous sign-in error: ${error}`);
          setLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const migrateAnonymousData = async (anonId: string, realUid: string) => {
    console.log('Migrating data from', anonId, 'to', realUid);
    try {
      const anonSubDoc = doc(db, 'subscriptions', anonId);
      const subSnap = await getDoc(anonSubDoc);
      if (subSnap.exists()) {
        await setDoc(doc(db, 'subscriptions', realUid), { ...subSnap.data(), userId: realUid });
      }
      localStorage.removeItem('zeno_anon_user_id');
      console.log('Data migration complete');
    } catch (e) {
      console.warn('Migration warning:', e);
    }
  };

  const signInWithGoogle = async (options?: { rememberDevice: boolean }) => {
    addLog('AuthContext: Initiating Google Sign-In');
    try {
      if (options?.rememberDevice) {
        setPersistence(auth, browserLocalPersistence);
      } else {
        setPersistence(auth, browserSessionPersistence);
      }
      addLog('AuthContext: Opening Google Sign-In popup');
      try {
        await signInWithPopup(auth, googleProvider);
      } catch (popupErr: any) {
        if (popupErr?.code === 'auth/network-request-failed' || popupErr?.code === 'auth/popup-blocked') {
          addLog('AuthContext: Popup failed, attempting signInWithRedirect');
          await signInWithRedirect(auth, googleProvider);
          return;
        }
        throw popupErr;
      }
      addLog('AuthContext: Google Sign-In successful');
    } catch (error: any) {
      addLog(`AuthContext: Google Sign-In ERROR: [${error.code}] ${error.message}`);
      if (error?.code === 'auth/cancelled-popup-request' || error?.code === 'auth/popup-closed-by-user') {
        console.warn('Google sign-in popup was closed by user.');
        return;
      }
      if (error?.code === 'auth/network-request-failed') {
        throw new Error('Falha de rede no Firebase Auth. Abra o aplicativo em uma nova aba ou cadastre-se com E-mail e Senha.');
      }
      console.error('Firebase sign-in error:', error);
      throw error;
    }
  };
  const signInWithEmail = (e: string, p: string) => signInWithEmailAndPassword(auth, e, p);
  const signUpWithEmail = (e: string, p: string) => createUserWithEmailAndPassword(auth, e, p);
  const signOut = () => firebaseSignOut(auth);

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      loading, 
      signInWithGoogle, 
      signInWithEmail, 
      signUpWithEmail, 
      signOut,
      login: signInWithGoogle,
      logout: signOut,
      session: { 
        accounts: user ? [{
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || profile?.displayName || 'Usuário ZENO',
          photoURL: user.photoURL || profile?.photoURL
        }] : [], 
        activeUid: user?.uid 
      },
      switchAccount: (uid: string) => {},
      authLogs
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
