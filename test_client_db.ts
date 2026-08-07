import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function test() {
  console.log("=== Querying Firestore with Web Client SDK ===");
  try {
    const snap = await getDocs(collection(db, 'gamificationProfiles'));
    console.log("Total gamificationProfiles docs:", snap.size);
    snap.docs.forEach(d => {
      console.log(`Doc ID: [${d.id}] ->`, JSON.stringify(d.data(), null, 2));
    });
  } catch (err: any) {
    console.error("Client SDK query failed:", err.message);
  }

  try {
    const userSnap = await getDocs(collection(db, 'users'));
    console.log("Total users docs:", userSnap.size);
    userSnap.docs.forEach(u => {
      console.log(`User ID: [${u.id}] ->`, JSON.stringify(u.data(), null, 2));
    });
  } catch (err: any) {
    console.error("Client SDK query failed:", err.message);
  }

  process.exit(0);
}

test();
