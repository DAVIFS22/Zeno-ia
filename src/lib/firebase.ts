import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Use standard getAuth for completely robust and safe initialization
export const auth = getAuth(app);

export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export { setPersistence, browserLocalPersistence, browserSessionPersistence };

export const extractDisplayNameFromEmail = (email: string): string => {
  if (!email) return 'Usuário ZENO';
  const localPart = email.split('@')[0] || '';
  if (!localPart) return 'Usuário ZENO';
  
  // Remove trailing digits from the end of the local part
  const withoutTrailingDigits = localPart.replace(/\d+$/, '');
  
  if (!withoutTrailingDigits) return 'Usuário ZENO';
  
  // Check if there are common separators like . _ or -
  const parts = withoutTrailingDigits.split(/[._-]/);
  
  if (parts.length > 1) {
    return parts
      .filter(p => p.length > 0)
      .map(p => p.charAt(0).toUpperCase() + p.slice(1))
      .join(' ');
  } else {
    return withoutTrailingDigits.charAt(0).toUpperCase() + withoutTrailingDigits.slice(1);
  }
};

export const syncUserProfile = async (user: any) => {
  if (!user) return;
  try {
    const userRef = doc(db, 'users', user.uid);
    const resolvedDisplayName = user.displayName || (user.email ? extractDisplayNameFromEmail(user.email) : 'Usuário ZENO');
    await setDoc(userRef, {
      uid: user.uid,
      displayName: resolvedDisplayName,
      email: user.email,
      photoURL: user.photoURL,
      lastLogin: serverTimestamp(),
    }, { merge: true });

    if (user.email && user.email.trim().toLowerCase() === 'davifernandes0024509@gmail.com') {
      const adminRef = doc(db, 'admins', 'davifernandes0024509@gmail.com');
      await setDoc(adminRef, {
        role: 'owner',
        isAdmin: true,
        isPro: true,
        unlimited: true,
        email: 'davifernandes0024509@gmail.com',
        updatedAt: serverTimestamp()
      }, { merge: true });
      console.log("ADMIN:", user.email);
    }
  } catch (error: any) {
    if (error?.message?.includes('offline') || error?.code === 'unavailable') {
      console.warn("Cannot sync user profile, client is offline.");
    } else {
      console.error("Error syncing user profile:", error);
    }
  }
};
