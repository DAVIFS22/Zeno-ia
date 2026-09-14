import { ProviderQuotaInfo, ProviderName, QuotaStatus } from './types';

const providerQuotas: Record<string, ProviderQuotaInfo> = {
  gemini: {
    requestLimit: 10000,
    requestsUsed: 1420,
    tokenLimit: 5000000,
    tokensUsed: 820000,
    remainingPercentage: 83.6,
    resetTimestamp: Date.now() + 24 * 3600 * 1000,
    status: 'normal'
  },
  openai: {
    requestLimit: 5000,
    requestsUsed: 920,
    tokenLimit: 2000000,
    tokensUsed: 450000,
    remainingPercentage: 77.5,
    resetTimestamp: Date.now() + 24 * 3600 * 1000,
    status: 'normal'
  },
  anthropic: {
    requestLimit: 3000,
    requestsUsed: 800,
    tokenLimit: 1500000,
    tokensUsed: 380000,
    remainingPercentage: 74.6,
    resetTimestamp: Date.now() + 24 * 3600 * 1000,
    status: 'normal'
  },
  deepseek: {
    requestLimit: 8000,
    requestsUsed: 1200,
    tokenLimit: 4000000,
    tokensUsed: 600000,
    remainingPercentage: 85.0,
    resetTimestamp: Date.now() + 24 * 3600 * 1000,
    status: 'normal'
  },
  groq: {
    requestLimit: 15000,
    requestsUsed: 4200,
    tokenLimit: 6000000,
    tokensUsed: 1800000,
    remainingPercentage: 70.0,
    resetTimestamp: Date.now() + 24 * 3600 * 1000,
    status: 'normal'
  },
  openrouter: {
    requestLimit: 10000,
    requestsUsed: 2100,
    tokenLimit: 3000000,
    tokensUsed: 950000,
    remainingPercentage: 68.3,
    resetTimestamp: Date.now() + 24 * 3600 * 1000,
    status: 'normal'
  },
  xai: {
    requestLimit: 10000,
    requestsUsed: 500,
    tokenLimit: 4000000,
    tokensUsed: 250000,
    remainingPercentage: 93.7,
    resetTimestamp: Date.now() + 24 * 3600 * 1000,
    status: 'normal'
  },
  grok: {
    requestLimit: 10000,
    requestsUsed: 500,
    tokenLimit: 4000000,
    tokensUsed: 250000,
    remainingPercentage: 93.7,
    resetTimestamp: Date.now() + 24 * 3600 * 1000,
    status: 'normal'
  }
};

export function getProviderQuota(provider: string): ProviderQuotaInfo {
  if (!providerQuotas[provider]) {
    providerQuotas[provider] = {
      requestLimit: 5000,
      requestsUsed: 100,
      tokenLimit: 2000000,
      tokensUsed: 50000,
      remainingPercentage: 97.5,
      resetTimestamp: Date.now() + 24 * 3600 * 1000,
      status: 'normal'
    };
  }

  const quota = providerQuotas[provider];
  // Auto-recovery check for billing_error or exhausted after 5 minutes cooldown
  if ((quota.status === 'billing_error' || quota.status === 'exhausted' || quota.status === 'rate_limited') && quota.errorTimestamp) {
    const cooldownMs = quota.status === 'rate_limited' ? 2 * 60 * 1000 : 5 * 60 * 1000;
    if (Date.now() - quota.errorTimestamp > cooldownMs) {
      quota.status = 'normal';
      quota.remainingPercentage = 50;
      console.log(`[QUOTA MANAGER] Cooldown encerrado para o provedor ${provider}. Status redefinido para normal.`);
    }
  }

  return quota;
}

export function recordQuotaUsage(provider: string, tokens = 1000) {
  const quota = getProviderQuota(provider);
  quota.requestsUsed += 1;
  quota.tokensUsed += tokens;
  
  const tokenRatio = quota.tokensUsed / quota.tokenLimit;
  quota.remainingPercentage = Math.max(0, Number(((1 - tokenRatio) * 100).toFixed(1)));

  if (quota.remainingPercentage >= 50) {
    quota.status = 'normal';
  } else if (quota.remainingPercentage >= 20) {
    quota.status = 'attention';
  } else if (quota.remainingPercentage >= 5) {
    quota.status = 'reduce_priority';
  } else if (quota.remainingPercentage > 0) {
    quota.status = 'avoid';
  } else {
    quota.status = 'exhausted';
  }
}

export function setProviderQuotaExhausted(provider: string, reason?: string) {
  const quota = getProviderQuota(provider);
  const isBilling = reason?.includes('402') || 
                    reason?.includes('403') || 
                    reason?.toLowerCase().includes('credit') || 
                    reason?.toLowerCase().includes('license') ||
                    reason?.toLowerCase().includes('permission-denied') ||
                    reason?.toLowerCase().includes('insufficient_quota');
  const isRateLimit = reason?.includes('429') || reason?.toLowerCase().includes('rate limit');
  
  if (isBilling) {
    quota.remainingPercentage = 0;
    quota.status = 'billing_error';
  } else if (isRateLimit) {
    quota.remainingPercentage = 25;
    quota.status = 'rate_limited';
  } else {
    quota.remainingPercentage = 0;
    quota.status = 'exhausted';
  }

  quota.lastError = reason;
  quota.errorTimestamp = Date.now();
  console.warn(`[QUOTA MANAGER] Provedor ${provider} marcado como ${quota.status} devido a: ${reason?.slice(0, 120)}`);
}

export function resetAllQuotas() {
  for (const key in providerQuotas) {
    providerQuotas[key].requestsUsed = 0;
    providerQuotas[key].tokensUsed = 0;
    providerQuotas[key].remainingPercentage = 100;
    providerQuotas[key].status = 'normal';
    console.log(`[QUOTA MANAGER] ${key} resetado.`);
  }
}
