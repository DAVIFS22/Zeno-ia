import * as fs from 'fs';

const filePath = 'src/services/ai/providerManager.ts';
let code = fs.readFileSync(filePath, 'utf8');

code = code.replace(
  `function prepareOpenAiMessages(contents: any[], systemInstruction?: string) {
  const messages: Array<{ role: string; content: string }> = [];
  let baseSystem = systemInstruction || "Você é o ZENO AI, assistente inteligente.";
  baseSystem += "\\n\\n[REGRA CRÍTICA DE MÍDIA]: Você NUNCA deve gerar links de imagem, URLs de serviços externos nem tags markdown de imagem. Se o usuário pedir imagem, informe para usar o Estúdio de Imagens do ZENO.";
  messages.push({ role: 'system', content: baseSystem });

  for (const c of contents) {
    let role = c.role === 'model' ? 'assistant' : 'user';
    let textPart = "";

    if (Array.isArray(c.parts)) {
      textPart = c.parts.map((p: any) => p.text || "").filter(Boolean).join("\\n");
    } else if (typeof c === 'string') {
      textPart = c;
    }

    if (textPart) {
      messages.push({ role, content: textPart });
    }
  }

  return messages;
}`,
  `function prepareOpenAiMessages(contents: any[], systemInstruction?: string) {
  const messages: Array<{ role: string; content: any }> = [];
  let baseSystem = systemInstruction || "Você é o ZENO AI, assistente inteligente.";
  baseSystem += "\\n\\n[REGRA CRÍTICA DE MÍDIA]: Você NUNCA deve gerar links de imagem, URLs de serviços externos nem tags markdown de imagem. Se o usuário pedir imagem, informe para usar o Estúdio de Imagens do ZENO.";
  messages.push({ role: 'system', content: baseSystem });

  for (const c of contents) {
    let role = c.role === 'model' ? 'assistant' : 'user';

    if (Array.isArray(c.parts)) {
      const hasImage = c.parts.some((p: any) => p.inlineData);
      if (hasImage) {
        const contentArray = c.parts.map((p: any) => {
          if (p.text) return { type: 'text', text: p.text };
          if (p.inlineData) return { type: 'image_url', image_url: { url: \`data:\${p.inlineData.mimeType};base64,\${p.inlineData.data}\` } };
          return null;
        }).filter(Boolean);
        messages.push({ role, content: contentArray });
      } else {
        const textPart = c.parts.map((p: any) => p.text || "").filter(Boolean).join("\\n");
        if (textPart) messages.push({ role, content: textPart });
      }
    } else if (typeof c === 'string') {
      if (c) messages.push({ role, content: c });
    }
  }

  return messages;
}`
);

fs.writeFileSync(filePath, code);
