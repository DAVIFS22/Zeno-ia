import { GoogleGenAI } from "@google/genai";
import { sanitizeResponseText } from "../utils/imageSecurity";

export interface AIProviderOptions {
  contents: any[];
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  tools?: any[];
  isSearchIntent?: boolean;
  category?: 'general' | 'think' | 'code' | 'speed' | 'search' | 'image';
  userGeminiApiKey?: string;
}

export interface AIProviderResult {
  text: string;
  provider: 'gemini' | 'groq' | 'openrouter' | 'replicate';
  modelUsed: string;
  isAlternative: boolean;
  sources?: Array<{ title: string; url: string; domain: string }>;
  groundingMetadata?: any;
  functionCalls?: any[];
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ==========================================
// CONFIGURATION & CIRCUIT BREAKER
// ==========================================

export const routingConfig: Record<string, Array<{ provider: string, model: string }>> = {
  general: [
    { provider: 'gemini', model: 'gemini-1.5-flash' },
    { provider: 'openrouter', model: 'google/gemini-1.5-flash' },
    { provider: 'groq', model: 'llama-3.3-70b-versatile' },
    { provider: 'openrouter', model: 'anthropic/claude-3.5-sonnet' },
    { provider: 'openrouter', model: 'mistralai/mistral-large' },
    { provider: 'openrouter', model: 'openrouter/free' }
  ],
  think: [
    { provider: 'gemini', model: 'gemini-1.5-flash' },
    { provider: 'openrouter', model: 'anthropic/claude-3-opus' },
    { provider: 'groq', model: 'llama-3.3-70b-versatile' },
    { provider: 'openrouter', model: 'deepseek/deepseek-chat' },
    { provider: 'openrouter', model: 'google/gemini-3.1-pro-preview' },
    { provider: 'openrouter', model: 'openrouter/free' }
  ],
  code: [
    { provider: 'gemini', model: 'gemini-1.5-flash' },
    { provider: 'openrouter', model: 'anthropic/claude-3.5-sonnet' },
    { provider: 'groq', model: 'llama-3.3-70b-versatile' },
    { provider: 'openrouter', model: 'deepseek/deepseek-chat' },
    { provider: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct' },
    { provider: 'openrouter', model: 'openrouter/free' }
  ],
  speed: [
    { provider: 'gemini', model: 'gemini-1.5-flash' },
    { provider: 'groq', model: 'llama-3.3-70b-versatile' },
    { provider: 'openrouter', model: 'google/gemini-1.5-flash' },
    { provider: 'openrouter', model: 'openrouter/free' }
  ],
  search: [
    { provider: 'gemini', model: 'gemini-1.5-flash' }, 
    { provider: 'openrouter', model: 'google/gemini-1.5-flash' },
    { provider: 'openrouter', model: 'deepseek/deepseek-chat' },
    { provider: 'groq', model: 'llama-3.3-70b-versatile' },
    { provider: 'openrouter', model: 'openrouter/free' }
  ],
  image: [
    { provider: 'replicate', model: 'black-forest-labs/flux-schnell' },
    { provider: 'openrouter', model: 'google/gemini-1.5-flash' },
    { provider: 'gemini', model: 'gemini-1.5-flash' },
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

function recordFailure(key: string, isRateLimit = false) {
  const state = providerStatus[key] || { failures: 0, cooldownUntil: 0 };
  state.failures += 1;
  
  if (isRateLimit || state.failures >= 3) {
    // Se for rate limit, esfriamos imediatamente por mais tempo
    const duration = isRateLimit ? 20 * 60 * 1000 : COOLDOWN_MS; // 20 min para rate limit
    state.cooldownUntil = Date.now() + duration;
    state.failures = Math.max(state.failures, 3); // Garante que entre no estado de falha
    console.warn(`[CIRCUIT BREAKER] ${key} offline (cooldown ${duration/60000}m). Motivo: ${isRateLimit ? 'Rate Limit' : 'Múltiplas falhas'}`);
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
            if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'dummy_key') {
               throw new Error("GEMINI_API_KEY ausente ou inválida (dummy)");
            }
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

  // Add dynamic anti-hallucination instruction if search intent is active
  if (isSearchIntent) {
    contents.push({
      role: 'user',
      parts: [{ text: "[SISTEMA]: Você está no modo de pesquisa. Se a ferramenta de busca retornar resultados, use-os. Se não houver resultados da ferramenta, admita que não encontrou informações recentes. NUNCA mencione veículos de imprensa ou sites (ex: CNN Brasil, Estadão, G1) a menos que eles estejam explicitamente nos dados de busca retornados. Não invente citações." }]
    });
  }

  for (const item of modelsToTry) {
    const key = `${item.provider}:${item.model}`;
    const reqStartTime = Date.now();
    
    // 1. Verificar Circuit Breaker
    if (!isProviderAvailable(key)) {
      console.log(`[AI ROUTING] Ignorando ${key} devido a falhas recentes (Cooldown ativo)`);
      continue;
    }

    // 2. Se for intenção de busca, verificar se o modelo suporta ou se devemos tentar fallback
    // Por enquanto, apenas o provedor 'gemini' nativo aqui suporta grounding metadata
    if (isSearchIntent && item.provider !== 'gemini') {
      console.log(`[AI ROUTING] Pulando ${key} para busca - provedor não suporta Grounding Metadata nativo`);
      continue;
    }

    try {
      const hasKey = item.provider === 'gemini' ? true : 
                    item.provider === 'groq' ? !!process.env.GROQ_API_KEY :
                    item.provider === 'openrouter' ? !!process.env.OPENROUTER_API_KEY :
                    item.provider === 'replicate' ? !!process.env.REPLICATE_API_KEY : true;

      console.log(`[AI ROUTING] Tentando categoria: ${category} | provedor: ${item.provider} | modelo: ${item.model}`);
      
      if (!hasKey) {
        console.log(`[AI ROUTING] Pulando ${key}: API KEY ausente para o provedor ${item.provider}`);
        continue;
      }

      if (item.provider === 'gemini') {
        const generationConfig = {
          temperature: temperature || 0.7,
          maxOutputTokens: maxOutputTokens || 1024,
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        try {
          console.log(`[AI Provider] Calling Gemini (${item.model}). Tools: ${tools?.length || 0}`);
          
          // Use user-provided API key if available for Gemini
          let effectiveClient = aiClient;
          if (options.userGeminiApiKey && options.userGeminiApiKey.trim().length > 10) {
            console.log(`[AI Provider] Using user-provided Gemini API Key for request.`);
            effectiveClient = new GoogleGenAI({ apiKey: options.userGeminiApiKey.trim() });
          }
          
          const response = await Promise.race([
            effectiveClient.models.generateContent({
              model: item.model,
              contents,
              config: {
                tools: tools && tools.length > 0 ? tools : undefined,
                systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
                temperature: temperature || 0.7,
                maxOutputTokens: maxOutputTokens || 1024,
              }
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout Gemini SDK")), 25000))
          ]) as any;
clearTimeout(timeoutId);

          // Safe text extraction
          let text = "";
          try {
            if ((response as any).text) {
              text = (response as any).text;
            } else if ((response as any).candidates?.[0]?.content?.parts?.[0]?.text) {
              text = (response as any).candidates[0].content.parts[0].text;
            }
          } catch (e: any) {
            console.warn("[AI Provider] Text extraction failed:", e.message);
          }

          const fCalls = (response as any).functionCalls || [];

          if (text || (fCalls && fCalls.length > 0)) {
            const tempo = Date.now() - reqStartTime;
            console.log(`[AI SUCCESS] provedor: gemini | modelo: ${item.model} | tempo: ${tempo}ms | fCalls: ${fCalls.length}`);
            recordSuccess(key);

            // Extract grounding sources
            let sources: Array<{ title: string; url: string; domain: string }> = [];
            const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
            if (groundingMetadata && groundingMetadata.groundingChunks) {
              sources = groundingMetadata.groundingChunks.map((chunk: any) => {
                if (chunk.web?.uri) {
                  return {
                    title: chunk.web.title || new URL(chunk.web.uri).hostname,
                    url: chunk.web.uri,
                    domain: new URL(chunk.web.uri).hostname.replace(/^www\./, ''),
                  };
                }
                return null;
              }).filter(Boolean);
            }

            const sanitizedText = sanitizeResponseText(text, category === 'image');

            return {
              text: sanitizedText,
              provider: 'gemini',
              modelUsed: item.model,
              isAlternative: false,
              sources: sources.length > 0 ? sources : undefined,
              groundingMetadata,
              functionCalls: fCalls
            };
          }
        } catch (geminiErr: any) {
          clearTimeout(timeoutId);
          
          let errorBody: any = {};
          try {
            if (geminiErr.message && geminiErr.message.includes('{')) {
              const jsonStart = geminiErr.message.indexOf('{');
              const jsonStr = geminiErr.message.substring(jsonStart);
              errorBody = JSON.parse(jsonStr);
            }
          } catch (e) {}

          const isInvalidKey = 
            geminiErr.message?.includes('API_KEY_INVALID') || 
            geminiErr.message?.includes('API key not valid') || 
            errorBody?.error?.message?.includes('API key not valid') ||
            errorBody?.error?.status === 'INVALID_ARGUMENT';

          const isQuota = 
            geminiErr.message?.includes('429') || 
            geminiErr.message?.includes('QUOTA') || 
            geminiErr.message?.includes('RESOURCE_EXHAUSTED') ||
            errorBody?.error?.status === 'RESOURCE_EXHAUSTED';

          if (!isInvalidKey && !isQuota) {
            console.error(`[AI Provider] Gemini API Error (${item.model}):`, {
              message: geminiErr.message,
              status: geminiErr.status,
              code: geminiErr.code,
              details: geminiErr.details,
              stack: geminiErr.stack ? (geminiErr.stack.split('\n')[1] || geminiErr.stack) : 'no stack'
            });
          } else {
            console.log(`[AI Provider] Gemini ${isInvalidKey ? 'Auth' : 'Quota'} issue (${item.model}): ${isInvalidKey ? 'Invalid API Key' : 'Rate Limit/Quota'}`);
          }

          recordFailure(key, isQuota);
          lastError = geminiErr;
          continue; // Try next model in list
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
            text: sanitizeResponseText(res, category === 'image'),
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
            text: sanitizeResponseText(res, category === 'image'),
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
      
      const isRateLimit = errorMsg.includes('429') || errorMsg.toLowerCase().includes('rate limit') || errorMsg.toLowerCase().includes('quota') || errorMsg.toLowerCase().includes('credits');
      
      if (errorMsg.includes('402') && errorMsg.includes('credits')) {
         errorMsg = 'Limite de creditos atingido ou max_tokens muito alto (402).';
      } else if (errorMsg.length > 200) {
         errorMsg = errorMsg.substring(0, 200) + '...';
      }
      
      console.warn(`[AI FALLBACK] Falha no provedor ${key} após ${tempo}ms. Motivo:`, errorMsg.replace(/error/gi, 'falha'));
      recordFailure(key, isRateLimit);
      await sleep(100); // Pular rapidamente para o próximo sem muito delay
    }
  }

  let isInvalidKey = false;
  let isQuota = false;

  if (lastError) {
    let errorBody: any = {};
    try {
      if (lastError.message && lastError.message.includes('{')) {
        const jsonStart = lastError.message.indexOf('{');
        const jsonStr = lastError.message.substring(jsonStart);
        errorBody = JSON.parse(jsonStr);
      }
    } catch (e) {}

    isInvalidKey = 
      lastError.message?.includes('API_KEY_INVALID') || 
      lastError.message?.includes('API key not valid') || 
      lastError.message?.includes('INVALID_ARGUMENT') ||
      errorBody?.error?.message?.includes('API key not valid') ||
      errorBody?.error?.status === 'INVALID_ARGUMENT' ||
      String(lastError.status) === '400' ||
      String(lastError.code) === '400';

    isQuota = 
      lastError.message?.includes('429') || 
      lastError.message?.includes('QUOTA') || 
      lastError.message?.includes('RESOURCE_EXHAUSTED') ||
      lastError.message?.includes('resource_exhausted') ||
      errorBody?.error?.status === 'RESOURCE_EXHAUSTED';
  }

  if (isInvalidKey) {
    return {
      text: "⚠️ **Configuração de API Necessária**: A chave de API fornecida é inválida ou ausente. Para interagir com o ZENO IA, configure uma `GEMINI_API_KEY` válida no painel de configurações ou nas variáveis de ambiente.",
      provider: 'gemini',
      modelUsed: 'fallback',
      isAlternative: true
    };
  }

  if (isQuota) {
    return {
      text: "⚠️ **Cota de API Exaurida / Rate Limit**: O limite de uso da API (quota/rate limit) foi atingido. Por favor, aguarde alguns minutos ou configure uma chave de API alternativa nas configurações.",
      provider: 'gemini',
      modelUsed: 'fallback',
      isAlternative: true
    };
  }

  throw lastError || new Error("Falha ao processar requisição em todos os modelos disponíveis.");
}

function prepareOpenAiMessages(contents: any[], systemInstruction?: string) {
  const messages: Array<{ role: string; content: string }> = [];
  let baseSystem = systemInstruction || "Você é o ZENO AI, assistente inteligente.";
  baseSystem += "\n\n[REGRA CRÍTICA DE MÍDIA]: Você NUNCA deve gerar links de imagem, URLs de serviços de geração de imagem (como pollinations.ai ou qualquer domínio externo), nem utilizar tags markdown de imagem (![alt](url)) ou HTML (<img ...>) em suas respostas. Se o usuário pedir uma imagem, informe em texto para usar a ferramenta 'Estúdio de Imagens' do ZENO.";

  messages.push({ role: "system", content: baseSystem });

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
  const timeoutId = setTimeout(() => controller.abort(), 20000); // Aumentado para 20s para evitar "signal is aborted without reason" em modelos lentos

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
