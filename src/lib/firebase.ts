import { initializeApp } from 'firebase/app';
import { 
  doc, 
  setDoc, 
  getDoc, 
  serverTimestamp,
  initializeFirestore
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Use initializeFirestore with forceLongPolling for better reliability in iframes
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId || '(default)');

export const syncUserProfile = async (user: { uid: string, displayName: string | null, email: string | null, photoURL: string | null }, remember?: boolean) => {
  try {
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef).catch(err => {
      console.warn('Firestore sync profile: could not get doc (offline or permission issue)', err);
      return null;
    });
    
    const userData = {
      uid: user.uid,
      displayName: user.displayName,
      email: user.email,
      photoURL: user.photoURL,
      lastLogin: serverTimestamp(),
      ...(remember !== undefined && { rememberDevice: remember })
    };

    if (!userSnap || !userSnap.exists()) {
      // First time access or couldn't fetch existing
      await setDoc(userRef, {
        ...userData,
        createdAt: serverTimestamp(),
      }, { merge: true });
    } else {
      // Regular login
      await setDoc(userRef, userData, { merge: true });
    }
  } catch (error) {
    console.error('Critical error in syncUserProfile:', error);
  }
};
