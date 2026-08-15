import { GoogleGenAI } from "@google/genai";
import { AIRequestOptions, AIResponseResult } from './types';
import { getSortedModelsForCategory } from './modelRouter';
import { callProviderAdapter } from './providerManager';
import { executeWithRetry } from './retryManager';
import { logAiEvent } from './logger';
import { incrementAiStat } from './metrics';

export async function generateTextWithResilience(
  options: AIRequestOptions
): Promise<AIResponseResult> {
  const category = options.category || 'general';
  const requestId = Math.random().toString(36).substring(2, 9);
  const models = getSortedModelsForCategory(category, options.isSearchIntent, options.hasImages, options.userRequestedModel);

  if (models.length === 0) {
    return { text: "⚠️ **Sistema Temporariamente Indisponível**: Todos os provedores de IA configurados falharam ou atingiram o limite de cota/circuit breaker. Por favor, tente novamente em alguns instantes.", provider: "gemini", modelUsed: "fallback-error", isAlternative: true, latencyMs: 0, attempts: 0, fallbackUsed: true };
  }

  let lastError: any = null;
  let attemptsTotal = 0;
  let fallbackCount = 0;

    for (let i = 0; i < models.length; i++) {
      const item = models[i];
      
      // Skip if this provider's quota was exhausted or in billing error (unless it's a free model)
      const currentQuota = (await import('./quotaManager')).getProviderQuota(item.provider);
      const isFree = item.model.includes(':free') || item.model.includes('/free');
      if ((currentQuota.status === 'exhausted' || currentQuota.status === 'billing_error') && !isFree) {
        continue;
      }

      const fromProvider = i > 0 ? models[i - 1].provider : undefined;

    if (i > 0) {
      fallbackCount += 1;
      incrementAiStat('fallbacksToday', 1);
      logAiEvent('FALLBACK', {
        provider: item.provider,
        model: item.model,
        from: fromProvider,
        to: item.provider,
        reason: lastError?.message || 'Falha anterior'
      });
    }

    try {
      // Execute with retry for each model
      const { result, attempts } = await executeWithRetry(
        () => callProviderAdapter(item.provider, item.model, { ...options, timeoutMs: item.timeoutMs }),
        item.maxRetries || 1, // At least 1 retry (2 total attempts) for network/timeout as requested
        500,
        (attempt, err) => {
          attemptsTotal += 1;
        }
      );

      attemptsTotal += attempts;

      console.log(`[RESILIENCE] Sucesso com ${item.provider}:${item.model} após ${i} fallbacks e ${attemptsTotal} tentativas totais.`);

      return {
        ...result,
        attempts: attemptsTotal,
        fallbackUsed: i > 0
      };

    } catch (err: any) {
      lastError = err;
      const msg = err?.message || String(err);
      const isRateLimit = msg.includes('429') || msg.toLowerCase().includes('rate limit');
      const isCreditOrAuth = msg.includes('402') || 
                             msg.includes('403') || 
                             msg.includes('401') || 
                             msg.toLowerCase().includes('credit') ||
                             msg.toLowerCase().includes('license') ||
                             msg.toLowerCase().includes('permission-denied') ||
                             msg.toLowerCase().includes('api key not valid');
      
      // Update Circuit Breaker and Quota state on failure
      const { recordCircuitFailure } = await import('./circuitBreaker');
      const { setProviderQuotaExhausted } = await import('./quotaManager');
      
      const circuitKey = `${item.provider}:${item.model}`;
      recordCircuitFailure(circuitKey, isRateLimit, isCreditOrAuth);
      
      if (isCreditOrAuth || isRateLimit) {
        setProviderQuotaExhausted(item.provider, msg);
      }

      if (isCreditOrAuth) {
        console.warn(`[RESILIENCE] Provedor ${item.provider}:${item.model} falhou (Autenticação/Créditos) em ${requestId}. Tentando próximo...`);
      } else if (isRateLimit) {
        console.warn(`[RESILIENCE] Provedor ${item.provider}:${item.model} atingiu limite de cota em ${requestId}. Tentando próximo...`);
      } else {
        console.warn(`[RESILIENCE] Provedor ${item.provider}:${item.model} falhou (Erro: ${msg.slice(0, 100)}) em ${requestId}. Tentando próximo...`);
      }
    }
  }

  // If all failed, return a graceful fallback message
  let errorDetail = "Por favor, tente novamente em alguns instantes.";
  if (lastError?.message?.toLowerCase().includes('api key') || lastError?.message?.toLowerCase().includes('invalid_api_key')) {
    errorDetail = "Parece haver um problema com as Chaves de API configuradas. Verifique suas configurações ou entre em contato com o suporte.";
  } else if (lastError?.message?.toLowerCase().includes('quota') || lastError?.message?.toLowerCase().includes('credits') || lastError?.message?.includes('429')) {
    errorDetail = "Os limites de uso (cota ou créditos) foram atingidos em todos os provedores disponíveis.";
  }

  return {
    text: `⚠️ **Sistema Indisponível**: Não foi possível processar sua solicitação agora.\n\n${errorDetail}`,
    provider: 'gemini',
    modelUsed: 'fallback-error',
    isAlternative: true,
    latencyMs: 0,
    attempts: attemptsTotal,
    fallbackUsed: true
  };
}

export async function generateImageWithResilience(
  options: AIRequestOptions
): Promise<AIResponseResult> {
  const category = 'image_generation';
  const requestId = Math.random().toString(36).substring(2, 9);
  const models = getSortedModelsForCategory(category, false, false);

  if (models.length === 0) {
    throw new Error("Nenhum provedor de imagem disponível.");
  }

  let lastError: any = null;
  let attemptsTotal = 0;

  for (let i = 0; i < models.length; i++) {
    const item = models[i];
    
    const currentQuota = (await import('./quotaManager')).getProviderQuota(item.provider);
    if (currentQuota.status === 'exhausted' || currentQuota.status === 'billing_error') continue;

    if (i > 0) {
      incrementAiStat('fallbacksToday', 1);
      logAiEvent('FALLBACK', { 
        provider: item.provider, 
        model: item.model, 
        from: models[i - 1].provider,
        to: item.provider,
        reason: 'Fallback de imagem resiliente'
      });
    }

    try {
      const { result, attempts } = await executeWithRetry(
        () => callProviderAdapter(item.provider, item.model, { ...options, category }),
        item.maxRetries || 1,
        1000,
        () => { attemptsTotal += 1; }
      );

      console.log(`[IMAGE RESILIENCE] Sucesso com ${item.provider}:${item.model} após ${i} fallbacks.`);

      return {
        ...result,
        attempts: attemptsTotal + attempts,
        fallbackUsed: i > 0
      };

    } catch (err: any) {
      lastError = err;
      const msg = err?.message || String(err);
      const isRateLimit = msg.includes('429') || msg.toLowerCase().includes('rate limit');
      const isCreditOrAuth = msg.includes('402') || 
                             msg.includes('403') || 
                             msg.includes('401') || 
                             msg.toLowerCase().includes('credit') ||
                             msg.toLowerCase().includes('license') ||
                             msg.toLowerCase().includes('permission-denied') ||
                             msg.toLowerCase().includes('api key not valid');

      const { recordCircuitFailure } = await import('./circuitBreaker');
      const { setProviderQuotaExhausted } = await import('./quotaManager');
      
      const circuitKey = `${item.provider}:${item.model}`;
      recordCircuitFailure(circuitKey, isRateLimit, isCreditOrAuth);
      
      if (isCreditOrAuth || isRateLimit) {
        setProviderQuotaExhausted(item.provider, msg);
      }

      console.error(`[IMAGE RESILIENCE] Provedor ${item.provider}:${item.model} FALHOU: ${msg.slice(0, 100)}. Tentando próximo...`);
    }
  }

  throw lastError || new Error("Falha ao gerar imagem com todos os provedores.");
}

