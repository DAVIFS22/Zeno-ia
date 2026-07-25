import { useMemo } from 'react';
import { useFirebaseAuth } from './useFirebaseAuth';
import { UserRole } from '../config/admin';

export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  rememberDevice: boolean;
  createdAt?: any;
  lastLogin?: any;
  role: UserRole;
  isAdmin: boolean;
}

export function useAuth() {
  const { 
    activeAccount, 
    loading, 
    login, 
    logout, 
    switchAccount, 
    session 
  } = useFirebaseAuth();

  const profile: UserProfile | null = useMemo(() => activeAccount ? {
    uid: activeAccount.uid,
    displayName: activeAccount.displayName,
    email: activeAccount.email,
    photoURL: activeAccount.photoURL,
    role: activeAccount.role as UserRole,
    isAdmin: activeAccount.isAdmin,
    rememberDevice: true,
  } : null, [activeAccount]);

  // For compatibility with code expecting a Firebase User object
  const user = useMemo(() => activeAccount ? {
    uid: activeAccount.uid,
    email: activeAccount.email,
    displayName: activeAccount.displayName,
    photoURL: activeAccount.photoURL,
    // Add other properties if needed by components
  } : null, [activeAccount]);

  return useMemo(() => ({ 
    user, 
    profile, 
    loading, 
    login, 
    logout, 
    switchAccount, 
    session 
  }), [user, profile, loading, login, logout, switchAccount, session]);
}
