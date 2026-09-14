import { Request, Response } from 'express';
import { GoogleGenAI, Modality } from '@google/genai';

/**
 * Helper to convert 16-bit raw PCM buffer to valid RIFF WAV buffer
 */
export function pcmToWav(
  pcmBuffer: Buffer,
  sampleRate: number = 24000,
  numChannels: number = 1,
  bitDepth: number = 16
): Buffer {
  const byteRate = (sampleRate * numChannels * bitDepth) / 8;
  const blockAlign = (numChannels * bitDepth) / 8;
  const dataSize = pcmBuffer.length;
  const chunkSize = 36 + dataSize;
  const header = Buffer.alloc(44);

  // RIFF header
  header.write('RIFF', 0);
  header.writeUInt32LE(chunkSize, 4);
  header.write('WAVE', 8);

  // fmt subchunk
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size for PCM = 16
  header.writeUInt16LE(1, 20); // AudioFormat = 1 (PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitDepth, 34);

  // data subchunk
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

// In-memory cache for fastest working TTS model to eliminate fallback lookup delay
let cachedFastestModel: string = 'gemini-2.0-flash';

/**
 * Handler for Gemini TTS requests with support for Server-Sent Events (SSE) streaming
 * and standard JSON responses.
 */
export async function handleGeminiTTS(req: Request, res: Response) {
  const { text, voice, stream } = req.body || {};

  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Texto obrigatório para síntese de voz.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY não configurada no servidor.' });
  }

  const aiClient = new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
  });

  const selectedVoice = voice || 'Aoede';
  
  // Prioritize cached fastest model, followed by known audio-capable models
  const allCandidateModels = [
    cachedFastestModel,
    'gemini-2.0-flash',
    'gemini-2.0-flash-exp',
    'gemini-flash-latest',
    'gemini-2.5-flash-preview-tts'
  ];
  const candidateModels = Array.from(new Set(allCandidateModels));

  const wantsStream = stream === true || req.headers.accept?.includes('text/event-stream');

  // If streaming is requested, setup low-latency SSE headers
  if (wantsStream) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
  }

  let lastError: any = null;

  for (const modelName of candidateModels) {
    try {
      if (wantsStream) {
        let chunkCount = 0;
        let streamSucceeded = false;

        try {
          const responseStream = await aiClient.models.generateContentStream({
            model: modelName,
            contents: text,
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: selectedVoice
                  }
                }
              }
            }
          });

          for await (const chunk of responseStream) {
            const candidate = chunk.candidates?.[0];
            const part = candidate?.content?.parts?.find((p: any) => p.inlineData?.data);

            if (part?.inlineData?.data) {
              chunkCount++;
              streamSucceeded = true;
              cachedFastestModel = modelName;
              const rawBase64 = part.inlineData.data;
              const mimeType = part.inlineData.mimeType || 'audio/pcm;rate=24000';

              res.write(`data: ${JSON.stringify({
                audio: rawBase64,
                mimeType,
                chunkIndex: chunkCount,
                model: modelName,
                voice: selectedVoice
              })}\n\n`);
              // Flush if compression or proxy middleware is active
              (res as any).flush?.();
            }
          }
        } catch (streamErr: any) {
          console.warn(`[GEMINI TTS STREAM] generateContentStream falhou para ${modelName}:`, streamErr?.message || String(streamErr));
        }

        // If streaming yielded chunks, finalize and end stream
        if (streamSucceeded && chunkCount > 0) {
          cachedFastestModel = modelName;
          res.write(`data: ${JSON.stringify({ done: true, totalChunks: chunkCount, model: modelName })}\n\n`);
          (res as any).flush?.();
          return res.end();
        }

        // If generateContentStream produced 0 chunks or wasn't supported, fallback to generateContent and send as single SSE chunk
        const singleResponse = await aiClient.models.generateContent({
          model: modelName,
          contents: text,
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: selectedVoice
                }
              }
            }
          }
        });

        const singleCandidate = singleResponse.candidates?.[0];
        const singlePart = singleCandidate?.content?.parts?.find((p: any) => p.inlineData?.data);

        if (singlePart?.inlineData?.data) {
          cachedFastestModel = modelName;
          const rawBase64 = singlePart.inlineData.data;
          const mimeType = singlePart.inlineData.mimeType || 'audio/pcm;rate=24000';

          res.write(`data: ${JSON.stringify({
            audio: rawBase64,
            mimeType,
            chunkIndex: 1,
            model: modelName,
            voice: selectedVoice
          })}\n\n`);
          res.write(`data: ${JSON.stringify({ done: true, totalChunks: 1, model: modelName })}\n\n`);
          (res as any).flush?.();
          return res.end();
        }
      } else {
        // Non-streaming standard JSON response
        const response = await aiClient.models.generateContent({
          model: modelName,
          contents: text,
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: selectedVoice
                }
              }
            }
          }
        });

        const candidate = response.candidates?.[0];
        const part = candidate?.content?.parts?.find((p: any) => p.inlineData?.data);

        if (part?.inlineData?.data) {
          cachedFastestModel = modelName;
          const rawBase64 = part.inlineData.data;
          const mimeType = part.inlineData.mimeType || 'audio/pcm;rate=24000';

          let audioBuffer = Buffer.from(rawBase64, 'base64');
          let finalMime = mimeType;

          if (mimeType.includes('pcm') || mimeType.includes('raw')) {
            const rateMatch = mimeType.match(/rate=(\d+)/);
            const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
            audioBuffer = pcmToWav(audioBuffer, sampleRate, 1, 16);
            finalMime = 'audio/wav';
          }

          return res.json({
            audio: audioBuffer.toString('base64'),
            mimeType: finalMime,
            model: modelName,
            voice: selectedVoice
          });
        }
      }
    } catch (err: any) {
      console.warn(`[GEMINI TTS] Falha no modelo ${modelName}:`, err?.message || String(err));
      lastError = err;
    }
  }

  console.error('[GEMINI TTS ERROR] Todos os modelos falharam:', lastError?.message);

  if (wantsStream) {
    res.write(`data: ${JSON.stringify({ error: `Falha na síntese de voz Gemini: ${lastError?.message || 'Nenhum áudio gerado'}` })}\n\n`);
    return res.end();
  }

  return res.status(500).json({
    error: `Falha na síntese de voz Gemini: ${lastError?.message || 'Nenhum áudio gerado'}`
  });
}
