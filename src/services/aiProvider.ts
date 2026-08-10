import { GoogleGenAI } from "@google/genai";
import { sanitizeResponseText } from "../utils/imageSecurity";
import { generateTextWithResilience } from "./ai/fallbackManager";
import { routingConfig as baseRoutingConfig } from "./ai/modelRouter";
import { startHealthCheckLoop as startHc } from "./ai/healthManager";

export interface AIProviderOptions {
  contents: any[];
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  tools?: any[];
  isSearchIntent?: boolean;
  category?: 'general' | 'think' | 'code' | 'speed' | 'search' | 'image';
  userGeminiApiKey?: string;
  userId?: string;
  userPlan?: string;
}

export interface AIProviderResult {
  text: string;
  provider: 'gemini' | 'openai' | 'groq' | 'openrouter' | 'replicate';
  modelUsed: string;
  isAlternative: boolean;
  sources?: Array<{ title: string; url: string; domain: string }>;
  groundingMetadata?: any;
  functionCalls?: any[];
}

// Map baseRoutingConfig to legacy format expected by existing callers
export const routingConfig: Record<string, Array<{ provider: string, model: string }>> = {
  general: baseRoutingConfig.general.map(m => ({ provider: m.provider, model: m.model })),
  think: baseRoutingConfig.think.map(m => ({ provider: m.provider, model: m.model })),
  code: baseRoutingConfig.code.map(m => ({ provider: m.provider, model: m.model })),
  speed: baseRoutingConfig.speed.map(m => ({ provider: m.provider, model: m.model })),
  search: baseRoutingConfig.search.map(m => ({ provider: m.provider, model: m.model })),
  image: baseRoutingConfig.image.map(m => ({ provider: m.provider, model: m.model }))
};

export function startHealthCheckLoop(aiClient: GoogleGenAI) {
  startHc(aiClient);
}

export async function generateTextWithFallback(
  options: AIProviderOptions,
  aiClient: GoogleGenAI
): Promise<AIProviderResult> {
  const result = await generateTextWithResilience(options, aiClient);
  return {
    text: result.text,
    provider: result.provider as any,
    modelUsed: result.modelUsed,
    isAlternative: result.isAlternative,
    sources: result.sources,
    groundingMetadata: result.groundingMetadata,
    functionCalls: result.functionCalls
  };
}
