import { initializeApp as initializeAdminApp, getApps as getAdminApps, applicationDefault, getApp as getAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// 1. Initialize Admin App
try {
  if (getAdminApps().length === 0) {
    initializeAdminApp({
      credential: applicationDefault(),
      projectId: firebaseConfig.projectId
    });
    console.log('[FIREBASE ADMIN] Initialized with project:', firebaseConfig.projectId);
  }
} catch (e) {
  console.error('[FIREBASE ADMIN] Initialization failed:', e);
}

const adminApp = getAdminApps().length > 0 ? getAdminApp() : null;

export const adminAuth = adminApp ? getAdminAuth(adminApp) : {
  verifyIdToken: async () => { throw new Error('Admin SDK not initialized'); }
} as any;

// Use the real Admin Firestore SDK with the named database ID
export const adminDb = adminApp ? getAdminFirestore(adminApp, firebaseConfig.firestoreDatabaseId) : {
  collection: () => ({
    doc: () => ({
      get: async () => ({ exists: false }),
      set: async () => { throw new Error('Admin SDK not initialized'); },
      delete: async () => { throw new Error('Admin SDK not initialized'); },
    })
  })
} as any;
