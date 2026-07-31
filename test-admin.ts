import { adminDb } from './src/lib/firebaseAdmin';

async function runTest() {
  try {
    console.log('Attempting to get doc with WORKAROUND adminDb');
    const d = await adminDb.collection('test').doc('1').get();
    console.log('Success! Exists:', d.exists);
    
    console.log('Attempting to set doc with WORKAROUND adminDb');
    await adminDb.collection('test').doc('1').set({ worked: true, timestamp: Date.now() });
    console.log('Set successful!');
    
    const d2 = await adminDb.collection('test').doc('1').get();
    console.log('Read back:', d2.data());
  } catch (e) {
    console.error('Workaround Error:', e);
  }
}

runTest();
