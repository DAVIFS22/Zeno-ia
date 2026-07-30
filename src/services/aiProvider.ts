import { GoogleGenAI } from "@google/genai";

export interface AIProviderOptions {
  contents: any[];
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  tools?: any[];
  isSearchIntent?: boolean;
}

export interface AIProviderResult {
  text: string;
  provider: 'gemini' | 'groq' | 'openrouter';
  modelUsed: string;
  isAlternative: boolean;
  sources?: Array<{ title: string; url: string; domain: string }>;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function generateTextWithFallback(
  options: AIProviderOptions,
  aiClient: GoogleGenAI
): Promise<AIProviderResult> {
  const { contents, systemInstruction, temperature = 0.7, maxOutputTokens = 2048, tools, isSearchIntent } = options;

  let lastError: any = null;

  // 1. PRIMARY: Gemini Chain (trying primary models with polite delay)
  const geminiModels = [
    "gemini-flash-latest",
    "gemini-3.5-flash",
    "gemini-3.1-flash-lite",
    "gemini-flash-lite-latest",
    "gemini-2.0-flash"
  ];

  for (let i = 0; i < geminiModels.length; i++) {
    const model = geminiModels[i];
    try {
      console.log(`[AI PROVIDER] Attempting Gemini model: ${model}`);
      const config: any = {
        systemInstruction,
        temperature,
        maxOutputTokens,
      };
      if (isSearchIntent && tools) {
        config.tools = tools;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const response = await aiClient.models.generateContent({
        model,
        contents,
        config,
      });
      clearTimeout(timeoutId);

      const text = response.text || "";
      if (text) {
        console.log(`[AI PROVIDER] Success with Gemini model: ${model}`);
        
        let searchSources: Array<{ title: string; url: string; domain: string }> = [];
        if (response.candidates?.[0]?.groundingMetadata) {
          const metadata = response.candidates[0].groundingMetadata;
          const chunks = (metadata as any).groundingChunks || [];
          chunks.forEach((chunk: any) => {
            if (chunk.web && chunk.web.uri) {
              const url = chunk.web.uri;
              let domain = '';
              try {
                domain = new URL(url).hostname.replace(/^www\./, '');
              } catch (e) {
                domain = 'web';
              }
              const title = chunk.web.title || domain;
              if (!searchSources.some(s => s.url === url)) {
                searchSources.push({ title, url, domain });
              }
            }
          });
        }

        return {
          text,
          provider: 'gemini',
          modelUsed: model,
          isAlternative: false,
          sources: searchSources
        };
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`[AI PROVIDER] Gemini model ${model} failed:`, err?.message || err);
      // If not last gemini model, wait 1s before trying next gemini model
      if (i < geminiModels.length - 1) {
        await sleep(1000);
      }
    }
  }

  // Wait 1.5s before fallback to Groq
  await sleep(1500);

  // 2. FALLBACK 1: Groq
  const groqApiKey = process.env.GROQ_API_KEY;
  if (groqApiKey) {
    const groqModel = "llama-3.3-70b-versatile";
    try {
      console.log(`[AI PROVIDER] Falling back to Groq model: ${groqModel}`);
      
      const openAiMessages: Array<{ role: string; content: string }> = [];
      if (systemInstruction) {
        openAiMessages.push({ role: "system", content: systemInstruction });
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
          openAiMessages.push({ role, content: textPart });
        }
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${groqApiKey}`
        },
        body: JSON.stringify({
          model: groqModel,
          messages: openAiMessages,
          temperature,
          max_tokens: maxOutputTokens
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (groqRes.ok) {
        const groqData = await groqRes.json();
        const text = groqData.choices?.[0]?.message?.content || "";
        if (text) {
          console.log(`[AI PROVIDER] Success with Groq fallback`);
          return {
            text: text + "\n\n*(Resposta gerada por modelo alternativo)*",
            provider: 'groq',
            modelUsed: groqModel,
            isAlternative: true
          };
        }
      } else {
        const errText = await groqRes.text();
        console.warn(`[AI PROVIDER] Groq fallback failed (Status ${groqRes.status}):`, errText);
      }
    } catch (groqErr: any) {
      console.warn(`[AI PROVIDER] Groq fallback exception:`, groqErr?.message || groqErr);
    }
  } else {
    console.log(`[AI PROVIDER] GROQ_API_KEY not configured, skipping Groq fallback.`);
  }

  // Wait 1.5s before fallback to OpenRouter
  await sleep(1500);

  // 3. FALLBACK FINAL: OpenRouter
  const openRouterApiKey = process.env.OPENROUTER_API_KEY;
  if (openRouterApiKey) {
    const openRouterModel = "deepseek/deepseek-chat:free";
    try {
      console.log(`[AI PROVIDER] Falling back to OpenRouter model: ${openRouterModel}`);

      const openAiMessages: Array<{ role: string; content: string }> = [];
      if (systemInstruction) {
        openAiMessages.push({ role: "system", content: systemInstruction });
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
          openAiMessages.push({ role, content: textPart });
        }
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openRouterApiKey}`,
          "HTTP-Referer": "https://ais-dev.run.app",
          "X-Title": "ZENO AI"
        },
        body: JSON.stringify({
          model: openRouterModel,
          messages: openAiMessages,
          temperature,
          max_tokens: maxOutputTokens
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (orRes.ok) {
        const orData = await orRes.json();
        const text = orData.choices?.[0]?.message?.content || "";
        if (text) {
          console.log(`[AI PROVIDER] Success with OpenRouter fallback`);
          return {
            text: text + "\n\n*(Resposta gerada por modelo alternativo)*",
            provider: 'openrouter',
            modelUsed: openRouterModel,
            isAlternative: true
          };
        }
      } else {
        const errText = await orRes.text();
        console.warn(`[AI PROVIDER] OpenRouter fallback failed (Status ${orRes.status}):`, errText);
      }
    } catch (orErr: any) {
      console.warn(`[AI PROVIDER] OpenRouter fallback exception:`, orErr?.message || orErr);
    }
  } else {
    console.log(`[AI PROVIDER] OPENROUTER_API_KEY not configured, skipping OpenRouter fallback.`);
  }

  throw lastError || new Error("Todos os provedores de IA (Gemini, Groq, OpenRouter) atingiram o limite de cota ou estão temporariamente indisponíveis. Por favor, tente novamente em instantes.");
}
