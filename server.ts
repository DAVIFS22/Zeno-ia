import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import Stripe from "stripe";

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
const PRIMARY_TEXT_MODEL = "gemini-3.6-flash";
const PRO_REASONING_MODEL = "gemini-3.1-pro-preview";
const LITE_FAST_MODEL = "gemini-3.1-flash-lite";
const LATEST_ALIAS_MODEL = "gemini-flash-latest";

// Deprecated or non-existent models to block
const DEPRECATED_MODELS = new Set([
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "gemini-pro",
  "gemini-2.0-flash",
  "gemini-2.0-pro",
  "gemini-2.0-flash-thinking",
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
  if (speed === "mega") {
    list = [PRO_REASONING_MODEL, PRIMARY_TEXT_MODEL, LITE_FAST_MODEL, LATEST_ALIAS_MODEL];
  } else if (speed === "fast") {
    list = [LITE_FAST_MODEL, PRIMARY_TEXT_MODEL, LATEST_ALIAS_MODEL];
  } else {
    list = [PRIMARY_TEXT_MODEL, LITE_FAST_MODEL, LATEST_ALIAS_MODEL];
  }
  return list.filter(isValidModelName);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  const subscriptionClients = new Map<string, express.Response[]>();

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
          const invoice = event.data.object as Stripe.Invoice;
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
            currentPeriodEnd: subscription.current_period_end,
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

  app.post("/api/chat", async (req, res) => {
    try {
      const { history, message, speed } = req.body;

      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      // Check if speed is 'image' or if message is explicitly asking to generate an image
      const isImageMode = speed === "image" || /^(gerar imagem|crie uma imagem|desenhe|gerar arte|criar imagem|gerar foto|image of|generate image)/i.test(message.trim());

      if (isImageMode) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        // Clean prompt
        const cleanPrompt = message.replace(/^(gerar imagem|crie uma imagem|desenhe|gerar arte|criar imagem|gerar foto|generate image|draw)\s*(de|para|a|um|uma|of|about)?\s*/i, "").trim() || message;
        
        let enhancedPrompt = cleanPrompt;
        const enhanceModels = [PRIMARY_TEXT_MODEL, LITE_FAST_MODEL, LATEST_ALIAS_MODEL];
        for (const mName of enhanceModels) {
          try {
            const enhanceResponse = await ai.models.generateContent({
              model: mName,
              contents: `Transform this user image prompt into an English high-quality, highly detailed photographic or digital art image prompt (max 40 words):\nPrompt: "${cleanPrompt}"`,
            });
            if (enhanceResponse.text) {
              enhancedPrompt = enhanceResponse.text.trim();
              break;
            }
          } catch (e: any) {
            console.error(`[ZENO Prompt Enhance] Model ${mName} error:`, e?.message || e);
          }
        }

        const seed = Math.floor(Math.random() * 1000000);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt + ", ultra detailed, 8k resolution, masterpiece")}?width=1024&height=1024&seed=${seed}&nologo=true`;

        const markdownOutput = `![${cleanPrompt}](${imageUrl})\n\n✨ **Imagem Gerada pelo ZENO Vision**\n\n- **Prompt Original:** *${cleanPrompt}*\n- **Prompt Aprimorado:** *${enhancedPrompt}*\n\n*(Você pode clicar na imagem para ampliar ou usar o Estúdio de Imagens do ZENO)*`;

        res.write(`data: ${JSON.stringify({ text: markdownOutput })}\n\n`);
        res.write("data: [DONE]\n\n");
        return res.end();
      }

      // Convert history to the format expected by GenAI SDK, which is just string content for simple cases,
      // but the chat model holds state on the backend. Since this is stateless via HTTP,
      // we'll pass the entire conversation history as an array of contents.
      const contents = [];
      if (history && Array.isArray(history)) {
        history.forEach((msg) => {
          contents.push({
            role: msg.role === "user" ? "user" : "model",
            parts: [{ text: msg.text }],
          });
        });
      }
      contents.push({
        role: "user",
        parts: [{ text: message }],
      });

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");


      
      const config: any = {
        systemInstruction: systemInstruction,
      };
      
      if (speed === "fast") {
        config.temperature = 0.5;
        config.topP = 0.8;
      } else if (speed === "mega") {
        config.temperature = 0.7;
        config.topP = 0.95;
        config.systemInstruction = `${systemInstruction}\n\n[MODO MEGA SÁBIO ATIVADO]: Você está operando no nível 'Mega Sábio' da internet. Traga a síntese mais profunda, abrangente, atualizada e analítica possível, cruzando dados de ciência, tecnologia, cultura e conhecimento global. Se tiver resultados de busca, cite e integre de forma harmoniosa.`;
      } else {
        config.temperature = 0.9;
        config.topP = 0.95;
      }

      const candidateModels = getCandidateModelsForMode(speed);

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

  // API route to generate AI Images
  app.post("/api/generate-image", async (req, res) => {
    try {
      const { prompt, style = "photorealistic", aspectRatio = "1:1", enhance = true } = req.body;

      if (!prompt || typeof prompt !== "string") {
        return res.status(400).json({ error: "O prompt é obrigatório." });
      }

      // Determine width and height based on aspect ratio
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

      // Map styles to prompt additions
      const stylePrompts: Record<string, string> = {
        photorealistic: "photorealistic, ultra-detailed 8k resolution, cinematic lighting, sharp focus, professional photography",
        anime: "anime art style, vibrant colors, detailed line art, studio ghibli inspired, high quality illustration",
        cyberpunk: "cyberpunk style, neon glow, futuristic city aesthetics, dark atmosphere, ultra detailed, octane render",
        "3d-render": "3d render, blender, unreal engine 5, ray tracing, soft lighting, Pixar style detail",
        digital: "digital art masterpiece, concept art, trending on artstation, rich color palette, detailed texturing",
        watercolor: "soft watercolor painting, artistic brush strokes, pastel aesthetic, delicate details, expressive art",
        minimalist: "minimalist design, clean shapes, elegant vector art, flat illustration, sophisticated color harmony",
      };

      const styleSuffix = stylePrompts[style] || stylePrompts.photorealistic;
      let finalPrompt = `${prompt}, ${styleSuffix}`;

      // Enhance prompt with Gemini if requested
      if (enhance) {
        const enhanceModels = [PRIMARY_TEXT_MODEL, LITE_FAST_MODEL, LATEST_ALIAS_MODEL];
        for (const mName of enhanceModels) {
          try {
            const enhanceResponse = await ai.models.generateContent({
              model: mName,
              contents: `Transform this Portuguese/English user request into a detailed, high-quality image generation prompt in English (max 50 words). Include art style, lighting, composition, and mood, but keep it clear and vivid.\nUser request: "${prompt}"\nStyle: "${style}"`,
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

      const seed = Math.floor(Math.random() * 1000000);
      const encodedPrompt = encodeURIComponent(finalPrompt);
      const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&nologo=true`;

      return res.json({
        imageUrl,
        prompt: finalPrompt,
        originalPrompt: prompt,
        aspectRatio,
        style,
        seed,
      });
    } catch (error: any) {
      console.error("Error generating image:", error);
      return res.status(500).json({ error: "Erro ao gerar imagem. Tente novamente." });
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
      if (!subscription_id) {
        return res.status(400).json({ error: "subscription_id não fornecido." });
      }
      
      const stripeSecret = process.env.STRIPE_SECRET_KEY || "sk_test_mock";
      const stripe = new Stripe(stripeSecret);

      const subscription = await stripe.subscriptions.update(subscription_id, {
        cancel_at_period_end: true,
      }) as Stripe.Subscription;

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
      console.error("Stripe Cancel Error:", error);
      return res.status(500).json({ error: error.message || "Erro ao cancelar assinatura." });
    }
  });

  // Reactivate Subscription Auto-Renewal
  app.post("/api/subscription/reactivate", async (req, res) => {
    try {
      const { subscription_id } = req.body;
      if (!subscription_id) {
        return res.status(400).json({ error: "subscription_id não fornecido." });
      }
      
      const stripeSecret = process.env.STRIPE_SECRET_KEY || "sk_test_mock";
      const stripe = new Stripe(stripeSecret);

      const subscription = await stripe.subscriptions.update(subscription_id, {
        cancel_at_period_end: false,
      }) as Stripe.Subscription;

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
      console.error("Stripe Reactivate Error:", error);
      return res.status(500).json({ error: error.message || "Erro ao reativar assinatura." });
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
