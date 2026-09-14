import { callProviderAdapter } from '../services/ai/providerManager';
import { ProviderName } from '../services/ai/types';

async function testProvider(provider: ProviderName, model: string) {
  console.log(`\nTesting provider: ${provider}:${model}`);
  try {
    const result = await callProviderAdapter(provider, model, {
      contents: [{ role: 'user', parts: [{ text: 'Oi' }] }],
      userId: 'test-user',
      category: 'general'
    });
    console.log(`✅ Success: ${provider}:${model}`);
    console.log(`Response: ${result.text.substring(0, 100)}...`);
  } catch (err: any) {
    console.error(`❌ Failure: ${provider}:${model}`);
    // Extract more detail from the error if possible
    if (err.response && err.response.data) {
        console.error(`Error Details: ${JSON.stringify(err.response.data)}`);
    } else {
        console.error(`Error: ${err.message || JSON.stringify(err)}`);
    }
  }
}

async function runTests() {
  // Try to use models that might be valid
  await testProvider('gemini', 'gemini-1.5-flash');
  await testProvider('openai', 'gpt-4o');
  await testProvider('groq', 'groq/compound');
  await testProvider('openrouter', 'google/gemini-2.0-flash-001');
}

runTests().catch(console.error);
