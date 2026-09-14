import { getVerifiedUser } from "../server/auth";
import { isAdminUser } from "../config/admin";
import { SubscriptionService } from "../lib/subscriptionService";
import { getUserUsage, getAdminConfig, updateUserUsage } from "../lib/limits";

export async function handleTranscribe(req: any, res: any) {
  try {
    const { audioBase64, userId } = req.body;
    if (!audioBase64) return res.status(400).json({ error: "Áudio não fornecido." });

    const verified = await getVerifiedUser(req);
    if (!verified || !verified.uid) {
      return res.status(401).json({ error: "Usuário não autenticado." });
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
    if (!apiKey) return res.status(500).json({ error: "GROQ_API_KEY não configurada." });

    const audioBuffer = Buffer.from(audioBase64, 'base64');
    if (audioBuffer.length === 0) return res.status(400).json({ error: "Arquivo de áudio está vazio." });

    const blob = new Blob([audioBuffer], { type: 'audio/webm' });
    const formData = new FormData();
    formData.append('file', blob, 'audio.webm');
    formData.append('model', 'whisper-large-v3');
    formData.append('language', 'pt');
    formData.append('response_format', 'json');

    const groqResponse = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: formData
    });

    if (!groqResponse.ok) {
      const errText = await groqResponse.text();
      return res.status(500).json({ error: "Falha na transcrição: " + errText });
    }

    const data = await groqResponse.json();
    if (!isAdmin) await updateUserUsage(verifiedUid, 'voice');

    res.json({ text: data.text || '' });
  } catch (error: any) {
    res.status(500).json({ error: "Erro interno: " + error.message });
  }
}
