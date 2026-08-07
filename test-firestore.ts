import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from './firebase-applet-config.json' assert { type: 'json' };

const app = initializeApp({ projectId: firebaseConfig.projectId });
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function test() {
  try {
    const res = await db.collection('test').limit(1).get();
    console.log("Success:", res.size);
  } catch(e) {
    console.error("Error:", e);
  }
}
test();
