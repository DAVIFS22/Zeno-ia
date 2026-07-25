import { initializeApp, getApps, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 
  ? initializeApp({ 
      credential: applicationDefault(),
      projectId: firebaseConfig.projectId 
    }) 
  : getApps()[0];

const databaseId = firebaseConfig.firestoreDatabaseId;

let dbInstance;
try {
  if (databaseId) {
    dbInstance = getFirestore(app, databaseId);
  } else {
    dbInstance = getFirestore(app);
  }
} catch (e) {
  try {
    dbInstance = getFirestore(app);
  } catch (err) {
    dbInstance = getFirestore();
  }
}

export const adminDb = dbInstance;
export const adminAuth = getAuth(app);
