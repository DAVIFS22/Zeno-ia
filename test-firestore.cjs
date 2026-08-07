const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();

try {
  db.collection('users').doc(undefined);
  console.log('Success');
} catch (e) {
  console.log('Error:', e.message);
}
