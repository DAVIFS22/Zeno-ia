import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));
firebase.initializeApp(config);
const db = firebase.firestore(config.firestoreDatabaseId);

db.collection('test').doc('1').get().then(d => {
  console.log("Compat success!", d.exists);
  process.exit(0);
}).catch(e => {
  console.error("Compat error:", e.message);
  process.exit(1);
});
