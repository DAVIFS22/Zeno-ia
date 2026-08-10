import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export { setPersistence, browserLocalPersistence, browserSessionPersistence };

export const syncUserProfile = async (user: any) => {
  if (!user) return;
  try {
    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, {
      uid: user.uid,
      displayName: user.displayName,
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
  } catch (error) {
    console.error("Error syncing user profile:", error);
  }
};
