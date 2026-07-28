import { YoutubeTranscript } from 'youtube-transcript';
import ytdl from '@distube/ytdl-core';
import yts from 'yt-search';
import fs from 'fs';
import path from 'path';
import os from 'os';

export function extractYoutubeId(url: string): string | null {
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
  const match = url.match(regex);
  return match ? match[1] : null;
}

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0'
];

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

export async function getYoutubeTranscript(url: string): Promise<{ transcript: string; videoId: string }> {
  const videoId = extractYoutubeId(url);
  if (!videoId) throw new Error('Link do YouTube inválido.');

  try {
    // Try to get Portuguese transcript first
    let transcript;
    try {
      transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'pt' });
    } catch (e) {
      // Fallback to any available language
      transcript = await YoutubeTranscript.fetchTranscript(videoId);
    }
    const fullText = transcript.map(t => t.text).join(' ');
    if (!fullText) throw new Error('Transcrição vazia.');
    return { transcript: fullText, videoId };
  } catch (err: any) {
    // console.error('[YOUTUBE TRANSCRIPT ERROR]', err.message);
    if (err.message?.includes('Transcript is disabled')) {
      throw new Error('As legendas estão desativadas para este vídeo.');
    }
    if (err.message?.includes('Too Many Requests') || err.message?.includes('429')) {
      throw new Error('O YouTube bloqueou o acesso às legendas temporariamente (excesso de tráfego).');
    }
    throw new Error('Não foi possível obter as legendas deste vídeo automaticamente.');
  }
}

export async function getYoutubeMetadata(url: string) {
  const videoId = extractYoutubeId(url);
  
  // Try ytdl first
  try {
    const info = await ytdl.getBasicInfo(url, {
      requestOptions: {
        headers: {
          'User-Agent': getRandomUserAgent(),
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        }
      }
    });
    return {
      title: info.videoDetails.title,
      description: info.videoDetails.description,
      thumbnail: info.videoDetails.thumbnails[0]?.url,
      author: info.videoDetails.author.name,
      duration: info.videoDetails.lengthSeconds,
      videoId: info.videoDetails.videoId
    };
  } catch (err: any) {
    // Fallback to yt-search (usually works when ytdl is blocked)
    try {
      if (videoId) {
        const r = await yts({ videoId });
        if (r) {
          return {
            title: r.title,
            description: r.description,
            thumbnail: r.thumbnail,
            author: r.author.name,
            duration: r.seconds,
            videoId: r.videoId
          };
        }
      }
    } catch (fallbackErr: any) {
      console.error('[YOUTUBE METADATA FALLBACK ERROR]', fallbackErr.message);
    }
    
    return {
      title: `Vídeo do YouTube (${videoId || 'URL'})`,
      description: 'Metadados e informações obtidos pelo ZENO AI.',
      thumbnail: videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '',
      author: 'YouTube Creator',
      duration: 0,
      videoId: videoId || 'unknown'
    };
  }
}

export async function downloadYoutubeAudio(url: string): Promise<string> {
  const videoId = extractYoutubeId(url);
  if (!videoId) throw new Error('Link do YouTube inválido.');

  const tempPath = path.join(os.tmpdir(), `yt_audio_${videoId}_${Date.now()}.mp3`);
  
  try {
    const stream = ytdl(url, { 
      filter: 'audioonly', 
      quality: 'lowestaudio',
      requestOptions: {
        headers: {
          'User-Agent': getRandomUserAgent(),
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        }
      }
    });

    return new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(tempPath);
      stream.pipe(writeStream);
      
      stream.on('error', (err: any) => {
        const msg = err.message || '';
        if (msg.includes('Sign in to confirm') || msg.includes('Faça login') || msg.includes('429') || msg.includes('Too Many Requests')) {
          reject(new Error('O YouTube bloqueou o download deste vídeo por segurança (detecção de robô). Tente outro vídeo ou use um com legendas oficiais.'));
        } else {
          reject(err);
        }
      });

      writeStream.on('finish', () => resolve(tempPath));
      writeStream.on('error', (err) => {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        reject(err);
      });
    });
  } catch (err: any) {
    const msg = err.message || '';
    if (msg.includes('Sign in to confirm') || msg.includes('Faça login')) {
      throw new Error('O YouTube bloqueou o acesso a este vídeo (detecção de robô).');
    }
    throw err;
  }
}
