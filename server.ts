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

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

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

  // API Routes
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, history, speed, plan, userId, attachments, systemInstruction } = req.body;
      
      if (!message) {
        return res.status(400).json({ error: "Mensagem é obrigatória." });
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
        const relevantMemories = await retrieveRelevantMemories(userId, message, 4);
        if (relevantMemories && relevantMemories.length > 0) {
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
        await setUserPlan(userId, plan || 'ZENO Free');
        
        // Pass userEmail and req to automatically update active metadata
        const usage = await getUserUsage(userId, userEmail, req);
        
        if (plan !== 'ZENO Pro') {
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
          // If Pro user, let's still update dynamic system stats
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
        model: modelCfg.apiModel,
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

      const fullResponseText = response.text || "";
      res.write(`data: ${JSON.stringify({ text: fullResponseText })}\n\n`);

      // Store AI response in vector memory
      if (userId && fullResponseText.length > 10) {
        await storeMemory(userId, fullResponseText, { type: "ai_response", model: modelCfg.apiModel });
      }

      res.write("data: [DONE]\n\n");
      res.end();
    } catch (error: any) {
      console.error("Chat Error:", error);
      res.write(`data: ${JSON.stringify({ error: error.message || "Erro interno no servidor ZENO." })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
    }
  });

  // GET Admin Stats (Protected)
  app.get("/api/admin/stats", async (req, res) => {
    try {
      if (!verifyAdminRole(req, res)) return;
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
      if (!verifyAdminRole(req, res)) return;
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
      await addSystemLog("auth", userEmail || "Anônimo", action, details, req);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET Admin Config (Protected)
  app.get("/api/admin/config", async (req, res) => {
    try {
      if (!verifyAdminRole(req, res)) return;
      const config = await getAdminConfig();
      res.json(config);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST Admin Config (Protected)
  app.post("/api/admin/config", async (req, res) => {
    try {
      if (!verifyAdminRole(req, res)) return;
      const newConfig = req.body;
      const db = await readDb();
      await addSystemLog('info', ADMIN_EMAIL, 'Atualização de Configuração', 'Configurações globais do sistema atualizadas via painel admin.', req);
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
      if (!verifyAdminRole(req, res)) return;
      const logsSnap = await adminDb.collection('stripe_webhook_logs').orderBy('timestamp', 'desc').limit(100).get();
      const failedSnap = await adminDb.collection('failed_webhooks').limit(50).get();

      const logs = logsSnap.docs.map(d => d.data());
      const failed = failedSnap.docs.map(d => d.data());

      return res.json({ logs, failedWebhooks: failed });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // GET Subscription Details & Renewal Reminders
  app.get("/api/subscription/details", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(400).json({ error: "userId é obrigatório." });
      }
      const details = await SubscriptionService.validateAndGetDetails(userId);
      const reminderResult = await SubscriptionService.checkAndProcessReminders(userId);
      
      res.json({
        ...details,
        pendingNotification: reminderResult?.pendingNotification || null
      });
    } catch (e: any) {
      res.json({
        isPro: false,
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
  });

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
      const { userId, subscription_id } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "userId é obrigatório." });
      }
      const sub = await SubscriptionService.getSubscription(userId);
      if (!sub) {
        return res.status(404).json({ error: "Assinatura não encontrada." });
      }
      sub.autoRenew = false;
      sub.status = 'active'; // active until period end

      await adminDb.collection('subscriptions').doc(userId).set(sub, { merge: true });
      await SubscriptionService.emitEvent(userId, 'SubscriptionCanceled', { subscriptionId: sub.subscriptionId });
      await addSystemLog('info', userId, 'Cancelamento de Renovação', 'Renovação automática da assinatura ZENO Pro cancelada.', req);

      res.json({ success: true, subscriptionId: sub.subscriptionId || subscription_id, cancelAtPeriodEnd: true, status: 'active' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST Reactivate Subscription Auto-Renewal
  app.post("/api/subscription/reactivate", async (req, res) => {
    try {
      const { userId, subscription_id } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "userId é obrigatório." });
      }
      const sub = await SubscriptionService.getSubscription(userId);
      if (!sub) {
        return res.status(404).json({ error: "Assinatura não encontrada." });
      }
      sub.autoRenew = true;
      sub.status = 'active';

      await adminDb.collection('subscriptions').doc(userId).set(sub, { merge: true });
      await SubscriptionService.emitEvent(userId, 'SubscriptionActivated', { subscriptionId: sub.subscriptionId });
      await addSystemLog('info', userId, 'Reativação de Renovação', 'Cobrança automática da assinatura ZENO Pro reativada.', req);

      res.json({ success: true, subscriptionId: sub.subscriptionId || subscription_id, cancelAtPeriodEnd: false, status: 'active' });
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
      const sub = await SubscriptionService.getSubscription(userId);
      if (!sub) {
        return res.status(404).json({ error: "Assinatura não encontrada." });
      }
      sub.paymentMethod = paymentMethod || { brand: 'visa', last4: '4242' };
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
      const sessions = snap.docs.map(d => d.data());
      res.json({ sessions });
    } catch (e: any) {
      res.json({ sessions: [] });
    }
  });

  app.post("/api/sync/sessions", async (req, res) => {
    try {
      const { userId, sessions } = req.body;
      if (!userId || !Array.isArray(sessions)) return res.status(400).json({ error: "Invalid data" });
      
      const batch = adminDb.batch();
      sessions.forEach((s: any) => {
        const ref = adminDb.collection('chats').doc(s.id);
        batch.set(ref, { ...s, userId }, { merge: true });
      });
      await batch.commit();
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/sync/settings", async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId) return res.status(400).json({ error: "userId is required" });
      const doc = await adminDb.collection('users').doc(userId as string).get();
      if (!doc.exists) return res.json({ settings: null });
      const data = doc.data();
      res.json({ settings: data?.settings || null });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/sync/settings", async (req, res) => {
    try {
      const { userId, settings } = req.body;
      if (!userId || !settings) return res.status(400).json({ error: "Invalid data" });
      await adminDb.collection('users').doc(userId).set({ settings }, { merge: true });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
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
        sessionConfig.subscription_data = { trial_period_days: 7 };
      }

      const session = await stripe.checkout.sessions.create(sessionConfig);
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
