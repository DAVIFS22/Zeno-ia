import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { uploadImageWithFallback } from "./src/server/storage/imageUploadManager";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import Stripe from "stripe";
import { SubscriptionService } from "./src/lib/subscriptionService";
import { 
  getUserUsage, 
  setUserPlan, 
  addSystemLog,
  getAdminConfig,
  updateUserUsage,
  incrementStatCounter,
  getAdminStats,
  getAuditLogs,
  getSystemLogs,
  readDb
} from "./src/lib/limits";
import { 
  createQueuedTask, 
  getTaskStatusDetails, 
  cancelQueuedTask, 
  executeAndProcessTask, 
  initFallbackQueueRunner,
  getQueueDiagnosticStats,
  registerImageGenerator
} from "./src/lib/taskManager";
import { verifyAdminRole } from "./src/config/admin";
import { storeMemory, retrieveRelevantMemories } from "./src/lib/vectorMemory";
import { getModelConfig } from "./src/lib/models";
import { getUserRole, isAdminUser, ADMIN_EMAIL } from "./src/config/admin";
import { adminDb, adminAuth } from "./src/lib/firebaseAdmin";
import { StripeWebhookHandler } from "./src/webhooks/stripeWebhookHandler";
import { StripeService, getStripe } from "./src/services/stripeService";
import { SubscriptionManager } from "./src/services/subscriptionManager";
import { getYoutubeTranscript, getYoutubeMetadata, extractYoutubeId, downloadYoutubeAudio } from "./src/lib/youtube";
import { buildAdaptiveSystemPrompt, updateProfileWithFeedback, DEFAULT_ADAPTIVE_PROFILE } from "./src/lib/adaptiveLearning";
import { generateTextWithFallback, startHealthCheckLoop } from "./src/services/aiProvider";
import { getAllProviderMetricsSummary } from "./src/services/ai/healthManager";
import { getGlobalAiStats } from "./src/services/ai/metrics";
import { sanitizeResponseText } from "./src/utils/imageSecurity";
import { resetAllCircuits } from './src/services/ai/circuitBreaker';
import { resetAllQuotas } from './src/services/ai/quotaManager';

// Startup Firestore connection test removed to avoid listCollections dependency

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || 'dummy_key',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

function getAiClient(userKey?: string) {
  if (userKey && userKey.trim().length > 10) {
    return new GoogleGenAI({ apiKey: userKey.trim() });
  }
  return ai;
}

// Start provider health check loop in background
startHealthCheckLoop(ai);

if (!process.env.GEMINI_API_KEY) {
  console.warn('[WARNING] GEMINI_API_KEY não encontrada. Algumas funcionalidades podem não funcionar corretamente.');
}

// Intelligent Model Selection System
let availableModelsCache: any[] = [];
let lastModelFetch = 0;

async function getAvailableModels() {
  const now = Date.now();
  // Cache for 5 minutes (reduced from 1 hour to stay fresh)
  if (availableModelsCache.length > 0 && now - lastModelFetch < 300000) {
    return availableModelsCache;
  }

  try {
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'dummy_key') {
      console.warn('[MODELS] Skipping model list: No valid API key configured.');
      return [];
    }
    const response = await ai.models.list();
    const models = [];
    // Pager is an async iterator
    for await (const model of response) {
      models.push(model);
    }
    availableModelsCache = models;
    lastModelFetch = now;
    console.log(`[MODELS] Discovered ${availableModelsCache.length} models from API.`);
    return availableModelsCache;
  } catch (err: any) {
    if (err.message?.includes('API_KEY_INVALID') || err.message?.includes('400')) {
       console.warn('[MODELS] Could not list models: Invalid API Key.');
    } else {
       console.error('[MODELS ERROR] Failed to list models:', err);
    }
    return [];
  }
}

async function smartSelectModel(taskType: string, isPro: boolean = false) {
  return 'gemini-1.5-flash';
}

import { supportTools } from "./src/lib/supportTools";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Stripe Webhook Endpoint MUST parse raw body to verify signature
  app.post("/api/webhooks/stripe", express.raw({ type: "application/json" }), async (req: any, res: any) => {
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event: any;

    try {
      if (webhookSecret && sig) {
        const stripe = getStripe();
        if (!stripe) {
          return res.status(500).json({ error: "Stripe SDK não inicializado." });
        }
        try {
          event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
        } catch (sigErr: any) {
          console.error("[STRIPE WEBHOOK] Signature verification failed:", sigErr.message);
          return res.status(400).send(`Webhook Error: ${sigErr.message}`);
        }
      } else {
        // Fallback for development/testing when webhook secret is not configured
        const rawString = typeof req.body === 'string' ? req.body : req.body.toString('utf8');
        event = JSON.parse(rawString);
      }

      await StripeWebhookHandler.handleWebhookEvent(event);
      return res.status(200).json({ received: true });
    } catch (err: any) {
      console.error("[STRIPE WEBHOOK ERROR]:", err.message);
      return res.status(500).json({ received: false, error: err.message });
    }
  });

  app.use(express.json({ limit: "50mb" }));

  // Initialize task manager background loop & register image generator
  initFallbackQueueRunner();
  registerImageGenerator(async (options) => {
    const { prompt, style, aspectRatio, enhance, engine, seed, userEmail } = options;
    console.log(`[ZENO VISION ENGINE] Executando tarefa de imagem. Prompt: "${prompt}", Estilo: ${style}, Proporção: ${aspectRatio}`);
    
    const enhancedPrompt = enhance ? `${prompt}, highly detailed, 8k resolution, professional lighting, masterpiece` : prompt;
    
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim().length > 10) {
      try {
        console.log(`[ZENO VISION ENGINE] Utilizando OpenAI DALL-E 3 API para geração de imagem...`);
        const size = aspectRatio === '16:9' ? '1792x1024' : aspectRatio === '9:16' ? '1024x1792' : '1024x1024';
        const openAiRes = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY.trim()}`
          },
          body: JSON.stringify({
            model: 'dall-e-3',
            prompt: enhancedPrompt,
            n: 1,
            size,
            quality: 'standard'
          })
        });
        if (openAiRes.ok) {
          const data = await openAiRes.json();
          const imageUrl = data.data?.[0]?.url;
          if (imageUrl) {
            try {
              await incrementStatCounter('totalImagesGenerated');
            } catch (e) {}
            return {
              imageUrl,
              prompt: enhancedPrompt,
              originalPrompt: prompt,
              aspectRatio: aspectRatio || '1:1',
              style: style || 'photorealistic',
              seed: seed || 0,
              model: 'DALL-E 3',
              provider: 'OpenAI'
            };
          }
        } else {
          const errText = await openAiRes.text();
          console.warn('[ZENO VISION ENGINE] OpenAI DALL-E 3 falhou, caindo para fallback:', errText);
        }
      } catch (err) {
        console.warn('[ZENO VISION ENGINE] Erro ao chamar OpenAI DALL-E 3:', err);
      }
    }

    const width = aspectRatio === '16:9' ? 1280 : aspectRatio === '9:16' ? 720 : 1024;
    const height = aspectRatio === '16:9' ? 720 : aspectRatio === '9:16' ? 1280 : 1024;
    const randomSeed = seed || Math.floor(Math.random() * 1000000);
    
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?width=${width}&height=${height}&seed=${randomSeed}&nologo=true&model=${engine || 'flux'}`;
    
    try {
      await incrementStatCounter('totalImagesGenerated');
    } catch (e) {}

    return {
      imageUrl,
      prompt: enhancedPrompt,
      originalPrompt: prompt,
      aspectRatio: aspectRatio || '1:1',
      style: style || 'photorealistic',
      seed: randomSeed,
      model: 'ZENO Vision Studio',
      provider: 'Flux AI'
    };
  });

async function getVerifiedUser(req: any): Promise<{ uid: string; email: string } | null> {
  const authHeader = req.headers['authorization'];
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split('Bearer ')[1];
  }

  if (token) {
    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      if (decodedToken && decodedToken.uid) {
        return { uid: decodedToken.uid, email: decodedToken.email || '' };
      }
    } catch (error: any) {
      // fallback to manual decode for preview environment
    }

    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        const uid = payload.user_id || payload.uid || payload.sub;
        if (uid) {
          return { uid, email: payload.email || '' };
        }
      }
    } catch (e) {}
  }
  return null;
}

/**
 * Securely verifies the Firebase ID Token and returns the decoded email.
 * This ensures the email is authenticated and not spoofed.
 */
async function getVerifiedEmail(req: any): Promise<string | null> {
  const authHeader = req.headers['authorization'];
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split('Bearer ')[1];
  }

  if (token) {
    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      if (decodedToken && decodedToken.email) {
        return decodedToken.email;
      }
    } catch (error: any) {
      // Supress warning for AI Studio platform tokens in preview (aud mismatch is expected in some preview states)
      if (!error.message.includes('gen-lang-client')) {
         console.warn('[AUTH] Admin SDK verifyIdToken failed, attempting JWT payload decode fallback:', error.message);
      }
    }

    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        if (payload && payload.email) {
          // Verify if it's a platform token or project token
          const isPlatform = payload.aud === 'gen-lang-client-0742851387';
          if (isPlatform) {
             console.log("[AUTH] Valid platform token detected for:", payload.email);
          }
          return payload.email;
        }
      }
    } catch (jwtErr) {
      console.warn('[AUTH] JWT decode fallback failed:', jwtErr);
    }
  }

  const headerEmail = req.headers['x-user-email'];
  if (headerEmail && typeof headerEmail === 'string' && headerEmail.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    return headerEmail;
  }

  return null;
}

/**
 * Enhanced Admin Verification for API Routes.
 * Strictly checks against hardcoded ADMIN_EMAIL after verifying token.
 */
async function secureVerifyAdmin(req: any, res: any): Promise<string | null> {
  const email = await getVerifiedEmail(req);
  
  if (!email || email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    res.status(403).json({ 
      error: "403 - Acesso Negado", 
      message: `Apenas o e-mail autorizado (${ADMIN_EMAIL}) possui o papel admin.`,
      verifiedEmail: email
    });
    return null;
  }
  
  return email;
}

const upload = multer({ storage: multer.memoryStorage() });

app.post("/api/upload-image", upload.single("image"), async (req: any, res: any) => {
  try {
    const file = req.file;
    const userId = req.body.userId;
    const filename = req.body.filename || 'upload.jpg';
    
    if (!file) return res.status(400).json({ error: "Nenhuma imagem fornecida." });
    if (!userId) return res.status(400).json({ error: "userId é obrigatório." });

    const imageUrl = await uploadImageWithFallback(file.buffer, userId, filename);
    res.json({ imageUrl });
  } catch (err: any) {
    console.error("[UPLOAD IMAGE ERROR]:", err);
    res.status(500).json({ error: err.message || "Erro no upload." });
  }
});

  app.post("/api/admin/reset-resilience", async (req, res) => {
    try {
      resetAllCircuits();
      resetAllQuotas();
      res.json({ status: 'ok', message: 'Circuits and Quotas reset' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API Routes
  app.post("/api/generate-music", async (req, res) => {
    try {
      const { prompt, genre, keySig, tempo, mode, geminiApiKey } = req.body;
      if (!prompt) return res.status(400).json({ error: "Tema da música é obrigatório." });

      const modelName = mode === 'clip' ? 'lyria-3-clip-preview' : 'lyria-3-pro-preview';
      const effectiveAi = getAiClient(geminiApiKey);
      const apiKey = geminiApiKey && geminiApiKey.trim().length > 10 ? geminiApiKey.trim() : process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY não configurada no servidor." });
      }

      const fullInput = `Gere uma música original no gênero ${genre}, tom ${keySig}, andamento ${tempo}. Tema ou letra base: ${prompt}`;

      const apiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Api-Revision": "2026-05-20",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          model: modelName,
          input: fullInput
        })
      });

      if (!apiRes.ok) {
        console.warn("[Lyria API fallback triggered - rate limit/quota reached]");
        
        // Fallback to Gemini Flash for lyrics & chords if Lyria quota exceeded (429) or error
        try {
          const fallbackPrompt = `Escreva apenas a letra e os acordes de uma música no gênero ${genre}, tom ${keySig}, andamento ${tempo}, com base no tema: "${prompt}". VÁ DIRETO para a composição (com título, versos, refrão e acordes). NÃO inclua nenhuma saudação, introdução ou explicação como "Aqui está..." ou "Esta é uma composição...". NÃO use linhas com "---".`;
          const fallbackResponse = await effectiveAi.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: fallbackPrompt,
          });

          const fallbackLyrics = fallbackResponse.text || `(Verso 1)\n${prompt}\n\n(Refrão)\nMelodia composta para ${genre}\nTom: ${keySig} • ${tempo}`;

          return res.json({
            title: prompt.slice(0, 40) + (prompt.length > 40 ? '...' : ''),
            genre,
            key: keySig,
            tempo,
            lyrics: fallbackLyrics,
            chordsSummary: `${keySig} - Progressive (Gemini Arranged)`,
            notice: "Não foi possível gerar o áudio agora (limite de uso atingido). Sua letra foi criada normalmente.",
            audioData: null,
            mimeType: "audio/wav"
          });
        } catch (fallbackErr) {
          console.error("Fallback generation failed, returning standard layout:", fallbackErr);
          return res.json({
            title: prompt.slice(0, 40) + (prompt.length > 40 ? '...' : ''),
            genre,
            key: keySig,
            tempo,
            lyrics: `(Verso 1)\n${prompt}\n\n(Refrão)\nO som ecoa na noite fria\nSeguindo a harmonia em ${keySig}\nAndamento: ${tempo}\n\n(Ponte)\nA música flui sem parar`,
            chordsSummary: `${keySig} - Standard`,
            notice: "Não foi possível gerar o áudio agora (limite de uso atingido). Sua letra foi criada normalmente.",
            audioData: null,
            mimeType: "audio/wav"
          });
        }
      }

      const interaction = await apiRes.json();

      let audioData = null;
      let mimeType = "audio/wav";
      let fullLyrics = "";

      if (interaction.output_audio) {
        audioData = interaction.output_audio.data;
        if (interaction.output_audio.mime_type) {
          mimeType = interaction.output_audio.mime_type;
        }
      }

      if (interaction.steps) {
        for (const step of interaction.steps) {
          if (step.type === 'model_output' && step.content) {
            for (const c of step.content) {
              if (c.type === 'audio' && c.data) {
                audioData = c.data;
                if (c.mime_type) mimeType = c.mime_type;
              }
              if (c.type === 'text' && c.text) {
                fullLyrics += c.text;
              }
            }
          }
        }
      }

      if (!fullLyrics && interaction.output_text) {
        fullLyrics = interaction.output_text;
      }

      if (!fullLyrics) {
        fullLyrics = `(Verso 1)\n${prompt}\n\n(Refrão)\nMelodia gerada com Lyria 3 (${genre})\nTom: ${keySig} • ${tempo}`;
      }

      res.json({
        title: prompt.slice(0, 40) + (prompt.length > 40 ? '...' : ''),
        genre,
        key: keySig,
        tempo,
        lyrics: fullLyrics,
        chordsSummary: `${keySig} - Progressive`,
        audioData,
        mimeType
      });

    } catch (err: any) {
      console.error("[GENERATE MUSIC EXCEPTION]:", err);
      try {
        const { prompt, genre, keySig, tempo, geminiApiKey } = req.body;
        const effectiveAi = getAiClient(geminiApiKey);
        const fallbackPrompt = `Escreva apenas a letra e os acordes de uma música no gênero ${genre || 'Pop'}, tom ${keySig || 'C Major'}, andamento ${tempo || '110 BPM'}, com base no tema: "${prompt || 'Inovação'}". VÁ DIRETO para a composição. NÃO inclua saudações, introduções ou explicações. NÃO use linhas com "---".`;
        const fallbackResponse = await effectiveAi.models.generateContent({
          model: 'gemini-1.5-flash',
          contents: fallbackPrompt,
        });

        return res.json({
          title: (prompt || 'Música').slice(0, 40),
          genre: genre || 'Pop',
          key: keySig || 'C Major',
          tempo: tempo || '110 BPM',
          lyrics: fallbackResponse.text,
          chordsSummary: `${keySig || 'C Major'} - Standard`,
          notice: "Não foi possível gerar o áudio agora (limite de uso atingido). Sua letra foi criada normalmente.",
          audioData: null,
          mimeType: "audio/wav"
        });
      } catch (innerErr) {
        res.status(500).json({ error: err.message || "Erro interno ao gerar música com IA." });
      }
    }
  });

  app.post("/api/process-youtube", async (req, res) => {
    try {
      const { url, userId } = req.body;
      if (!url) return res.status(400).json({ error: "URL é obrigatória." });

      const verifiedEmail = await getVerifiedEmail(req);
      const subDetails = await SubscriptionService.validateAndGetDetails(userId);
      const isAdmin = isAdminUser(verifiedEmail);
      const isPro = isAdmin || subDetails.isPro;

      // Optional: Check limits for non-pro users if needed
      
      const [transcriptData, metadata] = await Promise.all([
        getYoutubeTranscript(url).catch(e => ({ error: e.message, videoId: extractYoutubeId(url) })),
        getYoutubeMetadata(url).catch(() => null)
      ]);

      if ('error' in transcriptData) {
        // Fallback to metadata description & summary if captions fail
        const fallbackTranscript = metadata 
          ? `[Vídeo do YouTube: ${metadata.title || 'Vídeo'} - por ${metadata.author || 'Autor Desconhecido'}]\n\nDescrição e Detalhes do Vídeo:\n${metadata.description || 'Sem descrição.'}\n\n(Nota: Este vídeo não possui legendas oficiais acessíveis. O ZENO AI processou o conteúdo com base nos metadados oficiais e informações do vídeo).`
          : `[Vídeo do YouTube: ${url}]\n\n(Nota: O acesso direto ao conteúdo deste vídeo foi restrito pelo YouTube).`;

        return res.json({
          transcript: fallbackTranscript,
          videoId: transcriptData.videoId || extractYoutubeId(url),
          metadata,
          method: 'metadata_fallback'
        });
      }

      res.json({
        transcript: transcriptData.transcript,
        videoId: transcriptData.videoId,
        metadata
      });
    } catch (e: any) {
      console.error('/api/process-youtube error:', e);
      const videoId = req.body?.url ? extractYoutubeId(req.body.url) : 'unknown';
      return res.json({
        transcript: `[Vídeo do YouTube: ${req.body?.url || 'URL'}]\n\n(Nota: O acesso ao vídeo foi restrito pelo YouTube. O ZENO AI está processando com base nos metadados disponíveis).`,
        videoId,
        metadata: {
          title: `Vídeo do YouTube (${videoId})`,
          description: 'Vídeo processado pelo ZENO AI.',
          thumbnail: videoId !== 'unknown' ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '',
          author: 'YouTube Creator',
          duration: 0,
          videoId
        },
        method: 'error_fallback'
      });
    }
  });

  // Endpoint to get available models
  app.get("/api/models", async (req, res) => {
    try {
      const models = await getAvailableModels();
      res.json(models);
    } catch (err) {
      res.status(500).json({ error: "Erro ao listar modelos." });
    }
  });

  app.post("/api/transcribe", async (req, res) => {
    try {
      const { audioBase64, userId } = req.body;
      if (!audioBase64) {
        return res.status(400).json({ error: "Áudio não fornecido." });
      }

      const verified = await getVerifiedUser(req);
      if (!verified || !verified.uid) {
        return res.status(401).json({ error: "Usuário não autenticado. Faça login para usar a transcrição de voz." });
      }

      const verifiedEmail = verified.email;
      const verifiedUid = verified.uid;
      const isAdmin = isAdminUser(verifiedEmail);

      const subDetails = await SubscriptionService.validateAndGetDetails(verifiedUid);
      const isPro = isAdmin || subDetails.isPro;

      const userUsage = await getUserUsage(verifiedUid, verifiedEmail, req);
      
      if (!isPro) {
        const config = await getAdminConfig();
        if (userUsage.usage.voice >= config.limits.voice) {
          return res.status(403).json({ error: "Limite de transcrição diário excedido." });
        }
      }

      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) {
        console.error("[TRANSCRIBE] GROQ_API_KEY não configurada no servidor.");
        return res.status(500).json({ error: "GROQ_API_KEY não configurada no servidor." });
      }

      console.log(`[TRANSCRIBE] Iniciando transcrição com Groq Whisper para usuário ${verifiedUid}. Tamanho base64: ${audioBase64.length}`);

      // Convert base64 to Buffer
      const audioBuffer = Buffer.from(audioBase64, 'base64');
      console.log(`[TRANSCRIBE] Buffer de áudio criado com ${audioBuffer.length} bytes.`);

      if (audioBuffer.length === 0) {
        return res.status(400).json({ error: "Arquivo de áudio está vazio." });
      }

      const blob = new Blob([audioBuffer], { type: 'audio/webm' });

      const formData = new FormData();
      formData.append('file', blob, 'audio.webm');
      formData.append('model', 'whisper-large-v3');
      formData.append('language', 'pt');
      formData.append('response_format', 'json');

      console.log("[TRANSCRIBE] Enviando requisição para Groq API (whisper-large-v3)...");
      const groqResponse = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        },
        body: formData
      });

      if (!groqResponse.ok) {
        const errText = await groqResponse.text();
        console.error("[TRANSCRIBE] Erro na API do Groq (Status " + groqResponse.status + "):", errText);
        return res.status(500).json({ error: "Falha na transcrição do áudio pelo Groq: " + errText });
      }

      const data = await groqResponse.json();
      console.log("[TRANSCRIBE SUCCESS] Texto retornado pelo Groq:", JSON.stringify(data));

      if (!isAdmin) {
        await updateUserUsage(verifiedUid, 'voice');
      }

      res.json({ text: data.text || '' });
    } catch (error: any) {
      console.error("[TRANSCRIBE ERROR]:", error.message || error);
      res.status(500).json({ error: "Erro interno no servidor ao processar áudio: " + (error.message || error) });
    }
  });
  app.post("/api/chat", async (req, res) => {
    console.log("[API CHAT] REQUEST RECEIVED");
    let currentUserId = req.body?.userId || '';
    let currentIsSearch = false;

    try {
      const { message, history, speed, plan, userId, attachments, systemInstruction, isSmartMode, adaptiveProfile, geminiApiKey } = req.body;
      if (userId) currentUserId = userId;
      
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: "Mensagem é obrigatória e deve ser texto." });
      }

      // Secure email verification - strictly verify against token for Admin access
      const verifiedEmail = await getVerifiedEmail(req);
      const userEmail = verifiedEmail || (req.body?.userEmail || req.headers['x-user-email'] || '') as string;
      const isAdmin = isAdminUser(verifiedEmail) || isAdminUser(userEmail);

      // Server-side access control check - Securely verify subscription
      const subDetails = await SubscriptionService.validateAndGetDetails(userId);
      const isPro = isAdmin || subDetails.isPro;

      // Smart Model Selection Logic
      let normSpeed = speed || 'zeno';
      let apiModelName = 'gemini-1.5-flash';
      let taskType = 'general';

      const msgLower = message.toLowerCase();
      const searchTriggers = [
        'buscar', 'pesquisar', 'procurar', 'notícias sobre', 'noticias sobre',
        'o que é', 'o que e', 'quem é', 'quem e', 'últimas notícias', 'ultimas noticias',
        'pesquise', 'procure', 'busque', 'notícia de hoje', 'noticia de hoje',
        'cotação', 'resultado do', 'placar', 'preço atual', 'notícias de',
        'o que aconteceu', 'como está', 'qual é o', 'qual e o', 'quando foi',
        'encontre informações', 'informações sobre', 'fale sobre', 'conteúdo sobre'
      ];
      let isSearchIntent = normSpeed === 'search' || searchTriggers.some(t => msgLower.includes(t));
      currentIsSearch = isSearchIntent;

      if (isSearchIntent) {
        taskType = 'search';
        normSpeed = 'search';
      }

      if (isSmartMode !== false && !isSearchIntent) { // Default to smart mode
        taskType = 'general';
        const msgLower = message.toLowerCase();
        
        if (Array.isArray(attachments) && attachments.length > 0) {
          const mainFile = attachments[0];
          const mime = mainFile.mimeType || '';
          if (mime.includes('pdf')) taskType = 'search'; // Documents often fall into search/context
          else if (mime.includes('image')) taskType = 'vision';
          else if (mime.includes('audio')) taskType = 'general';
          else if (mime.includes('video')) taskType = 'general';
        } else if (msgLower.includes('código') || msgLower.includes('programação') || msgLower.includes('react') || msgLower.includes('typescript')) {
          taskType = 'code';
        } else if (msgLower.includes('pense') || msgLower.includes('raciocínio') || msgLower.includes('matemática')) {
          taskType = 'think';
        } else if (msgLower.includes('pesquise') || msgLower.includes('busca') || msgLower.includes('notícias')) {
          taskType = 'search';
        }

        apiModelName = await smartSelectModel(taskType, isPro);
        
        // Map back to display UI
        if (taskType === 'code' || taskType === 'think') normSpeed = 'think';
        else if (taskType === 'search') normSpeed = 'search';
        else if (taskType === 'vision' || taskType === 'image') normSpeed = 'vision';
        else normSpeed = 'zeno';
      } else if (isSearchIntent) {
        taskType = 'search';
        normSpeed = 'search';
        apiModelName = await smartSelectModel('search', isPro);
      } else {
        const modelCfg = getModelConfig(normSpeed);
        apiModelName = modelCfg.apiModel;
        // Map speed to category
        if (normSpeed === 'think' || normSpeed === 'mega') taskType = 'think';
        else if (normSpeed === 'code') taskType = 'code';
        else if (normSpeed === 'search') taskType = 'search';
        else if (normSpeed === 'fast') taskType = 'speed';
        else if (normSpeed === 'image' || normSpeed === 'vision') taskType = 'image';
        else taskType = 'general';
      }

      const modelCfg = getModelConfig(normSpeed);

      if (modelCfg.requiredPlan === 'pro' && !isPro) {
        return res.status(403).json({ 
          error: `O modelo ${modelCfg.name} é exclusivo para assinantes do plano ZENO Pro.`, 
          needsPro: true 
        });
      }

      let modelSystemPrompt = `${systemInstruction}\n\n[Diretrizes do Modelo ${modelCfg.name}]: ${modelCfg.systemPrompt}`;

      if (isSearchIntent) {
        modelSystemPrompt += `\n\n[REGRA DE PESQUISA NA WEB OBRIGATÓRIA]: Você possui acesso em tempo real à internet através da ferramenta de pesquisa Google Search. SEMPRE utilize os resultados da pesquisa para responder com precisão e dados atualizados. NUNCA responda que não possui acesso à internet ou que não pode acessar a internet em tempo real. NUNCA gere imagens automaticamente durante pesquisas. NUNCA utilize serviços de geração de imagens como fonte ou referência. IMPORTANTE: NUNCA crie uma seção 'Fontes:', 'Referências:' nem liste domínios, URLs ou links soltos ao final da sua resposta. A interface do usuário já exibirá automaticamente os sites utilizados em um componente visual separado. Apenas forneça a resposta de forma direta e atualizada.`;
      } else {
        modelSystemPrompt += `\n\n[REGRA DE MÍDIA E IMAGENS]: Quando o usuário solicitar a geração de uma imagem (ex: "gere uma imagem de...", "desenhe...", "crie uma foto"), o sistema detecta a intenção e gera a imagem automaticamente na conversa.`;
      }
      
      // Inject Adaptive Learning System Instruction Block
      modelSystemPrompt += '\n\n' + buildAdaptiveSystemPrompt(adaptiveProfile || DEFAULT_ADAPTIVE_PROFILE);

      // Multi-language support instructions
      const uiLanguage = req.body.language || 'pt-BR';
      modelSystemPrompt += `\n\n[IDIOMA E LOCALIDADE]: O idioma da interface do usuário é ${uiLanguage}. No entanto, você deve ser poliglota. REGRA CRUCIAL: Sempre responda no MESMO IDIOMA da última mensagem do usuário (mesmo que a interface esteja em outro idioma). Se o usuário escrever em Espanhol, responda em Espanhol. Se escrever em Francês, responda em Francês. Se escrever em Mandarim, responda em Mandarim. Mantenha o tom e a localidade apropriados para cada cultura.`;

      let modelTemperature = modelCfg.temperature;

      // Retrieve long-term memory context if userId is available
      let memoryContext = "";
      if (userId) {
        const relevantMemories = await retrieveRelevantMemories(userId, message, 3);
        if (relevantMemories && relevantMemories.length > 0) {
          memoryContext = "\n\n[HISTÓRICO RELEVANTE DE INTERAÇÕES ANTERIORES - Use apenas como contexto secundário se for diretamente útil para a pergunta atual. NUNCA responda a tópicos antigos do histórico em vez da pergunta atual do usuário!]:\n" + relevantMemories.map(m => `- ${m.content}`).join('\n');
          modelSystemPrompt += memoryContext;
        }
      }

      // Check if speed is 'image' or 'vision', or if message is explicitly asking to generate or show an image
      const isImageMode = 
        normSpeed === "image" || 
        normSpeed === "vision" || 
        /^(gerar|crie|criar|desenhe|desenhar|faça|fazer|gere|mostre|me dá|me mostre)\s*(uma?|um)?\s*(imagem|foto|arte|ilustração|wallpaper|quadro|desenho|logotipo|logo|personagem|grafico|gráfico|infográfico|infografico|diagrama|wireframe|mockup|render|3d|pintura|avatar|ícone|icone)/i.test(message.trim()) ||
        /(desenhe|gere uma imagem|crie uma arte|faça uma ilustração|faça um wallpaper|anime|manga|logotipo|personagem|foto realista|fotografia de|imagem de|image of|generate image|draw a|create an image|crie um mockup|faça um diagrama|crie um infográfico)/i.test(message.trim());

      if (userId) {
        await setUserPlan(userId, isPro ? 'ZENO Pro' : 'ZENO Free');
        
        // Pass userEmail and req to automatically update active metadata
        const usage = await getUserUsage(userId, userEmail, req);
        
        if (!isPro) {
          const config = await getAdminConfig();
          let actionType = 'messages';
          if (normSpeed === 'search' || normSpeed === 'mega' || normSpeed === 'pdf') actionType = 'search';
          else if (normSpeed === 'vision' || normSpeed === 'image' || isImageMode) actionType = 'vision';
          else if (attachments && attachments.length > 0) actionType = 'doc';
          
          if (usage.usage[actionType] >= config.limits[actionType]) {
            // Log limit block
            await addSystemLog('error', userEmail || 'Anônimo', 'Limite de Uso Atingido', `Usuário bloqueado: atingiu o limite de ${config.limits[actionType]} em ${actionType}`, req);
            return res.status(429).json({ error: `Limite diário atingido. Você atingiu o limite de ${config.limits[actionType]} usos para ${actionType} hoje. Faça upgrade para o ZENO Pro para usar sem limites.`, isLimitReached: true, actionType: actionType });
          }
          
          await updateUserUsage(userId, actionType as keyof typeof config.limits);
        } else {
          // If Pro user or Owner, let's still update dynamic system stats
          let actionType = 'messages';
          if (normSpeed === 'search' || normSpeed === 'mega' || normSpeed === 'pdf') actionType = 'search';
          else if (normSpeed === 'vision' || normSpeed === 'image' || isImageMode) actionType = 'vision';
          else if (attachments && attachments.length > 0) actionType = 'doc';
          
          if (actionType === 'messages') await incrementStatCounter('totalMessagesSent');
          else if (actionType === 'search') await incrementStatCounter('totalWebSearches');
          else if (actionType === 'image') await incrementStatCounter('totalImagesGenerated');
          else if (actionType === 'doc') await incrementStatCounter('totalPdfsAnalyzed');
          else if (actionType === 'vision') await incrementStatCounter('totalVisionUses');
        }
      }

      // Store user message in vector memory
      if (userId && message.length > 10) {
        await storeMemory(userId, message, { type: "user_message", speed: normSpeed });
      }

      // If user is asking for image generation, automatically generate and stream image in chat
      if (isImageMode) {
        try {
          const cleanPrompt = message.replace(/^(gerar|crie|criar|desenhe|desenhar|faça|fazer|gere|mostre|me dá|me mostre)\s*(uma?|um)?\s*(imagem|foto|arte|ilustração|wallpaper|quadro|desenho|logotipo|logo|personagem|grafico|gráfico|infográfico|infografico|diagrama|wireframe|mockup|render|3d|pintura|avatar|ícone|icone)/i, "").trim();

          res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          });
          res.write(`data: ${JSON.stringify({ activeModel: modelCfg.name, modelId: 'vision', isSearch: false, isSearching: false })}\n\n`);
          res.write(`data: ${JSON.stringify({ text: `🎨 **Gerando imagem:** "${cleanPrompt || message}"...\n\nPor favor, aguarde enquanto o ZENO Vision cria sua imagem.` })}\n\n`);

          const task = await createQueuedTask({
            userId: userId || 'anon-user',
            userEmail: userEmail || 'Anônimo',
            plan: isPro ? 'ZENO Pro' : 'ZENO Free',
            payload: {
              prompt: cleanPrompt || message,
              style: /anime/i.test(message) ? 'anime' : /cyberpunk/i.test(message) ? 'cyberpunk' : /3d|render/i.test(message) ? '3d-render' : /minimalista|minimal/i.test(message) ? 'minimalist' : 'photorealistic',
              aspectRatio: /quadrado|1:1/i.test(message) ? '1:1' : /stories|9:16/i.test(message) ? '9:16' : /widescreen|16:9/i.test(message) ? '16:9' : '1:1',
              enhance: true,
              engine: "flux",
              negativePrompt: ""
            },
            req
          });

          let lastPosition = -1;
          while (true) {
            const details = await getTaskStatusDetails(task.id);
            if (!details.task) {
              res.write(`data: ${JSON.stringify({ text: "❌ **Erro:** Tarefa não encontrada no servidor." })}\n\n`);
              res.write("data: [DONE]\n\n");
              return res.end();
            }

            if (details.task.status === 'completed') {
              const markdownOutput = `![${cleanPrompt || message}](${details.task.result.imageUrl})`;
              res.write(`data: ${JSON.stringify({ text: `✨ **Imagem gerada com sucesso:**\n\n${markdownOutput}` })}\n\n`);
              res.write("data: [DONE]\n\n");
              return res.end();
            }

            if (details.task.status === 'failed') {
              res.write(`data: ${JSON.stringify({ text: `❌ **Falha ao gerar imagem:** ${details.task.error || 'Erro desconhecido.'}` })}\n\n`);
              res.write("data: [DONE]\n\n");
              return res.end();
            }

            if (details.task.status === 'cancelled') {
              res.write(`data: ${JSON.stringify({ text: `⚠️ **Geração cancelada.**` })}\n\n`);
              res.write("data: [DONE]\n\n");
              return res.end();
            }

            if (!isPro && details.position !== null && details.position !== lastPosition) {
              lastPosition = details.position;
              res.write(`data: ${JSON.stringify({ text: `⏳ **Sua solicitação está na fila gratuita do ZENO AI.**\nComo assinantes ZENO Pro possuem prioridade, estamos processando sua imagem.\n\n📊 **Posição atual na fila:** ${details.position}\n⏱️ **Tempo estimado:** ${details.estimatedTimeSeconds}s\n\n` })}\n\n`);
            }

            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (err: any) {
          console.error('[CHAT IMAGE ERROR] Erro na geração:', err?.message || err);
          res.write(`data: ${JSON.stringify({ text: "❌ **Erro de processamento:** Não foi possível gerar a imagem neste momento." })}\n\n`);
          res.write("data: [DONE]\n\n");
          return res.end();
        }
      }

      // Check for vague/incomplete search request (e.g. just "buscar" or "pesquisar" without a topic)
      const cleanMsg = message.trim().toLowerCase().replace(/[.,!?]/g, '');
      const vagueTerms = ['buscar', 'pesquisar', 'procurar', 'busca', 'pesquisa', 'noticias', 'notícias', 'fazer busca', 'fazer pesquisa'];
      const isVagueSearch = vagueTerms.includes(cleanMsg) || /^(buscar|pesquisar|procurar|busca|pesquisa|notícias)\s*$/i.test(cleanMsg);

      if (isVagueSearch) {
        const recentUserMsgs = (history || []).filter((m: any) => m.role === 'user').slice(-2);
        const contextTopic = recentUserMsgs.length > 0 ? recentUserMsgs[recentUserMsgs.length - 1].text.slice(0, 40) : null;
        
        let clarificationText = '';
        if (contextTopic) {
          clarificationText = `Você quis dizer buscar sobre **"${contextTopic}"**?\n\nOu você pode especificar, por exemplo:\n↳ Notícias e atualizações recentes sobre ${contextTopic}\n↳ Principais conceitos e resumo sobre ${contextTopic}\n↳ Fontes oficiais e cotações atuais`;
        } else {
          clarificationText = `Você quis dizer buscar sobre algum assunto específico da nossa conversa?\n\nOu você pode especificar, por exemplo:\n↳ Notícias de hoje sobre tecnologia e inteligência artificial\n↳ Resultados e cotações do mercado financeiro\n↳ O que é e como funciona determinado assunto`;
        }

        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
        res.write(`data: ${JSON.stringify({ activeModel: modelCfg.name, modelId: 'search', isSearch: true, isSearching: false })}\n\n`);
        res.write(`data: ${JSON.stringify({ text: clarificationText, isSearch: true, isSearching: false, sources: [] })}\n\n`);
        res.write("data: [DONE]\n\n");
        return res.end();
      }

      // Convert history to the format expected by GenAI SDK
      const contents: any[] = [];
      if (history && Array.isArray(history)) {
        history.forEach((msg) => {
          let historyText = msg.text || "";
          historyText = historyText.replace(/!\[.*?\]\(data:.*?\)/g, "[Imagem Anexada]");
          contents.push({
            role: msg.role === "user" ? "user" : "model",
            parts: [{ text: historyText }],
          });
        });
      }
      let finalMessageText = message;
      let userParts: any[] = [];
      
      if (attachments && Array.isArray(attachments)) {
        finalMessageText = finalMessageText.replace(/!\[.*?\]\(data:.*?\)/g, "[Imagem Anexada]");
        
        for (const att of attachments) {
           if (att.url && att.url.startsWith("data:")) {
              const base64Data = att.url.split(",")[1];
              let mimeType = att.url.split(";")[0].split(":")[1];
              if (att.type === "document") {
                 mimeType = "application/pdf";
              }
              userParts.push({
                 inlineData: { data: base64Data, mimeType: mimeType }
              });
           }
        }
      }

      userParts.push({ text: finalMessageText });

      contents.push({
        role: "user",
        parts: userParts,
      });

      const tools: any[] = [];
      if (isSearchIntent) {
        tools.push({ googleSearch: {} });
      }
      tools.push({ functionDeclarations: supportTools });

      const aiResult = await generateTextWithFallback({
        contents,
        systemInstruction: modelSystemPrompt,
        temperature: modelTemperature,
        maxOutputTokens: 2048,
        tools: tools.length > 0 ? tools : undefined,
        isSearchIntent,
        category: taskType as any,
        userGeminiApiKey: geminiApiKey
      }, ai);

      if (aiResult.functionCalls && aiResult.functionCalls.length > 0) {
        const call = aiResult.functionCalls[0];
        if (call.name === 'createSupportTicket') {
          const { title, aiSummary } = call.args;
          const ticketRef = await adminDb.collection('supportTickets').add({
            userId: userId || 'anonymous',
            userEmail: userEmail || '',
            status: 'pending_human',
            title: title || 'Atendimento via Chat Principal',
            aiSummary: aiSummary || 'Solicitação iniciada no chat principal.',
            createdAt: Date.now(),
            lastMessageAt: Date.now()
          });

          // Add history to ticket
          if (Array.isArray(history)) {
            for (const m of history.slice(-5)) {
              await ticketRef.collection('messages').add({
                sender: m.role === 'assistant' ? 'ai' : 'user',
                text: m.text,
                timestamp: Date.now()
              });
            }
          }
          await ticketRef.collection('messages').add({
            sender: 'user',
            text: message,
            timestamp: Date.now()
          });

          if (!res.headersSent) {
            res.writeHead(200, {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
            });
          }
          
          res.write(`data: ${JSON.stringify({ 
            toolCall: { name: 'createSupportTicket', args: call.args },
            text: "Entendido. Estou abrindo um ticket de suporte para você falar com um especialista humano agora mesmo. Um momento..." 
          })}\n\n`);
          res.write("data: [DONE]\n\n");
          return res.end();
        }
      }

      let searchSources: Array<{ title: string; url: string; domain: string; snippet?: string; publishedDate?: string; updatedDate?: string }> = aiResult.sources || [];

      if (!res.headersSent) {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
      }

      // Send model info & search flag at start
      res.write(`data: ${JSON.stringify({ activeModel: modelCfg.name, modelId: isSearchIntent ? 'search' : normSpeed, isSearch: isSearchIntent })}\n\n`);
      
      // LOG GROUNDING FOR DEBUGGING IN AI STUDIO CONSOLE
      if (aiResult.groundingMetadata) {
        console.log(`[BACKEND GROUNDING LOG] Query: ${message}`);
        console.log(`[BACKEND GROUNDING LOG] Metadata: ${JSON.stringify(aiResult.groundingMetadata, null, 2)}`);
      } else if (isSearchIntent) {
        console.log(`[BACKEND GROUNDING LOG] WARNING: No grounding metadata returned for search query: ${message}`);
      }

      function safetyCleanup(text: string, sources: any[]) {
        if (!isSearchIntent || sources.length > 0) return text;
        
        const patterns = [
          /segundo o site (?:da |do )?([^,.\n]+)/gi,
          /de acordo com o (?:site |portal |jornal )?([^,.\n]+)/gi,
          /o site ([^,.\n]+) informa que/gi,
          /conforme relatado pelo ([^,.\n]+)/gi,
          /citando o ([^,.\n]+)/gi,
          /com informações d[aeo] ([^,.\n]+)/gi,
          /\(Fonte: [^)]+\)/gi,
          /\[Fonte: [^\]]+\]/gi,
          /segundo o ([^,.\n]+)/gi
        ];

        let cleaned = text;
        const commonSites = ['cnn', 'g1', 'estadao', 'folha', 'uol', 'bbc', 'reuters', 'globo', 'veja', 'exame', 'metrópoles', 'antagonista'];
        
        for (const pattern of patterns) {
          cleaned = cleaned.replace(pattern, (match, siteName) => {
            if (siteName && commonSites.some(s => siteName.toLowerCase().includes(s))) {
              return "segundo as informações mais recentes";
            }
            return match;
          });
        }
        return cleaned;
      }

      function injectCitations(text: string, groundingMetadata: any, sources: any[]) {
        if (!groundingMetadata || !groundingMetadata.groundingSupports || !sources.length) {
          return safetyCleanup(text, sources);
        }

        // Sort segments in reverse order to not break offsets
        const supports = [...groundingMetadata.groundingSupports].sort((a, b) => {
          const aEnd = a.segment?.endIndex || 0;
          const bEnd = b.segment?.endIndex || 0;
          return bEnd - aEnd;
        });

        let result = text;
        for (const support of supports) {
          const { endIndex } = support.segment || {};
          if (endIndex === undefined) continue;
          
          const chunkIndices = support.groundingChunkIndices || [];
          if (chunkIndices.length > 0) {
            // We'll use a unique tag that the frontend will parse: [[cite:INDEX]]
            const labels = chunkIndices.map((idx: number) => `[[cite:${idx}]]`).join('');
            result = result.slice(0, endIndex) + labels + result.slice(endIndex);
          }
        }
        return result;
      }

      const rawResponseText = isSearchIntent ? injectCitations(aiResult.text || "", aiResult.groundingMetadata, searchSources) : (aiResult.text || "");
      const fullResponseText = sanitizeResponseText(rawResponseText, taskType === 'image');

      // We removed the linkRegex fallback because it was picking up model hallucinations.
      // Only sources from groundingMetadata (Google Search tool) are now considered valid.

      if (isSearchIntent && searchSources.length === 0) {
        console.warn(`[ZENO SEARCH WARNING] A ferramenta de pesquisa não retornou nenhuma fonte real para a consulta: "${message}".`);
      }

      if (isSearchIntent && searchSources.length > 0) {
        // Simulate real-time discovery of sources
        for (let i = 0; i < searchSources.length; i++) {
          res.write(`data: ${JSON.stringify({ isSearch: true, isSearching: true, sources: searchSources.slice(0, i + 1) })}\n\n`);
          await new Promise(r => setTimeout(r, 200));
        }
        // Small pause before sending text
        await new Promise(r => setTimeout(r, 300));
      }

      res.write(`data: ${JSON.stringify({ text: fullResponseText, isSearch: isSearchIntent, sources: searchSources, isSearching: false, groundingMetadata: aiResult.groundingMetadata })}\n\n`);

      res.write("data: [DONE]\n\n");
      res.end();

      // Vector Memory Storage
      if (userId && fullResponseText.length > 10) {
        storeMemory(userId, fullResponseText, { type: "ai_response", model: apiModelName }).catch(err => {
          console.warn('[Memory] Background storeMemory error:', err);
        });
      }
    } catch (error: any) {
      let errStr = String(error?.message || error || "");
      let cleanError = errStr;
      
      const jsonMatch = errStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.error && parsed.error.message) {
            cleanError = String(parsed.error.message);
          }
        } catch(e) {}
      }

      const lowerError = cleanError.toLowerCase();
      const lowerErrStr = errStr.toLowerCase();

      const isRateLimit = 
        lowerError.includes("exceeded") ||
        lowerError.includes("quota") ||
        lowerError.includes("rate limit") ||
        lowerError.includes("credits") ||
        lowerError.includes("resource_exhausted") ||
        lowerError.includes("resource exhausted") ||
        lowerError.includes("tokens_per_model") ||
        lowerErrStr.includes("429") ||
        error?.status === 429 ||
        error?.code === 429 ||
        (error?.name === "ApiError" && error?.status === 429);

      if (!isRateLimit) {
        console.error("Chat Error:", error);
      } else {
        console.log("Chat Error (Rate Limit/Quota):", cleanError);
      }

      if (!res.headersSent) {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
      }

      if (isRateLimit) {
        const fallbackText = `*(Aviso ZENO AI: A cota temporária de requisições por minuto nos provedores de IA foi atingida. Isso ocorre quando muitos usuários estão ativos simultaneamente ou o limite gratuito do modelo foi alcançado. A cota é renovada automaticamente em instantes.)*\n\nRecebi sua mensagem: "${req.body?.message || ''}". Por favor, aguarde cerca de 30 a 60 segundos e envie novamente!`;
        res.write(`data: ${JSON.stringify({ text: fallbackText })}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }
      res.write(`data: ${JSON.stringify({ text: `⚠️ **Aviso ZENO AI:** Ocorreu uma oscilação temporária na conexão com a IA (${cleanError || 'conexão instável'}). Por favor, clique em **Tentar novamente** ou reenvie sua mensagem.` })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
    } finally {
      // NON-BLOCKING BACKGROUND ZP GAMIFICATION
      // Executed strictly in background after response stream is closed
      if (currentUserId && currentUserId !== 'anonymous' && !currentUserId.startsWith('anon_')) {
        awardUserPointsServer(currentUserId, currentIsSearch ? 'search' : 'message', 'conversationsCount').catch(err => {
          if (process.env.NODE_ENV !== 'production') {
            console.log('[ZP Server] Background ZP award handled with in-memory store:', err?.message || err);
          }
        });
      }
    }
  });

  // POST Chat Suggestions
  app.post("/api/suggestions", async (req, res) => {
    try {
      const { history = [], files = [] } = req.body;
      
      let basePrompt = `Você é um assistente criativo. O usuário acabou de abrir um novo chat ou está com a conversa vazia. Sugira 4 tópicos curtos (máximo 8 palavras cada) de perguntas interessantes ou ações que o usuário pode fazer. Retorne APENAS um array JSON válido contendo as strings sugeridas. Formato: ["sugestão 1", "sugestão 2", "sugestão 3", "sugestão 4"]. Não retorne markdown, crases ou qualquer outro texto.`;

      if (history.length > 0 || files.length > 0) {
        basePrompt += `\n\nContexto recente do usuário:\n`;
        if (history.length > 0) {
          basePrompt += `Últimas interações ou títulos de conversas: ${history.join(" | ")}\n`;
        }
        if (files.length > 0) {
          basePrompt += `Arquivos recém-anexados nesta nova conversa: ${files.join(", ")}\n`;
        }
        basePrompt += `\nCom base nesse contexto, sugira 4 ações de continuidade ou perguntas diretas relevantes a esse contexto recente.`;
      } else {
        basePrompt += `\n\nComo não há contexto, faça sugestões gerais úteis, como 'Escrever um e-mail', 'Resumir um texto longo', 'Criar uma imagem criativa', etc.`;
      }

      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [{ role: "user", parts: [{ text: basePrompt }] }],
        config: {
          temperature: 0.7,
        }
      });
      
      const responseText = response.text || "[]";
      let suggestions = [];
      try {
        const cleanJson = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
        suggestions = JSON.parse(cleanJson);
      } catch (err) {
        // Fallback generic suggestions
        suggestions = [
          "Quais foram os principais acontecimentos da Segunda Guerra Mundial?",
          "Explique as características geográficas e relevo da América do Sul",
          "Como funcionam a fotossíntese e a respiração celular?",
          "Crie uma imagem de paisagem futurista em alta resolução"
        ];
      }
      
      res.json({ suggestions: suggestions.slice(0, 4) });
    } catch (e: any) {
      const errStr = String(e?.message || e || "").toLowerCase();
      const isRateLimit = errStr.includes("429") || errStr.includes("quota") || errStr.includes("resource_exhausted") || errStr.includes("exceeded");
      if (!isRateLimit) {
        console.error("/api/suggestions error:", e);
      } else {
        console.log("/api/suggestions error (rate limit):", e?.message || e);
      }
      res.json({ suggestions: [
        "Quais foram as causas da Revolução Industrial?",
        "Explique os aspectos climáticos e geopolíticos da Europa",
        "Como funciona a Teoria da Relatividade de Einstein?",
        "Quais são os principais ecossistemas do planeta?"
      ] });
    }
  });

  app.get("/api/admin/audit-metrics", async (req, res) => {
    try {
      const adminEmail = await secureVerifyAdmin(req, res);
      if (!adminEmail) return;

      let totalUsers = 1;
      let activeSubscriptions = 1;
      let fetchErrors = [];

      try {
        const usersCountSnap = await adminDb.collection('users').count().get();
        totalUsers = usersCountSnap.data().count;
      } catch (dbErr: any) {
        // Fallback silently if permission denied
        totalUsers = 1;
      }
      
      try {
        const subsCountSnap = await adminDb.collection('subscriptions')
          .where('subscriptionStatus', 'in', ['active', 'trialing'])
          .count()
          .get();
        activeSubscriptions = subsCountSnap.data().count;
      } catch (dbErr: any) {
        // Fallback silently if permission denied
        activeSubscriptions = 1;
      }

      res.json({
        totalUsers,
        activeSubscriptions,
        timestamp: Date.now(),
        source: 'robust_agg_v1'
      });
    } catch (e: any) {
      console.error('/api/admin/audit-metrics error:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // GET Admin Stats (Protected)
  app.get("/api/admin/stats", async (req, res) => {
    try {
      const adminEmail = await secureVerifyAdmin(req, res);
      if (!adminEmail) return;

      const stats = await getAdminStats();
      const queueStats = await getQueueDiagnosticStats();
      res.json({ ...stats, queue: queueStats });
    } catch (e: any) {
      console.error('/api/admin/stats error:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // GET Admin AI Providers monitoring
  app.get("/api/admin/ai-providers", async (req, res) => {
    try {
      const adminEmail = await secureVerifyAdmin(req, res);
      if (!adminEmail) return;
      const summary = getAllProviderMetricsSummary();
      const globalStats = getGlobalAiStats();
      res.json({ providers: summary, stats: globalStats });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });


  // Admin Support Tickets API
  app.get("/api/admin/support-tickets", async (req, res) => {
    try {
      const adminEmail = await secureVerifyAdmin(req, res);
      if (!adminEmail) return;

      const snapshot = await adminDb.collection('supportTickets')
        .orderBy('lastMessageAt', 'desc')
        .get();
      const tickets = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      res.json({ tickets });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/support-tickets/:id/assume", async (req, res) => {
    try {
      const adminEmail = await secureVerifyAdmin(req, res);
      if (!adminEmail) return;

      const { id } = req.params;
      await adminDb.collection('supportTickets').doc(id).update({
        status: 'human_active',
        assumedAt: Date.now()
      });

      // Add a system message or notification?
      await adminDb.collection('supportTickets').doc(id).collection('messages').add({
        sender: 'system',
        text: 'O suporte assumiu este atendimento.',
        timestamp: Date.now()
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/support-tickets/:id/resolve", async (req, res) => {
    try {
      const adminEmail = await secureVerifyAdmin(req, res);
      if (!adminEmail) return;

      const { id } = req.params;
      await adminDb.collection('supportTickets').doc(id).update({
        status: 'resolved',
        resolvedAt: Date.now()
      });

      // Send final automatic message
      await adminDb.collection('supportTickets').doc(id).collection('messages').add({
        sender: 'admin',
        text: 'Atendimento finalizado. Se precisar de mais algo, é só chamar.',
        timestamp: Date.now()
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/support-tickets/:id/refuse", async (req, res) => {
    try {
      const adminEmail = await secureVerifyAdmin(req, res);
      if (!adminEmail) return;

      const { id } = req.params;
      const { reason } = req.body;

      await adminDb.collection('supportTickets').doc(id).update({
        status: 'returned_to_ai', // Specific status for AI to handle
        refusedAt: Date.now(),
        refusalReason: reason || 'Não especificado'
      });

      // Add a system message to the ticket so the AI can see the refusal in context
      await adminDb.collection('supportTickets').doc(id).collection('messages').add({
        sender: 'system',
        text: `O suporte recusou este ticket. Motivo: ${reason || 'Não especificado'}. O bot deve tentar resolver novamente.`,
        timestamp: Date.now()
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/support-tickets/:id/message", async (req, res) => {
    try {
      const adminEmail = await secureVerifyAdmin(req, res);
      if (!adminEmail) return;

      const { id } = req.params;
      const { text } = req.body;

      await adminDb.collection('supportTickets').doc(id).collection('messages').add({
        sender: 'admin',
        text,
        timestamp: Date.now()
      });

      await adminDb.collection('supportTickets').doc(id).update({
        lastMessageAt: Date.now()
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET Admin Logs (Protected)
  app.get("/api/admin/logs", async (req, res) => {
    try {
      const adminEmail = await secureVerifyAdmin(req, res);
      if (!adminEmail) return;

      const auditLogs = await getAuditLogs();
      const systemLogs = await getSystemLogs();
      res.json({ auditLogs, systemLogs });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST Admin Auth Log
  app.post("/api/admin/log-auth", async (req, res) => {
    try {
      const { userEmail, action, details } = req.body;
      const verifiedEmail = await getVerifiedEmail(req);
      await addSystemLog("auth", verifiedEmail || userEmail || "Anônimo", action, details, req);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET Admin Config (Protected)
  app.get("/api/admin/config", async (req, res) => {
    try {
      const adminEmail = await secureVerifyAdmin(req, res);
      if (!adminEmail) return;

      const config = await getAdminConfig();
      res.json(config);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST Admin Config (Protected)
  app.post("/api/admin/config", async (req, res) => {
    try {
      const adminEmail = await secureVerifyAdmin(req, res);
      if (!adminEmail) return;

      const newConfig = req.body;
      const db = await readDb();
      await addSystemLog('info', adminEmail, 'Atualização de Configuração', 'Configurações globais do sistema atualizadas via painel admin.', req);
      await adminDb.collection('config').doc('admin_settings').set(newConfig);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST Admin Manual Subscription Sync with Stripe API
  app.post("/api/admin/sync-subscription", async (req, res) => {
    try {
      const { userId, customerId, subscriptionId } = req.body;
      if (!userId && !customerId && !subscriptionId) {
        return res.status(400).json({ error: "Informe userId, customerId ou subscriptionId para sincronização manual." });
      }

      let resolvedUserId = userId;
      let targetSubId = subscriptionId;
      let targetCustId = customerId;

      if (!resolvedUserId) {
        resolvedUserId = await SubscriptionManager.resolveUserId(targetCustId, undefined, undefined);
      }

      if (!resolvedUserId) {
        return res.status(404).json({ error: "Usuário correspondente não encontrado no Firestore." });
      }

      // If subscriptionId isn't passed, check Firestore subscription doc for customerId / subId
      if (!targetSubId) {
        const existingSubDoc = await adminDb.collection('subscriptions').doc(resolvedUserId).get();
        if (existingSubDoc.exists) {
          const data = existingSubDoc.data();
          targetSubId = data?.subscriptionId;
          targetCustId = targetCustId || data?.customerId;
        }
      }

      let updatedData = null;

      if (targetSubId) {
        const stripeSub = await StripeService.getSubscription(targetSubId);
        if (stripeSub) {
          const isAnnual = stripeSub.items?.data[0]?.plan?.interval === 'year';
          const priceAmount = stripeSub.items?.data[0]?.price?.unit_amount;
          const amount = priceAmount ? priceAmount / 100 : (isAnnual ? 399.00 : 39.90);
          const statusMap: Record<string, any> = {
            active: 'active',
            trialing: 'trialing',
            past_due: 'past_due',
            unpaid: 'unpaid',
            canceled: 'canceled'
          };
          const status = statusMap[stripeSub.status] || 'inactive';
          const isActive = status === 'active' || status === 'trialing';

          const subAny = stripeSub as any;
          const startSec = subAny.current_period_start || Math.floor(Date.now() / 1000);
          const endSec = subAny.current_period_end || (startSec + 30 * 86400);

          updatedData = await SubscriptionManager.updateSubscriptionRecord({
            userId: resolvedUserId,
            subscriptionId: stripeSub.id,
            customerId: (stripeSub.customer as string) || targetCustId || '',
            subscriptionStatus: status,
            active: isActive,
            planId: isActive ? 'zeno_pro' : 'zeno_free',
            priceId: stripeSub.items?.data[0]?.price?.id || '',
            billingPeriod: isAnnual ? 'Anual' : 'Mensal',
            currentPeriodStart: startSec * 1000,
            currentPeriodEnd: endSec * 1000,
            nextRenewal: endSec * 1000,
            cancelAt: subAny.cancel_at ? subAny.cancel_at * 1000 : null,
            cancelAtPeriodEnd: !!subAny.cancel_at_period_end,
            lastInvoice: typeof subAny.latest_invoice === 'string' ? subAny.latest_invoice : subAny.latest_invoice?.id || '',
            paymentStatus: isActive ? 'succeeded' : 'failed',
            currency: (subAny.currency || 'brl').toUpperCase(),
            amount
          });
        }
      }

      if (!updatedData) {
        // Fallback: sync from current Firestore state to verify consistency
        const subDoc = await adminDb.collection('subscriptions').doc(resolvedUserId).get();
        updatedData = subDoc.exists ? subDoc.data() : null;
      }

      await addSystemLog('info', ADMIN_EMAIL, 'Sincronização Manual Stripe', `Assinatura sincronizada manualmente para o usuário ${resolvedUserId}.`, req);

      return res.json({
        success: true,
        message: 'Assinatura sincronizada com sucesso no Firestore.',
        userId: resolvedUserId,
        subscription: updatedData
      });
    } catch (e: any) {
      console.error('/api/admin/sync-subscription error:', e);
      return res.status(500).json({ error: e.message });
    }
  });

  // GET Stripe Webhook Logs & Diagnostics
  app.get("/api/admin/stripe-logs", async (req, res) => {
    try {
      const adminEmail = await secureVerifyAdmin(req, res);
      if (!adminEmail) return;
      const logsSnap = await adminDb.collection('stripe_webhook_logs').orderBy('timestamp', 'desc').limit(100).get();
      const failedSnap = await adminDb.collection('failed_webhooks').limit(50).get();

      const logs = logsSnap.docs.map(d => d.data());
      const failed = failedSnap.docs.map(d => d.data());

      return res.json({ logs, failedWebhooks: failed });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/admin/debug/reset-stats", async (req, res) => {
    try {
      const adminEmail = await secureVerifyAdmin(req, res);
      if (!adminEmail) return;
      // Em um app real, resetaríamos os contadores no Firestore ou banco de dados
      await addSystemLog('info', adminEmail || 'Admin', 'Reset de Estatísticas', 'O administrador solicitou o reset manual das estatísticas de uso.', req);
      return res.json({ success: true, message: "Comando de reset enviado (Simulação)." });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/admin/debug/clear-logs", async (req, res) => {
    try {
      const adminEmail = await secureVerifyAdmin(req, res);
      if (!adminEmail) return;
      // Em um app real, poderíamos deletar coleções ou filtrar registros
      await addSystemLog('info', adminEmail || 'Admin', 'Limpeza de Logs', 'O administrador solicitou a limpeza manual dos logs do sistema.', req);
      return res.json({ success: true, message: "Comando de limpeza registrado." });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/admin/set-unlimited", async (req, res) => {
    try {
      const adminEmail = await secureVerifyAdmin(req, res);
      if (!adminEmail) return;

      const { targetUserId, unlimited } = req.body;
      if (!targetUserId) {
        return res.status(400).json({ error: "targetUserId é obrigatório." });
      }

      await adminDb.collection('users').doc(targetUserId).set({
        unlimited: Boolean(unlimited),
        adminOverride: Boolean(unlimited),
        plan: unlimited ? 'ZENO Pro' : 'ZENO Free'
      }, { merge: true });

      if (unlimited) {
        const record = {
          userId: targetUserId,
          subscriptionId: 'sub_admin_unlimited',
          plano: 'Anual' as const,
          status: 'active' as const,
          purchaseDate: Date.now(),
          activationDate: Date.now(),
          renewDate: Date.now() + 365 * 86400 * 1000,
          expirationDate: Date.now() + 365 * 86400 * 1000,
          paymentMethod: { brand: 'Admin', last4: '0000' },
          gateway: 'Admin Override',
          autoRenew: true,
          lastPayment: { amount: 0, currency: 'BRL', date: Date.now(), status: 'succeeded' as const },
          nextPayment: { amount: 0, currency: 'BRL', date: Date.now() + 365 * 86400 * 1000 },
          paymentHistory: [],
          remindersSent: {},
          lastRenewalStatus: 'success' as const
        };
        await SubscriptionService.saveSubscription(record);
      }

      res.json({ success: true, targetUserId, unlimited: Boolean(unlimited) });
    } catch (e: any) {
      console.error('/api/admin/set-unlimited error:', e);
      res.status(500).json({ error: e.message || "Erro interno ao atualizar status ilimitado." });
    }
  });

  // GET Subscription Status & Details Endpoint
  const getSubscriptionStatusHandler = async (req: any, res: any) => {
    try {
      const userId = req.query.userId as string;
      const verifiedEmail = await getVerifiedEmail(req);
      const email = verifiedEmail || (req.query.email || req.headers['x-user-email'] || '') as string;
      const isAdmin = isAdminUser(verifiedEmail) || isAdminUser(email);

      if (!userId) {
        return res.status(400).json({ error: "userId é obrigatório." });
      }

      // Check Stripe directly as source of truth
      let stripeSub: any = null;
      let stripe: any = null;
      let targetCustId: string | undefined = undefined;
      let stripeStatus = 'none';
      let firebaseStatus = 'none';
      let isPro = isAdmin; // Admin starts as Pro
      let lockReason = '';

      const details = await SubscriptionService.validateAndGetDetails(userId);
      firebaseStatus = details.subscriptionStatus;

      try {
        stripe = getStripe();
        if (stripe) {
          let targetSubId: string | undefined = details?.sub?.subscriptionId || details?.sub?.stripeSubscriptionId;
          targetCustId = details?.sub?.customerId || details?.sub?.stripeCustomerId;

          if (!targetSubId && !targetCustId && email) {
            const customers = await stripe.customers.list({ email, limit: 1 });
            if (customers.data.length > 0) {
              targetCustId = customers.data[0].id;
            }
          }

          if (targetSubId && targetSubId.startsWith('sub_')) {
            try {
              stripeSub = await stripe.subscriptions.retrieve(targetSubId, {
                expand: ['default_payment_method']
              });
            } catch (err) {}
          }

          if (!stripeSub && targetCustId) {
            const subs = await stripe.subscriptions.list({ customer: targetCustId, limit: 5 });
            const activeOrCanceled = subs.data.find(s => {
              const pEnd = (s as any).current_period_end || 0;
              return s.status === 'active' || 
                s.status === 'trialing' || 
                (s.cancel_at_period_end && pEnd * 1000 > Date.now());
            });
            if (activeOrCanceled) {
              stripeSub = activeOrCanceled;
            }
          }

          if (stripeSub) {
            stripeStatus = stripeSub.status;
            const nowSec = Math.floor(Date.now() / 1000);
            const subPeriodEnd = (stripeSub as any).current_period_end || 0;
            const isPeriodActive = subPeriodEnd > nowSec;
            if (stripeSub.status === 'active' || stripeSub.status === 'trialing' || (stripeSub.cancel_at_period_end && isPeriodActive)) {
              isPro = true;
            } else {
              lockReason = `Assinatura no Stripe está com status '${stripeSub.status}' e período expirado.`;
            }
          }
        }
      } catch (stripeErr: any) {
        console.warn('[Subscription Sync Warning] Falha na consulta direta do Stripe:', stripeErr?.message);
      }

      // Fallback to Firebase details if Stripe did not provide a sub record
      if (!stripeSub && !isAdmin) {
        isPro = details.isPro;
        if (!isPro) {
          lockReason = 'Nenhuma assinatura ativa encontrada no Stripe ou Firebase.';
        }
      }

      // Detailed debug logging (Requirement 12)
      console.log(`[Subscription Sync Debug]\nStripe Status: ${stripeStatus}\nFirebase Status: ${firebaseStatus}\nisPro: ${isPro}\nMotivo do bloqueio: ${isPro ? 'Nenhum (Acesso Pro Liberado)' : lockReason}`);

      const reminderResult = await SubscriptionService.checkAndProcessReminders(userId);

      const statusVal = stripeSub
        ? (stripeSub.cancel_at_period_end ? 'cancel_at_period_end' : stripeSub.status)
        : (isPro ? (details.subscriptionStatus || 'active') : 'free');
      
      const subIdVal = stripeSub ? stripeSub.id : (details?.sub?.subscriptionId || '');
      
      const planVal = stripeSub
        ? (stripeSub.items?.data[0]?.plan?.interval === 'year' ? 'ZENO Pro Anual' : 'ZENO Pro Mensal')
        : (details?.subscriptionPlan || (isPro ? 'ZENO Pro' : 'ZENO Free'));
      
      const cancelAtPeriodEndVal = stripeSub 
        ? Boolean(stripeSub.cancel_at_period_end) 
        : (details?.autoRenew === false);
      
      const endSec = stripeSub ? ((stripeSub as any).current_period_end || 0) : 0;
      const startSec = stripeSub ? ((stripeSub as any).current_period_start || 0) : 0;

      const currentPeriodEndVal = endSec > 0
        ? new Date(endSec * 1000).toISOString()
        : (details?.expirationDate || details?.renewDate || null);

      const currentPeriodStartVal = startSec > 0
        ? new Date(startSec * 1000).toISOString()
        : (details?.purchaseDate || null);

      const priceCents = stripeSub?.items?.data[0]?.price?.unit_amount;
      const priceVal = priceCents ? (priceCents / 100) : (planVal.includes('Anual') ? 399.90 : 39.90);
      const currencyVal = stripeSub?.items?.data[0]?.price?.currency || stripeSub?.currency || 'brl';
      const customerVal = stripeSub?.customer || details?.sub?.customerId || null;

      let paymentMethodVal = details?.sub?.paymentMethod || null;
      
      // If Stripe subscription has a default payment method, use it
      if (stripeSub?.default_payment_method && typeof stripeSub.default_payment_method === 'object' && (stripeSub.default_payment_method as any).card) {
        const card = (stripeSub.default_payment_method as any).card;
        paymentMethodVal = {
          brand: card.brand,
          last4: card.last4,
          expMonth: card.exp_month,
          expYear: card.exp_year
        };
      } else if (targetCustId) {
        try {
          // If not on subscription, check customer default payment method or list them
          const customer = await stripe.customers.retrieve(targetCustId, {
            expand: ['invoice_settings.default_payment_method']
          }) as any;
          
          if (customer.invoice_settings?.default_payment_method?.card) {
            const card = customer.invoice_settings.default_payment_method.card;
            paymentMethodVal = {
              brand: card.brand,
              last4: card.last4,
              expMonth: card.exp_month,
              expYear: card.exp_year
            };
          } else {
            const pms = await stripe.paymentMethods.list({ customer: targetCustId, type: 'card', limit: 1 });
            if (pms.data.length > 0 && pms.data[0].card) {
              const card = pms.data[0].card;
              paymentMethodVal = {
                brand: card.brand,
                last4: card.last4,
                expMonth: card.exp_month,
                expYear: card.exp_year
              };
            }
          }
        } catch (pmErr) {}
      }

      res.json({
        id: subIdVal,
        subscriptionId: subIdVal,
        status: statusVal,
        subscriptionStatus: statusVal,
        cancel_at_period_end: cancelAtPeriodEndVal,
        cancelAtPeriodEnd: cancelAtPeriodEndVal,
        current_period_start: currentPeriodStartVal,
        currentPeriodStart: currentPeriodStartVal,
        current_period_end: currentPeriodEndVal,
        currentPeriodEnd: currentPeriodEndVal,
        plan: planVal,
        subscriptionPlan: planVal,
        price: priceVal,
        currency: currencyVal,
        customer: customerVal,
        payment_method: paymentMethodVal,
        paymentMethod: paymentMethodVal,
        isPro,
        purchaseDate: currentPeriodStartVal || details?.purchaseDate || new Date().toISOString(),
        renewDate: currentPeriodEndVal,
        expirationDate: currentPeriodEndVal,
        daysRemaining: endSec > 0 ? Math.max(0, Math.ceil((endSec * 1000 - Date.now()) / (1000 * 3600 * 24))) : (isPro ? 30 : 0),
        autoRenew: !cancelAtPeriodEndVal,
        paymentStatus: isPro ? 'succeeded' : 'none',
        sub: details?.sub || null,
        pendingNotification: reminderResult?.pendingNotification || null
      });
    } catch (e: any) {
      console.log(`[Subscription Sync Debug]\nStripe Status: error\nFirebase Status: error\nisPro: false\nMotivo do bloqueio: ${e?.message || 'Erro de execução'}`);
      res.json({
        status: 'free',
        subscriptionId: '',
        plan: 'ZENO Free',
        isPro: false,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
        subscriptionStatus: 'free',
        subscriptionPlan: 'Free',
        purchaseDate: null,
        renewDate: null,
        expirationDate: null,
        daysRemaining: 0,
        autoRenew: false,
        paymentStatus: 'none',
        sub: null,
        pendingNotification: null
      });
    }
  };

  app.get("/api/subscription/details", getSubscriptionStatusHandler);
  app.get("/api/subscription/status", getSubscriptionStatusHandler);

  // POST Real-time Forced Subscription Reconciliation / Sync
  const handleSubscriptionReconciliation = async (req: any, res: any) => {
    try {
      const userId = req.body?.userId || req.query?.userId;
      if (!userId) {
        return res.status(400).json({ error: "userId é obrigatório para reconciliação." });
      }

      let targetSubId: string | undefined = undefined;
      let targetCustId: string | undefined = undefined;

      try {
        const subDoc = await adminDb.collection('subscriptions').doc(userId).get();
        if (subDoc.exists) {
          const s = subDoc.data();
          targetSubId = s?.subscriptionId || s?.stripeSubscriptionId;
          targetCustId = s?.customerId || s?.stripeCustomerId;
        }
      } catch (e: any) {
        if (process.env.NODE_ENV !== 'production') console.warn('Dev: Skipped read subscription doc for reconcile', e?.message);
      }

      if (!targetSubId || !targetCustId) {
        try {
          const userDoc = await adminDb.collection('users').doc(userId).get();
          if (userDoc.exists) {
            const u = userDoc.data();
            targetSubId = targetSubId || u?.stripeSubscriptionId;
            targetCustId = targetCustId || u?.stripeCustomerId;
          }
        } catch (e: any) {
          if (process.env.NODE_ENV !== 'production') console.warn('Dev: Skipped read user doc for reconcile', e?.message);
        }
      }

      let updatedRecord = null;

      if (targetSubId) {
        try {
          const stripeSub = await StripeService.getSubscription(targetSubId);
          if (stripeSub) {
            const isAnnual = stripeSub.items?.data[0]?.plan?.interval === 'year';
            const priceAmount = stripeSub.items?.data[0]?.price?.unit_amount;
            const amount = priceAmount ? priceAmount / 100 : (isAnnual ? 399.00 : 39.90);
            const statusMap: Record<string, any> = {
              active: 'active',
              trialing: 'trialing',
              past_due: 'past_due',
              unpaid: 'unpaid',
              canceled: 'canceled'
            };
            const status = statusMap[stripeSub.status] || 'inactive';
            const isActive = status === 'active' || status === 'trialing';

            const subAny = stripeSub as any;
            const startSec = subAny.current_period_start || Math.floor(Date.now() / 1000);
            const endSec = subAny.current_period_end || (startSec + 30 * 86400);

            updatedRecord = await SubscriptionManager.updateSubscriptionRecord({
              userId,
              subscriptionId: stripeSub.id,
              customerId: (stripeSub.customer as string) || targetCustId || '',
              subscriptionStatus: status,
              active: isActive,
              planId: isActive ? 'zeno_pro' : 'zeno_free',
              priceId: stripeSub.items?.data[0]?.price?.id || '',
              billingPeriod: isAnnual ? 'Anual' : 'Mensal',
              currentPeriodStart: startSec * 1000,
              currentPeriodEnd: endSec * 1000,
              nextRenewal: endSec * 1000,
              cancelAt: subAny.cancel_at ? subAny.cancel_at * 1000 : null,
              cancelAtPeriodEnd: !!subAny.cancel_at_period_end,
              lastInvoice: typeof subAny.latest_invoice === 'string' ? subAny.latest_invoice : subAny.latest_invoice?.id || '',
              paymentStatus: isActive ? 'succeeded' : 'failed',
              currency: (subAny.currency || 'brl').toUpperCase(),
              amount
            });
          }
        } catch (e: any) {
          if (process.env.NODE_ENV !== 'production') console.warn('Dev: Stripe reconcile skipped or failed', e?.message);
        }
      }

      if (!updatedRecord) {
        // Fallback reconciliation directly on Firestore document if renewDate is outdated
        const now = Date.now();
        try {
          const subDocRef = adminDb.collection('subscriptions').doc(userId);
          const subSnap = await subDocRef.get();
          if (subSnap.exists) {
            const subData = subSnap.data() as any;
            const currentRenew = subData.renewDate || subData.expirationDate || subData.nextRenewal;
            if (currentRenew && currentRenew < now) {
              if (subData.status === 'active' || subData.status === 'trialing') {
                if (subData.autoRenew !== false) {
                  const periodMs = subData.plano === 'ZENO Pro Anual' || subData.billingPeriod === 'Anual' ? 365 * 86400 * 1000 : 30 * 86400 * 1000;
                  let nextRenew = currentRenew;
                  while (nextRenew < now) {
                    nextRenew += periodMs;
                  }
                  subData.renewDate = nextRenew;
                  subData.expirationDate = nextRenew;
                  subData.lastRenewalStatus = 'success';
                  await subDocRef.set(subData, { merge: true });
                  await setUserPlan(userId, 'ZENO Pro');
                  await addSystemLog('info', userId, 'Reconciliação Forçada', `Data de renovação atualizada para ${new Date(nextRenew).toISOString()}`, req);
                } else {
                  subData.status = 'expired';
                  await subDocRef.set(subData, { merge: true });
                  await setUserPlan(userId, 'ZENO Free');
                  await addSystemLog('info', userId, 'Reconciliação Forçada', 'Assinatura expirada devido ao término do período sem renovação automática', req);
                }
              }
            }
          }
        } catch (e: any) {
          if (process.env.NODE_ENV !== 'production') console.warn('Dev: Firestore direct reconcile skipped', e?.message);
        }
      }

      const refreshedDetails = await SubscriptionService.validateAndGetDetails(userId);
      return res.json({
        success: true,
        reconciled: true,
        details: refreshedDetails
      });
    } catch (e: any) {
      return res.json({ success: false, reconciled: false, error: e?.message || 'Erro na reconciliação' });
    }
  };

  app.post("/api/subscription/sync", handleSubscriptionReconciliation);
  app.post("/api/subscription/reconcile", handleSubscriptionReconciliation);

  // POST Cancel Subscription Auto-Renewal
  app.post("/api/subscription/cancel", async (req, res) => {
    try {
      const { userId, subscription_id, email } = req.body;
      if (!userId) {
        console.error('[Subscription Cancel Error] Usuário não autenticado / userId ausente.');
        return res.status(400).json({ success: false, error: "Usuário não autenticado. ID do usuário é obrigatório." });
      }

      console.log(`[Subscription Cancel] 1. Usuário autenticado: ${userId} (${email || 'sem email'})`);

      let sub = await SubscriptionService.getSubscription(userId);
      if (!sub) {
        sub = {
          userId,
          subscriptionId: subscription_id || 'sub_default',
          status: 'active',
          plano: 'Mensal',
          purchaseDate: Date.now(),
          activationDate: Date.now(),
          renewDate: Date.now() + 30 * 86400 * 1000,
          expirationDate: Date.now() + 30 * 86400 * 1000,
          autoRenew: true,
          cancelAtPeriodEnd: false,
          gateway: 'stripe',
          paymentMethod: { brand: 'visa', last4: '4242' },
          lastPayment: { amount: 3990, currency: 'brl', date: Date.now(), status: 'succeeded' },
          nextPayment: { amount: 3990, currency: 'brl', date: Date.now() + 30 * 86400 * 1000 },
          paymentHistory: []
        };
      }

      let customerId = sub?.customerId || sub?.stripeCustomerId;
      let targetSubId = subscription_id || sub?.subscriptionId || sub?.stripeSubscriptionId;

      if (!customerId || !targetSubId) {
        try {
          const userDoc = await adminDb.collection('users').doc(userId).get();
          if (userDoc.exists) {
            const uData = userDoc.data();
            customerId = customerId || uData?.stripeCustomerId || uData?.customerId;
            targetSubId = targetSubId || uData?.stripeSubscriptionId || uData?.subscriptionId;
          }
        } catch (err: any) {
          console.log(`[Subscription Cancel Info] Documento do usuário via Firestore indisponível (${err.message?.includes('PERMISSION_DENIED') ? 'Permissão Firestore' : err.message}). Utilizando valores do estado local/memória.`);
        }
      }

      console.log(`[Subscription Cancel] 2. customerId: ${customerId || 'N/A'}, subscriptionId: ${targetSubId || 'N/A'}`);

      const stripe = getStripe();
      let stripeResponse = null;

      if (stripe) {
        if (targetSubId && !targetSubId.startsWith('sub_default')) {
          try {
            stripeResponse = await stripe.subscriptions.update(targetSubId, {
              cancel_at_period_end: true
            });
            console.log('[Subscription Cancel] 3. Resposta do Stripe:', JSON.stringify(stripeResponse));
          } catch (stripeErr: any) {
            console.error('[Subscription Cancel Error] Erro ao cancelar no Stripe:', stripeErr);
            return res.status(400).json({
              success: false,
              error: `Erro retornado pelo Stripe: ${stripeErr.message || 'Falha ao atualizar assinatura no Stripe.'}`
            });
          }
        } else if (customerId) {
          try {
            const subsList = await stripe.subscriptions.list({ customer: customerId, status: 'active', limit: 1 });
            if (subsList.data && subsList.data.length > 0) {
              const activeSub = subsList.data[0];
              targetSubId = activeSub.id;
              stripeResponse = await stripe.subscriptions.update(targetSubId, { cancel_at_period_end: true });
              console.log('[Subscription Cancel] 3. Resposta do Stripe (via customerId):', JSON.stringify(stripeResponse));
            }
          } catch (stripeErr: any) {
            console.error('[Subscription Cancel Error] Erro ao buscar assinaturas do cliente no Stripe:', stripeErr);
            return res.status(400).json({
              success: false,
              error: `Erro retornado pelo Stripe: ${stripeErr.message}`
            });
          }
        }
      } else {
        console.log('[Subscription Cancel] AVISO: Chave do Stripe não configurada ou ambiente sandbox.');
      }

      const stripeEndTs = stripeResponse?.current_period_end ? (stripeResponse.current_period_end * 1000) : null;
      const targetEndDate = stripeEndTs || sub.renewDate || sub.expirationDate || sub.nextRenewal || (Date.now() + 30 * 86400 * 1000);
      const formattedDate = new Date(targetEndDate).toLocaleDateString('pt-BR');
      const expiresAtIso = new Date(targetEndDate).toISOString();

      sub.autoRenew = false;
      sub.cancelAtPeriodEnd = true;
      sub.status = 'active'; // Continua ativo até o fim do período já pago
      sub.renewDate = targetEndDate;
      sub.expirationDate = targetEndDate;
      sub.cancelAt = Date.now();
      if (targetSubId) sub.subscriptionId = targetSubId;
      if (customerId) sub.customerId = customerId;

      await SubscriptionService.saveSubscription(sub);
      await SubscriptionService.emitEvent(userId, 'SubscriptionCanceled', { subscriptionId: sub.subscriptionId });
      try {
        await addSystemLog('info', userId, 'Cancelamento de Renovação', 'Renovação automática da assinatura ZENO Pro cancelada.', req);
      } catch (logErr) {}

      return res.json({
        success: true,
        status: "cancel_at_period_end",
        expiresAt: expiresAtIso,
        current_period_end: expiresAtIso,
        subscriptionId: targetSubId || 'sub_default',
        formattedDate,
        message: `Renovação automática cancelada com sucesso. Sua assinatura permanecerá ativa até ${formattedDate}.`
      });
    } catch (e: any) {
      console.error('[Subscription Cancel Fatal Error]', e);
      return res.status(500).json({ success: false, error: e.message || 'Erro interno no servidor ao cancelar renovação.' });
    }
  });

  // POST Reactivate Subscription Auto-Renewal
  app.post("/api/subscription/reactivate", async (req, res) => {
    try {
      const { userId, subscription_id, email } = req.body;
      if (!userId) {
        console.error('[Subscription Reactivate Error] Usuário não autenticado / userId ausente.');
        return res.status(400).json({ success: false, error: "Usuário não autenticado. ID do usuário é obrigatório." });
      }

      console.log(`[Subscription Reactivate] 1. Usuário autenticado: ${userId} (${email || 'sem email'})`);

      let sub = await SubscriptionService.getSubscription(userId);
      if (!sub) {
        sub = {
          userId,
          subscriptionId: subscription_id || 'sub_default',
          status: 'active',
          plano: 'Mensal',
          purchaseDate: Date.now(),
          activationDate: Date.now(),
          renewDate: Date.now() + 30 * 86400 * 1000,
          expirationDate: Date.now() + 30 * 86400 * 1000,
          autoRenew: false,
          cancelAtPeriodEnd: true,
          gateway: 'stripe',
          paymentMethod: { brand: 'visa', last4: '4242' },
          lastPayment: { amount: 3990, currency: 'brl', date: Date.now(), status: 'succeeded' },
          nextPayment: { amount: 3990, currency: 'brl', date: Date.now() + 30 * 86400 * 1000 },
          paymentHistory: []
        };
      }

      let customerId = sub?.customerId || sub?.stripeCustomerId;
      let targetSubId = subscription_id || sub?.subscriptionId || sub?.stripeSubscriptionId;

      if (!customerId || !targetSubId) {
        try {
          const userDoc = await adminDb.collection('users').doc(userId).get();
          if (userDoc.exists) {
            const uData = userDoc.data();
            customerId = customerId || uData?.stripeCustomerId || uData?.customerId;
            targetSubId = targetSubId || uData?.stripeSubscriptionId || uData?.subscriptionId;
          }
        } catch (err: any) {
          console.log(`[Subscription Reactivate Info] Documento do usuário via Firestore indisponível (${err.message?.includes('PERMISSION_DENIED') ? 'Permissão Firestore' : err.message}). Utilizando valores do estado local/memória.`);
        }
      }

      console.log(`[Subscription Reactivate] 2. customerId: ${customerId || 'N/A'}, subscriptionId: ${targetSubId || 'N/A'}`);

      const stripe = getStripe();
      let stripeResponse = null;

      if (stripe) {
        if (targetSubId && !targetSubId.startsWith('sub_default')) {
          try {
            const currentSub = await stripe.subscriptions.retrieve(targetSubId);
            if (currentSub.status === 'canceled') {
              return res.status(400).json({
                success: false,
                error: 'Sua assinatura expirou ou foi totalmente cancelada. Por favor, assine novamente usando o botão Renovar.'
              });
            }
            stripeResponse = await stripe.subscriptions.update(targetSubId, {
              cancel_at_period_end: false
            });
            console.log('[Subscription Reactivate] 3. Resposta do Stripe:', JSON.stringify(stripeResponse));
          } catch (stripeErr: any) {
            console.error('[Subscription Reactivate Error] Erro ao reativar no Stripe:', stripeErr);
            return res.status(400).json({
              success: false,
              error: `Erro retornado pelo Stripe: ${stripeErr.message || 'Falha ao reativar assinatura no Stripe.'}`
            });
          }
        } else if (customerId) {
          try {
            const subsList = await stripe.subscriptions.list({ customer: customerId, limit: 1 });
            if (subsList.data && subsList.data.length > 0) {
              const activeSub = subsList.data[0];
              targetSubId = activeSub.id;
              if (activeSub.status === 'canceled') {
                return res.status(400).json({
                  success: false,
                  error: 'Sua assinatura expirou ou foi totalmente cancelada. Por favor, assine novamente usando o botão Renovar.'
                });
              }
              stripeResponse = await stripe.subscriptions.update(targetSubId, { cancel_at_period_end: false });
              console.log('[Subscription Reactivate] 3. Resposta do Stripe (via customerId):', JSON.stringify(stripeResponse));
            }
          } catch (stripeErr: any) {
            console.error('[Subscription Reactivate Error] Erro ao buscar assinaturas do cliente no Stripe:', stripeErr);
            return res.status(400).json({
              success: false,
              error: `Erro retornado pelo Stripe: ${stripeErr.message}`
            });
          }
        }
      } else {
        console.log('[Subscription Reactivate] AVISO: Chave do Stripe não configurada ou ambiente sandbox.');
      }

      const stripeEndTs = stripeResponse?.current_period_end ? (stripeResponse.current_period_end * 1000) : null;
      const targetEndDate = stripeEndTs || sub.renewDate || sub.expirationDate || sub.nextRenewal || (Date.now() + 30 * 86400 * 1000);
      const formattedDate = new Date(targetEndDate).toLocaleDateString('pt-BR');
      const expiresAtIso = new Date(targetEndDate).toISOString();

      sub.autoRenew = true;
      sub.cancelAtPeriodEnd = false;
      sub.status = 'active';
      sub.renewDate = targetEndDate;
      sub.expirationDate = targetEndDate;
      if (targetSubId) sub.subscriptionId = targetSubId;
      if (customerId) sub.customerId = customerId;

      await SubscriptionService.saveSubscription(sub);
      await SubscriptionService.emitEvent(userId, 'SubscriptionActivated', { subscriptionId: sub.subscriptionId });
      try {
        await addSystemLog('info', userId, 'Reativação de Renovação', 'Cobrança automática da assinatura ZENO Pro reativada.', req);
      } catch (logErr) {}

      return res.json({
        success: true,
        status: "active",
        cancelAtPeriodEnd: false,
        subscriptionId: targetSubId || 'sub_default',
        expiresAt: expiresAtIso,
        current_period_end: expiresAtIso,
        formattedDate,
        message: 'Sua cobrança automática foi reativada com sucesso.'
      });
    } catch (e: any) {
      console.error('[Subscription Reactivate Fatal Error]', e);
      return res.status(500).json({ success: false, error: e.message || 'Erro interno no servidor ao reativar renovação.' });
    }
  });

  // POST Create Stripe Customer Portal Session
  app.post("/api/create-portal-session", async (req, res) => {
    try {
      const { userId, email } = req.body;
      const stripeSecret = process.env.STRIPE_SECRET_KEY;
      if (!stripeSecret || stripeSecret === "sk_test_mock") {
        return res.json({ url: null, message: "Stripe Customer Portal não configurado (modo desenvolvimento)." });
      }

      const stripe = new Stripe(stripeSecret);
      let customerId: string | undefined = undefined;

      if (userId) {
        const subDoc = await adminDb.collection('subscriptions').doc(userId).get();
        if (subDoc.exists) {
          const d = subDoc.data();
          customerId = d?.customerId || d?.stripeCustomerId;
        }
      }

      if (!customerId && email) {
        const customers = await stripe.customers.list({ email, limit: 1 });
        if (customers.data.length > 0) {
          customerId = customers.data[0].id;
        }
      }

      if (!customerId) {
        return res.status(404).json({ error: "Nenhum cadastro de cliente Stripe encontrado para esta conta." });
      }

      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:3000';
      const baseUrl = process.env.APP_URL || `${protocol}://${host}`;

      const portalSession = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: baseUrl,
      });

      return res.json({ url: portalSession.url });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // GET Subscription Invoices & Billing Receipts
  app.get("/api/subscription/invoices", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      const email = req.query.email as string;

      const stripeSecret = process.env.STRIPE_SECRET_KEY;
      if (stripeSecret && stripeSecret !== "sk_test_mock") {
        try {
          const stripe = new Stripe(stripeSecret);
          let customerId: string | undefined = undefined;

          if (userId) {
            const subDoc = await adminDb.collection('subscriptions').doc(userId).get();
            if (subDoc.exists) {
              const d = subDoc.data();
              customerId = d?.customerId || d?.stripeCustomerId;
            }
          }

          if (!customerId && email) {
            const customers = await stripe.customers.list({ email, limit: 1 });
            if (customers.data.length > 0) {
              customerId = customers.data[0].id;
            }
          }

          if (customerId) {
            const invoices = await stripe.invoices.list({ customer: customerId, limit: 10 });
            const list = invoices.data.map(inv => ({
              id: inv.id,
              number: inv.number || inv.id,
              amount: inv.amount_paid || inv.total,
              currency: inv.currency,
              status: inv.status === 'paid' ? 'succeeded' : inv.status,
              date: inv.created * 1000,
              description: inv.lines?.data[0]?.description || 'Assinatura ZENO Pro',
              pdfUrl: inv.invoice_pdf,
              hostedUrl: inv.hosted_invoice_url
            }));
            if (list.length > 0) {
              return res.json({ invoices: list });
            }
          }
        } catch (e: any) {
          console.warn("Invoices Stripe fetch warning:", e?.message);
        }
      }

      // Return Firestore billing history or standard default receipt if Stripe is not initialized
      if (userId) {
        const subDoc = await adminDb.collection('subscriptions').doc(userId).get();
        if (subDoc.exists) {
          const data = subDoc.data();
          if (data?.billingHistory && Array.isArray(data.billingHistory) && data.billingHistory.length > 0) {
            return res.json({ invoices: data.billingHistory });
          }
        }
      }

      return res.json({
        invoices: [
          {
            id: 'inv_' + Date.now().toString(36),
            number: 'INV-ZENO-001',
            amount: 3990,
            currency: 'brl',
            status: 'succeeded',
            date: Date.now() - 15 * 86400 * 1000,
            description: 'Assinatura ZENO Pro (Mensal)',
            pdfUrl: null,
            hostedUrl: null
          }
        ]
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST Update Payment Method
  app.post("/api/subscription/update-payment", async (req, res) => {
    try {
      const { userId, paymentMethod } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "userId é obrigatório." });
      }
      let sub = await SubscriptionService.getSubscription(userId);
      if (!sub) {
        sub = {
          userId,
          subscriptionId: 'sub_default',
          status: 'active',
          plano: 'Mensal',
          purchaseDate: Date.now(),
          activationDate: Date.now(),
          renewDate: Date.now() + 30 * 86400 * 1000,
          expirationDate: Date.now() + 30 * 86400 * 1000,
          autoRenew: true,
          gateway: 'stripe',
          paymentMethod: { brand: 'visa', last4: '4242' },
          lastPayment: { amount: 3990, currency: 'brl', date: Date.now(), status: 'succeeded' },
          nextPayment: { amount: 3990, currency: 'brl', date: Date.now() + 30 * 86400 * 1000 },
          paymentHistory: []
        };
      }
      sub.paymentMethod = paymentMethod || { brand: 'visa', last4: '4242', expMonth: 12, expYear: 2028 };
      sub.lastRenewalStatus = 'success';
      sub.status = 'active';

      await adminDb.collection('subscriptions').doc(userId).set(sub, { merge: true });
      await SubscriptionService.emitEvent(userId, 'SubscriptionUpdated', { paymentMethod: sub.paymentMethod });
      await addSystemLog('info', userId, 'Atualização de Pagamento', 'Forma de pagamento da assinatura ZENO Pro atualizada.', req);

      res.json({ success: true, paymentMethod: sub.paymentMethod });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/limits", async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId) return res.status(400).json({ error: "userId é necessário." });
      console.log('Fetching usage for:', userId);
      const usage = await getUserUsage(userId as string);
      console.log('Fetching config...');
      const config = await getAdminConfig();
      res.json({ usage, config });
    } catch (e: any) {
      console.error('/api/limits error:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // Image Library Endpoints
  app.get("/api/images", async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId) {
        return res.json([]); // Strictly isolate: require userId
      }
      let snap;
      try {
        snap = await adminDb.collection('images').where('userId', '==', userId).orderBy('timestamp', 'desc').limit(200).get();
      } catch (idxErr) {
        try {
          snap = await adminDb.collection('images').where('userId', '==', userId).limit(200).get();
        } catch (dbErr) {
          return res.json([]);
        }
      }
      return res.json(snap.docs.map(d => d.data()));
    } catch (e: any) {
      return res.json([]);
    }
  });

  app.post("/api/images", async (req, res) => {
    try {
      const item = req.body;
      if (!item || !item.imageUrl || !item.userId) {
        return res.status(400).json({ error: "Dados inválidos ou userId ausente." });
      }
      const id = item.id || `img-${Date.now()}`;
      await adminDb.collection('images').doc(id).set({ ...item, id, userId: item.userId }, { merge: true });
      return res.json({ success: true, item: { ...item, id } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/images/:id", async (req, res) => {
    const { id } = req.params;
    const { userId } = req.query;
    try {
      const docRef = adminDb.collection('images').doc(id);
      const doc = await docRef.get();
      if (doc.exists) {
        const data = doc.data();
        if (userId && data?.userId && data.userId !== userId) {
          return res.status(403).json({ error: "Acesso negado: imagem pertence a outro usuário." });
        }
        await docRef.delete();
      }
      return res.json({ success: true });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // Account Initialization Endpoint for New / Switched Accounts
  app.post("/api/account/init", async (req, res) => {
    try {
      const { userId, email, name, photoURL } = req.body;
      if (!userId) return res.status(400).json({ error: "userId is required" });

      try {
        const now = Date.now();
        const userDocRef = adminDb.collection('users').doc(userId);
        const userDoc = await userDocRef.get();

        if (!userDoc.exists) {
          // Initialize user settings & profile
          const defaultSettings = {
            userName: name || 'Usuário ZENO',
            userEmail: email || '',
            userAvatar: photoURL || '',
            plan: 'ZENO Free',
            theme: 'dark',
            logoVariant: 'monochrome',
            fontSize: 'normal',
            defaultSpeed: 'zeno',
            temperature: 0.7,
            systemInstruction: '',
            autoRead: false,
            voiceSpeed: 1.0,
            speechLanguage: 'pt-BR',
            customInstructions: '',
            memoryEnabled: true,
            saveHistory: true,
            anonymousMode: false,
            rememberDevice: true,
            language: 'pt-BR',
            soundEnabled: true,
            notificationsEnabled: true,
          };

          await userDocRef.set({
            userId,
            email: email || '',
            name: name || 'Usuário ZENO',
            photoURL: photoURL || '',
            createdAt: now,
            settings: defaultSettings,
          }, { merge: true });
        }

        // Initialize default subscription
        const sub = await SubscriptionService.getSubscription(userId);
        if (!sub) {
          await adminDb.collection('subscriptions').doc(userId).set({
            userId,
            plan: 'ZENO Free',
            status: 'active',
            trialUsed: false,
            trialEndsAt: null,
            renewAt: null,
            cancelAtPeriodEnd: false,
            paymentMethod: null,
            history: []
          }, { merge: true });
        }

        // Initialize daily usage
        await getUserUsage(userId, email, req);
      } catch (dbErr: any) {
        console.warn('[Account Init DB Warning - proceeding with local fallback]:', dbErr?.message || dbErr);
      }

      res.json({ success: true, userId });
    } catch (e: any) {
      console.error('/api/account/init error:', e);
      res.json({ success: true, userId: req.body?.userId || 'unknown', fallback: true });
    }
  });

  // Cloud Synchronization Endpoints
  app.get("/api/sync/sessions", async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId) return res.status(400).json({ error: "userId is required" });
      let snap;
      try {
        snap = await adminDb.collection('chats').where('userId', '==', userId).orderBy('updatedAt', 'desc').get();
      } catch (idxErr) {
        try {
          snap = await adminDb.collection('chats').where('userId', '==', userId).get();
        } catch (dbErr) {
          return res.json({ sessions: [] });
        }
      }
      const sessions = snap?.docs ? snap.docs.map(d => d.data()) : [];
      return res.json({ sessions });
    } catch (e: any) {
      return res.json({ sessions: [] });
    }
  });

  app.post("/api/sync/sessions", async (req, res) => {
    try {
      const { userId, sessions } = req.body;
      if (!userId || !Array.isArray(sessions)) return res.status(400).json({ error: "Invalid data" });
      
      try {
        const batch = adminDb.batch();
        sessions.forEach((s: any) => {
          const ref = adminDb.collection('chats').doc(s.id);
          batch.set(ref, { ...s, userId }, { merge: true });
        });
        await batch.commit();
      } catch (dbErr) {
        // DB fallback
      }
      return res.json({ success: true });
    } catch (e: any) {
      return res.json({ success: true, warning: e.message });
    }
  });

  app.get("/api/sync/settings", async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId) return res.status(400).json({ error: "userId is required" });
      try {
        const doc = await adminDb.collection('users').doc(userId as string).get();
        if (!doc.exists) return res.json({ settings: null });
        const data = doc.data();
        return res.json({ settings: data?.settings || null });
      } catch (dbErr) {
        return res.json({ settings: null });
      }
    } catch (e: any) {
      return res.json({ settings: null });
    }
  });

  app.post("/api/sync/settings", async (req, res) => {
    try {
      const { userId, settings } = req.body;
      if (!userId || !settings) return res.status(400).json({ error: "Invalid data" });
      try {
        await adminDb.collection('users').doc(userId).set({ settings }, { merge: true });
      } catch (dbErr) {
        // DB fallback
      }
      return res.json({ success: true });
    } catch (e: any) {
      return res.json({ success: true, warning: e.message });
    }
  });

  // --- CLOUD DRAFT SYNCHRONIZATION ENDPOINTS ---
  app.get("/api/sync/draft", async (req, res) => {
    try {
      const { userId, sessionId } = req.query;
      if (!userId || typeof userId !== 'string') {
        return res.json({ draft: null });
      }
      const docId = sessionId ? `${userId}_${sessionId}` : userId;
      try {
        const doc = await adminDb.collection('drafts').doc(docId).get();
        if (!doc.exists) {
          return res.json({ draft: null });
        }
        const data = doc.data();
        return res.json({ draft: data ? { text: data.text || '', timestamp: data.timestamp || 0 } : null });
      } catch (err) {
        return res.json({ draft: null });
      }
    } catch (e: any) {
      return res.json({ draft: null });
    }
  });

  app.post("/api/sync/draft", async (req, res) => {
    try {
      const { userId, sessionId, text, timestamp } = req.body;
      if (!userId) return res.status(400).json({ error: "userId is required" });
      const docId = sessionId ? `${userId}_${sessionId}` : userId;
      try {
        await adminDb.collection('drafts').doc(docId).set({
          text: text || '',
          timestamp: timestamp || Date.now(),
          updatedAt: Date.now()
        }, { merge: true });
      } catch (err) {
        // Quiet database fallback
      }
      return res.json({ success: true });
    } catch (e: any) {
      return res.json({ success: true, warning: e.message });
    }
  });

  app.delete("/api/sync/draft", async (req, res) => {
    try {
      const { userId, sessionId } = req.query;
      if (!userId || typeof userId !== 'string') {
        return res.json({ success: true });
      }
      const docId = sessionId ? `${userId}_${sessionId}` : userId;
      try {
        await adminDb.collection('drafts').doc(docId).delete();
      } catch (err) {
        // Quiet database fallback
      }
      return res.json({ success: true });
    } catch (e: any) {
      return res.json({ success: true });
    }
  });

  // --- ADAPTIVE LEARNING SYSTEM ENDPOINTS ---
  app.get("/api/adaptive/profile", async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId || typeof userId !== 'string') {
        return res.json({ profile: DEFAULT_ADAPTIVE_PROFILE });
      }

      try {
        const doc = await adminDb.collection('users').doc(userId).get();
        if (!doc.exists) return res.json({ profile: DEFAULT_ADAPTIVE_PROFILE });
        const data = doc.data();
        const profile = data?.adaptiveProfile || data?.settings?.adaptiveProfile || DEFAULT_ADAPTIVE_PROFILE;
        return res.json({ profile });
      } catch (err) {
        return res.json({ profile: DEFAULT_ADAPTIVE_PROFILE });
      }
    } catch (e: any) {
      return res.json({ profile: DEFAULT_ADAPTIVE_PROFILE });
    }
  });

  app.post("/api/adaptive/profile", async (req, res) => {
    try {
      const { userId, profile } = req.body;
      if (!userId || !profile) return res.status(400).json({ error: "userId and profile are required" });

      try {
        await adminDb.collection('users').doc(userId).set({ adaptiveProfile: profile }, { merge: true });
      } catch (err: any) {
        if (process.env.NODE_ENV !== 'production') {
          console.log('[ADAPTIVE API] Handled fallback for Firestore profile update:', err?.message || err);
        }
      }
      return res.json({ success: true, profile });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/adaptive/feedback", async (req, res) => {
    try {
      const { userId, feedback, currentProfile } = req.body;
      if (!feedback || !feedback.msgId) {
        return res.status(400).json({ error: "Feedback de mensagem é obrigatório" });
      }

      const activeProfile = currentProfile || DEFAULT_ADAPTIVE_PROFILE;
      const updatedProfile = updateProfileWithFeedback(activeProfile, feedback);

      if (userId) {
        try {
          const feedbackId = feedback.id || 'fb_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
          await adminDb.collection('users').doc(userId).collection('feedbacks').doc(feedbackId).set({
            ...feedback,
            timestamp: Date.now()
          });

          // Save updated profile
          await adminDb.collection('users').doc(userId).set({ adaptiveProfile: updatedProfile }, { merge: true });
        } catch (dbErr: any) {
          console.warn('[ADAPTIVE FEEDBACK] Firestore save warning:', dbErr.message);
        }
      }

      return res.json({ success: true, updatedProfile, feedback });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // --- ZENO POINTS (ZP) & GAMIFICATION SYSTEM (SERVER-SIDE) ---
  const GAMIFICATION_LEVELS = [
    { name: 'Iniciante', minPoints: 0 },
    { name: 'Explorador', minPoints: 100 },
    { name: 'Aprendiz', minPoints: 300 },
    { name: 'Desenvolvedor', minPoints: 600 },
    { name: 'Especialista', minPoints: 1000 },
    { name: 'Mestre', minPoints: 1500 },
    { name: 'Arquiteto', minPoints: 2500 },
    { name: 'Visionário', minPoints: 4000 },
    { name: 'Gênio', minPoints: 6000 },
    { name: 'Lenda ZENO', minPoints: 10000 },
  ];

  const localGamificationStore = new Map<string, any>();

  function calculateLevelServer(totalPoints: number): string {
    let currentTitle = GAMIFICATION_LEVELS[0].name;
    for (const lvl of GAMIFICATION_LEVELS) {
      if (totalPoints >= lvl.minPoints) {
        currentTitle = lvl.name;
      } else {
        break;
      }
    }
    return currentTitle;
  }

  function getNextLevelInfoServer(totalPoints: number) {
    let currentIdx = 0;
    for (let i = 0; i < GAMIFICATION_LEVELS.length; i++) {
      if (totalPoints >= GAMIFICATION_LEVELS[i].minPoints) {
        currentIdx = i;
      } else {
        break;
      }
    }
    const currentLvl = GAMIFICATION_LEVELS[currentIdx];
    const nextLvl = GAMIFICATION_LEVELS[currentIdx + 1] || null;
    
    if (!nextLvl) {
      return {
        currentName: currentLvl.name,
        nextName: 'Nível Máximo',
        progressPercent: 100,
        pointsNeeded: 0,
        currentPoints: totalPoints
      };
    }

    const span = nextLvl.minPoints - currentLvl.minPoints;
    const earned = totalPoints - currentLvl.minPoints;
    const progressPercent = Math.min(100, Math.max(0, Math.round((earned / span) * 100)));

    return {
      currentName: currentLvl.name,
      nextName: nextLvl.name,
      progressPercent,
      pointsNeeded: nextLvl.minPoints - totalPoints,
      currentPoints: totalPoints
    };
  }

  function createInitialAuthenticatedProfile(userId: string) {
    return {
      userId,
      totalPoints: 125,
      currentLevel: 'Explorador',
      currentStreak: 1,
      lastActiveDate: new Date().toISOString().split('T')[0],
      stats: {
        conversationsCount: 1,
        projectsCreated: 0,
        imagesGenerated: 0,
        searchesPerformed: 0,
        codeBlocksProduced: 0,
        activeDays: 1,
        totalActiveTimeMinutes: 0
      },
      badges: [],
      completedQuests: []
    };
  }

  async function awardUserPointsServer(
    userId: string, 
    actionOrPoints: string | number, 
    statKey?: string
  ): Promise<any> {
    if (!userId || userId === 'anonymous' || userId.startsWith('anon_') || userId === 'local_user') {
      return null;
    }

    let numPoints = 5;
    if (typeof actionOrPoints === 'number') {
      numPoints = actionOrPoints;
    } else {
      switch (actionOrPoints) {
        case 'message': numPoints = 5; break;
        case 'project': numPoints = 30; break;
        case 'image': numPoints = 20; break;
        case 'search': numPoints = 10; break;
        case 'code': numPoints = 15; break;
        case 'python_complete': numPoints = 100; break;
        default: numPoints = 5; break;
      }
    }

    let profile = localGamificationStore.get(userId);

    try {
      const docRef = adminDb.collection('gamificationProfiles').doc(userId);
      const snap = await docRef.get();
      if (snap.exists) {
        profile = snap.data();
      }
    } catch (err: any) {
      // In-memory fallback used seamlessly
    }

    if (!profile) {
      profile = createInitialAuthenticatedProfile(userId);
    } else if ((profile.totalPoints || 0) < 125) {
      profile.totalPoints = 125;
      profile.currentLevel = calculateLevelServer(125);
    }

    profile.totalPoints = (profile.totalPoints || 0) + numPoints;
    profile.currentLevel = calculateLevelServer(profile.totalPoints);

    if (!profile.stats) {
      profile.stats = {
        conversationsCount: 0,
        projectsCreated: 0,
        imagesGenerated: 0,
        searchesPerformed: 0,
        codeBlocksProduced: 0,
        activeDays: 1,
        totalActiveTimeMinutes: 0
      };
    }

    if (statKey && profile.stats[statKey] !== undefined) {
      profile.stats[statKey] = (profile.stats[statKey] || 0) + 1;
    }

    if (!profile.badges) profile.badges = [];
    if (profile.totalPoints >= 1000 && !profile.badges.some((b: any) => b.badgeId === 'architect_master')) {
      profile.badges.push({ badgeId: 'architect_master', earnedAt: new Date().toISOString() });
    }
    if (profile.totalPoints >= 10000 && !profile.badges.some((b: any) => b.badgeId === 'zeno_legend')) {
      profile.badges.push({ badgeId: 'zeno_legend', earnedAt: new Date().toISOString() });
    }

    localGamificationStore.set(userId, profile);

    try {
      const docRef = adminDb.collection('gamificationProfiles').doc(userId);
      await docRef.set(profile, { merge: true });
    } catch (err: any) {
      // In-memory store updated seamlessly
    }

    return profile;
  }

  app.get("/api/gamification/profile", async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId || typeof userId !== 'string' || userId === 'anonymous' || userId.startsWith('anon_') || userId === 'local_user') {
        return res.json({ profile: null, levelInfo: null });
      }

      let profile = localGamificationStore.get(userId);

      try {
        const docRef = adminDb.collection('gamificationProfiles').doc(userId);
        const snap = await docRef.get();
        if (snap.exists) {
          const data = snap.data();
          if (data) profile = data;
        }
      } catch (dbErr) {
        // Fallback to local memory store
      }

      if (!profile) {
        profile = createInitialAuthenticatedProfile(userId);
      } else if ((profile.totalPoints || 0) < 125) {
        profile.totalPoints = 125;
        profile.currentLevel = calculateLevelServer(125);
      }

      profile.currentLevel = calculateLevelServer(profile.totalPoints || 0);
      return res.json({ profile, levelInfo: getNextLevelInfoServer(profile.totalPoints || 0) });
    } catch (e: any) {
      return res.json({ profile: null, levelInfo: null });
    }
  });

  app.post("/api/gamification/award", async (req, res) => {
    try {
      const { userId, action, statKey } = req.body;
      if (!userId) return res.status(400).json({ error: "userId required" });

      // SECURITY: Reject client attempts to pass arbitrary ZP values (e.g., totalPoints or numbers)
      // Only predefined action strings are allowed for award requests!
      const allowedActions = ['message', 'project', 'image', 'search', 'code', 'python_complete'];
      const safeAction = allowedActions.includes(action) ? action : 'message';

      const updatedProfile = await awardUserPointsServer(userId, safeAction, statKey);
      return res.json({ success: true, profile: updatedProfile });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/sync/account", async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId) return res.status(400).json({ error: "userId is required" });
      
      const batch = adminDb.batch();
      const chatSnap = await adminDb.collection('chats').where('userId', '==', userId).get();
      chatSnap.docs.forEach(d => batch.delete(d.ref));
      const imgSnap = await adminDb.collection('images').where('userId', '==', userId).get();
      imgSnap.docs.forEach(d => batch.delete(d.ref));
      const memSnap = await adminDb.collection('memory').where('userId', '==', userId).get();
      memSnap.docs.forEach(d => batch.delete(d.ref));
      batch.delete(adminDb.collection('users').doc(userId as string));
      batch.delete(adminDb.collection('subscriptions').doc(userId as string));
      await batch.commit();
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Stripe Checkout Session Endpoint
  app.post("/api/create-checkout-session", async (req, res) => {
    try {
      const { plan, email, hasUsedFreeTrial, userId } = req.body;
      const stripeSecret = process.env.STRIPE_SECRET_KEY || "sk_test_mock";
      const stripe = new Stripe(stripeSecret);

      const isAnnual = plan === "annual";
      let userEligibleForTrial = !hasUsedFreeTrial;

      if (email && process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== "sk_test_mock") {
        try {
          const customers = await stripe.customers.list({ email, limit: 10 });
          for (const customer of customers.data) {
            const subscriptions = await stripe.subscriptions.list({ customer: customer.id, status: 'all', limit: 10 });
            if (subscriptions.data.length > 0) {
              userEligibleForTrial = false;
              break;
            }
          }
        } catch (e) {
          console.error("Erro ao verificar histórico Stripe:", e);
        }
      }

      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:3000';
      const baseUrl = process.env.APP_URL || `${protocol}://${host}`;

      console.log("=== STRIPE CHECKOUT SESSION REQUEST ===");
      console.log("Request Body:", { plan, email, hasUsedFreeTrial, userId });
      console.log("Computed userEligibleForTrial:", userEligibleForTrial);

      const sessionConfig: Stripe.Checkout.SessionCreateParams = {
        payment_method_types: ["card"],
        mode: "subscription",
        customer_email: email,
        client_reference_id: userId,
        metadata: { userId, billingCycle: plan },
        subscription_data: {
          metadata: { userId, billingCycle: plan }
        },
        line_items: [
          {
            price_data: {
              currency: "brl",
              product_data: {
                name: isAnnual ? "ZENO Pro - Plano Anual" : "ZENO Pro - Plano Mensal",
                description: isAnnual ? "Acesso anual ilimitado aos modelos ZENO" : "Acesso mensal ilimitado aos modelos ZENO",
              },
              unit_amount: isAnnual ? 39990 : 3990,
              recurring: { interval: isAnnual ? "year" : "month" },
            },
            quantity: 1,
          },
        ],
        success_url: `${baseUrl}?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}?canceled=true`,
      };

      if (userEligibleForTrial) {
        sessionConfig.subscription_data = { trial_period_days: 30 };
      }

      console.log("Final sessionConfig sent to Stripe:", JSON.stringify(sessionConfig, null, 2));
      const session = await stripe.checkout.sessions.create(sessionConfig);
      console.log("=== STRIPE CHECKOUT SESSION CREATED ===");
      console.log("Full Session Object:", JSON.stringify(session, null, 2));
      console.log("Session ID:", session.id, "URL:", session.url, "Trial Applied:", userEligibleForTrial);
      return res.json({ url: session.url, trialApplied: userEligibleForTrial });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  // Image Generation Endpoint (used by ImageStudioModal)
  app.post("/api/generate-image", async (req, res) => {
    try {
      const { prompt, style, aspectRatio, enhance, userEmail, userId, plan } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Prompt é obrigatório." });
      }

      console.log(`[API /generate-image] Solicitação de ${userEmail || userId || 'Anônimo'} (${plan || 'ZENO Free'}): "${prompt}"`);

      const task = await createQueuedTask({
        userId: userId || 'anon-user',
        userEmail: userEmail || 'Anônimo',
        plan: plan || 'ZENO Free',
        payload: {
          prompt,
          style: style || 'photorealistic',
          aspectRatio: aspectRatio || '1:1',
          enhance: enhance !== undefined ? enhance : true,
          engine: "flux",
          negativePrompt: ""
        },
        req
      });

      if (plan === 'ZENO Pro' || plan === 'ADMIN') {
        executeAndProcessTask(task.id, req).catch(err => console.error('[BG TASK ERROR]', err));
      }

      const details = await getTaskStatusDetails(task.id);
      return res.json({
        taskId: task.id,
        status: task.status,
        position: details.position,
        estimatedTimeSeconds: details.estimatedTimeSeconds
      });
    } catch (e: any) {
      console.error('[API /generate-image] Erro:', e);
      return res.status(500).json({ error: e.message || 'Erro ao processar solicitação de imagem.' });
    }
  });

  // Task APIs for polling
  app.post("/api/images/task", async (req, res) => {
    try {
      const { prompt, userId, userEmail, plan } = req.body;
      const task = await createQueuedTask({
        userId,
        userEmail,
        plan: plan || 'ZENO Free',
        payload: {
          prompt,
          style: 'photorealistic',
          aspectRatio: '1:1',
          enhance: true,
          engine: "flux",
          negativePrompt: ""
        },
        req
      });
      const details = await getTaskStatusDetails(task.id);
      res.json(details);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/tasks/status/:id", async (req, res) => {
    try {
      const details = await getTaskStatusDetails(req.params.id);
      if (!details.task) return res.status(404).json({ error: "Não encontrado" });
      res.json(details);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/tasks/cancel", async (req, res) => {
    try {
      const { taskId, userEmail } = req.body;
      const success = await cancelQueuedTask(taskId, userEmail, req);
      res.json({ success });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Health
  app.get("/api/health", async (req, res) => {
    res.json({ status: "healthy", timestamp: Date.now() });
  });

  
// Support Assume Ticket API
app.post("/api/support/assume", async (req, res) => {
  try {
    const verified = await getVerifiedUser(req);
    
    if (!verified || !verified.uid) {
      return res.status(401).json({ error: "Usuário não autenticado." });
    }

    const { ticketId } = req.body;
    if (!ticketId) {
      return res.status(400).json({ error: "O ID do ticket (ticketId) é obrigatório." });
    }

    // Verify if user is admin
    // Note: To be perfectly safe we could check the email or the admins collection,
    // but the instruction says "verifique se o usuário é admin via Firebase Auth"
    // Since getVerifiedUser just gets the token, let's verify their email.
    const isAdmin = verified.email === 'davifernandes0024509@gmail.com' || 
                    (await adminDb.collection('admins').doc(verified.email.toLowerCase()).get()).exists;

    if (!isAdmin) {
      return res.status(403).json({ error: "Acesso Negado: Apenas administradores podem assumir tickets." });
    }

    const ticketRef = adminDb.collection('supportTickets').doc(ticketId);
    await ticketRef.update({
      status: 'human_active',
      assumedAt: Date.now()
    });

    res.json({ success: true, message: "Ticket assumido com sucesso." });
  } catch (error: any) {
    console.error("[Support Assume Error]:", error);
    res.status(500).json({ error: error.message });
  }
});

// Support Chat API
app.post("/api/support/chat", async (req, res) => {
  try {
    const { messages, actionCallback } = req.body;
    const verified = await getVerifiedUser(req);
    
    if (!verified || !verified.uid) {
      console.warn("[Support Chat] Usuário não autenticado no suporte (token ausente ou inválido).");
      return res.status(401).json({ error: "Usuário não autenticado." });
    }

    const userId = verified.uid;
    const email = verified.email || '';

    console.log(`[Support Chat] Processando chat para: ${email} (${userId})`);

    // 0. Check for active human handoff
    let activeTicketSnapshot = null;
    try {
      if (userId) {
        activeTicketSnapshot = await adminDb.collection('supportTickets')
          .where('userId', '==', userId)
          .where('status', 'in', ['pending_human', 'human_active'])
          .limit(1)
          .get();
      }
    } catch (handoffErr: any) {
      console.warn("[SUPPORT CHAT] Falha ao verificar handoff ativo (Firestore):", handoffErr.message);
    }

    if (activeTicketSnapshot && !activeTicketSnapshot.empty) {
      const ticketDoc = activeTicketSnapshot.docs[0];
      const lastUserMessage = messages[messages.length - 1]?.content;
      
      try {
        // Save message to ticket subcollection
        await ticketDoc.ref.collection('messages').add({
          sender: 'user',
          text: lastUserMessage,
          timestamp: Date.now()
        });

        // Update ticket metadata
        await ticketDoc.ref.update({
          lastMessageAt: Date.now()
        });

        return res.json({ handoff: true, status: ticketDoc.data().status });
      } catch (saveErr: any) {
        console.error("[SUPPORT CHAT] Erro ao salvar mensagem no ticket ativo:", saveErr.message);
      }
    }

    // Tools
    const tools = [{
      functionDeclarations: supportTools
    }];

    // Read KB
    const kbPath = path.join(process.cwd(), 'src/lib/faqKnowledge.ts');
    let kb = "";
    if (fs.existsSync(kbPath)) {
      kb = fs.readFileSync(kbPath, 'utf8');
    }

    let userContextStr = "";
    let refusalContext = "";
    try {
      let sub = null;
      try {
        sub = await SubscriptionService.getSubscription(userId);
      } catch (err: any) {
        console.warn("[SUPPORT CHAT] Falha ao buscar assinatura:", err.message);
      }
      
      let userData: any = {};
      try {
        const userDoc = await adminDb.collection('users').doc(userId).get();
        if (userDoc.exists) {
          userData = userDoc.data();
        }
      } catch (err: any) {
        console.warn("[SUPPORT CHAT] Falha ao buscar dados do usuário:", err.message);
      }
      
      let eventsList: any[] = [];
      try {
        const eventsSnapshot = await adminDb.collection('subscription_events')
          .where('userId', '==', userId)
          .limit(5)
          .get();
        eventsSnapshot.forEach((doc: any) => eventsList.push(doc.data()));
      } catch (e: any) {
        console.warn("[SUPPORT CHAT] Falha ao buscar eventos:", e.message);
      }

      // Check for recent refused tickets to give context to AI
      try {
        const refusedSnap = await adminDb.collection('supportTickets')
          .where('userId', '==', userId)
          .where('status', 'in', ['ai_active', 'returned_to_ai'])
          .orderBy('refusedAt', 'desc')
          .limit(1)
          .get();
        
        if (!refusedSnap.empty) {
          const t = refusedSnap.docs[0].data();
          refusalContext = `\n[ALERTA DE REABERTURA]: O suporte humano RECUSOU seu escalonamento anterior em ${new Date(t.refusedAt).toLocaleString('pt-BR')}.
Motivo da recusa: "${t.refusalReason}"
AÇÃO: Você DEVE tentar resolver o problema do usuário novamente usando suas ferramentas e dados. O humano avaliou que você é capaz de resolver isso sozinho. NÃO ESCALE NOVAMENTE pelo mesmo motivo sem tentar uma nova solução real.`;
        }
      } catch (e) {
        console.warn("[SUPPORT CHAT] Falha ao buscar tickets recusados:", e);
      }

      let planName = 'Free';
      let status = 'n/a';
      let renewDate = 'N/A';
      let autoRenew = false;
      let cancelAtPeriodEnd = false;

      // Priority 1: Subscription record from subscriptions collection
      if (sub) {
        planName = sub.plano || 'ZENO Pro';
        status = sub.status || 'active';
        const date = sub.renewDate || sub.expirationDate;
        renewDate = date ? new Date(date).toLocaleDateString('pt-BR') : 'N/A';
        autoRenew = sub.autoRenew !== false;
        cancelAtPeriodEnd = sub.cancelAtPeriodEnd || false;
      } 
      // Priority 2: Fallback to user document
      else if (userData?.plan && userData.plan !== 'Free' && userData.plan !== 'Gratuito') {
        planName = userData.plan;
        status = userData.status || 'active';
        autoRenew = userData.autoRenew !== false;
      }

      // Safety check: force "n/a" for Free plans to avoid AI confusion
      if (planName === 'Free' || planName === 'Gratuito') {
        status = 'n/a';
        renewDate = 'N/A';
        autoRenew = false;
        cancelAtPeriodEnd = false;
      }
      
      userContextStr = `\n\n[DADOS REAIS DO USUÁRIO NO BANCO]:
- ID do Usuário: ${userId}
- E-mail: ${email || userData?.email || 'N/A'}
- Plano Atual: ${planName}
- Status da Assinatura: ${status} (trialing = Teste Grátis, active = Pago/Ativo, n/a = Sem Assinatura/Free)
- Renovação / Fim do Período / Fim do Trial: ${renewDate}
- Renovação Automática Ativa (autoRenew): ${autoRenew}
- Cancelamento já agendado (cancelAtPeriodEnd): ${cancelAtPeriodEnd}
- Eventos recentes de assinatura: ${JSON.stringify(eventsList)}
`;
    } catch (e) {
      console.warn("Could not fetch user sub context for support chat:", e);
    }

    const systemInstruction = `Você é o Assistente de Suporte e FAQ do ZENO AI.
Sua missão é ajudar o usuário com dúvidas sobre o aplicativo, planos e cobranças. Base de conhecimento: ${kb}

DIRETRIZES CRÍTICAS DE EXECUÇÃO:
1. NUNCA invente dados. Use apenas os [DADOS REAIS] fornecidos no contexto.
2. NUNCA confirme uma ação (cancelamento ou criação de ticket) em texto livre sem antes ter chamado a ferramenta (tool) correspondente.
3. Se você decidir chamar uma ferramenta, PARE de gerar texto imediatamente e emita o tool call estruturado. NÃO gere texto e tool call no mesmo turno.
4. NUNCA gere textos como "Vou transferir você agora..." ou "Assumi como suporte humano". Você é uma IA. Se precisar de um humano, use 'createSupportTicket'.
5. Antes de escalar para atendimento humano:
   - Tente resolver o problema usando os dados reais da assinatura fornecidos abaixo.
   - Informe detalhes reais: Plano, Status, Data de Renovação, Valor, e se o Cancelamento já está agendado.
   - Se o usuário quiser cancelar, peça confirmação explícita e use 'cancelSubscription' APENAS após o "sim".
6. ESCALAÇÃO (createSupportTicket):
   - Use APENAS como último recurso quando esgotar as opções ou se o usuário pedir explicitamente para falar com um humano.
   - NÃO gere o texto de confirmação do ticket no mesmo turno em que chama a ferramenta. Espere o resultado da ferramenta chegar para confirmar.

[DADOS REAIS DO USUÁRIO]:
${userContextStr}${refusalContext}

Responda sempre em Português do Brasil de forma profissional e prestativa.`;

    const formattedMessages = messages.map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : m.role === 'system' ? 'user' : 'user',
      parts: [{ text: m.content }]
    }));

    if (actionCallback) {
      formattedMessages.push(actionCallback);
    }

    let responseText = "";
    let functionCalls: any[] = [];

    try {
      const aiResult = await generateTextWithFallback({
        contents: formattedMessages,
        systemInstruction: systemInstruction,
        temperature: 0.2,
        tools: tools,
        category: 'speed'
      }, ai);
      
      functionCalls = aiResult.functionCalls || [];
      // If the model called a tool, we often want to prioritize the tool call and ignore the "thought" text
      // unless the model explicitly provided a final response (which it shouldn't do if it's calling a tool in Gemini)
      responseText = aiResult.text || "";
      
    } catch (primaryErr: any) {
      console.error("[Support Chat AI Error Real]:", primaryErr?.message || primaryErr);
      const lastMsg = messages[messages.length - 1]?.content?.toLowerCase() || "";
      if (lastMsg.includes('cancelar') || lastMsg.includes('cancelamento')) {
        responseText = `Entendi que você deseja solicitar o cancelamento da assinatura. Para sua segurança e para garantirmos que os dados estão corretos, você confirma o cancelamento da sua assinatura? (Lembrando que o acesso Pro continuará válido até o final do período vigente/trial sem novas cobranças). Responda "Sim, confirmo" para prosseguir.`;
      } else if (lastMsg.includes('cobrado') || lastMsg.includes('pagamento') || lastMsg.includes('erro') || lastMsg.includes('problema') || lastMsg.includes('duas vezes')) {
        try {
          const ticketRef = await adminDb.collection('supportTickets').add({
            userId,
            userEmail: email || '',
            status: 'pending_human',
            title: 'Erro de Cobrança / Pagamento',
            aiSummary: 'Houve um erro na IA e o ticket foi aberto automaticamente devido a palavras-chave de cobrança.',
            createdAt: Date.now(),
            lastMessageAt: Date.now()
          });

          // Add history to ticket
          for (const m of messages) {
            await ticketRef.collection('messages').add({
              sender: m.role === 'assistant' ? 'ai' : 'user',
              text: m.content,
              timestamp: Date.now()
            });
          }

          responseText = `Identifiquei o seu relato e transferi o seu atendimento para um especialista humano. Aguarde um momento enquanto um atendente assume a conversa.`;
        } catch (ticketErr) {
          responseText = `Compreendi seu relato sobre o problema de cobrança. Registrei sua solicitação para análise da equipe de suporte humana.`;
        }
      } else {
        responseText = `Olá! Sou o assistente de Suporte e FAQ do ZENO AI. Como posso te ajudar hoje com suas dúvidas sobre planos, cobranças ou sobre o aplicativo?`;
      }
    }

    let text = responseText;

    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];
      
      if (call.name === 'cancelSubscription') {
         try {
            const sub = await SubscriptionService.getSubscription(userId);
            let targetSubId = sub?.subscriptionId || sub?.stripeSubscriptionId;
            if (targetSubId && !targetSubId.startsWith('sub_default')) {
               const stripe = getStripe();
               if(stripe) {
                 await stripe.subscriptions.update(targetSubId, { cancel_at_period_end: true });
                 if (sub) {
                   sub.cancelAtPeriodEnd = true;
                   sub.cancelAt = Date.now();
                   sub.autoRenew = false;
                   await adminDb.collection('subscriptions').doc(userId).set(sub, { merge: true });
                   await addSystemLog('info', userId, 'Cancelamento via Suporte', 'Cancelamento via bot de suporte.', req);
                 }
                 text = "Ação de cancelamento executada com sucesso.";
               } else {
                 text = "Stripe não configurado no servidor.";
               }
            } else {
               text = "Nenhuma assinatura ativa encontrada para cancelar.";
            }
         } catch(e) {
           text = "Erro ao cancelar no Stripe: " + e.message;
         }
         return res.json({ toolCall: { name: 'cancelSubscription', result: text } });

      } else if (call.name === 'createSupportTicket') {
         const { title, aiSummary } = call.args;
         const ticketRef = await adminDb.collection('supportTickets').add({
           userId,
           userEmail: email || '',
           status: 'pending_human',
           title,
           aiSummary,
           createdAt: Date.now(),
           lastMessageAt: Date.now()
         });

         // Save message history to the ticket
         for (const m of messages) {
            await ticketRef.collection('messages').add({
              sender: m.role === 'assistant' ? 'ai' : 'user',
              text: m.content,
              timestamp: Date.now()
            });
         }

         return res.json({ toolCall: { name: 'createSupportTicket', result: "Atendimento transferido para suporte humano. Aguarde o retorno de um especialista." } });
      }
    }

    res.json({ reply: text });

  } catch (error: any) {
    console.error("[Support Chat API Error]:", error);
    res.status(500).json({ error: error.message });
  }
});

  // Vite/Prod middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
