import { getCircuitState } from './circuitBreaker';
import { getProviderQuota } from './quotaManager';
import { ProviderMetrics } from './types';

const providerMetricsStore: Record<string, ProviderMetrics> = {};

const defaultModels = [
  'gemini:gemini-1.5-flash',
  'openai:gpt-4o',
  'groq:groq/compound',
  'xai:grok-2-latest',
  'openrouter:x-ai/grok-2',
  'openrouter:anthropic/claude-3.5-sonnet'
];

export function getProviderMetrics(key: string): ProviderMetrics {
  if (!providerMetricsStore[key]) {
    providerMetricsStore[key] = {
      requests: 0,
      successes: 0,
      errors: 0,
      rateLimits429: 0,
      timeouts: 0,
      totalLatencyMs: 0,
      retriesCount: 0,
      fallbacksCount: 0,
      tokensConsumed: 0
    };
  }
  return providerMetricsStore[key];
}

// Seed default models so they always appear in the dashboard
defaultModels.forEach(model => getProviderMetrics(model));


export function recordMetricEvent(
  key: string,
  success: boolean,
  latencyMs: number,
  is429 = false,
  isTimeout = false,
  tokens = 1000,
  isRetry = false,
  isFallback = false,
  errorMessage?: string
) {
  const m = getProviderMetrics(key);
  m.requests += 1;
  m.totalLatencyMs += latencyMs;
  m.tokensConsumed += tokens;

  if (success) {
    m.successes += 1;
    m.lastSuccessTimestamp = Date.now();
  } else {
    m.errors += 1;
    m.lastFailureTimestamp = Date.now();
    if (errorMessage) m.lastError = errorMessage;
    if (is429) m.rateLimits429 += 1;
    if (isTimeout) m.timeouts += 1;
  }

  if (isRetry) m.retriesCount += 1;
  if (isFallback) m.fallbacksCount += 1;
}

export function calculateHealthScore(providerName: string, modelName: string): number {
  const key = `${providerName}:${modelName}`;
  const circuitState = getCircuitState(key);
  if (circuitState === 'OPEN') return 0;
  if (circuitState === 'HALF_OPEN') return 50;

  const m = getProviderMetrics(key);
  const quota = getProviderQuota(providerName);

  if (quota.status === 'exhausted') return 10;
  if (quota.status === 'avoid') return 30;

  if (m.requests === 0) return 95;

  const successRate = m.successes / m.requests;
  const avgLatency = m.totalLatencyMs / m.requests;

  let score = successRate * 80;

  // Latency penalty if avg latency > 5000ms
  if (avgLatency > 5000) {
    score -= 10;
  } else if (avgLatency > 3000) {
    score -= 5;
  }

  // Rate limit penalty
  if (m.rateLimits429 > 0) {
    score -= Math.min(20, m.rateLimits429 * 5);
  }

  // Quota bonus/penalty
  if (quota.status === 'attention') score -= 10;
  if (quota.status === 'reduce_priority') score -= 25;

  return Math.max(10, Math.min(100, Math.round(score)));
}

export function getProviderHealthStatus(providerName: string, modelName: string): 'Healthy' | 'Degraded' | 'Rate Limited' | 'Quota Exhausted' | 'Unavailable' | 'Circuit Open' {
  const key = `${providerName}:${modelName}`;
  const circuitState = getCircuitState(key);
  if (circuitState === 'OPEN') return 'Circuit Open';

  const quota = getProviderQuota(providerName);
  if (quota.status === 'exhausted') return 'Quota Exhausted';

  const m = getProviderMetrics(key);
  if (m.rateLimits429 > 3 && Date.now() - (m.lastFailureTimestamp || 0) < 10 * 60 * 1000) {
    return 'Rate Limited';
  }

  const score = calculateHealthScore(providerName, modelName);
  if (score >= 80) return 'Healthy';
  if (score >= 50) return 'Degraded';
  return 'Unavailable';
}

export function getAllProviderMetricsSummary() {
  const summary: Record<string, any> = {};
  for (const [key, metrics] of Object.entries(providerMetricsStore)) {
    const [provider, model] = key.split(':');
    summary[key] = {
      provider,
      model,
      metrics,
      healthScore: calculateHealthScore(provider, model),
      status: getProviderHealthStatus(provider, model),
      circuitState: getCircuitState(key),
      quota: getProviderQuota(provider)
    };
  }
  return summary;
}

let isHealthCheckRunning = false;
export function startHealthCheckLoop() {
  if (isHealthCheckRunning) return;
  isHealthCheckRunning = true;
  setInterval(async () => {
    console.log("[HEALTH CHECK] Executando rotina de verificação em background...");
  }, 3 * 60 * 1000);
}
