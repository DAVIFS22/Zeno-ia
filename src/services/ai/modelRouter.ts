import { AICategory, AIProviderModelConfig, ProviderName } from './types';
import { isCircuitAvailable } from './circuitBreaker';
import { getProviderQuota } from './quotaManager';
import { calculateHealthScore } from './healthManager';

export const routingConfig: Record<AICategory, AIProviderModelConfig[]> = {
  general: [
    { provider: 'openai', model: 'gpt-4o', enabled: true, priority: 100, maxRetries: 2, timeoutMs: 20000 },
    { provider: 'openai', model: 'gpt-4o-mini', enabled: true, priority: 95, maxRetries: 2, timeoutMs: 15000 },
    { provider: 'gemini', model: 'gemini-1.5-flash', enabled: true, priority: 90, maxRetries: 2, timeoutMs: 20000 },
    { provider: 'openrouter', model: 'openai/gpt-4o-mini', enabled: true, priority: 85, maxRetries: 2, timeoutMs: 20000 },
    { provider: 'groq', model: 'llama-3.3-70b-versatile', enabled: true, priority: 80, maxRetries: 2, timeoutMs: 15000 },
    { provider: 'openrouter', model: 'anthropic/claude-3.5-sonnet', enabled: true, priority: 75, maxRetries: 2, timeoutMs: 25000 },
    { provider: 'openrouter', model: 'openrouter/free', enabled: true, priority: 50, maxRetries: 1, timeoutMs: 20000 }
  ],
  think: [
    { provider: 'openai', model: 'gpt-4o', enabled: true, priority: 100, maxRetries: 2, timeoutMs: 25000 },
    { provider: 'gemini', model: 'gemini-1.5-flash', enabled: true, priority: 95, maxRetries: 2, timeoutMs: 20000 },
    { provider: 'openrouter', model: 'anthropic/claude-3-opus', enabled: true, priority: 90, maxRetries: 2, timeoutMs: 30000 },
    { provider: 'groq', model: 'llama-3.3-70b-versatile', enabled: true, priority: 85, maxRetries: 2, timeoutMs: 15000 },
    { provider: 'openrouter', model: 'deepseek/deepseek-chat', enabled: true, priority: 80, maxRetries: 2, timeoutMs: 20000 },
    { provider: 'openrouter', model: 'openrouter/free', enabled: true, priority: 50, maxRetries: 1, timeoutMs: 20000 }
  ],
  code: [
    { provider: 'openai', model: 'gpt-4o', enabled: true, priority: 100, maxRetries: 2, timeoutMs: 25000 },
    { provider: 'gemini', model: 'gemini-1.5-flash', enabled: true, priority: 95, maxRetries: 2, timeoutMs: 20000 },
    { provider: 'openrouter', model: 'deepseek/deepseek-chat', enabled: true, priority: 90, maxRetries: 2, timeoutMs: 20000 },
    { provider: 'openrouter', model: 'anthropic/claude-3.5-sonnet', enabled: true, priority: 85, maxRetries: 2, timeoutMs: 25000 },
    { provider: 'groq', model: 'llama-3.3-70b-versatile', enabled: true, priority: 80, maxRetries: 2, timeoutMs: 15000 },
    { provider: 'openrouter', model: 'openrouter/free', enabled: true, priority: 50, maxRetries: 1, timeoutMs: 20000 }
  ],
  speed: [
    { provider: 'groq', model: 'llama-3.3-70b-versatile', enabled: true, priority: 100, maxRetries: 2, timeoutMs: 12000 },
    { provider: 'openai', model: 'gpt-4o-mini', enabled: true, priority: 95, maxRetries: 2, timeoutMs: 15000 },
    { provider: 'gemini', model: 'gemini-1.5-flash', enabled: true, priority: 90, maxRetries: 2, timeoutMs: 15000 },
    { provider: 'openrouter', model: 'openai/gpt-4o-mini', enabled: true, priority: 85, maxRetries: 2, timeoutMs: 15000 },
    { provider: 'openrouter', model: 'openrouter/free', enabled: true, priority: 50, maxRetries: 1, timeoutMs: 15000 }
  ],
  search: [
    { provider: 'gemini', model: 'gemini-1.5-flash', enabled: true, priority: 100, maxRetries: 2, timeoutMs: 20000 },
    { provider: 'openai', model: 'gpt-4o', enabled: true, priority: 95, maxRetries: 2, timeoutMs: 20000 },
    { provider: 'openrouter', model: 'openai/gpt-4o-mini', enabled: true, priority: 90, maxRetries: 2, timeoutMs: 20000 },
    { provider: 'openrouter', model: 'deepseek/deepseek-chat', enabled: true, priority: 85, maxRetries: 2, timeoutMs: 20000 },
    { provider: 'groq', model: 'llama-3.3-70b-versatile', enabled: true, priority: 80, maxRetries: 2, timeoutMs: 15000 }
  ],
  image: [
    { provider: 'replicate', model: 'black-forest-labs/flux-schnell', enabled: true, priority: 100, maxRetries: 2, timeoutMs: 30000 },
    { provider: 'openrouter', model: 'openai/gpt-4o-mini', enabled: true, priority: 90, maxRetries: 2, timeoutMs: 20000 },
    { provider: 'gemini', model: 'gemini-1.5-flash', enabled: true, priority: 85, maxRetries: 2, timeoutMs: 20000 }
  ]
};

export function getSortedModelsForCategory(category: AICategory = 'general', isSearchIntent = false): AIProviderModelConfig[] {
  const configs = routingConfig[category] || routingConfig.general;

  // Filter and score models
  const scored = configs.map(item => {
    const key = `${item.provider}:${item.model}`;
    const available = isCircuitAvailable(key);
    const quota = getProviderQuota(item.provider);
    const health = calculateHealthScore(item.provider, item.model);

    // If circuit is open or quota exhausted, score = -1
    if (!available || quota.status === 'exhausted') {
      return { item, score: -999 };
    }

    let score = item.priority + (health * 0.5);

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
