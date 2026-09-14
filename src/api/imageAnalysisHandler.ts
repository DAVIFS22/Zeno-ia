import { generateTextWithFallback } from "../services/aiProvider";

export async function handleImageAnalysis(req: any, res: any) {
  try {
    let imageBuffer: Buffer | null = null;
    let mimeType: string = "image/jpeg";

    if (req.file) {
      imageBuffer = req.file.buffer;
      mimeType = req.file.mimetype || "image/jpeg";
    } else if (req.body?.image) {
      const rawImage = req.body.image;
      if (typeof rawImage === 'string' && rawImage.startsWith('data:')) {
        const match = rawImage.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          mimeType = match[1];
          imageBuffer = Buffer.from(match[2], 'base64');
        }
      }
    }

    if (!imageBuffer || imageBuffer.length === 0) {
      return res.status(400).json({ error: "Nenhuma imagem válida fornecida." });
    }

    const mode = req.body.mode || 'general';
    const userPrompt = req.body.prompt || '';
    const geminiApiKey = req.body.geminiApiKey;

    const aiResult = await generateTextWithFallback({
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { data: imageBuffer.toString('base64'), mimeType } },
            { text: userPrompt || 'Analise esta imagem detalhadamente.' }
          ]
        }
      ],
      category: 'vision',
      userGeminiApiKey: geminiApiKey,
    });

    res.json({
      analysis: aiResult.text,
      mode,
      modelUsed: aiResult.modelUsed,
      provider: 'gemini',
      timestamp: Date.now()
    });

  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Erro ao analisar a imagem." });
  }
}
