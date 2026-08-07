import { adminDb } from './src/lib/firebaseAdmin';

async function inspect() {
  console.log('=== INSPECTING FIRESTORE GAMIFICATION PROFILES ===');
  try {
    const snap = await adminDb.collection('gamificationProfiles').get();
    console.log('Total documents:', snap.size);
    snap.docs.forEach(doc => {
      console.log(`Document ID: [${doc.id}]`);
      console.log(JSON.stringify(doc.data(), null, 2));
      console.log('-------------------------------------------');
    });
  } catch (err: any) {
    console.error('Error querying gamificationProfiles:', err.message);
  }

  console.log('\n=== INSPECTING USERS COLLECTION ===');
  try {
    const userSnap = await adminDb.collection('users').get();
    console.log('Total users:', userSnap.size);
    userSnap.docs.forEach(u => {
      console.log(`User ID: [${u.id}], Data:`, JSON.stringify(u.data(), null, 2));
      console.log('-------------------------------------------');
    });
  } catch (err: any) {
    console.error('Error querying users:', err.message);
  }

  process.exit(0);
}

inspect().catch(err => {
  console.error('Fatal inspect error:', err);
  process.exit(1);
});
