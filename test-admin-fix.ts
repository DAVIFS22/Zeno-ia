import { adminDb } from './src/lib/firebaseAdmin';

async function testAdmin() {
  console.log('=== TESTANDO ADMIN SDK APÓS CORREÇÃO IAM ===');
  try {
    const testDoc = adminDb.collection('system_tests').doc('iam_test');
    await testDoc.set({
      timestamp: Date.now(),
      status: 'success',
      message: 'Admin SDK agora tem acesso total via roles/datastore.user'
    });
    
    const snap = await testDoc.get();
    if (snap.exists) {
      console.log('SUCCESS: Admin SDK conseguiu gravar e ler do Firestore!');
      console.log('Data:', snap.data());
    } else {
      console.error('FAILURE: Documento não existe após gravação.');
    }
  } catch (e: any) {
    console.error('FAILURE: Ainda sem acesso ou outro erro:', e?.message || e);
  }
}

testAdmin();
