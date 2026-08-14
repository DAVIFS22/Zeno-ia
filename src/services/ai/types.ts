export type AICategory = 'general' | 'think' | 'code' | 'speed' | 'search' | 'image' | 'vision' | 'image_generation';

export type ProviderName = 'gemini' | 'openai' | 'anthropic' | 'deepseek' | 'mistral' | 'llama' | 'groq' | 'openrouter' | 'replicate';

export interface AIProviderModelConfig {
  provider: ProviderName;
  model: string;
  enabled: boolean;
  priority: number; // Higher number = higher priority
  maxRetries: number;
  timeoutMs: number;
  supportsVision?: boolean;
}

export interface AIRequestOptions {
  contents: any[];
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  tools?: any[];
  isSearchIntent?: boolean;
  hasImages?: boolean;
  category?: AICategory;
  imageOptions?: {
    prompt: string;
    aspectRatio?: string;
    imageSize?: string;
    style?: string;
    negativePrompt?: string;
    seed?: number;
  };
  userGeminiApiKey?: string;
  userId?: string;
  userPlan?: string;
}

export interface AIResponseResult {
  text: string;
  imageUrl?: string;
  provider: ProviderName;
  modelUsed: string;
  isAlternative: boolean;
  sources?: Array<{ title: string; url: string; domain: string }>;
  groundingMetadata?: any;
  functionCalls?: any[];
  latencyMs: number;
  tokensUsed?: number;
  attempts: number;
  fallbackUsed: boolean;
}

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface ProviderMetrics {
  requests: number;
  successes: number;
  errors: number;
  rateLimits429: number;
  timeouts: number;
  totalLatencyMs: number;
  lastFailureTimestamp?: number;
  lastSuccessTimestamp?: number;
  lastError?: string;
  retriesCount: number;
  fallbacksCount: number;
  tokensConsumed: number;
}

export type QuotaStatus = 'normal' | 'attention' | 'reduce_priority' | 'avoid' | 'exhausted' | 'billing_error' | 'rate_limited';

export interface ProviderQuotaInfo {
  requestLimit: number;
  requestsUsed: number;
  tokenLimit: number;
  tokensUsed: number;
  remainingPercentage: number;
  resetTimestamp: number;
  status: QuotaStatus;
  lastError?: string;
  errorTimestamp?: number;
}
