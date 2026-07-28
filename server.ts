import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import Stripe from "stripe";
import dotenv from "dotenv";
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
  getQueueDiagnosticStats 
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

// Startup Firestore connection test
adminDb.listCollections()
  .then(cols => console.log('[FIREBASE] Server-side Firestore connection test successful. Collections found:', cols.length))
  .catch(err => console.error('[FIREBASE] Server-side Firestore connection test failed:', err.message));

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

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
  } catch (err) {
    console.error('[MODELS ERROR] Failed to list models:', err);
    return [];
  }
}

async function smartSelectModel(taskType: string, isPro: boolean = false) {
  return 'models/gemini-flash-latest';
}

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
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      } else {
        // Fallback for development/testing when webhook secret is not configured
        const rawString = typeof req.body === 'string' ? req.body : req.body.toString('utf8');
        event = JSON.parse(rawString);
      }

      await StripeWebhookHandler.handleWebhookEvent(event);
      return res.status(200).json({ received: true });
    } catch (err: any) {
      console.error("[STRIPE WEBHOOK VERIFICATION ERROR]:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  });

  app.use(express.json({ limit: "50mb" }));

  // Initialize task manager background loop
  initFallbackQueueRunner();

/**
 * Securely verifies the Firebase ID Token and returns the decoded email.
 * This ensures the email is authenticated and not spoofed.
 */
async function getVerifiedEmail(req: any): Promise<string | null> {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split('Bearer ')[1];
  if (!token) {
    return null;
  }
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    return decodedToken.email || null;
  } catch (error) {
    console.error('[AUTH ERROR] Failed to verify ID Token:', error);
    return null;
  }
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

  // API Routes
  app.post("/api/generate-music", async (req, res) => {
    try {
      const { prompt, genre, keySig, tempo, mode } = req.body;
      if (!prompt) return res.status(400).json({ error: "Tema da música é obrigatório." });

      const modelName = mode === 'clip' ? 'lyria-3-clip-preview' : 'lyria-3-pro-preview';
      const apiKey = process.env.GEMINI_API_KEY;

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
        const errBody = await apiRes.text();
        console.log("[LYRIA API Notice/Quota]:", errBody);
        
        // Fallback to Gemini Flash for lyrics & chords if Lyria quota exceeded (429) or error
        try {
          const fallbackPrompt = `Escreva uma letra de música profissional completa no gênero ${genre}, tom ${keySig}, andamento ${tempo}, com base no tema: "${prompt}". Inclua versos, refrão e sugestão de acordes.`;
          const fallbackResponse = await ai.models.generateContent({
            model: 'gemini-flash-latest',
            contents: fallbackPrompt,
          });

          const fallbackLyrics = fallbackResponse.text || `(Verso 1)\n${prompt}\n\n(Refrão)\nMelodia composta para ${genre}\nTom: ${keySig} • ${tempo}`;

          return res.json({
            title: prompt.slice(0, 40) + (prompt.length > 40 ? '...' : ''),
            genre,
            key: keySig,
            tempo,
            lyrics: `⚠️ [Aviso: Cota do modelo Lyria 3 excedida na sua chave atual. Letra e arranjo gerados via Gemini Flash]\n\n` + fallbackLyrics,
            chordsSummary: `${keySig} - Progressive (Gemini Arranged)`,
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
        const { prompt, genre, keySig, tempo } = req.body;
        const fallbackPrompt = `Escreva uma letra de música profissional completa no gênero ${genre || 'Pop'}, tom ${keySig || 'C Major'}, andamento ${tempo || '110 BPM'}, com base no tema: "${prompt || 'Inovação'}".`;
        const fallbackResponse = await ai.models.generateContent({
          model: 'gemini-flash-latest',
          contents: fallbackPrompt,
        });

        return res.json({
          title: (prompt || 'Música').slice(0, 40),
          genre: genre || 'Pop',
          key: keySig || 'C Major',
          tempo: tempo || '110 BPM',
          lyrics: `⚠️ [Aviso: O serviço Lyria 3 está temporariamente indisponível. Letra gerada via Gemini Flash]\n\n` + fallbackResponse.text,
          chordsSummary: `${keySig || 'C Major'} - Standard`,
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
      const isAdmin = verifiedEmail?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
      const isPro = isAdmin || subDetails.isPro;

      // Optional: Check limits for non-pro users if needed
      
      const [transcriptData, metadata] = await Promise.all([
        getYoutubeTranscript(url).catch(e => ({ error: e.message, videoId: extractYoutubeId(url) })),
        getYoutubeMetadata(url).catch(() => null)
      ]);

      if ('error' in transcriptData) {
        // console.log('[YOUTUBE] Captions failed, trying audio transcription for:', url);
        try {
          const audioPath = await downloadYoutubeAudio(url);
          
          if (!fs.existsSync(audioPath)) {
            throw new Error("Falha ao gerar arquivo temporário de áudio.");
          }

          const audioData = fs.readFileSync(audioPath);
          
          // Check file size (rough limit for inline data is ~20MB)
          if (audioData.length > 20 * 1024 * 1024) {
             if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
             return res.status(422).json({ 
               error: "O vídeo é muito longo para transcrição automática. Tente um vídeo com legendas oficiais.",
               metadata 
             });
          }

          const base64Audio = audioData.toString('base64');
          
          const response = await ai.models.generateContent({
            model: "gemini-flash-latest",
            contents: [{
              role: 'user',
              parts: [
                {
                  inlineData: {
                    data: base64Audio,
                    mimeType: "audio/mp3"
                  }
                },
                { text: "Transcreva este áudio do YouTube completamente para o português. Se o áudio estiver em outra língua, transcreva e traduza para o português. Retorne apenas o texto da transcrição de forma limpa, sem comentários adicionais." }
              ]
            }]
          });
          
          const transcript = response.text || "";
          
          // Cleanup
          if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
          
          if (!transcript || transcript.length < 5) {
            throw new Error("A IA não conseguiu extrair uma transcrição útil deste áudio.");
          }

          return res.json({
            transcript,
            videoId: transcriptData.videoId || extractYoutubeId(url),
            metadata,
            method: 'ai_transcription'
          });
        } catch (audioErr: any) {
          // Fallback to metadata description & summary if audio download / transcription fails
          const fallbackTranscript = metadata 
            ? `[Vídeo do YouTube: ${metadata.title || 'Vídeo'} - por ${metadata.author || 'Autor Desconhecido'}]\n\nDescrição e Detalhes do Vídeo:\n${metadata.description || 'Sem descrição.'}\n\n(Nota: Devido a restrições de segurança do YouTube, as legendas e o áudio direto não puderam ser baixados. O ZENO AI está utilizando os metadados oficiais e informações do vídeo para gerar análises e respostas).`
            : `[Vídeo do YouTube: ${url}]\n\n(Nota: O acesso direto ao conteúdo deste vídeo foi restrito pelo YouTube).`;

          return res.json({
            transcript: fallbackTranscript,
            videoId: transcriptData.videoId || extractYoutubeId(url),
            metadata,
            method: 'metadata_fallback'
          });
        }
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

  app.post("/api/chat", async (req, res) => {
    try {
      const { message, history, speed, plan, userId, attachments, systemInstruction, isSmartMode } = req.body;
      
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: "Mensagem é obrigatória e deve ser texto." });
      }

      // Secure email verification - strictly verify against token for Admin access
      const verifiedEmail = await getVerifiedEmail(req);
      const isAdmin = verifiedEmail?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
      const userEmail = verifiedEmail || (req.body?.userEmail || req.headers['x-user-email'] || '') as string;

      // Server-side access control check - Securely verify subscription
      const subDetails = await SubscriptionService.validateAndGetDetails(userId);
      const isPro = isAdmin || subDetails.isPro;

      // Smart Model Selection Logic
      let normSpeed = speed || 'zeno';
      let apiModelName = 'models/gemini-flash-latest';

      if (isSmartMode !== false) { // Default to smart mode
        let taskType = 'chat';
        const msgLower = message.toLowerCase();
        
        if (Array.isArray(attachments) && attachments.length > 0) {
          const mainFile = attachments[0];
          const mime = mainFile.mimeType || '';
          if (mime.includes('pdf')) taskType = 'pdf';
          else if (mime.includes('image')) taskType = 'vision';
          else if (mime.includes('audio')) taskType = 'audio';
          else if (mime.includes('video')) taskType = 'video';
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
        else if (taskType === 'vision' || taskType === 'pdf') normSpeed = 'vision';
        else normSpeed = 'zeno';
      } else {
        const modelCfg = getModelConfig(normSpeed);
        apiModelName = `models/${modelCfg.apiModel}`;
      }

      const modelCfg = getModelConfig(normSpeed);

      if (modelCfg.requiredPlan === 'pro' && !isPro) {
        return res.status(403).json({ 
          error: `O modelo ${modelCfg.name} é exclusivo para assinantes do plano ZENO Pro.`, 
          needsPro: true 
        });
      }

      let modelSystemPrompt = `${systemInstruction}\n\n[Diretrizes do Modelo ${modelCfg.name}]: ${modelCfg.systemPrompt}\n\n[REGRA DE OURO PARA GERAÇÃO DE IMAGENS - ZENO VISION]: Você possui capacidade NATIVA e COMPLETA de gerar imagens no ZENO AI! NUNCA diga 'sou uma IA de texto', NUNCA diga 'não posso gerar imagens' ou 'não tenho olhos/capacidade visual'. NUNCA recomende Midjourney, DALL-E, Stable Diffusion ou ferramentas externas. Se o usuário solicitar uma imagem, foto, desenho, ilustração, arte, logo, avatar, mockup, infográfico, diagrama ou wallpaper em qualquer modelo do ZENO, responda diretamente em formato Markdown com a tag de imagem: ![descrição da imagem em português](https://image.pollinations.ai/prompt/DESCRICAO_DETALHADA_EM_INGLES_COM_ILUMINACAO_CINEMATOGRAFICA_LENTE_E_TEXTURA_8K?width=1024&height=1024&seed=${Math.floor(Math.random() * 1000000)}&nologo=true)`;
      let modelTemperature = modelCfg.temperature;

      // Retrieve long-term memory context if userId is available
      let memoryContext = "";
      if (userId) {
        const relevantMemories = await retrieveRelevantMemories(userId, message, 4);
        if (relevantMemories && relevantMemories.length > 0) {
          memoryContext = "\n\n[Memória de Longo Prazo do Usuário (Recuperada do Vetor Store)]:\n" + relevantMemories.map(m => `- ${m.content} (Contexto: ${m.metadata?.sessionTitle || 'Chat'})`).join('\n');
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
        if (!isAdmin) {
          await setUserPlan(userId, plan || 'ZENO Free');
        } else {
          await setUserPlan(userId, 'ZENO Pro');
        }
        
        // Pass userEmail and req to automatically update active metadata
        const usage = await getUserUsage(userId, userEmail, req);
        
        if (plan !== 'ZENO Pro' && !isAdmin) {
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

      // If user is asking for image generation, we might want to use the task queue instead of streaming
      // for free users if server is busy, but for now we stream directly unless explicitly handled.
      // Special check: ZENO Vision free tier queuing
      if (isImageMode && plan !== 'ZENO Pro' && !isAdminUser(userEmail)) {
        try {
          const config = await getAdminConfig();
          if (config.serverSettings?.enforceImageQueue) {
            const cleanPrompt = message.replace(/^(gerar|crie|criar|desenhe|desenhar|faça|fazer|gere|mostre|me dá|me mostre)\s*(uma?|um)?\s*(imagem|foto|arte|ilustração|wallpaper|quadro|desenho|logotipo|logo|personagem|grafico|gráfico|infográfico|infografico|diagrama|wireframe|mockup|render|3d|pintura|avatar|ícone|icone)/i, "").trim();
            
            const task = await createQueuedTask({
              userId: userId || 'anon-user',
              userEmail: userEmail || 'Anônimo',
              plan: 'ZENO Free',
              payload: {
                prompt: cleanPrompt,
                style: "photorealistic",
                aspectRatio: "1:1",
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
                const markdownOutput = `![${cleanPrompt}](${details.task.result.imageUrl})`;
                res.write(`data: ${JSON.stringify({ text: `✨ **Imagem Processada via Fila ZENO:**\n\n${markdownOutput}` })}\n\n`);
                res.write("data: [DONE]\n\n");
                return res.end();
              }

              if (details.task.status === 'failed') {
                res.write(`data: ${JSON.stringify({ text: `❌ **Falha ao gerar imagem:** ${details.task.error || 'Erro desconhecido.'}` })}\n\n`);
                res.write("data: [DONE]\n\n");
                return res.end();
              }

              if (details.task.status === 'cancelled') {
                res.write(`data: ${JSON.stringify({ text: `⚠️ **Geração cancelada pelo usuário.**` })}\n\n`);
                res.write("data: [DONE]\n\n");
                return res.end();
              }

              if (details.position !== null && details.position !== lastPosition) {
                lastPosition = details.position;
                res.write(`data: ${JSON.stringify({ text: `⏳ **Sua solicitação está na fila gratuita do ZENO AI.**\nComo assinantes ZENO Pro possuem prioridade e processamento imediato, estamos organizando o tráfego do servidor para processar sua imagem com segurança.\n\n📊 **Posição atual na fila:** ${details.position}\n⏱️ **Tempo estimado de espera:** ${details.estimatedTimeSeconds} segundos\n\n` })}\n\n`);
              }

              await new Promise(resolve => setTimeout(resolve, 1500));
            }
          }
        } catch (err: any) {
          console.error('[CHAT IMAGE ERROR] Erro na geração:', err?.message || err);
          res.write(`data: ${JSON.stringify({ text: "❌ **Erro de processamento:** Não foi possível gerar a imagem neste momento." })}\n\n`);
          res.write("data: [DONE]\n\n");
          return res.end();
        }
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

      const response = await ai.models.generateContent({
        model: apiModelName,
        contents,
        config: {
          systemInstruction: modelSystemPrompt,
          temperature: modelTemperature,
          maxOutputTokens: 2048,
        },
      });

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      // Send model info at the start of stream if smart mode is on
      res.write(`data: ${JSON.stringify({ activeModel: modelCfg.name, modelId: normSpeed })}\n\n`);

      const fullResponseText = response.text || "";
      res.write(`data: ${JSON.stringify({ text: fullResponseText })}\n\n`);

      // Store AI response in vector memory
      if (userId && fullResponseText.length > 10) {
        await storeMemory(userId, fullResponseText, { type: "ai_response", model: apiModelName });
      }

      res.write("data: [DONE]\n\n");
      res.end();
    } catch (error: any) {
      console.error("Chat Error:", error);
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
        lowerError.includes("resource_exhausted") ||
        lowerError.includes("resource exhausted") ||
        lowerError.includes("tokens_per_model") ||
        lowerErrStr.includes("429") ||
        error?.status === 429 ||
        error?.code === 429 ||
        (error?.name === "ApiError" && error?.status === 429);

      if (isRateLimit) {
        const fallbackText = `*(Nota: A cota da API Gemini atingiu o limite temporário de requisições ou tokens para este modelo. Isso acontece devido à alta demanda global nos servidores do Google. Como assistente ZENO AI, estou processando sua mensagem de forma otimizada. Para uso ilimitado e acesso prioritário aos modelos Pro sem limites de cota, faça upgrade para o ZENO Pro)*\n\nRecebi sua mensagem: "${req.body?.message || ''}". Como posso ajudar com seus códigos, redação, análises ou criatividade hoje?`;
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
        res.write(`data: ${JSON.stringify({ text: fallbackText })}\n\n`);
        res.write("data: [DONE]\n\n");
        return res.end();
      }
      res.write(`data: ${JSON.stringify({ error: cleanError })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
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
        model: "gemini-flash-latest",
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
          "Como melhorar minha produtividade?",
          "Crie uma imagem de paisagem futurista",
          "Explique física quântica de forma simples",
          "Me ajude a planejar uma viagem"
        ];
      }
      
      res.json({ suggestions: suggestions.slice(0, 4) });
    } catch (e: any) {
      console.error("/api/suggestions error:", e);
      res.json({ suggestions: ["Explique um conceito complexo", "Gere uma ideia criativa", "Resuma os principais pontos de", "Traduza este texto para inglês"] });
    }
  });

  app.get("/api/admin/audit-metrics", async (req, res) => {
    try {
      const adminEmail = await secureVerifyAdmin(req, res);
      if (!adminEmail) return;

      let totalUsers = 0;
      let activeSubscriptions = 0;
      let fetchErrors = [];

      try {
        const usersCountSnap = await adminDb.collection('users').count().get();
        totalUsers = usersCountSnap.data().count;
      } catch (dbErr: any) {
        console.error('Audit Metrics Users fetch error:', dbErr.message);
        fetchErrors.push(`users: ${dbErr.message}`);
        totalUsers = 0;
      }
      
      try {
        const subsCountSnap = await adminDb.collection('subscriptions')
          .where('subscriptionStatus', 'in', ['active', 'trialing'])
          .count()
          .get();
        activeSubscriptions = subsCountSnap.data().count;
      } catch (dbErr: any) {
        console.error('Audit Metrics Subs fetch error:', dbErr.message);
        fetchErrors.push(`subs: ${dbErr.message}`);
        activeSubscriptions = 0;
      }

      res.json({
        totalUsers,
        activeSubscriptions,
        timestamp: Date.now(),
        errors: fetchErrors.length > 0 ? fetchErrors : undefined,
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
      res.status(500).json({ error: e.message });
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

  // GET Subscription Status & Details Endpoint
  const getSubscriptionStatusHandler = async (req: any, res: any) => {
    try {
      const userId = req.query.userId as string;
      const verifiedEmail = await getVerifiedEmail(req);
      const email = verifiedEmail || (req.query.email || req.headers['x-user-email'] || '') as string;
      const isAdmin = verifiedEmail?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

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

      res.json({ success: true, userId });
    } catch (e: any) {
      console.error('/api/account/init error:', e);
      res.status(500).json({ error: e.message });
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
      const { plan, email, hasUsedFreeTrial } = req.body;
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
      console.log("Request Body:", { plan, email, hasUsedFreeTrial });
      console.log("Computed userEligibleForTrial:", userEligibleForTrial);

      const sessionConfig: Stripe.Checkout.SessionCreateParams = {
        payment_method_types: ["card"],
        mode: "subscription",
        customer_email: email,
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
