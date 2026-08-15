import { GoogleGenAI } from "@google/genai";
import { generateTextWithResilience, generateImageWithResilience } from "./ai/fallbackManager";
import { routingConfig as baseRoutingConfig } from "./ai/modelRouter";
import { startHealthCheckLoop as startHc } from "./ai/healthManager";
import { AIRequestOptions } from "./ai/types";

export interface AIProviderOptions {
  contents: any[];
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  tools?: any[];
  isSearchIntent?: boolean;
  hasImages?: boolean;
  category?: 'general' | 'think' | 'code' | 'speed' | 'search' | 'image' | 'vision' | 'image_generation';
  isThinkingMode?: boolean;
  userRequestedModel?: string;
  imageOptions?: {
    prompt: string;
    aspectRatio?: string;
    imageSize?: string;
    style?: string;
    negativePrompt?: string;
    seed?: number;
    speedMode?: string;
  };
  userGeminiApiKey?: string;
  userId?: string;
  userPlan?: string;
}

export interface AIProviderResult {
  text: string;
  thought?: string;
  imageUrl?: string;
  provider: 'gemini' | 'openai' | 'groq' | 'openrouter' | 'replicate' | 'xai' | 'grok';
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
  image: baseRoutingConfig.image.map(m => ({ provider: m.provider, model: m.model })),
  vision: baseRoutingConfig.vision.map(m => ({ provider: m.provider, model: m.model })),
  image_generation: baseRoutingConfig.image_generation.map(m => ({ provider: m.provider, model: m.model }))
};

export function startHealthCheckLoop() {
  startHc();
}

export async function generateTextWithFallback(
  options: AIProviderOptions
): Promise<AIProviderResult> {
  const result = await generateTextWithResilience(options as any);
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

export async function generateImageWithFallback(
  options: AIProviderOptions
): Promise<AIProviderResult> {
  const result = await generateImageWithResilience(options as any);
  return {
    text: result.text,
    imageUrl: result.imageUrl,
    provider: result.provider as any,
    modelUsed: result.modelUsed,
    isAlternative: result.isAlternative
  };
}
