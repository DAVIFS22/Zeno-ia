import { GoogleGenAI } from "@google/genai";

export interface AIProviderOptions {
  contents: any[];
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  tools?: any[];
  isSearchIntent?: boolean;
  category?: 'general' | 'think' | 'code' | 'speed' | 'search' | 'image';
}

export interface AIProviderResult {
  text: string;
  provider: 'gemini' | 'groq' | 'openrouter' | 'replicate';
  modelUsed: string;
  isAlternative: boolean;
  sources?: Array<{ title: string; url: string; domain: string }>;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ==========================================
// CONFIGURATION & CIRCUIT BREAKER
// ==========================================

export const routingConfig: Record<string, Array<{ provider: string, model: string }>> = {
  general: [
    { provider: 'gemini', model: 'gemini-3.6-flash' },
    { provider: 'groq', model: 'llama-3.3-70b-versatile' },
    { provider: 'openrouter', model: 'anthropic/claude-sonnet-5' },
    { provider: 'openrouter', model: 'mistralai/mistral-large' },
    { provider: 'openrouter', model: 'google/gemini-3.6-flash' },
    { provider: 'openrouter', model: 'openrouter/free' }
  ],
  think: [
    { provider: 'openrouter', model: 'anthropic/claude-opus-5' },
    { provider: 'groq', model: 'llama-3.3-70b-versatile' },
    { provider: 'openrouter', model: 'deepseek/deepseek-chat' },
    { provider: 'openrouter', model: 'google/gemini-3.1-pro-preview' },
    { provider: 'gemini', model: 'gemini-3.1-pro-preview' },
    { provider: 'openrouter', model: 'openrouter/free' }
  ],
  code: [
    { provider: 'openrouter', model: 'anthropic/claude-sonnet-5' },
    { provider: 'groq', model: 'llama-3.3-70b-versatile' },
    { provider: 'openrouter', model: 'deepseek/deepseek-chat' },
    { provider: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct' },
    { provider: 'gemini', model: 'gemini-3.6-flash' },
    { provider: 'openrouter', model: 'openrouter/free' }
  ],
  speed: [
    { provider: 'groq', model: 'llama-3.3-70b-versatile' },
    { provider: 'groq', model: 'llama-3.1-8b-instant' },
    { provider: 'gemini', model: 'gemini-3.6-flash' },
    { provider: 'openrouter', model: 'openrouter/free' }
  ],
  search: [
    { provider: 'gemini', model: 'gemini-3.6-flash' }, 
    { provider: 'openrouter', model: 'deepseek/deepseek-chat' },
    { provider: 'groq', model: 'llama-3.3-70b-versatile' },
    { provider: 'openrouter', model: 'google/gemini-3.6-flash' },
    { provider: 'openrouter', model: 'openrouter/free' }
  ],
  image: [
    { provider: 'replicate', model: 'black-forest-labs/flux-schnell' },
    { provider: 'openrouter', model: 'gryphe/mythomax-l2-13b' },
    { provider: 'gemini', model: 'gemini-3.6-flash' },
    { provider: 'openrouter', model: 'openrouter/free' }
  ]
};

interface CircuitBreakerState {
  failures: number;
  cooldownUntil: number;
}
const providerStatus: Record<string, CircuitBreakerState> = {};
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutos de cooldown

function isProviderAvailable(key: string): boolean {
  const state = providerStatus[key];
  if (!state) return true;
  if (state.failures >= 3 && Date.now() < state.cooldownUntil) {
    return false;
  }
  // Se o cooldown expirou, podemos tentar de novo
  return true;
}

function recordSuccess(key: string) {
  providerStatus[key] = { failures: 0, cooldownUntil: 0 };
}

function recordFailure(key: string) {
  const state = providerStatus[key] || { failures: 0, cooldownUntil: 0 };
  state.failures += 1;
  if (state.failures >= 3) {
    state.cooldownUntil = Date.now() + COOLDOWN_MS;
    console.warn(`[CIRCUIT BREAKER] ${key} offline (cooldown 5m). Fails: ${state.failures}`);
  }
  providerStatus[key] = state;
}

let isHealthCheckRunning = false;

export function startHealthCheckLoop(aiClient: GoogleGenAI) {
  if (isHealthCheckRunning) return;
  isHealthCheckRunning = true;

  const interval = 3 * 60 * 1000; // a cada 3 minutos

  async function runChecks() {
    console.log("[HEALTH CHECK] Iniciando verificação de saúde dos provedores em background...");
    
    // Obter todos os provedores/modelos únicos usados nas rotas
    const uniqueModels = new Set<string>();
    Object.values(routingConfig).forEach(list => {
      list.forEach(item => uniqueModels.add(`${item.provider}:${item.model}`));
    });

    for (const key of uniqueModels) {
      const [provider, model] = key.split(':');
      try {
        const startTime = Date.now();
        
        // Chamada mínima para testar a saúde
        if (provider === 'gemini') {
            if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY faltando");
            await aiClient.models.generateContent({
              model,
              contents: ["1"],
              config: { maxOutputTokens: 1 }
            });
        } else if (provider === 'groq' || provider === 'openrouter') {
           const apiKey = provider === 'groq' ? process.env.GROQ_API_KEY : process.env.OPENROUTER_API_KEY;
           if (!apiKey) throw new Error("API KEY faltando");
           const url = provider === 'groq' ? "https://api.groq.com/openai/v1/chat/completions" : "https://openrouter.ai/api/v1/chat/completions";
           await callOpenAiCompatible(url, apiKey, model, [{role: 'user', content: '1'}], 0.7, 1);
        } else if (provider === 'replicate') {
           if (!process.env.REPLICATE_API_KEY) throw new Error("REPLICATE_API_KEY faltando");
        }
        
        recordSuccess(key);
        console.log(`[HEALTH CHECK] ${key} está ONLINE (${Date.now() - startTime}ms)`);
      } catch (err: any) {
        recordFailure(key);
        let errorMsg = err.message || String(err);
        if (errorMsg.includes('402') && errorMsg.includes('credits')) {
           errorMsg = 'Limite de creditos atingido ou max_tokens muito alto (402).';
        } else if (errorMsg.length > 200) {
           errorMsg = errorMsg.substring(0, 200) + '...';
        }
        console.log(`[HEALTH CHECK] ${key} esta OFFLINE ou FALHANDO: ${errorMsg.replace(/error/gi, 'falha')}`);
      }
      await sleep(500); // pequeno atraso para evitar rate limits
    }
  }

  // Iniciar a primeira verificação após 10 segundos
  setTimeout(runChecks, 10000);
  setInterval(runChecks, interval);
}

// ==========================================
// FALLBACK GENERATOR
// ==========================================

export async function generateTextWithFallback(
  options: AIProviderOptions,
  aiClient: GoogleGenAI
): Promise<AIProviderResult> {
  const { 
    contents, 
    systemInstruction, 
    temperature = 0.7, 
    maxOutputTokens = 2048, 
    tools, 
    isSearchIntent,
    category = 'general'
  } = options;

  const modelsToTry = routingConfig[category] || routingConfig.general;
  let lastError: any = null;

  for (const item of modelsToTry) {
    const key = `${item.provider}:${item.model}`;
    const reqStartTime = Date.now();
    
    // 1. Verificar Circuit Breaker
    if (!isProviderAvailable(key)) {
      console.log(`[AI ROUTING] Ignorando ${key} devido a falhas recentes (Cooldown ativo)`);
      continue;
    }

    try {
      const hasKey = item.provider === 'gemini' ? !!process.env.GEMINI_API_KEY : 
                    item.provider === 'groq' ? !!process.env.GROQ_API_KEY :
                    item.provider === 'openrouter' ? !!process.env.OPENROUTER_API_KEY :
                    item.provider === 'replicate' ? !!process.env.REPLICATE_API_KEY : true;

      console.log(`[AI ROUTING] Tentando categoria: ${category} | provedor: ${item.provider} | modelo: ${item.model}`);
      
      if (!hasKey) {
        throw new Error("API KEY ausente para o provedor");
      }

      if (item.provider === 'gemini') {
        const config: any = {
          systemInstruction,
          temperature,
          maxOutputTokens,
        };
        if (isSearchIntent && tools) {
          config.tools = tools;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 segundos de timeout p/ fallback rápido

        const response = await aiClient.models.generateContent({
          model: item.model,
          contents,
          config,
        });
        clearTimeout(timeoutId);

        const text = response.text || "";
        if (text) {
          const tempo = Date.now() - reqStartTime;
          console.log(`[AI SUCCESS] provedor: gemini | modelo: ${item.model} | tempo: ${tempo}ms`);
          recordSuccess(key);

          // Extract grounding sources if available
          let sources: Array<{ title: string; url: string; domain: string }> = [];
          if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
            sources = response.candidates[0].groundingMetadata.groundingChunks.map((chunk: any) => {
               if (chunk.web?.uri) {
                  return {
                     title: chunk.web.title || new URL(chunk.web.uri).hostname,
                     url: chunk.web.uri,
                     domain: new URL(chunk.web.uri).hostname.replace(/^www\./, ''),
                     publishedDate: chunk.web.publishedDate || undefined,
                     updatedDate: chunk.web.updatedDate || undefined
                  };
               }
               return null;
            }).filter(Boolean);
          }

          return {
            text,
            provider: 'gemini',
            modelUsed: item.model,
            isAlternative: false,
            sources: sources.length > 0 ? sources : undefined
          };
        }
      }

      if (item.provider === 'groq') {
        const apiKey = process.env.GROQ_API_KEY!;
        const messages = prepareOpenAiMessages(contents, systemInstruction);
        const res = await callOpenAiCompatible(
          "https://api.groq.com/openai/v1/chat/completions",
          apiKey,
          item.model,
          messages,
          temperature,
          maxOutputTokens
        );

        if (res) {
          const tempo = Date.now() - reqStartTime;
          console.log(`[AI SUCCESS] provedor: groq | modelo: ${item.model} | tempo: ${tempo}ms`);
          recordSuccess(key);
          return {
            text: res,
            provider: 'groq',
            modelUsed: item.model,
            isAlternative: true
          };
        }
      }

      if (item.provider === 'openrouter') {
        const apiKey = process.env.OPENROUTER_API_KEY!;
        const messages = prepareOpenAiMessages(contents, systemInstruction);
        const res = await callOpenAiCompatible(
          "https://openrouter.ai/api/v1/chat/completions",
          apiKey,
          item.model,
          messages,
          temperature,
          maxOutputTokens,
          { "HTTP-Referer": "https://ais-dev.run.app", "X-Title": "ZENO AI" }
        );

        if (res) {
          const tempo = Date.now() - reqStartTime;
          console.log(`[AI SUCCESS] provedor: openrouter | modelo: ${item.model} | tempo: ${tempo}ms`);
          recordSuccess(key);
          return {
            text: res,
            provider: 'openrouter',
            modelUsed: item.model,
            isAlternative: true
          };
        }
      }

    } catch (err: any) {
      lastError = err;
      const tempo = Date.now() - reqStartTime;
      let errorMsg = err?.message || String(err);
      if (errorMsg.includes('402') && errorMsg.includes('credits')) {
         errorMsg = 'Limite de creditos atingido ou max_tokens muito alto (402).';
      } else if (errorMsg.length > 200) {
         errorMsg = errorMsg.substring(0, 200) + '...';
      }
      console.warn(`[AI FALLBACK] Falha no provedor ${key} após ${tempo}ms. Motivo:`, errorMsg.replace(/error/gi, 'falha'));
      recordFailure(key);
      await sleep(100); // Pular rapidamente para o próximo sem muito delay
    }
  }

  throw lastError || new Error("Falha ao processar requisição em todos os modelos disponíveis.");
}

function prepareOpenAiMessages(contents: any[], systemInstruction?: string) {
  const messages: Array<{ role: string; content: string }> = [];
  if (systemInstruction) {
    messages.push({ role: "system", content: systemInstruction });
  }

  for (const c of contents) {
    let role = c.role === 'model' ? 'assistant' : 'user';
    let textPart = "";
    if (Array.isArray(c.parts)) {
      textPart = c.parts.map((p: any) => p.text || "").filter(Boolean).join("\n");
    } else if (typeof c === 'string') {
      textPart = c;
    }
    if (textPart) {
      messages.push({ role, content: textPart });
    }
  }
  return messages;
}

async function callOpenAiCompatible(
  url: string,
  apiKey: string,
  model: string,
  messages: any[],
  temperature: number,
  max_tokens: number,
  extraHeaders: Record<string, string> = {}
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s de timeout máximo (Fast Fallback)

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      ...extraHeaders
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: Math.max(max_tokens, 16)
    }),
    signal: controller.signal
  });
  clearTimeout(timeoutId);

  if (res.ok) {
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  }
  
  const errText = await res.text();
  throw new Error(`API Error (${res.status}): ${errText}`);
}
