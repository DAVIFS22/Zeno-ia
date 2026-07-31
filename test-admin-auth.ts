import { adminAuth } from './src/lib/firebaseAdmin';

async function testAuth() {
  console.log('=== TESTANDO ADMIN AUTH ===');
  try {
    const list = await adminAuth.listUsers(1);
    console.log('SUCCESS: Admin Auth conseguiu listar usuários!');
  } catch (e: any) {
    console.error('FAILURE no Admin Auth:', e?.message || e);
  }
}

testAuth();
