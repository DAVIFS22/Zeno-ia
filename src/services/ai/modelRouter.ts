import { AICategory, AIProviderModelConfig, ProviderName } from './types';
import { isCircuitAvailable } from './circuitBreaker';
import { getProviderQuota } from './quotaManager';
import { calculateHealthScore } from './healthManager';

export const routingConfig: Record<AICategory, AIProviderModelConfig[]> = {
  general: [
    { provider: 'openrouter', model: 'anthropic/claude-sonnet-5', enabled: true, priority: 100, maxRetries: 2, timeoutMs: 25000, supportsVision: true },
    { provider: 'groq', model: 'llama-3.3-70b-versatile', enabled: true, priority: 98, maxRetries: 2, timeoutMs: 15000, supportsVision: false },
    { provider: 'openai', model: 'gpt-4o', enabled: true, priority: 95, maxRetries: 2, timeoutMs: 20000, supportsVision: true },
    { provider: 'gemini', model: 'gemini-1.5-flash', enabled: true, priority: 90, maxRetries: 2, timeoutMs: 20000, supportsVision: true },
    { provider: 'openrouter', model: 'google/gemini-flash-latest', enabled: true, priority: 88, maxRetries: 2, timeoutMs: 20000, supportsVision: true },
    { provider: 'openrouter', model: 'meta-llama/llama-3.1-70b-instruct', enabled: true, priority: 87, maxRetries: 2, timeoutMs: 20000, supportsVision: false },
    { provider: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct', enabled: true, priority: 86, maxRetries: 2, timeoutMs: 20000, supportsVision: false },
    { provider: 'openrouter', model: 'google/gemini-2.0-flash-exp:free', enabled: true, priority: 85, maxRetries: 2, timeoutMs: 20000, supportsVision: true },
    { provider: 'openrouter', model: 'google/gemini-2.0-flash-lite-preview-02-05:free', enabled: true, priority: 84, maxRetries: 2, timeoutMs: 20000, supportsVision: true },
    { provider: 'openrouter', model: 'google/gemini-pro-latest:free', enabled: true, priority: 83, maxRetries: 2, timeoutMs: 20000, supportsVision: true },
    { provider: 'openrouter', model: 'meta-llama/llama-3.1-8b-instruct:free', enabled: true, priority: 80, maxRetries: 2, timeoutMs: 15000, supportsVision: false },
    { provider: 'openai', model: 'gpt-4o-mini', enabled: true, priority: 75, maxRetries: 2, timeoutMs: 15000, supportsVision: true },
    { provider: 'groq', model: 'llama-3.3-70b-versatile', enabled: true, priority: 70, maxRetries: 2, timeoutMs: 15000, supportsVision: false },
    { provider: 'groq', model: 'llama-3.1-8b-instant', enabled: true, priority: 65, maxRetries: 2, timeoutMs: 15000, supportsVision: false },
    { provider: 'openrouter', model: 'openrouter/free', enabled: true, priority: 50, maxRetries: 1, timeoutMs: 20000, supportsVision: false }
  ],
  think: [
    { provider: 'openrouter', model: 'deepseek/deepseek-reasoner', enabled: true, priority: 105, maxRetries: 2, timeoutMs: 40000, supportsVision: false },
    { provider: 'openrouter', model: 'anthropic/claude-opus-5', enabled: true, priority: 100, maxRetries: 2, timeoutMs: 30000, supportsVision: true },
    { provider: 'openrouter', model: 'anthropic/claude-sonnet-5', enabled: true, priority: 98, maxRetries: 2, timeoutMs: 28000, supportsVision: true },
    { provider: 'openrouter', model: 'anthropic/claude-sonnet-5', enabled: true, priority: 97, maxRetries: 2, timeoutMs: 28000, supportsVision: true },
    { provider: 'openai', model: 'gpt-4o', enabled: true, priority: 95, maxRetries: 2, timeoutMs: 25000, supportsVision: true },
    { provider: 'gemini', model: 'gemini-1.5-pro', enabled: true, priority: 90, maxRetries: 2, timeoutMs: 20000, supportsVision: true },
    { provider: 'openrouter', model: 'google/gemini-pro-latest', enabled: true, priority: 88, maxRetries: 2, timeoutMs: 25000, supportsVision: true },
    { provider: 'openrouter', model: 'meta-llama/llama-3.1-405b-instruct', enabled: true, priority: 87, maxRetries: 2, timeoutMs: 30000, supportsVision: false },
    { provider: 'groq', model: 'llama-3.3-70b-versatile', enabled: true, priority: 85, maxRetries: 2, timeoutMs: 15000, supportsVision: false },
    { provider: 'openrouter', model: 'deepseek/deepseek-chat', enabled: true, priority: 80, maxRetries: 2, timeoutMs: 20000, supportsVision: false },
    { provider: 'openrouter', model: 'openrouter/free', enabled: true, priority: 50, maxRetries: 1, timeoutMs: 20000, supportsVision: false }
  ],
  code: [
    { provider: 'openrouter', model: 'anthropic/claude-sonnet-5', enabled: true, priority: 100, maxRetries: 2, timeoutMs: 28000, supportsVision: true },
    { provider: 'openrouter', model: 'anthropic/claude-sonnet-5', enabled: true, priority: 99, maxRetries: 2, timeoutMs: 28000, supportsVision: true },
    { provider: 'openrouter', model: 'anthropic/claude-opus-5', enabled: true, priority: 98, maxRetries: 2, timeoutMs: 30000, supportsVision: true },
    { provider: 'openai', model: 'gpt-4o', enabled: true, priority: 95, maxRetries: 2, timeoutMs: 25000, supportsVision: true },
    { provider: 'gemini', model: 'gemini-1.5-pro', enabled: true, priority: 90, maxRetries: 2, timeoutMs: 20000, supportsVision: true },
    { provider: 'openrouter', model: 'google/gemini-pro-latest', enabled: true, priority: 88, maxRetries: 2, timeoutMs: 25000, supportsVision: true },
    { provider: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct', enabled: true, priority: 87, maxRetries: 2, timeoutMs: 20000, supportsVision: false },
    { provider: 'openrouter', model: 'deepseek/deepseek-chat', enabled: true, priority: 85, maxRetries: 2, timeoutMs: 20000, supportsVision: false },
    { provider: 'groq', model: 'llama-3.3-70b-versatile', enabled: true, priority: 80, maxRetries: 2, timeoutMs: 15000, supportsVision: false },
    { provider: 'openrouter', model: 'openrouter/free', enabled: true, priority: 50, maxRetries: 1, timeoutMs: 20000, supportsVision: false }
  ],
  speed: [
    { provider: 'groq', model: 'llama-3.3-70b-versatile', enabled: true, priority: 100, maxRetries: 2, timeoutMs: 12000, supportsVision: false },
    { provider: 'openai', model: 'gpt-4o-mini', enabled: true, priority: 95, maxRetries: 2, timeoutMs: 15000, supportsVision: true },
    { provider: 'gemini', model: 'gemini-1.5-flash', enabled: true, priority: 90, maxRetries: 2, timeoutMs: 15000, supportsVision: true },
    { provider: 'openrouter', model: 'openai/gpt-4o-mini', enabled: true, priority: 85, maxRetries: 2, timeoutMs: 15000, supportsVision: true },
    { provider: 'openrouter', model: 'openrouter/free', enabled: true, priority: 50, maxRetries: 1, timeoutMs: 15000, supportsVision: false }
  ],
  search: [
    { provider: 'gemini', model: 'gemini-1.5-flash', enabled: true, priority: 100, maxRetries: 2, timeoutMs: 20000, supportsVision: true },
    { provider: 'openai', model: 'gpt-4o', enabled: true, priority: 95, maxRetries: 2, timeoutMs: 20000, supportsVision: true },
    { provider: 'openrouter', model: 'openai/gpt-4o-mini', enabled: true, priority: 90, maxRetries: 2, timeoutMs: 20000, supportsVision: true },
    { provider: 'openrouter', model: 'deepseek/deepseek-chat', enabled: true, priority: 85, maxRetries: 2, timeoutMs: 20000, supportsVision: false },
    { provider: 'groq', model: 'llama-3.3-70b-versatile', enabled: true, priority: 80, maxRetries: 2, timeoutMs: 15000, supportsVision: false }
  ],
  vision: [
    { provider: 'openrouter', model: 'anthropic/claude-sonnet-5', enabled: true, priority: 100, maxRetries: 2, timeoutMs: 25000, supportsVision: true },
    { provider: 'openai', model: 'gpt-4o', enabled: true, priority: 95, maxRetries: 2, timeoutMs: 25000, supportsVision: true },
    { provider: 'gemini', model: 'gemini-1.5-flash', enabled: true, priority: 90, maxRetries: 2, timeoutMs: 20000, supportsVision: true },
    { provider: 'openai', model: 'gpt-4o-mini', enabled: true, priority: 85, maxRetries: 2, timeoutMs: 15000, supportsVision: true },
    { provider: 'openrouter', model: 'openai/gpt-4o-mini', enabled: true, priority: 80, maxRetries: 2, timeoutMs: 20000, supportsVision: true }
  ],
  image: [
    { provider: 'replicate', model: 'black-forest-labs/flux-schnell', enabled: true, priority: 100, maxRetries: 2, timeoutMs: 30000, supportsVision: false },
    { provider: 'openrouter', model: 'openai/gpt-4o-mini', enabled: true, priority: 90, maxRetries: 2, timeoutMs: 20000, supportsVision: true },
    { provider: 'gemini', model: 'gemini-1.5-flash', enabled: true, priority: 85, maxRetries: 2, timeoutMs: 20000, supportsVision: true }
  ],
  image_generation: [
    { provider: 'gemini', model: 'gemini-1.5-flash', enabled: true, priority: 100, maxRetries: 2, timeoutMs: 40000, supportsVision: false },
    { provider: 'openai', model: 'dall-e-3', enabled: true, priority: 90, maxRetries: 1, timeoutMs: 40000, supportsVision: false },
    { provider: 'replicate', model: 'black-forest-labs/flux-schnell', enabled: true, priority: 80, maxRetries: 1, timeoutMs: 60000, supportsVision: false }
  ]
};

export function getSortedModelsForCategory(category: AICategory = 'general', isSearchIntent = false, hasImages = false): AIProviderModelConfig[] {
  const configs = routingConfig[category] || routingConfig.general;

  // Filter and score models
  const scored = configs.map(item => {
    const key = `${item.provider}:${item.model}`;
    const available = isCircuitAvailable(key);
    const quota = getProviderQuota(item.provider);
    const health = calculateHealthScore(item.provider, item.model);

    // If circuit is open or quota exhausted, score = -1
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

    if (quota.status === 'rate_limited') score -= 50;
    if (quota.status === 'billing_error') score -= 100;
    if (quota.status === 'attention') score -= 15;
    if (quota.status === 'reduce_priority') score -= 40;
    if (quota.status === 'avoid') score -= 80;

    if (isSearchIntent && item.provider !== 'gemini' && item.provider !== 'openai') {
      score -= 30; // prefer native search support
    }

    return { item, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.filter(s => s.score > -500).map(s => s.item);
}
