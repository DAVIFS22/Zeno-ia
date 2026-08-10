import { GoogleGenAI } from "@google/genai";
import { AIRequestOptions, AIResponseResult } from './types';
import { getSortedModelsForCategory } from './modelRouter';
import { callProviderAdapter } from './providerManager';
import { executeWithRetry } from './retryManager';
import { logAiEvent } from './logger';
import { incrementAiStat } from './metrics';

export async function generateTextWithResilience(
  options: AIRequestOptions,
  aiClient: GoogleGenAI
): Promise<AIResponseResult> {
  const category = options.category || 'general';
  const models = getSortedModelsForCategory(category, options.isSearchIntent, options.hasImages);

  if (models.length === 0) {
    return { text: "⚠️ **Sistema Temporariamente Indisponível**: Todos os provedores de IA configurados falharam ou atingiram o limite de cota/circuit breaker. Por favor, tente novamente em alguns instantes.", provider: "gemini", modelUsed: "fallback-error", isAlternative: true, latencyMs: 0, attempts: 0, fallbackUsed: true };
  }

  let lastError: any = null;
  let attemptsTotal = 0;
  let fallbackCount = 0;

    for (let i = 0; i < models.length; i++) {
      const item = models[i];
      
      // Skip if this provider's quota was exhausted by a previous failure in this same run
      const currentQuota = (await import('./quotaManager')).getProviderQuota(item.provider);
      if (currentQuota.status === 'exhausted') {
        console.warn(`[RESILIENCE] Pulando ${item.provider}:${item.model} porque o provedor está com cota esgotada.`);
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
        () => callProviderAdapter(item.provider, item.model, options, aiClient),
        item.maxRetries || 2,
        400,
        (attempt, err) => {
          attemptsTotal += 1;
        }
      );

      attemptsTotal += attempts;

      return {
        ...result,
        attempts: attemptsTotal,
        fallbackUsed: i > 0
      };

    } catch (err: any) {
      lastError = err;
      console.error(`[RESILIENCE] Provedor ${item.provider}:${item.model} FALHOU com erro: ${err.message || JSON.stringify(err)}`);
      console.warn(`[RESILIENCE] Provedor ${item.provider}:${item.model} falhou definitivamente. Tentando próximo...`);
    }
  }

  // If all failed, return a graceful fallback message
  return {
    text: "⚠️ **Sistema Temporariamente Indisponível**: Todos os provedores de IA configurados falharam ou atingiram o limite de cota/circuit breaker. Por favor, tente novamente em alguns instantes.",
    provider: 'gemini',
    modelUsed: 'fallback-error',
    isAlternative: true,
    latencyMs: 0,
    attempts: attemptsTotal,
    fallbackUsed: true
  };
}

export async function generateImageWithResilience(
  options: AIRequestOptions,
  aiClient: GoogleGenAI
): Promise<AIResponseResult> {
  const category = 'image_generation';
  const models = getSortedModelsForCategory(category, false, false);

  if (models.length === 0) {
    throw new Error("Nenhum provedor de imagem disponível.");
  }

  let lastError: any = null;
  let attemptsTotal = 0;

  for (let i = 0; i < models.length; i++) {
    const item = models[i];
    
    const currentQuota = (await import('./quotaManager')).getProviderQuota(item.provider);
    if (currentQuota.status === 'exhausted') continue;

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
        () => callProviderAdapter(item.provider, item.model, { ...options, category }, aiClient),
        item.maxRetries || 1,
        1000,
        () => { attemptsTotal += 1; }
      );

      return {
        ...result,
        attempts: attemptsTotal + attempts,
        fallbackUsed: i > 0
      };

    } catch (err: any) {
      lastError = err;
      console.error(`[IMAGE RESILIENCE] Provedor ${item.provider}:${item.model} FALHOU: ${err.message}`);
    }
  }

  throw lastError || new Error("Falha ao gerar imagem com todos os provedores.");
}

