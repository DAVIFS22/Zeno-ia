import { GoogleGenAI } from "@google/genai";
import { AIRequestOptions, AIResponseResult, ProviderName } from './types';
import { recordCircuitSuccess, recordCircuitFailure } from './circuitBreaker';
import { recordQuotaUsage, setProviderQuotaExhausted } from './quotaManager';
import { recordMetricEvent } from './healthManager';
import { logAiEvent } from './logger';
import { incrementAiStat } from './metrics';
import { sanitizeResponseText } from '../../utils/imageSecurity';

const defaultAi = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || 'dummy_key',
  httpOptions: { headers: { 'User-Agent': 'zeno-ai-resilience' } }
});

export async function callProviderAdapter(
  provider: ProviderName,
  model: string,
  options: AIRequestOptions,
  aiClient: GoogleGenAI = defaultAi
): Promise<AIResponseResult> {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(2, 9);
  const key = `${provider}:${model}`;

  logAiEvent('REQUEST', { provider, model, requestId, userId: options.userId });

  try {
    let text = "";
    let sources: any[] = [];
    let groundingMetadata: any = null;
    let functionCalls: any[] = [];

    if (provider === 'gemini') {
      let client = aiClient;
      if (options.userGeminiApiKey && options.userGeminiApiKey.trim().length > 10) {
        client = new GoogleGenAI({ apiKey: options.userGeminiApiKey.trim() });
      }

      const response = await client.models.generateContent({
        model,
        contents: options.contents,
        config: {
          tools: options.tools && options.tools.length > 0 ? options.tools : undefined,
          systemInstruction: options.systemInstruction ? { parts: [{ text: options.systemInstruction }] } : undefined,
          temperature: options.temperature || 0.7,
          maxOutputTokens: options.maxOutputTokens || 1024,
        }
      });

      if ((response as any).text) {
        text = (response as any).text;
      } else if ((response as any).candidates?.[0]?.content?.parts?.[0]?.text) {
        text = response.candidates[0].content.parts[0].text;
      }

      functionCalls = (response as any).functionCalls || [];
      groundingMetadata = response.candidates?.[0]?.groundingMetadata;
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

    } else if (provider === 'openai' || provider === 'groq' || provider === 'openrouter') {
      const apiKey = provider === 'openai' ? process.env.OPENAI_API_KEY :
                     provider === 'groq' ? process.env.GROQ_API_KEY :
                     process.env.OPENROUTER_API_KEY;

      if (!apiKey) throw new Error(`API KEY faltando para o provedor ${provider}`);

      const url = provider === 'openai' ? 'https://api.openai.com/v1/chat/completions' :
                  provider === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' :
                  'https://openrouter.ai/api/v1/chat/completions';

      const messages = prepareOpenAiMessages(options.contents, options.systemInstruction);
      text = await callOpenAiCompatible(url, apiKey, model, messages, options.temperature || 0.7, options.maxOutputTokens || 1024, provider === 'openrouter' ? { 'HTTP-Referer': 'https://zeno.ai', 'X-Title': 'ZENO AI' } : {});
    } else {
      throw new Error(`Provedor ${provider} não suportado diretamente pelo adapter.`);
    }

    const sanitized = sanitizeResponseText(text, options.category === 'image');
    const latencyMs = Date.now() - startTime;
    const tokens = Math.round((sanitized.length / 4) + 100);

    recordCircuitSuccess(key);
    recordQuotaUsage(provider, tokens);
    recordMetricEvent(key, true, latencyMs, false, false, tokens);
    incrementAiStat('requestsToday', 1);
    incrementAiStat('tokensUsedToday', tokens);
    logAiEvent('SUCCESS', { provider, model, requestId, latency: latencyMs });

    return {
      text: sanitized,
      provider,
      modelUsed: model,
      isAlternative: provider !== 'gemini',
      sources: sources.length > 0 ? sources : undefined,
      groundingMetadata,
      functionCalls: functionCalls.length > 0 ? functionCalls : undefined,
      latencyMs,
      tokensUsed: tokens,
      attempts: 1,
      fallbackUsed: false
    };

  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    const msg = err?.message || String(err);
    const is429 = msg.includes('429') || msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('resource_exhausted');
    const isTimeout = msg.includes('timeout') || msg.includes('aborted');

    recordCircuitFailure(key, is429);
    if (is429) {
      setProviderQuotaExhausted(provider);
    }
    recordMetricEvent(key, false, latencyMs, is429, isTimeout, 0, false, false, msg);
    incrementAiStat('errorsToday', 1);
    logAiEvent('ERROR', { provider, model, requestId, error: msg, retry: true, attempt: 1 });

    throw err;
  }
}

function prepareOpenAiMessages(contents: any[], systemInstruction?: string) {
  const messages: Array<{ role: string; content: string }> = [];
  let baseSystem = systemInstruction || "Você é o ZENO AI, assistente inteligente.";
  baseSystem += "\n\n[REGRA CRÍTICA DE MÍDIA]: Você NUNCA deve gerar links de imagem, URLs de serviços externos nem tags markdown de imagem. Se o usuário pedir imagem, informe para usar o Estúdio de Imagens do ZENO.";

  messages.push({ role: 'system', content: baseSystem });
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
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
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
