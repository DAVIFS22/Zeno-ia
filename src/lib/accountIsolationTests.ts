/**
 * Test Suite for Account Data Isolation and Multi-Account Management in ZENO AI
 */

export interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  durationMs: number;
}

export async function runAccountIsolationTestSuite(): Promise<{
  results: TestResult[];
  allPassed: boolean;
}> {
  const results: TestResult[] = [];

  // Helper to record test
  async function runTest(name: string, fn: () => Promise<void>) {
    const start = performance.now();
    try {
      await fn();
      results.push({
        name,
        passed: true,
        message: 'Passou com sucesso sem vazamento de dados.',
        durationMs: Math.round(performance.now() - start),
      });
    } catch (err: any) {
      results.push({
        name,
        passed: false,
        message: err.message || 'Falha no teste.',
        durationMs: Math.round(performance.now() - start),
      });
    }
  }

  const testUserA = 'test_user_a_' + Date.now();
  const testUserB = 'test_user_b_' + Date.now();

  // Test 1: Provisioning New Account A
  await runTest('Criar e Inicializar Conta A', async () => {
    const res = await fetch('/api/account/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: testUserA,
        email: 'usera@test.com',
        name: 'Usuário A',
      }),
    });
    if (!res.ok) throw new Error('Falha ao inicializar Conta A no servidor');
  });

  // Test 2: Writing Secret Data to Account A
  await runTest('Gravar Dados Exclusivos na Conta A', async () => {
    // 1. Sync session
    const sessionRes = await fetch('/api/sync/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: testUserA,
        sessions: [
          {
            id: 'session-a-secret',
            title: 'Chat Secreto do Usuário A',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messages: [{ id: 'm1', role: 'user', text: 'Segredo do Usuário A' }],
          },
        ],
      }),
    });
    if (!sessionRes.ok) throw new Error('Falha ao gravar sessões na Conta A');

    // 2. Sync setting
    const settingRes = await fetch('/api/sync/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: testUserA,
        settings: { userName: 'Usuário A Config', customInstructions: 'Role A' },
      }),
    });
    if (!settingRes.ok) throw new Error('Falha ao gravar configurações na Conta A');
  });

  // Test 3: Provisioning New Account B
  await runTest('Criar e Inicializar Conta B', async () => {
    const res = await fetch('/api/account/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: testUserB,
        email: 'userb@test.com',
        name: 'Usuário B',
      }),
    });
    if (!res.ok) throw new Error('Falha ao inicializar Conta B no servidor');
  });

  // Test 4: Verify Data Isolation - Account B reads ZERO data from Account A
  await runTest('Verificar Isolamento Total entre Conta A e Conta B', async () => {
    // 1. Read sessions for User B
    const sessRes = await fetch(`/api/sync/sessions?userId=${testUserB}`);
    const sessData = await sessRes.json();
    if (sessData.sessions && sessData.sessions.some((s: any) => s.id === 'session-a-secret')) {
      throw new Error('VAZAMENTO DE DADOS DETECTADO: Conta B conseguiu ver a sessão da Conta A!');
    }

    // 2. Read images for User B
    const imgRes = await fetch(`/api/images?userId=${testUserB}`);
    const imgData = await imgRes.json();
    if (Array.isArray(imgData) && imgData.some((i: any) => i.userId === testUserA)) {
      throw new Error('VAZAMENTO DE DADOS DETECTADO: Conta B viu imagens da Conta A!');
    }

    // 3. Read settings for User B
    const setRes = await fetch(`/api/sync/settings?userId=${testUserB}`);
    const setData = await setRes.json();
    if (setData.settings && setData.settings.userName === 'Usuário A Config') {
      throw new Error('VAZAMENTO DE DADOS DETECTADO: Conta B recebeu configurações da Conta A!');
    }
  });

  // Test 5: Switch back to Account A and verify Data Intact
  await runTest('Alternar de Volta para Conta A e Validar Integridade', async () => {
    const sessRes = await fetch(`/api/sync/sessions?userId=${testUserA}`);
    const sessData = await sessRes.json();
    if (!sessData.sessions || !sessData.sessions.some((s: any) => s.id === 'session-a-secret')) {
      throw new Error('Dados da Conta A não foram encontrados ao retornar.');
    }
  });

  // Test 6: Account Deletion - Delete Account B and ensure Account A is untouched
  await runTest('Excluir Conta B e Verificar Integridade da Conta A', async () => {
    const delRes = await fetch(`/api/sync/account?userId=${testUserB}`, { method: 'DELETE' });
    if (!delRes.ok) throw new Error('Falha ao excluir Conta B');

    // Verify Account A still exists
    const sessRes = await fetch(`/api/sync/sessions?userId=${testUserA}`);
    const sessData = await sessRes.json();
    if (!sessData.sessions || !sessData.sessions.some((s: any) => s.id === 'session-a-secret')) {
      throw new Error('A exclusão da Conta B afetou indevidamente a Conta A!');
    }

    // Clean up Account A
    await fetch(`/api/sync/account?userId=${testUserA}`, { method: 'DELETE' });
  });

  const allPassed = results.every(r => r.passed);
  return { results, allPassed };
}
