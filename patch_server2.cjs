const fs = require('fs');

let server = fs.readFileSync('server.ts', 'utf8');

const supportCode = `
// Support Chat API
import { GoogleGenAI } from '@google/genai';
app.post("/api/support/chat", async (req, res) => {
  try {
    const { messages, userId, email, actionCallback } = req.body;
    if (!userId) {
      return res.status(401).json({ error: "Usuário não autenticado." });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    // Tools
    const tools = [{
      functionDeclarations: [
        {
          name: "cancelSubscription",
          description: "Cancela a renovação automática da assinatura Pro do usuário no Stripe. SÓ USE ISSO APÓS CONFIRMAR EXPLICITAMENTE COM O USUÁRIO (ex: 'Confirma o cancelamento?').",
          parameters: {
            type: "OBJECT",
            properties: {
              reason: {
                type: "STRING",
                description: "Opcional, o motivo pelo qual o usuário quer cancelar."
              }
            },
          }
        },
        {
          name: "createSupportTicket",
          description: "Cria um ticket no painel Admin se a mensagem for uma reclamação (bug, cobrança indevida, insatisfação) que o bot não pode resolver sozinho.",
          parameters: {
            type: "OBJECT",
            properties: {
              category: {
                type: "STRING",
                description: "Categoria da reclamação: 'bug', 'billing', ou 'other'"
              },
              details: {
                type: "STRING",
                description: "Resumo da reclamação do usuário"
              }
            },
            required: ["category", "details"]
          }
        }
      ]
    }];

    // Read KB
    const fsMod = require('fs');
    const path = require('path');
    const kbPath = path.join(process.cwd(), 'src/lib/faqKnowledge.ts');
    let kb = "";
    if (fsMod.existsSync(kbPath)) {
      kb = fsMod.readFileSync(kbPath, 'utf8');
    }

    const systemInstruction = "Você é o assistente de Suporte e FAQ do ZENO AI. Responda APENAS com base nesta base de conhecimento: " + kb + "\\n\\nSe a pergunta não estiver na base ou envolver dados específicos da conta, diga que vai encaminhar para o suporte humano e crie um ticket (usando createSupportTicket). NUNCA INVENTE precos ou politicas. Se o usuario pedir para cancelar a assinatura, PRIMEIRO pergunte se ele confirma (informando que o acesso vai até o final do período atual). SE, E SOMENTE SE, ele responder que sim/confirma explicitamente, chame a tool cancelSubscription.";

    const formattedMessages = messages.map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : m.role === 'system' ? 'user' : 'user',
      parts: [{ text: m.content }]
    }));

    if (actionCallback) {
      // If there's a function call result passed from the client
      formattedMessages.push(actionCallback);
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: formattedMessages,
      config: {
        systemInstruction: systemInstruction,
        tools: tools,
        temperature: 0.2
      }
    });

    let toolCall = null;
    let text = "";

    if (response.functionCalls && response.functionCalls.length > 0) {
      const call = response.functionCalls[0];
      
      if (call.name === 'cancelSubscription') {
         // Execute cancellation
         try {
            const sub = await SubscriptionService.getSubscription(userId);
            let customerId = sub?.customerId || sub?.stripeCustomerId;
            let targetSubId = sub?.subscriptionId || sub?.stripeSubscriptionId;
            if (!customerId || !targetSubId) {
               const userDoc = await adminDb.collection('users').doc(userId).get();
               if (userDoc.exists) {
                 const uData = userDoc.data();
                 customerId = customerId || uData?.stripeCustomerId || uData?.customerId;
                 targetSubId = targetSubId || uData?.stripeSubscriptionId || uData?.subscriptionId;
               }
            }
            if (targetSubId && !targetSubId.startsWith('sub_default')) {
               const stripe = getStripe();
               if(stripe) {
                 await stripe.subscriptions.update(targetSubId, { cancel_at_period_end: true });
                 if (sub) {
                   sub.cancelAtPeriodEnd = true;
                   sub.cancelAt = Date.now();
                   sub.autoRenew = false;
                   sub.status = 'cancel_at_period_end';
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
         const { category, details } = call.args;
         await adminDb.collection('supportTickets').add({
           userId,
           email: email || '',
           category,
           details,
           status: 'aberto',
           createdAt: Date.now()
         });
         return res.json({ toolCall: { name: 'createSupportTicket', result: "Ticket criado com sucesso." } });
      }
    }

    if (response.text) {
      text = response.text;
    }

    res.json({ reply: text });

  } catch (error: any) {
    console.error("[Support Chat API Error]:", error);
    res.status(500).json({ error: error.message });
  }
});

// Admin Support Tickets API
app.get("/api/admin/support-tickets", async (req, res) => {
  try {
    const email = req.headers['x-user-email'];
    if (!email) return res.status(401).json({ error: "No user email" });
    const userRole = await getUserRole(email as string);
    if (userRole !== 'admin') return res.status(403).json({ error: "Forbidden" });

    const snapshot = await adminDb.collection('supportTickets').orderBy('createdAt', 'desc').get();
    const tickets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ tickets });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/admin/support-tickets/:id/resolve", async (req, res) => {
  try {
    const email = req.headers['x-user-email'];
    const userRole = await getUserRole(email as string);
    if (userRole !== 'admin') return res.status(403).json({ error: "Forbidden" });

    const { id } = req.params;
    await adminDb.collection('supportTickets').doc(id).update({
      status: 'resolvido',
      resolvedAt: Date.now()
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
`;

if (!server.includes('app.post("/api/support/chat"')) {
   server = server.replace(/(\/\/ Vite\/Prod middleware)/, supportCode + "\n  $1");
   fs.writeFileSync('server.ts', server);
   console.log("Server patched.");
} else {
   console.log("Already patched.");
}
