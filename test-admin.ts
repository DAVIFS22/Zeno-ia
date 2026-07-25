import { adminDb } from './src/lib/firebaseAdmin';
async function test() {
  try {
    const doc = await adminDb.collection('users').doc('test').get();
    console.log('Success:', doc.exists);
  } catch (e) {
    console.error('Error:', e);
  }
}
test();
