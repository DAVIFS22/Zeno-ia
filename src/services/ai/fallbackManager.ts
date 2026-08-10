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
  const models = getSortedModelsForCategory(category, options.isSearchIntent);

  if (models.length === 0) {
    throw new Error("Nenhum provedor de IA disponível (todos em Circuit Open ou Cota Esgotada).");
  }

  let lastError: any = null;
  let attemptsTotal = 0;
  let fallbackCount = 0;

  for (let i = 0; i < models.length; i++) {
    const item = models[i];
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
