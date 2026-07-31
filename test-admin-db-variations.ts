import { initializeApp as initializeAdminApp, getApps as getAdminApps, applicationDefault, getApp as getAdminApp } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import firebaseConfig from './firebase-applet-config.json';

async function testAdmin() {
  console.log('=== TESTANDO ADMIN SDK NO BANCO (DEFAULT) ===');
  try {
    if (getAdminApps().length === 0) {
      initializeAdminApp({
        credential: applicationDefault(),
        projectId: firebaseConfig.projectId
      });
    }
    const adminApp = getAdminApp();
    const dbDefault = getAdminFirestore(adminApp); // (default) database
    
    console.log('Tentando ler do banco (default)...');
    await dbDefault.collection('test').limit(1).get();
    console.log('SUCCESS: Acesso ao banco (default) funciona!');
  } catch (e: any) {
    console.error('FAILURE no banco (default):', e?.message || e);
  }

  console.log('\n=== TESTANDO ADMIN SDK NO BANCO ESPECÍFICO ===');
  try {
    const adminApp = getAdminApp();
    const dbSpecific = getAdminFirestore(adminApp, firebaseConfig.firestoreDatabaseId);
    
    console.log(`Tentando ler do banco ${firebaseConfig.firestoreDatabaseId}...`);
    await dbSpecific.collection('test').limit(1).get();
    console.log('SUCCESS: Acesso ao banco específico funciona!');
  } catch (e: any) {
    console.error('FAILURE no banco específico:', e?.message || e);
  }
}

testAdmin();
