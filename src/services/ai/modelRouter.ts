import { AICategory, AIProviderModelConfig, ProviderName } from './types';
import { isCircuitAvailable } from './circuitBreaker';
import { getProviderQuota } from './quotaManager';
import { calculateHealthScore } from './healthManager';

export const routingConfig: Record<AICategory, AIProviderModelConfig[]> = {
  general: [
    { provider: 'gemini', model: 'gemini-1.5-pro', enabled: true, priority: 150, maxRetries: 1, timeoutMs: 25000, supportsVision: true },
    { provider: 'gemini', model: 'gemini-1.5-flash', enabled: true, priority: 140, maxRetries: 1, timeoutMs: 20000, supportsVision: true },
    { provider: 'groq', model: 'groq/compound', enabled: true, priority: 100, maxRetries: 2, timeoutMs: 15000, supportsVision: false },
    { provider: 'groq', model: 'openai/gpt-oss-20b', enabled: true, priority: 92, maxRetries: 1, timeoutMs: 12000, supportsVision: false },
    { provider: 'openrouter', model: 'nvidia/nemotron-3.5-lightning:free', enabled: true, priority: 91, maxRetries: 1, timeoutMs: 15000, supportsVision: false },
    { provider: 'gemini', model: 'gemini-1.5-pro', enabled: true, priority: 90, maxRetries: 1, timeoutMs: 25000, supportsVision: true },
    { provider: 'openai', model: 'gpt-4o-mini', enabled: true, priority: 80, maxRetries: 1, timeoutMs: 15000, supportsVision: true },
    { provider: 'xai', model: 'grok-4.6', enabled: true, priority: 75, maxRetries: 1, timeoutMs: 20000, supportsVision: true }
  ],
  think: [
    { provider: 'gemini', model: 'gemini-1.5-pro', enabled: true, priority: 150, maxRetries: 1, timeoutMs: 25000, supportsVision: true },
    { provider: 'groq', model: 'qwen/qwen3.6-27b', enabled: true, priority: 100, maxRetries: 2, timeoutMs: 25000, supportsVision: false },
    { provider: 'groq', model: 'groq/compound', enabled: true, priority: 99, maxRetries: 2, timeoutMs: 15000, supportsVision: false },
    { provider: 'groq', model: 'openai/gpt-oss-120b', enabled: true, priority: 98, maxRetries: 1, timeoutMs: 20000, supportsVision: false },
    { provider: 'gemini', model: 'gemini-1.5-pro', enabled: true, priority: 97, maxRetries: 1, timeoutMs: 25000, supportsVision: true },
    { provider: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct:free', enabled: true, priority: 95, maxRetries: 2, timeoutMs: 20000, supportsVision: false },
    { provider: 'openai', model: 'gpt-4o', enabled: true, priority: 80, maxRetries: 1, timeoutMs: 20000, supportsVision: true }
  ],
  code: [
    { provider: 'gemini', model: 'gemini-1.5-pro', enabled: true, priority: 150, maxRetries: 1, timeoutMs: 25000, supportsVision: true },
    { provider: 'groq', model: 'groq/compound', enabled: true, priority: 100, maxRetries: 2, timeoutMs: 15000, supportsVision: false },
    { provider: 'groq', model: 'openai/gpt-oss-120b', enabled: true, priority: 98, maxRetries: 1, timeoutMs: 18000, supportsVision: false },
    { provider: 'gemini', model: 'gemini-1.5-pro', enabled: true, priority: 96, maxRetries: 1, timeoutMs: 25000, supportsVision: true },
    { provider: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct:free', enabled: true, priority: 95, maxRetries: 2, timeoutMs: 20000, supportsVision: false },
    { provider: 'groq', model: 'qwen/qwen3.6-27b', enabled: true, priority: 94, maxRetries: 1, timeoutMs: 25000, supportsVision: false },
    { provider: 'openai', model: 'gpt-4o-mini', enabled: true, priority: 80, maxRetries: 1, timeoutMs: 18000, supportsVision: true }
  ],
  speed: [
    { provider: 'gemini', model: 'gemini-1.5-flash', enabled: true, priority: 150, maxRetries: 1, timeoutMs: 15000, supportsVision: true },
    { provider: 'groq', model: 'openai/gpt-oss-20b', enabled: true, priority: 96, maxRetries: 1, timeoutMs: 10000, supportsVision: false },
    { provider: 'groq', model: 'groq/compound', enabled: true, priority: 98, maxRetries: 2, timeoutMs: 12000, supportsVision: false },
    { provider: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct:free', enabled: true, priority: 94, maxRetries: 1, timeoutMs: 15000, supportsVision: false },
    { provider: 'gemini', model: 'gemini-1.5-flash', enabled: true, priority: 90, maxRetries: 1, timeoutMs: 15000, supportsVision: true }
  ],
  search: [
    { provider: 'gemini', model: 'gemini-1.5-flash', enabled: true, priority: 150, maxRetries: 1, timeoutMs: 20000, supportsVision: true },
    { provider: 'groq', model: 'groq/compound', enabled: true, priority: 100, maxRetries: 2, timeoutMs: 15000, supportsVision: false },
    { provider: 'gemini', model: 'gemini-1.5-flash', enabled: true, priority: 96, maxRetries: 1, timeoutMs: 20000, supportsVision: true },
    { provider: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct:free', enabled: true, priority: 95, maxRetries: 2, timeoutMs: 18000, supportsVision: false }
  ],
  vision: [
    { provider: 'gemini', model: 'gemini-1.5-pro', enabled: true, priority: 150, maxRetries: 2, timeoutMs: 30000, supportsVision: true },
    { provider: 'gemini', model: 'gemini-1.5-flash', enabled: true, priority: 140, maxRetries: 2, timeoutMs: 25000, supportsVision: true },
    { provider: 'openai', model: 'gpt-4o-mini', enabled: true, priority: 85, maxRetries: 1, timeoutMs: 25000, supportsVision: true }
  ],
  image: [
    { provider: 'gemini', model: 'gemini-1.5-pro', enabled: true, priority: 150, maxRetries: 2, timeoutMs: 30000, supportsVision: true },
    { provider: 'gemini', model: 'gemini-1.5-flash', enabled: true, priority: 140, maxRetries: 2, timeoutMs: 25000, supportsVision: true },
    { provider: 'replicate', model: 'black-forest-labs/flux-schnell', enabled: true, priority: 95, maxRetries: 1, timeoutMs: 30000, supportsVision: false }
  ],
  image_generation: [
    { provider: 'gemini', model: 'gemini-1.5-flash', enabled: true, priority: 150, maxRetries: 1, timeoutMs: 40000, supportsVision: false },
    { provider: 'replicate', model: 'black-forest-labs/flux-schnell', enabled: true, priority: 95, maxRetries: 1, timeoutMs: 60000, supportsVision: false },
    { provider: 'openai', model: 'dall-e-3', enabled: true, priority: 80, maxRetries: 1, timeoutMs: 40000, supportsVision: false }
  ]
};

export function getSortedModelsForCategory(
  category: AICategory = 'general',
  isSearchIntent = false,
  hasImages = false,
  userRequestedModel?: string,
  userGeminiApiKey?: string
): AIProviderModelConfig[] {
  const configs = routingConfig[category] || routingConfig.general;

  const hasServerGeminiKey = !!(process.env.GEMINI_API_KEY || process.env.API_KEY);
  const hasGeminiKey = hasServerGeminiKey || (!!userGeminiApiKey && userGeminiApiKey.trim().length > 10);
  const hasGroqKey = !!process.env.GROQ_API_KEY;
  const hasOpenRouterKey = !!process.env.OPENROUTER_API_KEY;
  const hasOpenAiKey = !!process.env.OPENAI_API_KEY;
  const hasXaiKey = !!(process.env.XAI_API_KEY || process.env.GROK_API_KEY);

  // Filter and score models
  const scored = configs.map(item => {
    const key = `${item.provider}:${item.model}`;
    const available = isCircuitAvailable(key);
    const quota = getProviderQuota(item.provider);
    const health = calculateHealthScore(item.provider, item.model);

    // Check if key is available for this provider
    let providerHasKey = true;
    if (item.provider === 'gemini') providerHasKey = hasGeminiKey;
    else if (item.provider === 'groq') providerHasKey = hasGroqKey;
    else if (item.provider === 'openrouter') providerHasKey = hasOpenRouterKey;
    else if (item.provider === 'openai') providerHasKey = hasOpenAiKey;
    else if (item.provider === 'xai' || item.provider === 'grok') providerHasKey = hasXaiKey || hasOpenRouterKey;

    if (!providerHasKey) {
      return { item, score: -999 };
    }

    // If circuit is open or quota exhausted, score = -999 (unless it's a free model on openrouter)
    const isExhausted = quota.status === 'exhausted' || quota.status === 'billing_error';
    const isFree = item.model.includes(':free') || item.model.includes('/free');

    if (!available || (isExhausted && !isFree)) {
      return { item, score: -999 };
    }

    // STRICT FILTER: If hasImages is true, model MUST support vision
    if (hasImages && item.supportsVision === false) {
      return { item, score: -999 };
    }

    let score = item.priority + (health * 0.5);

    if (quota.status === 'rate_limited') score -= 25; // slight penalty, don't completely block alternative models of this provider
    if (quota.status === 'billing_error') score -= 100;
    if (quota.status === 'attention') score -= 10;
    if (quota.status === 'reduce_priority') score -= 30;
    if (quota.status === 'avoid') score -= 60;

    if (isSearchIntent && item.provider !== 'gemini' && item.provider !== 'openai') {
      score -= 15;
    }

    if (userRequestedModel) {
      const normReq = userRequestedModel.toLowerCase();
      const normModel = item.model.toLowerCase();
      if (
        normModel === normReq ||
        normModel.endsWith(normReq) ||
        (normReq.includes('grok') && normModel.includes('grok')) ||
        (normReq.includes('gemini') && normModel.includes('gemini')) ||
        (normReq.includes('llama') && normModel.includes('llama'))
      ) {
        score += 1000; // Boost requested model heavily
      }
    }

    return { item, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.filter(s => s.score > -500).map(s => s.item);
}
