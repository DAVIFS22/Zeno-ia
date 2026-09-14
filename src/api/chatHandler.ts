import { getVerifiedEmail } from "../server/auth";
import { isAdminUser } from "../config/admin";
import { SubscriptionService } from "../lib/subscriptionService";
import { smartSelectModel } from "../server/models";
import { getModelConfig } from "../lib/models";
import { buildAdaptiveSystemPrompt, DEFAULT_ADAPTIVE_PROFILE } from "../lib/adaptiveLearning";
import { retrieveRelevantMemories, storeMemory } from "../lib/vectorMemory";
import { setUserPlan, getUserUsage, getAdminConfig, addSystemLog, updateUserUsage, incrementStatCounter } from "../lib/limits";
import { createQueuedTask, getTaskStatusDetails } from "../lib/taskManager";
import { generateTextWithFallback } from "../services/aiProvider";
import { supportTools } from "../lib/supportTools";
import { adminDb } from "../lib/firebaseAdmin";

export async function handleChat(req: any, res: any) {
  let currentUserId = req.body?.userId || '';
  let currentIsSearch = false;

  try {
    const { 
      message, 
      history, 
      speed, 
      userId, 
      attachments, 
      systemInstruction, 
      isSmartMode, 
      adaptiveProfile, 
      geminiApiKey, 
      isThinkingMode 
    } = req.body;
    
    if (userId) currentUserId = userId;
    
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: "Mensagem é obrigatória e deve ser texto." });
    }

    const verifiedEmail = await getVerifiedEmail(req);
    const userEmail = verifiedEmail || (req.body?.userEmail || req.headers['x-user-email'] || '') as string;
    const isAdmin = isAdminUser(verifiedEmail) || isAdminUser(userEmail);

    const subDetails = await SubscriptionService.validateAndGetDetails(userId);
    const isPro = isAdmin || subDetails.isPro;

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
      'encontre informações', 'informações sobre', 'fale sobre', 'conteúdo sobre',
      'agora', 'lançamento', 'estreia', 'filme', 'série', 'cripto', 'dólar', 'euro', 'bolsa', 'ações',
      'qual o', 'como está', 'onde fica', 'porque está', 'motivo de', 'entenda o que', 'saiba mais sobre',
      'hoje', 'ontem', '2024', '2025'
    ];
    
    const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
    const hasImages = hasAttachments && attachments.some(a => 
      (a.mimeType || a.type || '').includes('image') || 
      (a.url && a.url.startsWith('data:image/')) || 
      !!a.name?.match(/\.(png|jpe?g|webp|gif|heic|bmp|svg)$/i)
    );

    let isSearchIntent = (normSpeed === 'search' || searchTriggers.some(t => msgLower.includes(t))) && !hasImages;
    currentIsSearch = isSearchIntent;

    if (hasImages) {
      taskType = 'vision';
      normSpeed = 'vision';
      apiModelName = await smartSelectModel('vision', isPro);
    } else if (isSearchIntent) {
      taskType = 'search';
      normSpeed = 'search';
      apiModelName = await smartSelectModel('search', isPro);
    } else if (isSmartMode !== false) {
      taskType = 'general';
      if (Array.isArray(attachments) && attachments.length > 0) {
        const mainFile = attachments[0];
        const mime = mainFile.mimeType || mainFile.type || '';
        if (mime.includes('pdf')) taskType = 'search';
        else if (mime.includes('image')) taskType = 'vision';
        else if (mime.includes('audio')) taskType = 'general';
        else if (mime.includes('video')) taskType = 'general';
      } else if (msgLower.includes('código') || msgLower.includes('programação') || msgLower.includes('react') || msgLower.includes('typescript')) {
        taskType = 'code';
      } else if (msgLower.includes('pense') || msgLower.includes('raciocínio') || msgLower.includes('matemática') || isThinkingMode) {
        taskType = 'think';
      } else if (msgLower.includes('pesquise') || msgLower.includes('busca') || msgLower.includes('notícias')) {
        taskType = 'search';
      }

      apiModelName = await smartSelectModel(taskType, isPro);
      
      if (taskType === 'code' || taskType === 'think') normSpeed = 'think';
      else if (taskType === 'search') normSpeed = 'search';
      else if (taskType === 'vision' || taskType === 'image') normSpeed = 'vision';
      else normSpeed = 'zeno';
    } else {
      const modelCfg = getModelConfig(normSpeed);
      apiModelName = modelCfg.apiModel;
      if (normSpeed === 'think' || normSpeed === 'mega' || normSpeed === 'grok' || normSpeed === 'grok-4.6') taskType = 'think';
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

    if (hasImages) {
      modelSystemPrompt += `\n\n[DIRETRIZES DE VISÃO COMPUTACIONAL & ANÁLISE MULTIMODAL AVANÇADA]:
Você possui capacidade avançada de visão computacional e OCR para analisar e extrair dados das imagens enviadas.
- **Recibos, Cupons Fiscais e Faturas**: Extraia com exatidão o nome do estabelecimento/empresa, data e hora, lista de itens com quantidades e preços unitários formatados em uma tabela Markdown limpa, subtotal, impostos/taxas/gorjeta, descontos e o VALOR TOTAL em negrito destacado.
- **Cardápios e Menus de Restaurantes**: Identifique as seções/categorias, nomes dos pratos, preços, ingredientes principais, traduza para o idioma de resposta quando relevante e alerte sobre potenciais alérgenos (glúten, lactose, nozes, frutos do mar).
- **Gráficos e Infográficos**: Identifique o tipo de gráfico (barras, linhas, pizza, dispersão), leia com exatidão os rótulos e valores dos eixos X e Y, legendas, variações percentuais e forneça insights e conclusões analíticas claras.
- **OCR e Documentos / Prints de Código**: Transcreva o texto ou código visível fielmente preservando formatação, indentação e estrutura lógica.
- **Análise Geral de Imagens**: Descreva minuciosamente os elementos visuais, paleta de cores, composição espacial, objetos, pessoas e significado conceitual.`;
    } else if (isSearchIntent) {
      modelSystemPrompt += `\n\n[REGRA DE PESQUISA NA WEB OBRIGATÓRIA]: Você possui acesso em tempo real à internet através da ferramenta de pesquisa Google Search. SEMPRE utilize os resultados da pesquisa para responder com precisão e dados atualizados. NUNCA responda que não possui acesso à internet ou que não pode acessar a internet em tempo real. NUNCA gere imagens automaticamente durante pesquisas. NUNCA utilize serviços de geração de imagens como fonte ou referência. IMPORTANTE: NUNCA crie uma seção 'Fontes:', 'Referências:' nem liste domínios, URLs ou links soltos ao final da sua resposta. A interface do usuário já exibirá automaticamente os sites utilizados em um componente visual separado. Apenas forneça a resposta de forma direta e atualizada.`;
    } else {
      modelSystemPrompt += `\n\n[REGRA DE MÍDIA E IMAGENS]: Quando o usuário solicitar a geração de uma imagem (ex: "gere uma imagem de...", "desenhe...", "crie uma foto"), o sistema detecta a intenção e gera a imagem automaticamente na conversa.`;
    }
    
    modelSystemPrompt += '\n\n' + buildAdaptiveSystemPrompt(adaptiveProfile || DEFAULT_ADAPTIVE_PROFILE);

    const uiLanguage = req.body.language || 'pt-BR';
    modelSystemPrompt += `\n\n[IDIOMA OBRIGATÓRIO]: O idioma da interface e de resposta é ${uiLanguage}. VOCÊ DEVE RESPONDER ÚNICA E EXCLUSIVAMENTE NO IDIOMA ${uiLanguage}.`;

    let modelTemperature = modelCfg.temperature;

    if (userId) {
      const relevantMemories = await retrieveRelevantMemories(userId, message, 3);
      if (relevantMemories && relevantMemories.length > 0) {
        modelSystemPrompt += "\n\n[HISTÓRICO RELEVANTE]:\n" + relevantMemories.map(m => `- ${m.content}`).join('\n');
      }
    }

    const isImageMode = 
      (normSpeed === "image" || 
       normSpeed === "vision" || 
       /^(gerar|crie|criar|desenhe|desenhar|faça|fazer|gere|mostre|me dá|me mostre)\s*(uma?|um)?\s*(imagem|foto|arte|ilustração|wallpaper|quadro|desenho|logotipo|logo|personagem|grafico|gráfico|infográfico|infografico|diagrama|wireframe|mockup|render|3d|pintura|avatar|ícone|icone)/i.test(message.trim()) ||
       /(desenhe|gere uma imagem|crie uma arte|faça uma ilustração|faça um wallpaper|anime|manga|logotipo|personagem|foto realista|fotografia de|imagem de|image of|generate image|draw a|create an image|crie um mockup|faça um diagrama|crie um infográfico)/i.test(message.trim())) && 
      !hasAttachments;

    if (userId) {
      await setUserPlan(userId, isPro ? 'ZENO Pro' : 'ZENO Free');
      const usage = await getUserUsage(userId, userEmail, req);
      
      if (!isPro) {
        const config = await getAdminConfig();
        let actionType = 'messages';
        if (normSpeed === 'search' || normSpeed === 'mega' || normSpeed === 'pdf') actionType = 'search';
        else if (normSpeed === 'vision' || normSpeed === 'image' || isImageMode) actionType = 'vision';
        else if (attachments && attachments.length > 0) actionType = 'doc';
        
        if (usage.usage[actionType as keyof typeof usage.usage] >= config.limits[actionType as keyof typeof config.limits]) {
          await addSystemLog('error', userEmail || 'Anônimo', 'Limite de Uso Atingido', `Usuário bloqueado: atingiu o limite de ${config.limits[actionType as keyof typeof config.limits]} em ${actionType}`, req);
          return res.status(429).json({ error: `Limite diário atingido. Você atingiu o limite de ${config.limits[actionType as keyof typeof config.limits]} usos para ${actionType} hoje.`, isLimitReached: true, actionType: actionType });
        }
        await updateUserUsage(userId, actionType as any);
      } else {
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

    if (userId && message.length > 10) {
      await storeMemory(userId, message, { type: "user_message", speed: normSpeed });
    }

    if (isImageMode) {
      const cleanPrompt = message.replace(/^(gerar|crie|criar|desenhe|desenhar|faça|fazer|gere|mostre|me dá|me mostre)\s*(uma?|um)?\s*(imagem|foto|arte|ilustração|wallpaper|quadro|desenho|logotipo|logo|personagem|grafico|gráfico|infográfico|infografico|diagrama|wireframe|mockup|render|3d|pintura|avatar|ícone|icone)/i, "").trim();
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
      res.write(`data: ${JSON.stringify({ activeModel: modelCfg.name, modelId: 'vision', isSearch: false, isSearching: false })}\n\n`);
      res.write(`data: ${JSON.stringify({ text: `🎨 **Gerando imagem:** "${cleanPrompt || message}"...` })}\n\n`);

      const task = await createQueuedTask({
        userId: userId || 'anon-user',
        userEmail: userEmail || 'Anônimo',
        plan: isPro ? 'ZENO Pro' : 'ZENO Free',
        payload: {
          prompt: cleanPrompt || message,
          style: 'photorealistic',
          aspectRatio: '1:1',
          enhance: true,
          engine: "flux",
          negativePrompt: ""
        },
        req
      });

      while (true) {
        const details = await getTaskStatusDetails(task.id);
        if (details.task?.status === 'completed') {
          res.write(`data: ${JSON.stringify({ text: `✨ **Imagem gerada:**\n\n![${cleanPrompt}](${details.task.result.imageUrl})` })}\n\n`);
          res.write("data: [DONE]\n\n");
          return res.end();
        }
        if (details.task?.status === 'failed') {
          res.write(`data: ${JSON.stringify({ text: `❌ **Falha ao gerar imagem.**` })}\n\n`);
          res.write("data: [DONE]\n\n");
          return res.end();
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const contents: any[] = [];
    if (history && Array.isArray(history)) {
      let lastRole: string | null = null;
      history.forEach((msg) => {
        const currentRole = msg.role === "user" ? "user" : "model";
        if (currentRole === lastRole) return;
        contents.push({ role: currentRole, parts: [{ text: msg.text || "" }] });
        lastRole = currentRole;
      });
    }
    
    let userParts: any[] = [];
    if (attachments && Array.isArray(attachments)) {
      for (const att of attachments) {
         if (att.url && att.url.startsWith("data:")) {
            const base64Data = att.url.split(",")[1];
            let mimeType = att.url.split(";")[0].split(":")[1];
            if (att.type === "document") mimeType = "application/pdf";
            userParts.push({ inlineData: { data: base64Data, mimeType: mimeType } });
         }
      }
    }
    userParts.push({ text: message });
    contents.push({ role: "user", parts: userParts });

    const tools: any[] = [];
    if (isSearchIntent) tools.push({ googleSearch: {} });
    tools.push({ functionDeclarations: supportTools });

    const aiResult = await generateTextWithFallback({
      contents,
      systemInstruction: modelSystemPrompt,
      temperature: modelTemperature,
      maxOutputTokens: 2048,
      tools: tools.length > 0 ? tools : undefined,
      isSearchIntent,
      hasImages,
      category: taskType as any,
      userGeminiApiKey: geminiApiKey,
      isThinkingMode,
      userRequestedModel: apiModelName
    });

    if (aiResult.functionCalls && aiResult.functionCalls.length > 0) {
      const call = aiResult.functionCalls[0];
      if (call.name === 'createSupportTicket') {
        const ticketRef = await adminDb.collection('supportTickets').add({
          userId: userId || 'anonymous',
          userEmail: userEmail || '',
          status: 'pending_human',
          title: call.args.title || 'Atendimento via Chat',
          createdAt: Date.now()
        });
        res.writeHead(200, { "Content-Type": "text/event-stream" });
        res.write(`data: ${JSON.stringify({ text: "Abrindo ticket de suporte..." })}\n\n`);
        res.write("data: [DONE]\n\n");
        return res.end();
      }
    }

    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    res.write(`data: ${JSON.stringify({ activeModel: modelCfg.name, modelId: isSearchIntent ? 'search' : normSpeed, isSearch: isSearchIntent })}\n\n`);
    res.write(`data: ${JSON.stringify({ text: aiResult.text, sources: aiResult.sources || [] })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();

  } catch (err: any) {
    console.error("[CHAT HANDLER ERROR]:", err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
    else res.end();
  }
}
