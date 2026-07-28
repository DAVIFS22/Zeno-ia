
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));

const app = initializeApp({
  credential: applicationDefault(),
});

const db = getFirestore(app, '(default)');

async function test() {
  try {
    const collections = await db.listCollections();
    console.log('Collections:', collections.map(c => c.id));
  } catch (e) {
    console.error('Error:', e);
  }
}

test();
