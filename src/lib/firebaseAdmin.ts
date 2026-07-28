import { initializeApp, getApps, applicationDefault, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { adminDb as mockDb } from './mockAdminDb';

const authProjectId = firebaseConfig.projectId;

// 1. Initialize default app for Auth
if (getApps().length === 0) {
  initializeApp({
    credential: applicationDefault(),
    projectId: authProjectId
  });
}

const defaultApp = getApp();

export const adminDb = mockDb;
export const adminAuth = getAuth(defaultApp);
