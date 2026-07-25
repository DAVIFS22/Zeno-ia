import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { OAuth2Client } from "google-auth-library";
import Stripe from "stripe";
import { 
  getUserUsage, 
  updateUserUsage, 
  getAdminConfig, 
  setUserPlan, 
  updateAdminConfig, 
  getAdminStats, 
  addAuditLog, 
  addSystemLog, 
  getAuditLogs, 
  getSystemLogs, 
  incrementStatCounter, 
  incrementModelCounter 
} from "./src/lib/limits";
import { 
  registerImageGenerator, 
  createQueuedTask, 
  getTaskStatusDetails, 
  cancelQueuedTask, 
  executeAndProcessTask, 
  initFallbackQueueRunner, 
  getQueueDiagnosticStats 
} from "./src/lib/taskManager";
import { storeMemory, retrieveRelevantMemories } from "./src/lib/vectorMemory";
import { getModelConfig } from "./src/lib/models";
import { getUserRole, isAdminUser, ADMIN_EMAIL } from "./src/config/admin";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

const systemInstruction = `Você é ZENO, uma inteligência artificial avançada de altíssimo desempenho, projetada para raciocínio profundo, análise lógica e resolução de problemas complexos.
Sua missão é fornecer respostas precisas, altamente estruturadas e perspicazes. Você domina todas as áreas do conhecimento, como engenharia de software, ciências, negócios, filosofia e criatividade.
Diretrizes de Inteligência e Comunicação:
1. Pense Passo a Passo: Em problemas complexos, estruture sua lógica internamente antes de responder.
2. Direto e Conciso: Entregue valor imediatamente. Evite floreios, introduções redundantes ou textos prolixos. Suas respostas devem ser precisas, curtas e diretas ao ponto.
3. Precisão Técnica: Use terminologia correta e forneça exemplos práticos quando aplicável.
4. Clareza Absoluta: Explique conceitos difíceis de maneira simples, sem perder a profundidade técnica.
5. Personalidade: Futurista, altamente inteligente, analítico, prestativo e amigável.
Seu lema é: "ZENO — Precisão e inteligência em cada resposta."`;

// List of known supported Gemini models according to @google/genai guidelines
const PRIMARY_TEXT_MODEL = "gemini-3.5-flash-lite";
const PRO_REASONING_MODEL = "gemini-3.5-flash-lite";
const LITE_FAST_MODEL = "gemini-3.5-flash-lite";
const LATEST_ALIAS_MODEL = "gemini-flash-latest";

// Deprecated or non-existent models to block
const DEPRECATED_MODELS = new Set([
  "gemini-pro",
  "gemini-2.0-flash",
  "gemini-2.0-pro",
  "gemini-2.5-flash",
  "gemini-2.5-pro",
]);

// Helper to validate model names
function isValidModelName(modelName: string): boolean {
  if (!modelName || typeof modelName !== "string") return false;
  return !DEPRECATED_MODELS.has(modelName.trim().toLowerCase());
}

// Get fallback sequence for a given mode
function getCandidateModelsForMode(speed?: string): string[] {
  let list: string[];
  if (speed === "mega" || speed === "think" || speed === "code" || speed === "strategy") {
    list = [PRO_REASONING_MODEL, "gemini-3.1-flash-lite", PRIMARY_TEXT_MODEL, LATEST_ALIAS_MODEL];
  } else if (speed === "search") {
    list = [PRIMARY_TEXT_MODEL, "gemini-3.1-flash-lite", LITE_FAST_MODEL, LATEST_ALIAS_MODEL];
  } else {
    list = [PRIMARY_TEXT_MODEL, "gemini-3.1-flash-lite", LITE_FAST_MODEL, LATEST_ALIAS_MODEL];
  }
  return list.filter(isValidModelName);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  const subscriptionClients = new Map<string, express.Response[]>();

  // --- PRODUCTION-GRADE SLIDING WINDOW RATE LIMITER ---
  const ipRequestTimes = new Map<string, number[]>();
  const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
  const MAX_REQUESTS_PER_WINDOW = 60; // 60 requests per window

  function rateLimiterMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
    if (req.path === '/api/webhook' || req.path === '/api/health') {
      return next();
    }
    
    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const ip = (typeof rawIp === 'string' ? rawIp.split(',')[0] : 'unknown').trim();
    const now = Date.now();
    
    let timestamps = ipRequestTimes.get(ip) || [];
    timestamps = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    
    if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
      console.warn(`[RATE LIMIT] IP bloqueado por excesso de requisições: ${ip}`);
      addSystemLog('error', 'Sistema', 'Rate Limit Ativado', `Bloqueado IP ${ip} por exceder ${MAX_REQUESTS_PER_WINDOW} req/min`, req);
      
      return res.status(429).json({
        error: "Muitas requisições. Por favor, aguarde alguns instantes antes de enviar mais mensagens.",
        retryAfterSeconds: Math.ceil((RATE_LIMIT_WINDOW_MS - (now - timestamps[0])) / 1000)
      });
    }
    
    timestamps.push(now);
    ipRequestTimes.set(ip, timestamps);
    next();
  }

  app.use("/api", rateLimiterMiddleware);

  app.post("/api/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event: Stripe.Event;

    try {
      if (webhookSecret && sig) {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_mock");
        event = stripe.webhooks.constructEvent(req.body, sig as string, webhookSecret);
      } else {
        event = JSON.parse(req.body.toString());
      }
    } catch (err: any) {
      console.error("Webhook signature verification failed.", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted" || event.type === "invoice.payment_succeeded") {
        let subscriptionId: string | null = null;
        let subscription: Stripe.Subscription | null = null;

        if (event.type === "invoice.payment_succeeded") {
          const invoice = event.data.object as any;
          subscriptionId = invoice.subscription as string;
          if (subscriptionId) {
            const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_mock");
            subscription = await stripe.subscriptions.retrieve(subscriptionId);
          }
        } else {
          subscription = event.data.object as Stripe.Subscription;
          subscriptionId = subscription.id;
        }

        if (subscription && subscriptionId) {
          const planAmount = subscription.items.data[0]?.price.unit_amount || 0;
          const planCurrency = subscription.items.data[0]?.price.currency || "brl";

          const payload = {
            subscriptionId: subscription.id,
            status: subscription.status,
            trialEnd: subscription.trial_end,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            currentPeriodEnd: (subscription as any).current_period_end,
            amount: planAmount,
            currency: planCurrency,
          };

          const clients = subscriptionClients.get(subscriptionId);
          if (clients) {
            clients.forEach(client => {
              client.write(`data: ${JSON.stringify(payload)}\n\n`);
            });
          }
        }
      }
      res.json({ received: true });
    } catch (err: any) {
      console.error("Error processing webhook event", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.use(express.json());

  const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    "postmessage" // Using postmessage for GIS code client
  );

  app.post("/api/auth/google/token", async (req, res) => {
    try {
      const { code } = req.body;
      if (!code) return res.status(400).json({ error: "Code is required" });

      const { tokens } = await oauth2Client.getToken(code);
      
      // Verify ID token to get user info
      const ticket = await oauth2Client.verifyIdToken({
        idToken: tokens.id_token!,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      
      if (!payload) throw new Error("Invalid token payload");

      res.json({
        tokens,
        user: {
          uid: payload.sub,
          email: payload.email,
          displayName: payload.name,
          photoURL: payload.picture,
        }
      });
    } catch (error: any) {
      console.error("Token exchange error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/auth/google/refresh", async (req, res) => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) return res.status(400).json({ error: "Refresh token is required" });

      const client = new OAuth2Client(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
      );
      client.setCredentials({ refresh_token: refreshToken });
      
      const { tokens } = await client.refreshAccessToken();
      res.json({ tokens });
    } catch (error: any) {
      console.error("Token refresh error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/subscription/stream", (req, res) => {
    const { subscription_id } = req.query;
    if (!subscription_id || typeof subscription_id !== "string") {
      return res.status(400).json({ error: "subscription_id is required" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const clients = subscriptionClients.get(subscription_id) || [];
    clients.push(res);
    subscriptionClients.set(subscription_id, clients);

    res.write(":\n\n");

    req.on("close", () => {
      const activeClients = subscriptionClients.get(subscription_id) || [];
      subscriptionClients.set(subscription_id, activeClients.filter(c => c !== res));
      if (subscriptionClients.get(subscription_id)?.length === 0) {
        subscriptionClients.delete(subscription_id);
      }
    });
  });


  app.get("/api/limits", (req, res) => {
    try {
      const userId = req.query.userId;
      if (!userId) return res.status(400).json({ error: "userId is required" });
      const usage = getUserUsage(userId as string);
      const config = getAdminConfig();
      res.json({ usage, config });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/memory/retrieve", (req, res) => {
    try {
      const { userId, query } = req.query;
      if (!userId || !query) return res.status(400).json({ error: "userId and query are required" });
      const memories = retrieveRelevantMemories(userId as string, query as string, 5);
      res.json({ memories });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/memory/store", (req, res) => {
    try {
      const { userId, content, metadata } = req.body;
      if (!userId || !content) return res.status(400).json({ error: "userId and content are required" });
      const chunk = storeMemory(userId, content, metadata);
      res.json({ chunk });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Backend RBAC Guard Helper Function
  function verifyAdminRole(req: express.Request, res: express.Response): boolean {
    const userEmail = (
      req.headers['x-user-email'] ||
      req.body?.userEmail ||
      req.query?.userEmail ||
      ''
    ) as string;

    const role = getUserRole(userEmail);

    if (role !== 'admin') {
      res.status(403).json({
        error: '403 Forbidden',
        code: 'ACCESS_DENIED',
        message: `Acesso Negado. O seu usuário (${userEmail || 'Anônimo'}) possui o papel 'user'. Apenas o administrador (${ADMIN_EMAIL}) possui permissão para acessar ou alterar o Painel Administrativo.`,
        userEmail: userEmail || 'Anônimo',
        requiredRole: 'admin',
        currentRole: role
      });
      return false;
    }
    return true;
  }

  // GET Admin Config (Protected)
  app.get("/api/admin/config", (req, res) => {
    try {
      if (!verifyAdminRole(req, res)) return;
      const config = getAdminConfig();
      res.json({ config });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST Admin Config (Protected with Audit Log)
  app.post("/api/admin/config", (req, res) => {
    try {
      if (!verifyAdminRole(req, res)) return;
      const { config, userEmail } = req.body;
      const oldConfig = getAdminConfig();
      const updated = updateAdminConfig(config);
      
      // Register this administrative change in audit logs!
      addAuditLog(
        userEmail || ADMIN_EMAIL, 
        "Alteração de Configurações do Sistema", 
        oldConfig, 
        updated, 
        req
      );
      
      addSystemLog(
        "info", 
        userEmail || ADMIN_EMAIL, 
        "Configurações Salvas", 
        "As configurações globais do ZENO AI foram modificadas pelo administrador", 
        req
      );
      
      res.json({ success: true, config: updated });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET Admin Stats (Protected - Real calculated Database metrics)
  app.get("/api/admin/stats", (req, res) => {
    try {
      if (!verifyAdminRole(req, res)) return;
      const stats = getAdminStats();
      res.json(stats);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET Admin Logs (Protected)
  app.get("/api/admin/logs", (req, res) => {
    try {
      if (!verifyAdminRole(req, res)) return;
      const auditLogs = getAuditLogs();
      const systemLogs = getSystemLogs();
      res.json({ auditLogs, systemLogs });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST Admin Auth Log (Logs Login/Logout operations)
  app.post("/api/admin/log-auth", (req, res) => {
    try {
      const { userEmail, action, details } = req.body;
      addSystemLog("auth", userEmail || "Anônimo", action, details, req);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST Verify User Role
  app.post("/api/admin/verify", (req, res) => {
    try {
      const userEmail = (req.body?.userEmail || req.headers['x-user-email'] || '') as string;
      const role = getUserRole(userEmail);
      res.json({
        userEmail,
        role,
        isAdmin: role === 'admin'
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/chat", async (req, res) => {
    try {

      const { history, message, speed, attachments, userId, plan } = req.body;

      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      // Model-specific instructions and parameters from models.ts
      const normSpeed = speed || 'zeno';
      const modelCfg = getModelConfig(normSpeed);

      // Server-side access control check
      if (modelCfg.requiredPlan === 'pro' && plan !== 'ZENO Pro') {
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
        const relevantMemories = retrieveRelevantMemories(userId, message, 4);
        if (relevantMemories.length > 0) {
          memoryContext = "\n\n[Memória de Longo Prazo do Usuário (Recuperada do Vetor Store)]:\n" + relevantMemories.map(m => `- ${m.content} (Contexto: ${m.metadata?.sessionTitle || 'Chat'})`).join('\n');
          modelSystemPrompt += memoryContext;
        }
      }

      // Check if speed is 'image' or 'vision', or if message is explicitly asking to generate or show an image
      const isImageMode = 
        speed === "image" || 
        speed === "vision" || 
        /^(gerar|crie|criar|desenhe|desenhar|faça|fazer|gere|mostre|me dá|me mostre)\s*(uma?|um)?\s*(imagem|foto|arte|ilustração|wallpaper|quadro|desenho|logotipo|logo|personagem|grafico|gráfico|infográfico|infografico|diagrama|wireframe|mockup|render|3d|pintura|avatar|ícone|icone)/i.test(message.trim()) ||
        /(desenhe|gere uma imagem|crie uma arte|faça uma ilustração|faça um wallpaper|anime|manga|logotipo|personagem|foto realista|fotografia de|imagem de|image of|generate image|draw a|create an image|crie um mockup|faça um diagrama|crie um infográfico)/i.test(message.trim());

      const userEmail = (req.body?.userEmail || req.headers['x-user-email'] || '') as string;

      if (userId) {
        setUserPlan(userId, plan || 'ZENO Free');
        
        // Pass userEmail and req to automatically update active metadata
        const usage = getUserUsage(userId, userEmail, req);
        
        if (plan !== 'ZENO Pro') {
          const config = getAdminConfig();
          let actionType = 'messages';
          if (normSpeed === 'search' || normSpeed === 'mega' || normSpeed === 'pdf') actionType = 'search';
          else if (normSpeed === 'vision' || normSpeed === 'image' || isImageMode) actionType = 'vision';
          else if (attachments && attachments.length > 0) actionType = 'doc';
          
          if (usage.usage[actionType] >= config.limits[actionType]) {
            // Log limit block
            addSystemLog('error', userEmail || 'Anônimo', 'Limite de Uso Atingido', `Usuário bloqueado: atingiu o limite de ${config.limits[actionType]} em ${actionType}`, req);
            return res.status(429).json({ error: `Limite diário atingido. Você atingiu o limite de ${config.limits[actionType]} usos para ${actionType} hoje. Faça upgrade para o ZENO Pro para usar sem limites.`, isLimitReached: true, actionType: actionType });
          }
          
          updateUserUsage(userId, actionType as keyof typeof config.limits);
        } else {
          // If Pro user, let's still update dynamic system stats
          let actionType = 'messages';
          if (normSpeed === 'search' || normSpeed === 'mega' || normSpeed === 'pdf') actionType = 'search';
          else if (normSpeed === 'vision' || normSpeed === 'image' || isImageMode) actionType = 'vision';
          else if (attachments && attachments.length > 0) actionType = 'doc';
          
          if (actionType === 'messages') incrementStatCounter('totalMessagesSent');
          else if (actionType === 'search') incrementStatCounter('totalWebSearches');
          else if (actionType === 'image') incrementStatCounter('totalImagesGenerated');
          else if (actionType === 'doc') incrementStatCounter('totalPdfsAnalyzed');
          else if (actionType === 'vision') incrementStatCounter('totalVisionUses');
        }
      }

      // Store user message in vector memory
      if (userId && message.length > 10) {
        storeMemory(userId, message, { model: normSpeed, type: 'qa' });
      }

      if (isImageMode) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        try {
          // Clean prompt
          const cleanPrompt = message
            .replace(/^(gerar imagem|crie uma imagem|desenhe|gerar arte|criar imagem|gerar foto|generate image|draw|fazer uma ilustração|fazer um wallpaper|desenhar|criar uma arte|criar logotipo|criar personagem|criar foto realista|faça uma ilustração|faça um wallpaper|logotipo|personagem|foto realista|anime|crie um mockup|faça um diagrama|crie um infográfico|mostre uma imagem|gere uma imagem)\s*(de|para|a|um|uma|of|about)?\s*/i, "")
            .trim() || message;

          const userPlan = userEmail === ADMIN_EMAIL ? 'ADMIN' : (plan === 'ZENO Pro' ? 'ZENO Pro' : 'ZENO Free');

          if (userPlan === 'ADMIN' || userPlan === 'ZENO Pro') {
            res.write(`data: ${JSON.stringify({ text: "⚡ **Processando sua solicitação de imagem prioritária no ZENO AI sem fila de espera...**\n\n" })}\n\n`);
            
            const task = await createQueuedTask({
              userId: userId || 'anon-user',
              userEmail: userEmail || 'Anônimo',
              plan: userPlan,
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

            const processedTask = await executeAndProcessTask(task.id, req);
            if (processedTask.status === 'failed') {
              res.write(`data: ${JSON.stringify({ text: `❌ **Falha ao gerar imagem:** ${processedTask.error || 'Erro desconhecido.'}` })}\n\n`);
              res.write("data: [DONE]\n\n");
              return res.end();
            }

            const markdownOutput = `![${cleanPrompt}](${processedTask.result.imageUrl})`;
            res.write(`data: ${JSON.stringify({ text: markdownOutput })}\n\n`);
            res.write("data: [DONE]\n\n");
            return res.end();
          } else {
            // ZENO Free tier - write initial queue status and poll in the background of the SSE stream
            res.write(`data: ${JSON.stringify({ text: "⏳ **Sua solicitação foi adicionada à fila gratuita do ZENO AI.**\nComo assinantes ZENO Pro possuem prioridade e processamento imediato, estamos organizando o tráfego do servidor para processar sua imagem com segurança.\n\n" })}\n\n`);

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
              const details = getTaskStatusDetails(task.id);
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

      // Convert history to the format expected by GenAI SDK, which is just string content for simple cases,
      // but the chat model holds state on the backend. Since this is stateless via HTTP,
      // we'll pass the entire conversation history as an array of contents.
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
        // Remove massive base64 markdown images from the text we send to Gemini
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

      // 2. URL Reading & Extraction
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const urls = message.match(urlRegex) || [];
      if (urls.length > 0) {
        let urlContents = "";
        const fetchPromises = urls.map(async (url) => {
          try {
            console.log(`[ZENO API] Extraindo conteúdo da URL: ${url}`);
            const jinaRes = await fetch(`https://r.jina.ai/${url}`, {
              headers: { "User-Agent": "ZENO-AI-Bot" }
            });
            if (jinaRes.ok) {
              const text = await jinaRes.text();
              return `\n\n--- Conteúdo da URL (${url}) ---\n${text.substring(0, 30000)}\n---------------------------\n`;
            }
          } catch (e) {
            console.error(`[ZENO API] Erro ao ler URL ${url}:`, e);
          }
          return "";
        });
        
        const results = await Promise.all(fetchPromises);
        urlContents = results.join("");
        
        if (urlContents) {
           contents.push({
              role: "user",
              parts: [{ text: `[SISTEMA]: O usuário enviou os seguintes links. Aqui está o conteúdo extraído deles para você analisar e responder à pergunta:\n${urlContents}` }]
           });
        }
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      
      let activeSpeed = speed;
      let currentSystemInstruction = systemInstruction;
      let routerIntent = "GENERAL";

      // 1. Smart Model Router
      if (speed === "smart") {
        const routerPrompt = `Analyze the user's message and reply ONLY with one of these tags indicating the intent:
[CODE] for programming, coding, refactoring, debug.
[MATH] for math, complex logic, deep reasoning.
[CREATIVE] for storytelling, poetry, creative writing.
[GENERAL] for casual conversation, general questions.

User Message: "${message}"`;

        try {
          const routerResponse = await ai.models.generateContent({
            model: PRIMARY_TEXT_MODEL,
            contents: routerPrompt,
            config: { temperature: 0.1 }
          });
          
          routerIntent = routerResponse.text?.trim().toUpperCase() || "[GENERAL]";
          console.log(`[Smart Router] Intent detectada: ${routerIntent}`);

          if (routerIntent.includes("[CODE]")) {
            activeSpeed = "mega";
            currentSystemInstruction = `${systemInstruction}\n\n[MODO ARQUITETO DE SOFTWARE]: Forneça código limpo, modular, documentado e explique a lógica. Suporte a múltiplas linguagens com as melhores práticas de engenharia.`;
          } else if (routerIntent.includes("[MATH]")) {
            activeSpeed = "mega";
            currentSystemInstruction = `${systemInstruction}\n\n[MODO RACIOCÍNIO LÓGICO]: Pense profundamente e passo-a-passo. Descreva todas as deduções antes de fornecer a resposta final.`;
          } else if (routerIntent.includes("[CREATIVE]")) {
            activeSpeed = "fast";
            currentSystemInstruction = `${systemInstruction}\n\n[MODO ESCRITA CRIATIVA]: Seja altamente expressivo, use vocabulário rico, tom envolvente e estrutura narrativa impecável.`;
          } else {
            activeSpeed = "fast";
          }
        } catch (e: any) {
          console.error("[Smart Router] Falha na classificação, usando fallback (fast):", e.message);
          activeSpeed = "fast";
        }
      }

      const config: any = {
        systemInstruction: currentSystemInstruction,
      };
      
      if (activeSpeed === "fast" || activeSpeed === "zeno") {
        config.temperature = 0.5;
        config.topP = 0.8;
      } else if (activeSpeed === "mega" || activeSpeed === "think") {
        config.temperature = 0.7;
        config.topP = 0.95;
        if (!config.systemInstruction.includes("MODO")) {
          config.systemInstruction = `${currentSystemInstruction}\n\n[MODO ANALÍTICO AVANÇADO ATIVADO]: Traga a síntese mais profunda, abrangente, atualizada e analítica possível. Cruze dados de ciência, tecnologia e conhecimento global.`;
        }
      } else {
        config.temperature = 0.9;
        config.topP = 0.95;
      }
      
      // Permitir que o modelo pesquise antes de responder quando necessário (Search & Mega modes)
      if (activeSpeed === "search" || activeSpeed === "mega") {
        config.tools = [{ googleSearch: {} }];
      }

      const candidateModels = getCandidateModelsForMode(activeSpeed);

      let success = false;
      let lastError: any = null;

      for (const modelName of candidateModels) {
        if (!isValidModelName(modelName)) {
          console.warn(`[ZENO API] Ignorando nome de modelo inválido/obsoleto: ${modelName}`);
          continue;
        }

        try {
          console.log(`[ZENO API] Conectando ao Gemini com modelo: ${modelName} (modo: ${speed || "padrão"})`);
          const responseStream = await ai.models.generateContentStream({
            model: modelName,
            contents: contents,
            config: config,
          });

          for await (const chunk of responseStream) {
            const c = chunk as GenerateContentResponse;
            if (c.text) {
              res.write(`data: ${JSON.stringify({ text: c.text })}\n\n`);
            }
          }
          success = true;
          incrementModelCounter(modelName);
          addSystemLog('ia', userEmail || 'Anônimo', 'Resposta de IA', `Uso do modelo: ${modelName} (modo: ${speed || 'padrão'})`, req);
          console.log(`[ZENO API] Sucesso na geração com modelo: ${modelName}`);
          break;
        } catch (err: any) {
          console.error(`[ZENO API] Erro ao usar modelo ${modelName}:`, err?.message || err);
          lastError = err;
        }
      }

      if (!success) {
        console.error("[ZENO API] Todos os modelos da cadeia de fallback falharam. Erro final:", lastError);
        const errStr = String(lastError?.message || lastError || "");
        
        // Register critical AI error in system logs
        addSystemLog('error', userEmail || 'Anônimo', 'Falha Crítica de IA', `Cadeia de fallback falhou. Erro: ${errStr.substring(0, 150)}`, req);
        
        let errorMessage = "Não foi possível se conectar aos modelos de IA do ZENO no momento. Por favor, tente novamente em alguns instantes.";

        if (errStr.includes("quota") || errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("429")) {
          errorMessage = "O limite de requisições por minuto da IA foi atingido. Por favor, aguarde alguns instantes e tente novamente.";
        } else if (errStr.includes("API_KEY") || errStr.includes("API key")) {
          errorMessage = "Erro nas credenciais da API do Gemini no servidor.";
        }

        res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
        return res.end();
      }

      res.write("data: [DONE]\n\n");
      res.end();
    } catch (error: any) {
      console.error("[ZENO API] Exceção crítica na rota de chat:", error?.message || error);
      const errStr = String(error?.message || error || "");
      let errorMessage = "Não foi possível processar sua solicitação no momento. Tente novamente.";
      if (errStr.includes("quota") || errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("429")) {
        errorMessage = "O limite de requisições por minuto da IA foi atingido. Por favor, aguarde alguns instantes e tente novamente.";
      }
      res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
      res.end();
    }
  });

  // API route to generate concise LLM title for chat session
  app.post("/api/generate-title", async (req, res) => {
    try {
      const { message } = req.body;
      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Mensagem é obrigatória." });
      }

      const cleanMessage = message.slice(0, 500);
      const prompt = `Você é um assistente de IA. Sua tarefa é criar um título extremamente curto, conciso, elegante e altamente descritivo (de 3 a 5 palavras no máximo) para uma conversa no chat baseando-se na mensagem inicial do usuário.
Responda APENAS com o texto do título gerado, sem aspas, sem ponto final, e sem nenhum prefixo como "Título:".

Mensagem do usuário:
"${cleanMessage}"`;

      const candidateModels = [LITE_FAST_MODEL, PRIMARY_TEXT_MODEL, LATEST_ALIAS_MODEL];
      let aiTitle = "";

      for (const modelName of candidateModels) {
        if (!isValidModelName(modelName)) continue;
        try {
          const result = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              temperature: 0.3,
              topP: 0.8,
            },
          });
          const text = result.text?.trim();
          if (text) {
            aiTitle = text.replace(/^["'«»]|["'«»]$/g, '').replace(/\.$/, '').trim();
            if (aiTitle) break;
          }
        } catch (err: any) {
          console.error(`[ZENO Title API] Erro ao usar modelo ${modelName}:`, err?.message || err);
        }
      }

      return res.json({ title: aiTitle || null });
    } catch (error: any) {
      console.error("[ZENO Title API] Erro ao gerar título:", error?.message || error);
      return res.json({ title: null });
    }
  });

  // Core Image Generation Engine
  async function generateImageCore(options: {
    prompt: string;
    style?: string;
    aspectRatio?: string;
    enhance?: boolean;
    engine?: string;
    negativePrompt?: string;
    seed?: any;
    guidanceScale?: number;
    userEmail?: string;
    req?: any;
  }) {
    const { 
      prompt, 
      style = "photorealistic", 
      aspectRatio = "1:1", 
      enhance = true,
      engine = "flux",
      negativePrompt = "",
      seed: customSeed,
      guidanceScale = 7.5,
      userEmail = "Anônimo",
      req
    } = options;

    let width = 1024;
    let height = 1024;
    if (aspectRatio === "16:9") {
      width = 1280;
      height = 720;
    } else if (aspectRatio === "9:16") {
      width = 720;
      height = 1280;
    } else if (aspectRatio === "4:3") {
      width = 1024;
      height = 768;
    } else if (aspectRatio === "3:2") {
      width = 1080;
      height = 720;
    }

    const stylePrompts: Record<string, string> = {
      photorealistic: "photorealistic, ultra-detailed 8k resolution, cinematic lighting, physical shadow depth, sharp focus, professional photography, flawless human anatomy, natural hands",
      "ultra-realista": "ultra realistic photographic, masterwork lighting, 8k UHD resolution, highly detailed texture, DSLR camera lens 85mm f1.4, accurate hands and faces",
      anime: "anime art style, vibrant colors, clean line art, Studio Ghibli inspired, high quality japanese animation visual, masterwork illustration",
      manga: "japanese manga style, dramatic ink shading, high contrast monochrome with subtle tones, expressive character design",
      ghibli: "Studio Ghibli aesthetic, hand-drawn anime background, lush nature, dreamy atmospheric lighting, nostalgic art style",
      pixar: "3D Pixar animation style, warm charming character design, soft subsurface scattering, realistic textures, Disney Pixar render",
      "3d-render": "3D render, Blender, Unreal Engine 5, ray tracing, soft volumetric lighting, octane render, 8k detail",
      cyberpunk: "cyberpunk aesthetics, glowing neon reflections, dark futuristic metropolis, volumetric fog, high detail octane render",
      fantasy: "epic dark fantasy art, magical atmosphere, intricate armor and clothing details, legendary lighting, concept art",
      scifi: "sci-fi cinematic visual, advanced technology aesthetics, sleek metallic surfaces, cosmic space lighting, 8k concept art",
      "concept-art": "digital concept art, trending on artstation, rich color palette, detailed texturing, cinematic framing",
      digital: "digital painting masterpiece, refined brush strokes, dramatic lighting, vivid color depth",
      watercolor: "soft watercolor painting, artistic water brush strokes, pastel aesthetic, delicate details, expressive traditional art",
      vector: "flat vector graphic, sharp clean lines, modern geometric shapes, vibrant solid colors, professional illustration",
      logo: "professional minimalist vector logo design, iconic brand symbol, clean geometry, isolated background, elegant branding",
      icon: "app icon design, 3D glossy metallic/clay emblem, isolated object, sleek modern UI asset",
      minimalist: "minimalist design, clean empty space, elegant composition, subtle color harmony, sophisticated visual",
      "low-poly": "low poly 3D art, geometric facet design, vibrant pastel lighting, stylized low polygon artwork"
    };

    const styleSuffix = stylePrompts[style] || stylePrompts.photorealistic;
    let finalPrompt = `${prompt}, ${styleSuffix}`;

    if (enhance) {
      const enhanceModels = [PRIMARY_TEXT_MODEL, LITE_FAST_MODEL, LATEST_ALIAS_MODEL];
      for (const mName of enhanceModels) {
        try {
          const enhanceResponse = await ai.models.generateContent({
            model: mName,
            contents: `Transform this Portuguese/English user request into a detailed, high-quality image generation prompt in English (max 50 words). Include camera framing, light physics, exact style elements, and natural anatomy (flawless hands and faces).\nUser request: "${prompt}"\nStyle: "${style}"`,
          });
          const enhancedText = enhanceResponse.text?.trim();
          if (enhancedText) {
            finalPrompt = `${enhancedText}, ${styleSuffix}`;
            break;
          }
        } catch (e: any) {
          console.error(`[ZENO Image API] Prompt enhancement error with ${mName}:`, e?.message || e);
        }
      }
    }

    const seed = customSeed && !isNaN(Number(customSeed)) ? Number(customSeed) : Math.floor(Math.random() * 1000000);
    
    let modelParam = "flux";
    if (engine === "flux-realism" || style === "photorealistic" || style === "ultra-realista") modelParam = "flux-realism";
    else if (engine === "turbo" || engine === "sdxl") modelParam = "turbo";
    else if (engine === "flux-anime" || style === "anime" || style === "ghibli") modelParam = "flux-anime";
    else if (engine === "flux-3d" || style === "3d-render" || style === "pixar") modelParam = "flux-3d";

    const encodedPrompt = encodeURIComponent(finalPrompt);
    const negParam = negativePrompt ? `&negative=${encodeURIComponent(negativePrompt)}` : '';
    
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&nologo=true&model=${modelParam}${negParam}`;
    const fallbackUrls = [
      `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&nologo=true&model=turbo${negParam}`,
      `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&nologo=true&model=default${negParam}`
    ];

    const imageItem = {
      id: `img-${Date.now()}-${Math.floor(Math.random()*10000)}`,
      imageUrl,
      fallbackUrls,
      prompt: finalPrompt,
      originalPrompt: prompt,
      optimizedPrompt: finalPrompt,
      aspectRatio,
      style,
      seed,
      engine: modelParam,
      negativePrompt,
      guidanceScale,
      model: "Estúdio ZENO Vision",
      provider: "Flux Dev",
      collection: "Geral",
      timestamp: Date.now()
    };

    backendImageLibrary.unshift(imageItem);

    incrementStatCounter('totalImagesGenerated');
    incrementModelCounter(modelParam);
    addSystemLog('ia', userEmail, 'Geração de Imagem', `Geração com motor ${modelParam} para o prompt: "${prompt.substring(0, 80)}..."`, req);

    return imageItem;
  }

  // Register with task manager and initialize fallback runner ONCE at startup
  registerImageGenerator(generateImageCore);
  initFallbackQueueRunner();

  // API route to generate AI Images (With subscription queuing)
  app.post("/api/generate-image", async (req, res) => {
    try {
      const { 
        prompt, 
        style = "photorealistic", 
        aspectRatio = "1:1", 
        enhance = true, 
        engine = "flux", 
        negativePrompt = "", 
        seed, 
        guidanceScale = 7.5, 
        plan, 
        userId, 
        userEmail = "Anônimo" 
      } = req.body;

      if (!prompt || typeof prompt !== "string") {
        return res.status(400).json({ error: "O prompt é obrigatório." });
      }

      const userPlan = userEmail === ADMIN_EMAIL ? 'ADMIN' : (plan === 'ZENO Pro' ? 'ZENO Pro' : 'ZENO Free');

      // Create queued task in persistent db and queue locally
      const task = await createQueuedTask({
        userId: userId || 'anon-user',
        userEmail,
        plan: userPlan,
        payload: {
          prompt,
          style,
          aspectRatio,
          enhance,
          engine,
          negativePrompt,
          seed,
          guidanceScale
        },
        req
      });

      if (userPlan === 'ADMIN' || userPlan === 'ZENO Pro') {
        // "Usuários Pro nunca devem visualizar fila de espera." -> Synchronous execution
        console.log(`[QUEUE] Usuário Pro/Admin (${userEmail}) ignorou a fila. Processando imediatamente.`);
        const processedTask = await executeAndProcessTask(task.id, req);
        if (processedTask.status === 'failed') {
          return res.status(500).json({ error: processedTask.error || "Erro ao gerar imagem." });
        }
        return res.json(processedTask.result);
      } else {
        // Free tier users get queued task details and poll the status endpoint
        console.log(`[QUEUE] Usuário gratuito (${userEmail}) adicionado à fila.`);
        const details = getTaskStatusDetails(task.id);
        return res.json({
          taskId: task.id,
          status: task.status,
          position: details.position,
          estimatedTimeSeconds: details.estimatedTimeSeconds,
          averageWaitTimeSeconds: details.averageWaitTimeSeconds
        });
      }
    } catch (error: any) {
      console.error("Error generating image via tasks:", error);
      return res.status(500).json({ error: "Erro ao processar tarefa de geração. Tente novamente." });
    }
  });

  // Task status details endpoint (ZENO Free polling)
  app.get("/api/tasks/status/:id", (req, res) => {
    try {
      const details = getTaskStatusDetails(req.params.id);
      if (!details.task) {
        return res.status(404).json({ error: "Tarefa não encontrada." });
      }
      return res.json({
        taskId: details.task.id,
        status: details.task.status,
        plan: details.task.plan,
        position: details.position,
        estimatedTimeSeconds: details.estimatedTimeSeconds,
        averageWaitTimeSeconds: details.averageWaitTimeSeconds,
        error: details.task.error,
        result: details.task.result
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  // Task cancellation endpoint
  app.post("/api/tasks/cancel", (req, res) => {
    try {
      const { taskId, userEmail = "Anônimo" } = req.body;
      if (!taskId) {
        return res.status(400).json({ error: "O ID da tarefa é obrigatório para cancelamento." });
      }
      const success = cancelQueuedTask(taskId, userEmail, req);
      return res.json({ success });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  // REAL-TIME SYSTEM MONITORING DIAGNOSTICS ENDPOINT (DevOps/Admin tool)
  app.get("/api/health", (req, res) => {
    try {
      const memoryUsage = process.memoryUsage();
      const uptime = process.uptime();
      
      const dbPath = path.join(process.cwd(), '.data', 'db.json');
      let dbOk = false;
      let dbSize = 0;
      if (fs.existsSync(dbPath)) {
        dbOk = true;
        dbSize = fs.statSync(dbPath).size;
      }

      res.json({
        status: "healthy",
        uptimeSeconds: Math.floor(uptime),
        timestamp: Date.now(),
        process: {
          memoryRssMb: Math.round(memoryUsage.rss / 1024 / 1024),
          memoryHeapTotalMb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          memoryHeapUsedMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          nodeVersion: process.version,
          platform: process.platform
        },
        queue: getQueueDiagnosticStats(),
        database: {
          healthy: dbOk,
          provider: "db.json (Decoupled Abstract Mode)",
          sizeBytes: dbSize
        }
      });
    } catch (e: any) {
      res.status(500).json({ status: "unhealthy", error: e.message });
    }
  });

  // SECURE ADMINISTRATOR DATABASE BACKUP GENERATOR (Protected with verifyAdminRole)
  app.post("/api/admin/backup", (req, res) => {
    try {
      if (!verifyAdminRole(req, res)) return;
      
      const backupDir = path.join(process.cwd(), '.data', 'backups');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      const dbPath = path.join(process.cwd(), '.data', 'db.json');
      if (!fs.existsSync(dbPath)) {
        return res.status(404).json({ error: "O banco de dados db.json não existe no momento para criar o backup." });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFilename = `db-backup-${timestamp}.json`;
      const backupFilePath = path.join(backupDir, backupFilename);

      fs.copyFileSync(dbPath, backupFilePath);
      console.log(`[BACKUP] Backup gerado com sucesso pelo administrador: ${backupFilename}`);

      // Log backup audit log
      addSystemLog('info', ADMIN_EMAIL, 'Backup Gerado', `Backup gerado com sucesso: ${backupFilename}`, req);

      // Enforce file retention: keep only the 5 most recent backup files
      const files = fs.readdirSync(backupDir);
      const backupFiles = files
        .filter(f => f.startsWith('db-backup-') && f.endsWith('.json'))
        .map(f => ({ name: f, time: fs.statSync(path.join(backupDir, f)).mtime.getTime() }))
        .sort((a, b) => b.time - a.time); // newest first

      if (backupFiles.length > 5) {
        const excessFiles = backupFiles.slice(5);
        excessFiles.forEach(f => {
          fs.unlinkSync(path.join(backupDir, f.name));
          console.log(`[BACKUP] Backup de histórico antigo excluído: ${f.name}`);
        });
      }

      res.json({
        success: true,
        message: "Backup do banco de dados concluído com sucesso.",
        filename: backupFilename,
        totalBackupsStored: Math.min(backupFiles.length, 5)
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Backend Image Library Storage In-Memory Database
  const backendImageLibrary: any[] = [];

  app.get("/api/images", (req, res) => {
    return res.json(backendImageLibrary);
  });

  app.post("/api/images", (req, res) => {
    try {
      const item = req.body;
      if (!item || !item.imageUrl) {
        return res.status(400).json({ error: "Dados inválidos." });
      }
      const existingIdx = backendImageLibrary.findIndex(i => i.id === item.id || i.imageUrl === item.imageUrl);
      if (existingIdx >= 0) {
        backendImageLibrary[existingIdx] = { ...backendImageLibrary[existingIdx], ...item };
      } else {
        backendImageLibrary.unshift(item);
      }
      return res.json({ success: true, item });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/images/:id", (req, res) => {
    const { id } = req.params;
    const idx = backendImageLibrary.findIndex(i => i.id === id);
    if (idx >= 0) {
      backendImageLibrary.splice(idx, 1);
    }
    return res.json({ success: true });
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
          // Look for an existing customer with this email
          const customers = await stripe.customers.list({ email, limit: 10 });
          for (const customer of customers.data) {
            // Check if customer has or had subscriptions
            const subscriptions = await stripe.subscriptions.list({ customer: customer.id, status: 'all', limit: 10 });
            if (subscriptions.data.length > 0) {
              userEligibleForTrial = false;
              console.log(`[AUDIT] O usuário ${email} já possui histórico de assinaturas na Stripe. Avaliação gratuita revogada.`);
              break;
            }
          }
        } catch (e) {
          console.error("Erro ao verificar histórico de assinaturas do usuário:", e);
        }
      } else {
        if (!userEligibleForTrial) {
          console.log(`[AUDIT] O usuário ${email || 'desconhecido'} já utilizou o teste (verificado via banco/localStorage). Avaliação gratuita revogada.`);
        }
      }

      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:3000';
      const baseUrl = process.env.APP_URL || `${protocol}://${host}`;

      // Since this is a test environment and we don't have real price IDs, we create dynamic price data
      // For a real production app, use existing price IDs (e.g., price_123)
      const sessionConfig: Stripe.Checkout.SessionCreateParams = {
        payment_method_types: ["card"],
        mode: "subscription",
        customer_email: email, // Associate checkout with the user's email
        line_items: [
          {
            price_data: {
              currency: "brl",
              product_data: {
                name: isAnnual ? "ZENO Pro - Plano Anual" : "ZENO Pro - Plano Mensal",
                description: isAnnual ? "Acesso anual ilimitado aos modelos ZENO" : "Acesso mensal ilimitado aos modelos ZENO",
              },
              unit_amount: isAnnual ? 39990 : 3990, // in cents
              recurring: {
                interval: isAnnual ? "year" : "month",
              },
            },
            quantity: 1,
          },
        ],
        success_url: `${baseUrl}?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}?canceled=true`,
      };

      if (userEligibleForTrial) {
        sessionConfig.subscription_data = {
          trial_period_days: 7, // Free 7-day trial before billing begins
        };
      }

      const session = await stripe.checkout.sessions.create(sessionConfig);

      return res.json({ url: session.url, trialApplied: userEligibleForTrial });
    } catch (error: any) {
      console.error("Stripe Checkout Error:", error);
      return res.status(500).json({ error: error.message || "Erro ao criar sessão de checkout." });
    }
  });

  // Retrieve Subscription Details
  app.get("/api/subscription/retrieve", async (req, res) => {
    try {
      const { session_id, subscription_id } = req.query;
      const stripeSecret = process.env.STRIPE_SECRET_KEY || "sk_test_mock";
      const stripe = new Stripe(stripeSecret);

      let subscription;

      if (session_id) {
        const session = await stripe.checkout.sessions.retrieve(session_id as string, {
          expand: ["subscription"],
        });
        subscription = session.subscription as Stripe.Subscription;
      } else if (subscription_id) {
        subscription = await stripe.subscriptions.retrieve(subscription_id as string);
      } else {
        return res.status(400).json({ error: "É necessário informar session_id ou subscription_id." });
      }

      if (!subscription) {
        return res.status(404).json({ error: "Assinatura não encontrada." });
      }

      const planAmount = subscription.items.data[0]?.price.unit_amount || 0;
      const planCurrency = subscription.items.data[0]?.price.currency || 'brl';

      return res.json({
        subscriptionId: subscription.id,
        status: subscription.status,
        trialEnd: subscription.trial_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        currentPeriodEnd: (subscription as any).current_period_end,
        amount: planAmount,
        currency: planCurrency,
      });
    } catch (error: any) {
      console.error("Stripe Retrieve Error:", error);
      return res.status(500).json({ error: error.message || "Erro ao buscar assinatura." });
    }
  });

  // Cancel Subscription Auto-Renewal
  app.post("/api/subscription/cancel", async (req, res) => {
    try {
      const { subscription_id } = req.body;
      console.log(`[API] Solicitado cancelamento da assinatura: ${subscription_id}`);
      
      if (!subscription_id) {
        console.error("[API] Falha: subscription_id ausente na requisição de cancelamento.");
        return res.status(400).json({ error: "subscription_id não fornecido." });
      }
      
      const stripeSecret = process.env.STRIPE_SECRET_KEY || "sk_test_mock";
      const stripe = new Stripe(stripeSecret);
      
      console.log(`[API] Chamando Stripe.subscriptions.update para cancelar a assinatura: ${subscription_id}`);
      const subscription = await stripe.subscriptions.update(subscription_id, {
        cancel_at_period_end: true,
      }) as Stripe.Subscription;
      console.log(`[API] Sucesso: Assinatura Stripe cancelada com sucesso. (cancel_at_period_end: ${subscription.cancel_at_period_end})`);

      const planAmount = subscription.items.data[0]?.price.unit_amount || 0;
      const planCurrency = subscription.items.data[0]?.price.currency || 'brl';

      return res.json({
        subscriptionId: subscription.id,
        status: subscription.status,
        trialEnd: subscription.trial_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        currentPeriodEnd: (subscription as any).current_period_end,
        amount: planAmount,
        currency: planCurrency,
      });
    } catch (error: any) {
      console.error("[API] Stripe Cancel Error:", error);
      return res.status(500).json({ error: error.message || "Erro ao cancelar assinatura na Stripe." });
    }
  });

  // Reactivate Subscription Auto-Renewal
  app.post("/api/subscription/reactivate", async (req, res) => {
    try {
      const { subscription_id } = req.body;
      console.log(`[API] Solicitada reativação da assinatura: ${subscription_id}`);
      
      if (!subscription_id) {
        console.error("[API] Falha: subscription_id ausente na requisição de reativação.");
        return res.status(400).json({ error: "subscription_id não fornecido." });
      }
      
      const stripeSecret = process.env.STRIPE_SECRET_KEY || "sk_test_mock";
      const stripe = new Stripe(stripeSecret);
      
      console.log(`[API] Chamando Stripe.subscriptions.update para reativar a assinatura: ${subscription_id}`);
      const subscription = await stripe.subscriptions.update(subscription_id, {
        cancel_at_period_end: false,
      }) as Stripe.Subscription;
      console.log(`[API] Sucesso: Assinatura Stripe reativada com sucesso. (cancel_at_period_end: ${subscription.cancel_at_period_end})`);

      const planAmount = subscription.items.data[0]?.price.unit_amount || 0;
      const planCurrency = subscription.items.data[0]?.price.currency || 'brl';

      return res.json({
        subscriptionId: subscription.id,
        status: subscription.status,
        trialEnd: subscription.trial_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        currentPeriodEnd: (subscription as any).current_period_end,
        amount: planAmount,
        currency: planCurrency,
      });
    } catch (error: any) {
      console.error("[API] Stripe Reactivate Error:", error);
      return res.status(500).json({ error: error.message || "Erro ao reativar assinatura na Stripe." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // Support Express v4 syntax
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
