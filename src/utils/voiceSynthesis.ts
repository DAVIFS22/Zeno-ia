import { VoicePersonality } from '../types';

export interface VoicePersonalityConfig {
  id: VoicePersonality;
  pitch: number;
  rateMultiplier: number;
  previewSamples: Record<string, string>;
}

export const VOICE_PERSONALITIES: Record<VoicePersonality, VoicePersonalityConfig> = {
  formal: {
    id: 'formal',
    pitch: 0.92,
    rateMultiplier: 0.95,
    previewSamples: {
      'pt-BR': 'Olá. Sou o assistente ZENO. Como posso auxiliá-lo de forma estruturada e profissional hoje?',
      'en-US': 'Hello. I am the ZENO assistant. How may I assist you in a structured and professional manner today?',
      'es-ES': 'Hola. Soy el asistente ZENO. ¿En qué puedo colaborarle de manera formal y profesional hoy?',
      'fr-FR': 'Bonjour. Je suis l’assistant ZENO. Comment puis-je vous assister de manière structurée et professionnelle aujourd’hui ?',
      'zh-CN': '您好。我是 ZENO 助手。今天我能为您提供怎样的专业协助？'
    }
  },
  friendly: {
    id: 'friendly',
    pitch: 1.06,
    rateMultiplier: 1.02,
    previewSamples: {
      'pt-BR': 'Oi, tudo bem? Que ótimo ter você aqui! Como posso te ajudar agora?',
      'en-US': 'Hi there! Great to talk with you! How can I help you today?',
      'es-ES': '¡Hola! ¡Qué bueno tenerte por aquí! ¿En qué te puedo ayudar hoy?',
      'fr-FR': 'Salut ! C’est super de vous retrouver ! Comment puis-je vous aider aujourd’hui ?',
      'zh-CN': '嗨，你好！很高兴能与您交流，今天想聊些什么呢？'
    }
  },
  enthusiastic: {
    id: 'enthusiastic',
    pitch: 1.22,
    rateMultiplier: 1.15,
    previewSamples: {
      'pt-BR': 'Fala aí! Vamos com tudo resolver suas dúvidas e criar coisas incríveis agora!',
      'en-US': 'Hey! Let’s dive right in and create something amazing together today!',
      'es-ES': '¡Hola! ¡Vamos con toda la energía a crear cosas increíbles ahora mismo!',
      'fr-FR': 'Bonjour ! Donnons le meilleur de nous-mêmes pour créer quelque chose de formidable !',
      'zh-CN': '太棒了！让我们充满干劲地一起创造令人惊叹的成果吧！'
    }
  },
  calm: {
    id: 'calm',
    pitch: 0.88,
    rateMultiplier: 0.86,
    previewSamples: {
      'pt-BR': 'Respire com calma. Vamos analisar cada ponto com tranquilidade e clareza.',
      'en-US': 'Take a deep breath. Let us explore each detail with calm and serenity.',
      'es-ES': 'Respira con calma. Vamos a analizar cada detalle con tranquilidad y claridad.',
      'fr-FR': 'Prenez une profonde respiration. Analysons chaque point avec sérénité et clarté.',
      'zh-CN': '放慢呼吸。让我们静下心来，沉着清晰地分析每一个细节。'
    }
  },
  concise: {
    id: 'concise',
    pitch: 1.0,
    rateMultiplier: 1.25,
    previewSamples: {
      'pt-BR': 'Direto ao ponto: dados carregados, resposta processada com máxima eficiência.',
      'en-US': 'Straight to the point: data loaded, response processed with maximum efficiency.',
      'es-ES': 'Directo al grano: datos cargados, respuesta procesada con máxima eficiencia.',
      'fr-FR': 'Droit au but : données prêtes, réponse traitée avec efficacité maximale.',
      'zh-CN': '直奔主题：数据已加载，高效快速处理完成。'
    }
  }
};

/**
 * Configures a SpeechSynthesisUtterance with language, speed, and personality adjustments.
 */
export function configureUtterance(
  utterance: SpeechSynthesisUtterance,
  options: {
    lang?: string;
    speed?: number;
    personality?: VoicePersonality;
  }
) {
  const lang = options.lang || 'pt-BR';
  const personality = options.personality || 'friendly';
  const baseSpeed = options.speed ?? 1.0;

  const config = VOICE_PERSONALITIES[personality] || VOICE_PERSONALITIES.friendly;

  utterance.lang = lang;
  utterance.pitch = Math.max(0.5, Math.min(2.0, config.pitch));
  utterance.rate = Math.max(0.5, Math.min(2.0, baseSpeed * config.rateMultiplier));

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const voices = window.speechSynthesis.getVoices();
    if (voices && voices.length > 0) {
      const targetLangPrefix = lang.toLowerCase().split('-')[0];
      const matchingVoices = voices.filter(v => v.lang.toLowerCase().replace('_', '-').startsWith(targetLangPrefix));
      
      if (matchingVoices.length > 0) {
        // Preference for higher quality browser voices (Google, Natural, Premium, Neural)
        const preferred = matchingVoices.find(v => {
          const name = v.name.toLowerCase();
          return name.includes('google') || name.includes('natural') || name.includes('premium') || name.includes('online');
        }) || matchingVoices[0];

        if (preferred) {
          utterance.voice = preferred;
        }
      }
    }
  }
}

/**
 * Returns a preview text sample for the given personality and language.
 */
export function getPersonalityPreviewText(personality: VoicePersonality, lang: string = 'pt-BR'): string {
  const config = VOICE_PERSONALITIES[personality] || VOICE_PERSONALITIES.friendly;
  return config.previewSamples[lang] || config.previewSamples['pt-BR'] || 'Olá! Eu sou o ZENO IA.';
}
