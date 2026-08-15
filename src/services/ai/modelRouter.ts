import { AICategory, AIProviderModelConfig, ProviderName } from './types';
import { isCircuitAvailable } from './circuitBreaker';
import { getProviderQuota } from './quotaManager';
import { calculateHealthScore } from './healthManager';

export const routingConfig: Record<AICategory, AIProviderModelConfig[]> = {
  general: [
    { provider: 'gemini', model: 'gemini-1.5-flash', enabled: true, priority: 100, maxRetries: 2, timeoutMs: 20000, supportsVision: true },
    { provider: 'gemini', model: 'gemini-1.5-pro', enabled: true, priority: 99, maxRetries: 2, timeoutMs: 25000, supportsVision: true },
    { provider: 'groq', model: 'llama-3.3-70b-versatile', enabled: true, priority: 98, maxRetries: 2, timeoutMs: 15000, supportsVision: false },
    { provider: 'xai', model: 'grok-2', enabled: true, priority: 95, maxRetries: 1, timeoutMs: 25000, supportsVision: true },
    { provider: 'openrouter', model: 'google/gemini-pro-1.5', enabled: true, priority: 94, maxRetries: 1, timeoutMs: 25000, supportsVision: true },
    { provider: 'openai', model: 'gpt-4o', enabled: true, priority: 93, maxRetries: 2, timeoutMs: 20000, supportsVision: true },
    { provider: 'xai', model: 'grok-2-latest', enabled: true, priority: 92, maxRetries: 1, timeoutMs: 20000, supportsVision: true },
    { provider: 'openrouter', model: 'anthropic/claude-3.5-sonnet', enabled: true, priority: 90, maxRetries: 1, timeoutMs: 25000, supportsVision: true },
    { provider: 'groq', model: 'llama-3.1-8b-instant', enabled: true, priority: 80, maxRetries: 2, timeoutMs: 15000, supportsVision: false },
    { provider: 'openrouter', model: 'meta-llama/llama-3.1-8b-instruct:free', enabled: true, priority: 75, maxRetries: 2, timeoutMs: 15000, supportsVision: false }
  ],
  think: [
    { provider: 'gemini', model: 'gemini-1.5-pro', enabled: true, priority: 100, maxRetries: 2, timeoutMs: 30000, supportsVision: true },
    { provider: 'gemini', model: 'gemini-1.5-flash', enabled: true, priority: 99, maxRetries: 2, timeoutMs: 20000, supportsVision: true },
    { provider: 'groq', model: 'llama-3.3-70b-versatile', enabled: true, priority: 98, maxRetries: 2, timeoutMs: 15000, supportsVision: false },
    { provider: 'xai', model: 'grok-2', enabled: true, priority: 96, maxRetries: 1, timeoutMs: 30000, supportsVision: true },
    { provider: 'openrouter', model: 'deepseek/deepseek-chat', enabled: true, priority: 95, maxRetries: 1, timeoutMs: 35000, supportsVision: false },
    { provider: 'openrouter', model: 'x-ai/grok-2', enabled: true, priority: 94, maxRetries: 1, timeoutMs: 30000, supportsVision: true },
    { provider: 'openrouter', model: 'anthropic/claude-3-opus', enabled: true, priority: 92, maxRetries: 1, timeoutMs: 30000, supportsVision: true },
    { provider: 'openai', model: 'gpt-4o', enabled: true, priority: 90, maxRetries: 2, timeoutMs: 25000, supportsVision: true }
  ],
  code: [
    { provider: 'gemini', model: 'gemini-1.5-pro', enabled: true, priority: 100, maxRetries: 2, timeoutMs: 30000, supportsVision: true },
    { provider: 'gemini', model: 'gemini-1.5-flash', enabled: true, priority: 99, maxRetries: 2, timeoutMs: 20000, supportsVision: true },
    { provider: 'groq', model: 'llama-3.3-70b-versatile', enabled: true, priority: 98, maxRetries: 2, timeoutMs: 15000, supportsVision: false },
    { provider: 'xai', model: 'grok-2', enabled: true, priority: 96, maxRetries: 1, timeoutMs: 30000, supportsVision: true },
    { provider: 'openrouter', model: 'x-ai/grok-2', enabled: true, priority: 94, maxRetries: 1, timeoutMs: 30000, supportsVision: true },
    { provider: 'openrouter', model: 'anthropic/claude-3.5-sonnet', enabled: true, priority: 92, maxRetries: 1, timeoutMs: 28000, supportsVision: true },
    { provider: 'openai', model: 'gpt-4o', enabled: true, priority: 90, maxRetries: 2, timeoutMs: 25000, supportsVision: true }
  ],
  speed: [
    { provider: 'gemini', model: 'gemini-1.5-flash', enabled: true, priority: 100, maxRetries: 2, timeoutMs: 15000, supportsVision: true },
    { provider: 'groq', model: 'llama-3.3-70b-versatile', enabled: true, priority: 99, maxRetries: 2, timeoutMs: 12000, supportsVision: false },
    { provider: 'groq', model: 'llama-3.1-8b-instant', enabled: true, priority: 96, maxRetries: 2, timeoutMs: 10000, supportsVision: false },
    { provider: 'xai', model: 'grok-2', enabled: true, priority: 94, maxRetries: 1, timeoutMs: 15000, supportsVision: true },
    { provider: 'openai', model: 'gpt-4o-mini', enabled: true, priority: 90, maxRetries: 2, timeoutMs: 15000, supportsVision: true }
  ],
  search: [
    { provider: 'gemini', model: 'gemini-1.5-flash', enabled: true, priority: 100, maxRetries: 2, timeoutMs: 20000, supportsVision: true },
    { provider: 'gemini', model: 'gemini-1.5-pro', enabled: true, priority: 98, maxRetries: 2, timeoutMs: 25000, supportsVision: true },
    { provider: 'openai', model: 'gpt-4o', enabled: true, priority: 95, maxRetries: 2, timeoutMs: 20000, supportsVision: true },
    { provider: 'xai', model: 'grok-2', enabled: true, priority: 94, maxRetries: 1, timeoutMs: 20000, supportsVision: true },
    { provider: 'groq', model: 'llama-3.3-70b-versatile', enabled: true, priority: 90, maxRetries: 2, timeoutMs: 15000, supportsVision: false }
  ],
  vision: [
    { provider: 'gemini', model: 'gemini-1.5-pro', enabled: true, priority: 100, maxRetries: 2, timeoutMs: 30000, supportsVision: true },
    { provider: 'gemini', model: 'gemini-1.5-flash', enabled: true, priority: 99, maxRetries: 2, timeoutMs: 20000, supportsVision: true },
    { provider: 'xai', model: 'grok-2', enabled: true, priority: 96, maxRetries: 1, timeoutMs: 25000, supportsVision: true },
    { provider: 'openrouter', model: 'x-ai/grok-2', enabled: true, priority: 94, maxRetries: 1, timeoutMs: 25000, supportsVision: true },
    { provider: 'openai', model: 'gpt-4o', enabled: true, priority: 92, maxRetries: 2, timeoutMs: 25000, supportsVision: true },
    { provider: 'openrouter', model: 'anthropic/claude-3.5-sonnet', enabled: true, priority: 90, maxRetries: 1, timeoutMs: 25000, supportsVision: true }
  ],
  image: [
    { provider: 'gemini', model: 'gemini-1.5-pro', enabled: true, priority: 100, maxRetries: 2, timeoutMs: 30000, supportsVision: true },
    { provider: 'gemini', model: 'gemini-1.5-flash', enabled: true, priority: 99, maxRetries: 2, timeoutMs: 20000, supportsVision: true },
    { provider: 'replicate', model: 'black-forest-labs/flux-schnell', enabled: true, priority: 98, maxRetries: 2, timeoutMs: 30000, supportsVision: false },
    { provider: 'xai', model: 'grok-2', enabled: true, priority: 95, maxRetries: 1, timeoutMs: 25000, supportsVision: true },
    { provider: 'openrouter', model: 'x-ai/grok-2', enabled: true, priority: 94, maxRetries: 1, timeoutMs: 25000, supportsVision: true }
  ],
  image_generation: [
    { provider: 'replicate', model: 'black-forest-labs/flux-schnell', enabled: true, priority: 100, maxRetries: 1, timeoutMs: 60000, supportsVision: false },
    { provider: 'gemini', model: 'gemini-1.5-flash', enabled: true, priority: 90, maxRetries: 2, timeoutMs: 40000, supportsVision: false },
    { provider: 'openai', model: 'dall-e-3', enabled: true, priority: 80, maxRetries: 1, timeoutMs: 40000, supportsVision: false }
  ]
};

export function getSortedModelsForCategory(category: AICategory = 'general', isSearchIntent = false, hasImages = false, userRequestedModel?: string): AIProviderModelConfig[] {
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

    if (userRequestedModel && (item.model === userRequestedModel || item.model.endsWith(userRequestedModel))) {
      score += 1000; // Boost requested model heavily
    }

    return { item, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.filter(s => s.score > -500).map(s => s.item);
}
