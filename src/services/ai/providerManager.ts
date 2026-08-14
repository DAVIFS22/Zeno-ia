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

    if (options.category === 'image_generation') {
      if (provider === 'gemini') {
        let client = aiClient;
        if (options.userGeminiApiKey && options.userGeminiApiKey.trim().length > 10) {
          client = new GoogleGenAI({ apiKey: options.userGeminiApiKey.trim() });
        }

        const imgConfig = options.imageOptions || { prompt: '' };
        const response = await (client as any).models.generateContent({
          model,
          contents: [{ role: 'user', parts: [{ text: imgConfig.prompt }] }],
          config: {
            imageConfig: {
              aspectRatio: (imgConfig.aspectRatio as any) || "1:1",
              imageSize: (imgConfig.imageSize as any) || "1K"
            }
          }
        });

        const candidates = (response as any).candidates;
        const imagePart = candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
        
        if (imagePart?.inlineData?.data) {
          return {
            text: "Imagem gerada com sucesso via Gemini.",
            imageUrl: `data:${imagePart.inlineData.mimeType || 'image/png'};base64,${imagePart.inlineData.data}`,
            provider,
            modelUsed: model,
            isAlternative: false,
            latencyMs: Date.now() - startTime,
            attempts: 1,
            fallbackUsed: false
          };
        }
        throw new Error("Nenhuma imagem retornada pelo Gemini (Formato incompatível ou não retornado).");

      } else if (provider === 'openai') {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) throw new Error("OpenAI API key missing");

        const imgConfig = options.imageOptions || { prompt: '' };
        const size = imgConfig.aspectRatio === '16:9' ? '1792x1024' : imgConfig.aspectRatio === '9:16' ? '1024x1792' : '1024x1024';
        
        const res = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'dall-e-3',
            prompt: imgConfig.prompt,
            n: 1,
            size,
            quality: 'standard'
          })
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`OpenAI Image Error (${res.status}): ${errText}`);
        }

        const data = await res.json();
        const imageUrl = data.data?.[0]?.url;
        if (imageUrl) {
          return {
            text: "Imagem gerada com sucesso via OpenAI.",
            imageUrl,
            provider,
            modelUsed: model,
            isAlternative: true,
            latencyMs: Date.now() - startTime,
            attempts: 1,
            fallbackUsed: false
          };
        }
        throw new Error("Nenhuma URL de imagem retornada pela OpenAI.");
      } else if (provider === 'replicate') {
        // Simple fallback to pollinations for replicate if needed, or implement real replicate call
        const imgConfig = options.imageOptions || { prompt: '' };
        const width = imgConfig.aspectRatio === '16:9' ? 1280 : imgConfig.aspectRatio === '9:16' ? 720 : 1024;
        const height = imgConfig.aspectRatio === '16:9' ? 720 : imgConfig.aspectRatio === '9:16' ? 1280 : 1024;
        const seed = imgConfig.seed || Math.floor(Math.random() * 1000000);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(imgConfig.prompt)}?width=${width}&height=${height}&seed=${seed}&nologo=true&model=flux`;

        return {
          text: "Imagem gerada via Flux (Pollinations).",
          imageUrl,
          provider,
          modelUsed: model,
          isAlternative: true,
          latencyMs: Date.now() - startTime,
          attempts: 1,
          fallbackUsed: false
        };
      }
    }

    if (provider === 'gemini') {
      let client = aiClient;
      const isUserKey = options.userGeminiApiKey && options.userGeminiApiKey.trim().length > 10;
      if (isUserKey) {
        console.log(`[Gemini Adapter] Using user-provided API key for request ${requestId}`);
        client = new GoogleGenAI({ apiKey: options.userGeminiApiKey!.trim() });
      } else {
        console.log(`[Gemini Adapter] Using server-side API key for request ${requestId}`);
      }

      console.log(`[Gemini Adapter] Calling model: ${model} with contents:`, JSON.stringify(options.contents).substring(0, 500));

      const response = await (client as any).models.generateContent({
        model,
        contents: options.contents,
        config: {
          systemInstruction: options.systemInstruction ? { parts: [{ text: options.systemInstruction }] } : undefined,
          temperature: options.temperature || 0.7,
          maxOutputTokens: options.maxOutputTokens || 2048,
          tools: options.tools && options.tools.length > 0 ? options.tools : undefined,
        }
      });

      console.log(`[Gemini Adapter] Response received from ${model}`);

      text = (response as any).text || "";
      
      const candidates = (response as any).candidates;
      if (candidates && candidates[0]) {
        groundingMetadata = candidates[0].groundingMetadata;
        functionCalls = (response as any).functionCalls ? (response as any).functionCalls() : [];
      }
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

      if (provider === 'groq') {
        console.log(`[Groq Adapter] Successfully configured model ${model} using GROQ_API_KEY`);
      }

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
    const is429 = msg.includes('429') || msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('resource_exhausted');
    const isPermanentAuthOrBillingError = 
      msg.toLowerCase().includes('invalid_api_key') || 
      msg.toLowerCase().includes('api_key_invalid') || 
      msg.toLowerCase().includes('api key not valid') || 
      msg.includes('402') || 
      msg.includes('401') ||
      msg.includes('400') || // Bad Request/Invalid Key in some APIs
      (provider === 'openrouter' && msg.includes('404')) || // No endpoints found usually means billing/policy or deprecated model
      msg.toLowerCase().includes('insufficient_quota');
    const isModelNotFound = msg.includes('404') || msg.toLowerCase().includes('model_not_found') || msg.toLowerCase().includes('no endpoints found');
    const isTimeout = msg.includes('timeout') || msg.includes('aborted');

    recordCircuitFailure(key, is429 || isModelNotFound);
    if (isPermanentAuthOrBillingError) {
      setProviderQuotaExhausted(provider, msg);
    }
    recordMetricEvent(key, false, latencyMs, is429, isTimeout, 0, false, false, msg);
    incrementAiStat('errorsToday', 1);
    logAiEvent('ERROR', { provider, model, requestId, error: msg });

    throw err;
  }
}

function prepareOpenAiMessages(contents: any[], systemInstruction?: string) {
  const messages: Array<{ role: string; content: any }> = [];
  let baseSystem = systemInstruction || "Você é o ZENO AI, assistente inteligente.";
  baseSystem += "\n\n[REGRA CRÍTICA DE MÍDIA]: Você NUNCA deve gerar links de imagem, URLs de serviços externos nem tags markdown de imagem. Se o usuário pedir imagem, informe para usar o Estúdio de Imagens do ZENO.";

  messages.push({ role: 'system', content: baseSystem });
  for (const c of contents) {
    let role = c.role === 'model' ? 'assistant' : 'user';

    if (Array.isArray(c.parts)) {
      const hasImage = c.parts.some((p: any) => p.inlineData);
      if (hasImage) {
        const contentArray = c.parts.map((p: any) => {
          if (p.text) return { type: 'text', text: p.text };
          if (p.inlineData) {
            return { 
              type: 'image_url', 
              image_url: { 
                url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}` 
              } 
            };
          }
          return null;
        }).filter(Boolean);
        messages.push({ role, content: contentArray });
      } else {
        const textPart = c.parts.map((p: any) => p.text || "").filter(Boolean).join("\n");
        if (textPart) {
          messages.push({ role, content: textPart });
        }
      }
    } else if (typeof c === 'string') {
      if (c) messages.push({ role, content: c });
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
