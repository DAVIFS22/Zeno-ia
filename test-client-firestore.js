import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

getDoc(doc(db, 'test/1')).then(d => {
  console.log("Client Success!", d.exists());
  process.exit(0);
}).catch(e => {
  console.error("Client Error:", e.message);
  process.exit(1);
});
