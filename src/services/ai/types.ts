export type AICategory = 'general' | 'think' | 'code' | 'speed' | 'search' | 'image';

export type ProviderName = 'gemini' | 'openai' | 'anthropic' | 'deepseek' | 'mistral' | 'llama' | 'groq' | 'openrouter' | 'replicate';

export interface AIProviderModelConfig {
  provider: ProviderName;
  model: string;
  enabled: boolean;
  priority: number; // Higher number = higher priority
  maxRetries: number;
  timeoutMs: number;
}

export interface AIRequestOptions {
  contents: any[];
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  tools?: any[];
  isSearchIntent?: boolean;
  category?: AICategory;
  userGeminiApiKey?: string;
  userId?: string;
  userPlan?: string;
}

export interface AIResponseResult {
  text: string;
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

export interface ProviderQuotaInfo {
  requestLimit: number;
  requestsUsed: number;
  tokenLimit: number;
  tokensUsed: number;
  remainingPercentage: number;
  resetTimestamp: number;
  status: 'normal' | 'attention' | 'reduce_priority' | 'avoid' | 'exhausted';
}
