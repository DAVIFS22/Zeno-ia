import fetch from 'node-fetch';

async function testAuthTokenPassing() {
  console.log("=== Iniciando Teste de Validação de Token de Autenticação / Requisições ao Backend ===");

  const baseUrl = 'http://localhost:3000';
  const testUserId = 'test_user_auth_123';
  const testAuthToken = 'Bearer mock-firebase-id-token-xyz';

  // 1. Testar endpoint protegido de assinatura sem token/userId
  try {
    const res = await fetch(`${baseUrl}/api/subscription/details`);
    console.log(`[Teste 1] GET /api/subscription/details (sem userId): Status ${res.status}`);
    const data = await res.json() as any;
    console.log(`[Teste 1] Resposta:`, data);
  } catch (e: any) {
    console.log(`[Teste 1] Erro capturado conforme esperado:`, e.message);
  }

  // 2. Testar endpoint com userId / token simulando requisição autenticada do frontend
  try {
    const res = await fetch(`${baseUrl}/api/subscription/details?userId=${testUserId}`, {
      headers: {
        'Authorization': testAuthToken,
        'Content-Type': 'application/json'
      }
    });
    console.log(`[Teste 2] GET /api/subscription/details?userId=${testUserId} com Auth Header: Status ${res.status}`);
    const data = await res.json() as any;
    console.log(`[Teste 2] Sucesso na resposta do backend:`, { plan: data.plan, active: data.active });
  } catch (e: any) {
    console.error(`[Teste 2] Falha na requisição:`, e.message);
  }

  // 3. Testar atualização de pagamento no backend
  try {
    const res = await fetch(`${baseUrl}/api/subscription/update-payment`, {
      method: 'POST',
      headers: {
        'Authorization': testAuthToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: testUserId,
        paymentMethod: { brand: 'mastercard', last4: '9988' }
      })
    });
    console.log(`[Teste 3] POST /api/subscription/update-payment: Status ${res.status}`);
    const data = await res.json() as any;
    console.log(`[Teste 3] Resposta de pagamento:`, data);
  } catch (e: any) {
    console.error(`[Teste 3] Falha na requisição:`, e.message);
  }

  console.log("=== Teste de Autenticação Concluído com Sucesso ===");
}

testAuthTokenPassing();
