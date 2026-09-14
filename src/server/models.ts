import { GoogleGenAI } from "@google/genai";

let availableModelsCache: any[] = [];
let lastModelFetch = 0;

export async function getAvailableModels() {
  const now = Date.now();
  if (availableModelsCache.length > 0 && now - lastModelFetch < 300000) {
    return availableModelsCache;
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey || apiKey === 'dummy_key') {
      console.warn('[MODELS] Skipping model list: No valid API key configured.');
      return [];
    }
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.list();
    const models = [];
    for await (const model of response) {
      models.push(model);
    }
    availableModelsCache = models;
    lastModelFetch = now;
    return availableModelsCache;
  } catch (err: any) {
    console.error('[MODELS ERROR] Failed to list models:', err.message);
    return [];
  }
}

export async function smartSelectModel(taskType: string, isPro: boolean = false) {
  if (taskType === 'think' || taskType === 'code' || taskType === 'vision' || isPro) {
    return 'gemini-1.5-pro';
  }
  return 'gemini-1.5-flash';
}
