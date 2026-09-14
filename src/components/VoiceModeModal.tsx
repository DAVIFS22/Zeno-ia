import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mic, Square, Volume2, VolumeX, AlertCircle, Sparkles, Terminal, ChevronDown, ChevronUp, Trash2, Play } from 'lucide-react';
import { ZenoLogo } from './ZenoLogo';
import { AudioVisualizerCanvas } from './AudioVisualizerCanvas';
import { Message, UserSettings } from '../types';
import { ContiguousAudioQueue } from '../utils/contiguousAudioQueue';

// =========================================================================
// TEMPORARY VISUAL DEBUG FLAG FOR VOICE MODE
// Alterar para `false` para desativar a caixa de log visual na tela.
// =========================================================================
export const DEBUG_VOICE = true;

type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking';

interface DebugLogItem {
  id: string;
  time: string;
  text: string;
  type: 'info' | 'warn' | 'error' | 'success';
}

interface VoiceModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendMessage: (text: string) => Promise<any> | any;
  isLoading: boolean;
  latestMessage: Message | null;
  theme?: 'dark' | 'light';
  userSettings?: UserSettings;
}

export const VoiceModeModal: React.FC<VoiceModeModalProps> = ({
  isOpen,
  onClose,
  onSendMessage,
  isLoading,
  latestMessage,
  theme,
  userSettings
}) => {
  // Synchronize modal visual appearance with userSettings and global theme
  const isDark = useMemo(() => {
    if (theme === 'dark') return true;
    if (theme === 'light') return false;
    if (userSettings?.theme === 'dark') return true;
    if (userSettings?.theme === 'light') return false;
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  }, [theme, userSettings?.theme]);

  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [displayedTranscript, setDisplayedTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [voiceName, setVoiceName] = useState<string>('');
  const [availablePtVoices, setAvailablePtVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [geminiVoice, setGeminiVoice] = useState<string>('Aoede');
  const [outputAnalyserNode, setOutputAnalyserNode] = useState<AnalyserNode | null>(null);
  
  // Real-time Event Debug Log State
  const [debugLogs, setDebugLogs] = useState<DebugLogItem[]>([]);
  const [isDebugExpanded, setIsDebugExpanded] = useState<boolean>(true);
  const debugLogsEndRef = useRef<HTMLDivElement | null>(null);

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(typeof window !== 'undefined' ? window.speechSynthesis : null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const currentAudioElementRef = useRef<HTMLAudioElement | null>(null);
  const ttsAbortControllerRef = useRef<AbortController | null>(null);
  const lastSpokenMessageIdRef = useRef<string | null>(null);
  const lastSpokenTextRef = useRef<string>('');
  const latestTranscriptRef = useRef<string>('');
  const silenceTimerRef = useRef<any>(null);
  const restartTimeoutRef = useRef<any>(null);
  const availableVoicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const selectedVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const finalTranscriptRef = useRef('');
  const isSpeechRecognitionActiveRef = useRef<boolean>(false);
  const isStartingRef = useRef<boolean>(false);


  // Natural Speech Chaining & Pause Engine Refs
  const phraseQueueRef = useRef<string[]>([]);
  const currentPhraseIndexRef = useRef<number>(0);
  const speechTimeoutRef = useRef<any>(null);
  const isSpeakingCancelledRef = useRef<boolean>(false);

  // Web Audio API Chunked Streaming & Queue Refs
  const activeSourceNodesRef = useRef<AudioBufferSourceNode[]>([]);
  const nextStartTimeRef = useRef<number>(0);
  const streamEndTimeoutRef = useRef<any>(null);
  const activeTtsAbortControllersRef = useRef<AbortController[]>([]);
  const audioQueueRef = useRef<ContiguousAudioQueue | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const voiceStateRef = useRef<VoiceState>(voiceState);
  const isOpenRef = useRef<boolean>(isOpen);
  const onSendMessageRef = useRef(onSendMessage);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    onSendMessageRef.current = onSendMessage;
  }, [onSendMessage]);

  const updateVoiceState = useCallback((newState: VoiceState) => {
    voiceStateRef.current = newState;
    setVoiceState(newState);
  }, []);

  // Real-time visual logger with timestamp
  const addDebugLog = useCallback((text: string, type: 'info' | 'warn' | 'error' | 'success' = 'info') => {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
    
    console.log(`[VoiceDebug ${timeStr}] [${type.toUpperCase()}] ${text}`);
    
    if (DEBUG_VOICE) {
      setDebugLogs(prev => {
        const next = [...prev, { id: `${Date.now()}-${Math.random()}`, time: timeStr, text, type }];
        return next.slice(-60); // Keep last 60 entries
      });
    }
  }, []);

  const resetTranscript = useCallback(() => {
    finalTranscriptRef.current = '';
    setFinalTranscript('');
    setInterimTranscript('');
    setDisplayedTranscript('');
  }, []);


  // Helper: Convert Float32Array PCM to Base64
  const pcmToBase64 = (pcmData: Float32Array) => {
    const buffer = new ArrayBuffer(pcmData.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < pcmData.length; i++) {
      const s = Math.max(-1, Math.min(1, pcmData[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
  };

  // Helper: Playback audio chunk
  const playAudioChunk = (ctx: AudioContext, base64: string) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    
    // Simplistic playback: assume PCM 16kHz
    const audioBuffer = ctx.createBuffer(1, bytes.length / 2, 16000);
    const channelData = audioBuffer.getChannelData(0);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < bytes.length / 2; i++) {
        channelData[i] = view.getInt16(i * 2, true) / 32768;
    }
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    source.start();
  };

  const startLiveApiConnection = useCallback(async () => {
    try {
        addDebugLog('Conectando ao Gemini Live...', 'info');
        const ws = new WebSocket(`wss://${window.location.host}/api/live`);
        wsRef.current = ws;

        ws.onopen = () => {
            addDebugLog('Conexão Gemini Live estabelecida.', 'success');
            updateVoiceState('listening');
        };

        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.audio) {
                if (!outputAudioCtxRef.current) {
                    outputAudioCtxRef.current = new AudioContext({ sampleRate: 16000 });
                }
                playAudioChunk(outputAudioCtxRef.current, msg.audio);
                updateVoiceState('speaking');
            }
        };

        ws.onclose = () => {
            addDebugLog('Conexão Gemini Live fechada.', 'warn');
        };

        // Mic capture
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!inputAudioCtxRef.current) {
             inputAudioCtxRef.current = new AudioContext({ sampleRate: 16000 });
        }
        const source = inputAudioCtxRef.current.createMediaStreamSource(stream);
        const processor = inputAudioCtxRef.current.createScriptProcessor(4096, 1, 1);
        source.connect(processor);
        processor.connect(inputAudioCtxRef.current.destination);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                const base64 = pcmToBase64(e.inputBuffer.getChannelData(0));
                wsRef.current.send(JSON.stringify({ audio: base64 }));
            }
        };

    } catch (err: any) {
        addDebugLog(`Erro Gemini Live: ${err.message}`, 'error');
    }
  }, [addDebugLog, updateVoiceState]);

  const SILENCE_TIMEOUT_MS = 850; // 0.85s silence after speech auto-triggers AI response

  // Safe SpeechRecognition instance creator & lifecycle binder
  const createRecognitionInstance = useCallback(() => {
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      setError('Seu navegador não suporta reconhecimento de voz Web Speech API.');
      addDebugLog('Navegador não suporta SpeechRecognition API.', 'error');
      return null;
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onstart = null;
          recognitionRef.current.onresult = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.onend = null;
          recognitionRef.current.abort();
        } catch (e) {}
      }

      const recognition = new SpeechRecognitionClass();
      recognition.lang = userSettings?.speechLanguage || 'pt-BR';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        isSpeechRecognitionActiveRef.current = true;
        isStartingRef.current = false;
        addDebugLog('Reconhecimento iniciado', 'success');
      };

      recognition.onresult = (event: any) => {
        addDebugLog(`onresult disparado, resultados: ${event?.results?.length || 0}`, 'info');
        let interimTranscriptChunk = '';
        let finalTranscriptChunk = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptPiece = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscriptChunk += transcriptPiece + ' ';
          } else {
            interimTranscriptChunk += transcriptPiece;
          }
        }

        // Se detectamos um final novo, atualizamos o acumulado e limpamos o interino.
        if (finalTranscriptChunk) {
          finalTranscriptRef.current += finalTranscriptChunk;
          setFinalTranscript(finalTranscriptRef.current);
          setInterimTranscript('');
          setDisplayedTranscript(finalTranscriptRef.current);
        } else if (interimTranscriptChunk) {
          setInterimTranscript(interimTranscriptChunk);
          setDisplayedTranscript(finalTranscriptRef.current + interimTranscriptChunk);
        }

        addDebugLog(`Interino: "${interimTranscriptChunk}" | Final: "${finalTranscriptRef.current}"`, 'info');
        
        if (interimTranscriptChunk.trim()) {
           latestTranscriptRef.current = finalTranscriptRef.current + interimTranscriptChunk;
        } else {
           latestTranscriptRef.current = finalTranscriptRef.current;
        }

        // Lógica de silêncio
        if (interimTranscriptChunk.trim() || finalTranscriptChunk.trim()) {
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }

          silenceTimerRef.current = setTimeout(() => {
            if (voiceStateRef.current === 'listening' && isOpenRef.current) {
              addDebugLog('Silêncio detectado (0.85s), enviando...', 'info');
              submitSpeechToAIRef.current();
            }
          }, SILENCE_TIMEOUT_MS);
        }
      };

      recognition.onerror = (event: any) => {
        isSpeechRecognitionActiveRef.current = false;
        isStartingRef.current = false;
        addDebugLog(`Reconhecimento erro: ${event.error}`, event.error === 'no-speech' ? 'info' : 'warn');

        if (event.error === 'not-allowed') {
          setError('Permissão de microfone negada. Autorize no navegador.');
          updateVoiceState('idle');
        } else if (event.error === 'network') {
          if (isOpenRef.current && voiceStateRef.current === 'listening') {
            startRecognitionSafe(1000);
          }
        }
      };

      recognition.onend = () => {
        isSpeechRecognitionActiveRef.current = false;
        isStartingRef.current = false;
        addDebugLog('Reconhecimento finalizado pelo navegador.', 'info');

        if (isOpenRef.current && voiceStateRef.current === 'listening') {
          startRecognitionSafe(250);
        }
      };

      recognitionRef.current = recognition;
      return recognition;
    } catch (e: any) {
      addDebugLog(`Erro ao criar instância do SpeechRecognition: ${e?.message || String(e)}`, 'error');
      return null;
    }
  }, [addDebugLog, updateVoiceState]);

  // Safe recognition start/stop helpers to avoid browser audio collisions
  const startRecognitionSafe = useCallback((delayMs = 0) => {
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }

    if (!isOpenRef.current) {
      addDebugLog('Ignorando início: Modo de Voz fechado.', 'info');
      return;
    }

    if (voiceStateRef.current !== 'listening') {
      addDebugLog(`Ignorando início: Estado é "${voiceStateRef.current}" (esperado: listening).`, 'info');
      return;
    }

    if (delayMs > 0) {
      restartTimeoutRef.current = setTimeout(() => {
        startRecognitionSafe(0);
      }, delayMs);
      return;
    }

    if (isSpeechRecognitionActiveRef.current) {
      addDebugLog('Reconhecimento já estava ativo.', 'info');
      return;
    }

    let rec = recognitionRef.current;
    if (!rec) {
      rec = createRecognitionInstance();
    }

    if (!rec) {
      addDebugLog('Erro: Instância do SpeechRecognition indisponível.', 'error');
      return;
    }

    try {
      addDebugLog('Tentando iniciar reconhecimento...', 'info');
      isStartingRef.current = true;
      rec.start();
    } catch (err: any) {
      isStartingRef.current = false;
      const msg = err?.message || String(err);
      if (msg.includes('already started') || msg.includes('has already started')) {
        isSpeechRecognitionActiveRef.current = true;
        addDebugLog('Reconhecimento já estava ativo.', 'info');
      } else {
        addDebugLog(`Erro ao iniciar reconhecimento: ${msg}`, 'error');
        console.warn('[VoiceMode] startRecognitionSafe caught:', err);
        // Reset instance so next try recreates a fresh one
        recognitionRef.current = null;
      }
    }
  }, [addDebugLog, createRecognitionInstance]);

  const stopRecognitionSafe = useCallback(() => {
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    isStartingRef.current = false;
    isSpeechRecognitionActiveRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
  }, []);

  // Auto-scroll debug logs
  useEffect(() => {
    if (DEBUG_VOICE && isDebugExpanded && debugLogsEndRef.current) {
      debugLogsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [debugLogs, isDebugExpanded]);

  // =========================================================================
  // NATURAL SPEECH REFINEMENTS (PT-BR)
  // =========================================================================

  // Comprehensive Markdown Sanitizer and Portuguese Text Normalizer for Natural Speech
  const cleanAndNormalizeTextForSpeech = (text: string): string => {
    if (!text) return '';

    return text
      // 1. Remove thinking tags and internal content
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      // 2. Replace code blocks with spoken placeholder
      .replace(/```[\s\S]*?```/g, ' Bloco de código omitido. ')
      // 3. Replace inline code `...` with text
      .replace(/`([^`]+)`/g, '$1')
      // 4. Markdown links & images: ![alt](url) -> '' and [text](url) -> text
      .replace(/!\[[^\]]*\]\([^\)]*\)/g, '')
      .replace(/\[([^\]]+)\]\([^\)]*\)/g, '$1')
      // 5. Remove raw URLs
      .replace(/https?:\/\/\S+/g, '')
      // 6. Markdown headings, blockquotes, list markers
      .replace(/^\s*#{1,6}\s+/gm, '')
      .replace(/^\s*[\*\-\+]\s+/gm, '')
      .replace(/^\s*\d+\.\s+/gm, '')
      .replace(/^\s*>\s+/gm, '')
      // 7. Bold, italics and strikethrough markdown markers
      .replace(/(\*\*|__)(.*?)\1/g, '$2')
      .replace(/(\*|_|~~)(.*?)\1/g, '$2')
      // 8. Markdown tables
      .replace(/\|/g, ' ')
      .replace(/^\s*[-:_]{3,}\s*$/gm, '')
      // 9. Portuguese Numbers & Abbreviations Normalization
      .replace(/R\$\s*(\d+(?:[.,]\d+)?)/g, '$1 reais')
      .replace(/(\d+)\s*%/g, '$1 por cento')
      .replace(/°C\b/g, ' graus Celsius')
      .replace(/°F\b/g, ' graus Fahrenheit')
      .replace(/\bDr\.\s*/g, 'Doutor ')
      .replace(/\bDra\.\s*/g, 'Doutora ')
      .replace(/\bSr\.\s*/g, 'Senhor ')
      .replace(/\bSra\.\s*/g, 'Senhora ')
      .replace(/\bProf\.\s*/g, 'Professor ')
      .replace(/\bProfa\.\s*/g, 'Professora ')
      .replace(/\bEx\.\s*/gi, 'Exemplo ')
      .replace(/\betc\.\s*/gi, 'etcétera ')
      .replace(/\bvs\.\s*/gi, 'versus ')
      .replace(/\bpág\.\s*/gi, 'página ')
      .replace(/\bkm\/h\b/gi, 'quilômetros por hora')
      .replace(/\bkm\b/gi, 'quilômetros')
      .replace(/\bkg\b/gi, 'quilos')
      .replace(/\bvc\b/gi, 'você')
      .replace(/\btbm\b/gi, 'também')
      .replace(/\bpq\b/gi, 'porque')
      // 10. Strip remaining stray symbols that could be pronounced literally
      .replace(/[*_#~>\[\]\(\)\{\}\\\^@=]/g, ' ')
      // 11. Normalize punctuation spacing and consecutive whitespace
      .replace(/\s+([.,!?;:])/g, '$1')
      .replace(/([.,!?;:])\1+/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Splits text into natural breathing phrases separated by punctuation boundaries
  const splitIntoNaturalPhrases = (text: string): string[] => {
    if (!text) return [];

    // Match sentences ending with . ! ? ; : or newline
    const rawSentences = text.split(/(?<=[.!?;\n:])\s+/);
    const phrases: string[] = [];

    for (const sentence of rawSentences) {
      const trimmed = sentence.trim();
      if (!trimmed) continue;

      // If a sentence is long (>120 chars) and contains commas, split at comma boundaries for natural cadence
      if (trimmed.length > 120 && trimmed.includes(',')) {
        const parts = trimmed.split(/(?<=,)\s+/);
        for (const part of parts) {
          const pt = part.trim();
          if (pt) phrases.push(pt);
        }
      } else {
        phrases.push(trimmed);
      }
    }

    return phrases;
  };

  // Voice priority matching for natural, fluent Brazilian Portuguese
  const getBestPtVoice = (voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null => {
    if (!voices || voices.length === 0) return null;

    // 1. Natural Google voices for Portuguese (e.g. "Google português do Brasil")
    const googlePt = voices.find(v => 
      (v.lang.replace('_', '-').toLowerCase().startsWith('pt')) && 
      (v.name.toLowerCase().includes('google'))
    );
    if (googlePt) return googlePt;

    // 2. Microsoft / Natural voices (e.g. "Microsoft Francisca Online (Natural)")
    const msPt = voices.find(v => 
      (v.lang.replace('_', '-').toLowerCase().startsWith('pt')) && 
      (v.name.toLowerCase().includes('microsoft') || v.name.toLowerCase().includes('natural'))
    );
    if (msPt) return msPt;

    // 3. Samsung or device native pt-BR voices
    const samsungPt = voices.find(v => 
      (v.lang.replace('_', '-').toLowerCase() === 'pt-br') && 
      (v.name.toLowerCase().includes('samsung'))
    );
    if (samsungPt) return samsungPt;

    // 4. Any other pt-BR voice
    const standardPtBr = voices.find(v => v.lang.replace('_', '-').toLowerCase() === 'pt-br');
    if (standardPtBr) return standardPtBr;

    // 5. Any Portuguese voice
    const anyPt = voices.find(v => v.lang.toLowerCase().startsWith('pt'));
    if (anyPt) return anyPt;

    return null;
  };

  // Load and cache voices, logging full pt-BR diagnostic list
  const loadVoices = useCallback(() => {
    if (!synthRef.current) return;
    try {
      const voices = synthRef.current.getVoices();
      if (voices && voices.length > 0) {
        availableVoicesRef.current = voices;

        // Filter all Portuguese voices available on the device
        const ptVoices = voices.filter(v => 
          v.lang.toLowerCase().startsWith('pt') || 
          v.lang.replace('_', '-').toLowerCase().includes('pt')
        );
        setAvailablePtVoices(ptVoices);

        if (ptVoices.length > 0) {
          addDebugLog(`Vozes PT detectadas no dispositivo (${ptVoices.length}):`, 'info');
          ptVoices.forEach((v, index) => {
            const isGoogle = v.name.toLowerCase().includes('google') ? ' [Google]' : '';
            const isMs = (v.name.toLowerCase().includes('microsoft') || v.name.toLowerCase().includes('natural')) ? ' [Microsoft]' : '';
            const isSamsung = v.name.toLowerCase().includes('samsung') ? ' [Samsung]' : '';
            const isDefault = v.default ? ' [Padrão]' : '';
            addDebugLog(`  #${index + 1}: ${v.name} (${v.lang})${isGoogle}${isMs}${isSamsung}${isDefault}`, 'info');
          });
        } else {
          addDebugLog('Nenhuma voz específica com tag PT-BR encontrada no navegador.', 'warn');
        }

        if (!selectedVoiceRef.current) {
          const best = getBestPtVoice(voices);
          if (best) {
            selectedVoiceRef.current = best;
            setVoiceName(best.name);
            addDebugLog(`Voz ativa selecionada: ${best.name}`, 'success');
          }
        }
      }
    } catch (e: any) {
      addDebugLog(`[VoiceMode] Falha ao carregar vozes: ${e?.message || String(e)}`, 'warn');
    }
  }, [addDebugLog]);

  // Splits text into pipelined segments: Sentence 1 (ultra-fast first bytes) + rest
  const splitIntoPipelinedSegments = (text: string): string[] => {
    if (!text) return [];
    const phrases = splitIntoNaturalPhrases(text);
    if (phrases.length <= 1) return [text];

    const segments: string[] = [];
    // Segment 1: first phrase (or first 2 if extremely short)
    let firstSeg = phrases[0];
    let startIndex = 1;
    if (firstSeg.length < 35 && phrases.length > 1) {
      firstSeg += ' ' + phrases[1];
      startIndex = 2;
    }
    segments.push(firstSeg);

    // Remaining segments grouped into natural chunks
    let currentGroup = '';
    for (let i = startIndex; i < phrases.length; i++) {
      const p = phrases[i];
      if (!currentGroup) {
        currentGroup = p;
      } else if (currentGroup.length + p.length < 180) {
        currentGroup += ' ' + p;
      } else {
        segments.push(currentGroup);
        currentGroup = p;
      }
    }
    if (currentGroup) {
      segments.push(currentGroup);
    }

    return segments;
  };

  // Browser Autoplay / Audio Context Unlock on User Interaction & Pre-warming
  const unlockAudioSpeech = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        if (!outputAudioCtxRef.current || outputAudioCtxRef.current.state === 'closed') {
          outputAudioCtxRef.current = new AudioCtx({ sampleRate: 24000 });
        }
        if (outputAudioCtxRef.current && outputAudioCtxRef.current.state === 'suspended') {
          outputAudioCtxRef.current.resume().catch(() => {});
        }
      }
      if (synthRef.current) {
        if (synthRef.current.paused) {
          synthRef.current.resume();
        }
      }
    } catch (e) {
      console.warn('[VoiceMode] Audio unlock warning:', e);
    }
  }, []);

  // Initialize voice list and event listeners on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const initVoices = () => {
        loadVoices();
      };
      
      initVoices();
      window.speechSynthesis.onvoiceschanged = initVoices;
      
      return () => {
        window.speechSynthesis.onvoiceschanged = null;
      };
    }
  }, [loadVoices]);

  // Available Gemini TTS Voices
  const GEMINI_TTS_VOICES = [
    { id: 'Aoede', name: 'Aoede (Feminina - Calorosa & Fluida)', desc: 'Padrão' },
    { id: 'Kore', name: 'Kore (Feminina - Suave & Serena)', desc: 'Suave' },
    { id: 'Puck', name: 'Puck (Masculina - Natural & Amigável)', desc: 'Natural' },
    { id: 'Charon', name: 'Charon (Masculina - Profunda & Calma)', desc: 'Profunda' },
    { id: 'Fenrir', name: 'Fenrir (Masculina - Enérgica & Dinâmica)', desc: 'Enérgica' },
    { id: 'Zephyr', name: 'Zephyr (Neutra - Clara & Equilibrada)', desc: 'Equilibrada' },
  ];

  // Internal cancellation helper for speech queues and audio playback
  const cancelSpeakingInternal = useCallback(() => {
    isSpeakingCancelledRef.current = true;
    if (ttsAbortControllerRef.current) {
      try {
        ttsAbortControllerRef.current.abort();
      } catch (e) {}
      ttsAbortControllerRef.current = null;
    }
    activeTtsAbortControllersRef.current.forEach(ctrl => {
      try { ctrl.abort(); } catch (e) {}
    });
    activeTtsAbortControllersRef.current = [];

    if (audioQueueRef.current) {
      audioQueueRef.current.cancel();
      audioQueueRef.current = null;
    }

    if (streamEndTimeoutRef.current) {
      clearTimeout(streamEndTimeoutRef.current);
      streamEndTimeoutRef.current = null;
    }
    activeSourceNodesRef.current.forEach((node) => {
      try {
        node.stop();
        node.disconnect();
      } catch (e) {}
    });
    activeSourceNodesRef.current = [];
    nextStartTimeRef.current = 0;

    if (currentAudioElementRef.current) {
      try {
        currentAudioElementRef.current.pause();
        currentAudioElementRef.current.currentTime = 0;
        currentAudioElementRef.current.src = '';
      } catch (e) {}
      currentAudioElementRef.current = null;
    }
    if (speechTimeoutRef.current) {
      clearTimeout(speechTimeoutRef.current);
      speechTimeoutRef.current = null;
    }
    if (synthRef.current) {
      try {
        if (synthRef.current.speaking || synthRef.current.pending) {
          synthRef.current.cancel();
        }
      } catch (e) {}
    }
    phraseQueueRef.current = [];
    currentPhraseIndexRef.current = 0;
    (window as any).__zeno_active_utterance = null;
    utteranceRef.current = null;
  }, []);

  // Web Audio API Chunked PCM Stream Player via Contiguous Queue
  const playPcmChunk = useCallback((base64Data: string, mimeType?: string) => {
    if (isSpeakingCancelledRef.current || !isOpenRef.current) return;

    try {
      if (audioQueueRef.current) {
        audioQueueRef.current.enqueuePcmChunk(base64Data, mimeType);
        return;
      }

      if (!outputAudioCtxRef.current || outputAudioCtxRef.current.state === 'closed') {
        outputAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate: 24000
        });
      }

      const ctx = outputAudioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const rateMatch = mimeType?.match(/rate=(\d+)/);
      const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;

      const binaryString = window.atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const numSamples = Math.floor(bytes.length / 2);
      if (numSamples === 0) return;

      const int16Array = new Int16Array(bytes.buffer, bytes.byteOffset, numSamples);
      const float32Array = new Float32Array(numSamples);
      for (let i = 0; i < numSamples; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }

      const audioBuffer = ctx.createBuffer(1, numSamples, sampleRate);
      audioBuffer.getChannelData(0).set(float32Array);

      const sourceNode = ctx.createBufferSource();
      sourceNode.buffer = audioBuffer;
      sourceNode.connect(ctx.destination);

      const now = ctx.currentTime;
      const startTime = Math.max(now, nextStartTimeRef.current);
      sourceNode.start(startTime);
      nextStartTimeRef.current = startTime + audioBuffer.duration;

      activeSourceNodesRef.current.push(sourceNode);

      sourceNode.onended = () => {
        const idx = activeSourceNodesRef.current.indexOf(sourceNode);
        if (idx !== -1) {
          activeSourceNodesRef.current.splice(idx, 1);
        }
        try { sourceNode.disconnect(); } catch (e) {}
      };
    } catch (err: any) {
      console.error('[PLAY PCM CHUNK ERROR]', err);
    }
  }, []);

  // Chained phrase speaker with natural cadence and 180ms pause between phrases (FALLBACK NATIVO)
  const speakNextPhrase = useCallback(() => {
    if (!isOpenRef.current || isSpeakingCancelledRef.current || !synthRef.current) return;

    const queue = phraseQueueRef.current;
    const idx = currentPhraseIndexRef.current;

    if (idx >= queue.length) {
      // Finished speaking all phrases!
      addDebugLog('Síntese nativa concluída (todas as frases finalizadas).', 'success');
      (window as any).__zeno_active_utterance = null;
      utteranceRef.current = null;

      if (isOpenRef.current && voiceStateRef.current === 'speaking') {
        updateVoiceState('listening');
        latestTranscriptRef.current = '';
        resetTranscript();
        startRecognitionSafe(250);
      }
      return;
    }

    const currentPhrase = queue[idx];
    const utterance = new SpeechSynthesisUtterance(currentPhrase);
    utterance.rate = 1.02; // Natural pacing
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    if (selectedVoiceRef.current) {
      utterance.voice = selectedVoiceRef.current;
      utterance.lang = selectedVoiceRef.current.lang || 'pt-BR';
    } else {
      utterance.lang = 'pt-BR';
    }

    (window as any).__zeno_active_utterance = utterance;
    utteranceRef.current = utterance;

    utterance.onstart = () => {
      if (isOpenRef.current) {
        updateVoiceState('speaking');
      }
    };

    utterance.onend = () => {
      (window as any).__zeno_active_utterance = null;
      utteranceRef.current = null;

      if (isSpeakingCancelledRef.current || !isOpenRef.current) return;

      currentPhraseIndexRef.current++;
      
      // Natural breath pause between sentences (180ms)
      if (currentPhraseIndexRef.current < queue.length) {
        speechTimeoutRef.current = setTimeout(() => {
          speakNextPhrase();
        }, 180);
      } else {
        speakNextPhrase();
      }
    };

    utterance.onerror = (e) => {
      addDebugLog(`Aviso na síntese nativa frase ${idx + 1}/${queue.length}: ${e.error || 'ignorado'}`, 'warn');
      (window as any).__zeno_active_utterance = null;
      utteranceRef.current = null;

      if (isSpeakingCancelledRef.current || !isOpenRef.current) return;

      currentPhraseIndexRef.current++;
      if (currentPhraseIndexRef.current < queue.length) {
        speechTimeoutRef.current = setTimeout(() => {
          speakNextPhrase();
        }, 120);
      } else {
        if (isOpenRef.current) {
          updateVoiceState('listening');
          latestTranscriptRef.current = '';
          resetTranscript();
          startRecognitionSafe(250);
        }
      }
    };

    try {
      synthRef.current.speak(utterance);
      if (synthRef.current.paused) {
        synthRef.current.resume();
      }
    } catch (err: any) {
      addDebugLog(`Erro ao falar frase nativa: ${err?.message || String(err)}`, 'error');
      updateVoiceState('listening');
      startRecognitionSafe(250);
    }
  }, [addDebugLog, resetTranscript, startRecognitionSafe, updateVoiceState]);

  // Fallback speaker using browser SpeechSynthesis
  const speakNativeFallback = useCallback((cleanText: string) => {
    if (!synthRef.current || !isOpenRef.current) {
      addDebugLog('SpeechSynthesis não disponível para fallback. Retornando ao modo de escuta.', 'warn');
      updateVoiceState('listening');
      startRecognitionSafe(250);
      return;
    }

    const phrases = splitIntoNaturalPhrases(cleanText);
    if (phrases.length === 0) {
      updateVoiceState('listening');
      startRecognitionSafe(250);
      return;
    }

    phraseQueueRef.current = phrases;
    currentPhraseIndexRef.current = 0;

    updateVoiceState('speaking');
    addDebugLog(`Iniciando fallback de voz nativa (${phrases.length} frase(s))`, 'info');
    speakNextPhrase();
  }, [addDebugLog, speakNextPhrase, startRecognitionSafe, updateVoiceState]);

  // Helper to stream a single text segment over SSE and queue its PCM audio
  const streamSingleSegment = useCallback(async (
    segmentText: string,
    segmentIdx: number,
    totalSegments: number,
    signal: AbortSignal,
    onFirstChunk?: (latency: number) => void
  ): Promise<number> => {
    const startTime = Date.now();
    const res = await fetch('/api/voice/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify({
        text: segmentText,
        voice: geminiVoice,
        stream: true
      }),
      signal
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }

    const reader = res.body?.getReader();
    if (!reader) {
      throw new Error('ReadableStream não suportado pelo navegador.');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let chunkCount = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      if (isSpeakingCancelledRef.current || !isOpenRef.current) {
        reader.cancel();
        return chunkCount;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const jsonStr = trimmed.slice(5).trim();
        if (!jsonStr) continue;

        try {
          const data = JSON.parse(jsonStr);
          if (data.error) {
            throw new Error(data.error);
          }

          if (data.audio) {
            chunkCount++;
            if (chunkCount === 1 && onFirstChunk) {
              const latency = Date.now() - startTime;
              onFirstChunk(latency);
            }
            playPcmChunk(data.audio, data.mimeType);
          }
        } catch (jsonErr: any) {
          if (jsonErr.message && !jsonErr.message.includes('Unexpected')) {
            throw jsonErr;
          }
        }
      }
    }

    return chunkCount;
  }, [geminiVoice, playPcmChunk]);

  // Primary Speaker: Gemini Native TTS with Pipelined First-Bytes Streaming & Auto-Fallback
  const speakText = useCallback(async (text: string) => {
    if (!isOpenRef.current) {
      addDebugLog('Modal fechado ao tentar falar.', 'warn');
      return;
    }

    cancelSpeakingInternal();
    isSpeakingCancelledRef.current = false;

    // Warm-up Audio Context immediately
    unlockAudioSpeech();

    const cleanText = cleanAndNormalizeTextForSpeech(text);

    if (!cleanText) {
      addDebugLog('Texto limpo está vazio. Retornando ao modo de escuta.', 'info');
      updateVoiceState('listening');
      startRecognitionSafe(250);
      return;
    }

    updateVoiceState('speaking');
    const segments = splitIntoPipelinedSegments(cleanText);
    addDebugLog(`Iniciando streaming TTS do Gemini (Voz: ${geminiVoice}, ${segments.length} segmento(s))...`, 'info');

    // Create and initialize contiguous audio queue
    const audioQueue = new ContiguousAudioQueue({
      sampleRate: 24000,
      initialBufferDelaySec: 0.03, // 30ms lookahead jitter buffer to prevent gaps
      crossfadeSec: 0.015,          // 15ms crossfade between chunks to eliminate audible clicks
      onPlaybackStarted: () => {
        if (isOpenRef.current) {
          updateVoiceState('speaking');
        }
      },
      onPlaybackEnded: () => {
        addDebugLog('Reprodução de áudio contígua concluída com sucesso.', 'success');
        if (isOpenRef.current && voiceStateRef.current === 'speaking' && !isSpeakingCancelledRef.current) {
          updateVoiceState('listening');
          latestTranscriptRef.current = '';
          resetTranscript();
          startRecognitionSafe(250);
        }
      },
      onError: (err) => {
        addDebugLog(`Aviso na fila de áudio contígua: ${err.message}`, 'warn');
      }
    });
    audioQueue.initContext(outputAudioCtxRef.current);
    audioQueueRef.current = audioQueue;
    setOutputAnalyserNode(audioQueue.getAnalyserNode());

    const masterAbort = new AbortController();
    ttsAbortControllerRef.current = masterAbort;
    activeTtsAbortControllersRef.current = [masterAbort];

    try {
      if (segments.length === 1) {
        // Single segment streaming
        const chunkCount = await streamSingleSegment(
          segments[0],
          0,
          1,
          masterAbort.signal,
          (latency) => {
            addDebugLog(`Streaming Gemini TTS iniciado: 1º chunk recebido em ${latency}ms! Reproduzindo instantaneamente...`, 'success');
            if (isOpenRef.current) {
              updateVoiceState('speaking');
            }
          }
        );

        if (chunkCount === 0) {
          throw new Error('Nenhum fragmento de áudio retornado pelo streaming Gemini');
        }
      } else {
        // Pipelined Multi-segment strategy for ultra-fast first-bytes delivery
        let totalChunks = 0;

        // 1. Launch Segment 1 immediately
        const seg1Promise = streamSingleSegment(
          segments[0],
          0,
          segments.length,
          masterAbort.signal,
          (latency) => {
            addDebugLog(`Primeira frase do Gemini TTS iniciada em ${latency}ms! Áudio tocando...`, 'success');
            if (isOpenRef.current) {
              updateVoiceState('speaking');
            }
          }
        );

        // 2. Concurrently pipeline subsequent segments with slight delay or immediate chain
        const subsequentPromises = segments.slice(1).map((seg, idx) => {
          return streamSingleSegment(
            seg,
            idx + 1,
            segments.length,
            masterAbort.signal
          );
        });

        const allResults = await Promise.all([seg1Promise, ...subsequentPromises]);
        totalChunks = allResults.reduce((acc, count) => acc + count, 0);

        if (totalChunks === 0) {
          throw new Error('Nenhum fragmento de áudio recebido nos segmentos pipelined');
        }

        addDebugLog(`Todos os ${segments.length} segmentos de voz sintetizados e enfileirados (${totalChunks} chunks totais).`, 'info');
      }

      // Signal stream completion to contiguous queue to trigger onPlaybackEnded when finished
      audioQueue.endStream();

    } catch (err: any) {
      if (err.name === 'AbortError' || isSpeakingCancelledRef.current) {
        return;
      }
      addDebugLog(`Aviso no streaming Gemini TTS (${err?.message || String(err)}). Ativando fallback nativo...`, 'warn');
      if (isOpenRef.current && !isSpeakingCancelledRef.current) {
        speakNativeFallback(cleanText);
      }
    }
  }, [geminiVoice, addDebugLog, cancelSpeakingInternal, resetTranscript, speakNativeFallback, startRecognitionSafe, streamSingleSegment, unlockAudioSpeech, updateVoiceState]);

  // Test selected voice sample
  const handleTestVoice = (voiceToTest?: string) => {
    const v = voiceToTest || geminiVoice;
    addDebugLog(`Iniciando teste da voz Gemini: ${v}`, 'info');
    speakText(`Olá! Esta é uma demonstração da voz ${v} do TTS nativo do Gemini.`);
  };

  // Dispatch speech to AI and transition state
  const submitSpeechToAI = useCallback(async (overrideText?: string) => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    const textToSend = (overrideText ?? latestTranscriptRef.current).trim();
    if (!textToSend || !isOpenRef.current) return;
    if (voiceStateRef.current !== 'listening' && voiceStateRef.current !== 'idle') return;

    addDebugLog(`Silêncio detectado, enviando...`, 'info');
    latestTranscriptRef.current = '';
    resetTranscript();
    updateVoiceState('processing');

    stopRecognitionSafe();

    try {
      const directResponse = await onSendMessageRef.current(textToSend);
      if (directResponse && typeof directResponse === 'string' && directResponse.trim().length > 0 && isOpenRef.current) {
        const cleanResp = directResponse.trim();
        const preview = cleanResp.length > 50 ? cleanResp.slice(0, 50) + '...' : cleanResp;
        addDebugLog(`Resposta da IA recebida: "${preview}"`, 'success');
        
        lastSpokenMessageIdRef.current = 'direct-' + Date.now();
        lastSpokenTextRef.current = cleanResp;

        if (!isMuted) {
          speakText(directResponse);
        } else {
          updateVoiceState('listening');
          startRecognitionSafe(250);
        }
      }
    } catch (submitErr: any) {
      addDebugLog(`Erro no envio para a IA: ${submitErr?.message || String(submitErr)}`, 'error');
      updateVoiceState('listening');
      startRecognitionSafe(250);
    }
  }, [isMuted, speakText, addDebugLog, stopRecognitionSafe, startRecognitionSafe, updateVoiceState]);

  const submitSpeechToAIRef = useRef(submitSpeechToAI);
  useEffect(() => {
    submitSpeechToAIRef.current = submitSpeechToAI;
  }, [submitSpeechToAI]);

  // Sync dynamic debug logs on active audio visualizer source switching
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (voiceState === 'listening') {
      addDebugLog('Visualizador em modo simulado (ouvindo).', 'info');
    } else if (voiceState === 'speaking') {
      addDebugLog('Visualizador conectado à saída IA.', 'info');
    }
  }, [voiceState, isOpen, addDebugLog]);

  // Handle modal Open / Close lifecycle
  useEffect(() => {
    if (!isOpen) {
      isOpenRef.current = false;
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      latestTranscriptRef.current = '';
      resetTranscript();
      stopRecognitionSafe();
        if (synthRef.current) {
        try { synthRef.current.cancel(); } catch (e) {}
      }
      updateVoiceState('idle');
      lastSpokenMessageIdRef.current = null;
      lastSpokenTextRef.current = '';
      return;
    } else {
      isOpenRef.current = true;
      // Auto-unlock audio context & speech synthesis
      unlockAudioSpeech();
      loadVoices();
      addDebugLog('Modo de Voz aberto.', 'info');

      // If opening with existing messages, record current message ID so we don't replay history
      if (latestMessage) {
        lastSpokenMessageIdRef.current = latestMessage.id;
        lastSpokenTextRef.current = (latestMessage.text || '').trim();
      } else {
        lastSpokenMessageIdRef.current = null;
        lastSpokenTextRef.current = '';
      }

      updateVoiceState('listening');
      latestTranscriptRef.current = '';
      resetTranscript();
      setError(null);

      if (isOpenRef.current) {
        addDebugLog('Visualizador em modo simulado (ouvindo).', 'info');
        createRecognitionInstance();
        startRecognitionSafe(100);
      }
    }
  }, [isOpen, latestMessage, unlockAudioSpeech, loadVoices, addDebugLog, createRecognitionInstance, startRecognitionSafe, stopRecognitionSafe, updateVoiceState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecognitionSafe();
        if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      if (synthRef.current) {
        try { synthRef.current.cancel(); } catch (e) {}
      }
      if (inputAudioCtxRef.current && inputAudioCtxRef.current.state !== 'closed') {
        try { inputAudioCtxRef.current.close(); } catch(e) {}
        inputAudioCtxRef.current = null;
      }
      if (outputAudioCtxRef.current && outputAudioCtxRef.current.state !== 'closed') {
        try { outputAudioCtxRef.current.close(); } catch(e) {}
        outputAudioCtxRef.current = null;
      }
    };
  }, [stopRecognitionSafe]);

  // Handle AI processing state changes
  useEffect(() => {
    if (isLoading && voiceStateRef.current !== 'processing') {
      updateVoiceState('processing');
    }
  }, [isLoading, updateVoiceState]);

  // Observer fallback: Watch for completed AI responses in state (preventing double-play)
  useEffect(() => {
    if (isOpen && !isLoading && latestMessage && latestMessage.role === 'model' && latestMessage.text && !latestMessage.isStreaming) {
      const msgText = latestMessage.text.trim();
      const isAlreadySpoken = 
        latestMessage.id === lastSpokenMessageIdRef.current || 
        msgText === lastSpokenTextRef.current;

      if (!isAlreadySpoken) {
        lastSpokenMessageIdRef.current = latestMessage.id;
        lastSpokenTextRef.current = msgText;
        const preview = msgText.length > 50 ? msgText.slice(0, 50) + '...' : msgText;
        addDebugLog(`Resposta da IA recebida: "${preview}"`, 'success');
        if (!isMuted && latestMessage.text) {
          speakText(latestMessage.text);
        } else {
          updateVoiceState('listening');
          startRecognitionSafe(250);
        }
      }
    }
  }, [isLoading, latestMessage, isOpen, isMuted, speakText, addDebugLog, startRecognitionSafe, updateVoiceState]);

  // Toggle user speech recording / Manual finish
  const toggleListening = () => {
    unlockAudioSpeech();
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (voiceState === 'listening') {
      if (latestTranscriptRef.current.trim()) {
        submitSpeechToAI();
      } else {
        updateVoiceState('idle');
        stopRecognitionSafe();
      }
    } else {
      cancelSpeakingInternal();
      updateVoiceState('listening');
      setError(null);
      latestTranscriptRef.current = '';
      resetTranscript();
      if (isOpenRef.current) {
        addDebugLog('Visualizador em modo simulado (ouvindo).', 'info');
        startRecognitionSafe(50);
      }
    }
  };

  // Instant interruption / barge-in
  const stopSpeaking = () => {
    addDebugLog('Interrupção manual da fala (barge-in)', 'warn');
    cancelSpeakingInternal();
    updateVoiceState('listening');
    latestTranscriptRef.current = '';
    resetTranscript();
    if (isOpenRef.current) {
      addDebugLog('Visualizador em modo simulado (ouvindo).', 'info');
      startRecognitionSafe(100);
    }
  };

  const handleClose = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    latestTranscriptRef.current = '';
    resetTranscript();
    stopRecognitionSafe();
    cancelSpeakingInternal();
    updateVoiceState('idle');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 20 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className={`fixed inset-0 z-[200] flex flex-col items-center justify-between p-6 sm:p-12 overflow-hidden select-none transition-colors duration-300 ${
          isDark
            ? 'bg-black bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#001b38] via-[#02060c] to-[#000000] text-white'
            : 'bg-[#f8fafc] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#e0f2fe] via-[#f1f5f9] to-[#ffffff] text-neutral-900'
        }`}
        onClick={unlockAudioSpeech}
      >
        {/* Background ambient lighting */}
        <div className={`absolute inset-0 pointer-events-none blur-3xl rounded-full scale-155 transition-opacity duration-300 ${
          isDark ? 'bg-zeno/5' : 'bg-zeno/10'
        }`} />

        {/* Header */}
        <div className="w-full max-w-4xl flex justify-between items-center z-10">
          <div className="flex items-center gap-2">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setIsMuted(!isMuted);
                if (!isMuted && synthRef.current) {
                  synthRef.current.cancel();
                }
              }} 
              className={`p-3.5 rounded-full backdrop-blur-md border active:scale-95 transition-all duration-200 shadow-md cursor-pointer ${
                isDark
                  ? 'bg-white/10 border-white/10 hover:bg-white/20 text-neutral-400'
                  : 'bg-white/80 border-neutral-200 hover:bg-white text-neutral-600 shadow-sm'
              }`}
              title={isMuted ? "Ativar som" : "Silenciar voz"}
            >
              {isMuted ? (
                <VolumeX className={`w-5 h-5 ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`} />
              ) : (
                <Volume2 className="w-5 h-5 text-zeno" />
              )}
            </button>
            {voiceName && (
              <span className={`hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs backdrop-blur-md transition-colors ${
                isDark
                  ? 'bg-white/5 border-white/10 text-neutral-300'
                  : 'bg-white/80 border-neutral-200 text-neutral-700 shadow-xs'
              }`}>
                <Sparkles className="w-3 h-3 text-zeno" />
                {voiceName}
              </span>
            )}
          </div>
          
          {/* Dynamic Audio Visualizer Source Indicator */}
          <AnimatePresence mode="wait">
            {voiceState === 'listening' ? (
              <motion.div
                key="source-indicator-user"
                initial={{ opacity: 0, y: -6, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.95 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full backdrop-blur-md text-xs font-medium shadow-sm transition-colors ${
                  isDark
                    ? 'bg-white/5 border border-white/10 text-white'
                    : 'bg-white/90 border border-neutral-200 text-neutral-800 shadow-xs'
                }`}
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zeno opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-zeno" />
                </span>
                <Mic className="w-3.5 h-3.5 text-zeno" />
                <span>Você falando</span>
              </motion.div>
            ) : voiceState === 'speaking' ? (
              <motion.div
                key="source-indicator-ai"
                initial={{ opacity: 0, y: -6, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.95 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zeno/10 border border-zeno/30 backdrop-blur-md text-xs font-medium shadow-sm transition-colors ${
                  isDark ? 'text-white' : 'text-neutral-900 shadow-xs'
                }`}
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zeno opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-zeno" />
                </span>
                <Volume2 className="w-3.5 h-3.5 text-zeno" />
                <span>IA falando</span>
              </motion.div>
            ) : voiceState === 'processing' ? (
              <motion.div
                key="source-indicator-processing"
                initial={{ opacity: 0, y: -6, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.95 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full backdrop-blur-md text-xs font-medium shadow-sm transition-colors ${
                  isDark
                    ? 'bg-white/5 border border-white/10 text-neutral-300'
                    : 'bg-white/90 border border-neutral-200 text-neutral-700 shadow-xs'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full animate-pulse ${isDark ? 'bg-neutral-400' : 'bg-neutral-500'}`} />
                <span>Processando...</span>
              </motion.div>
            ) : (
              <motion.div
                key="source-indicator-idle"
                initial={{ opacity: 0, y: -6, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.95 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full backdrop-blur-md text-xs font-medium shadow-sm transition-colors ${
                  isDark
                    ? 'bg-white/5 border border-white/10 text-neutral-400'
                    : 'bg-white/90 border border-neutral-200 text-neutral-600 shadow-xs'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${isDark ? 'bg-neutral-500' : 'bg-neutral-400'}`} />
                <span>Aguardando</span>
              </motion.div>
            )}
          </AnimatePresence>

          <button 
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
            }}
            className={`p-3.5 rounded-full backdrop-blur-md border active:scale-95 transition-all duration-200 shadow-md cursor-pointer ${
              isDark
                ? 'bg-white/10 border-white/10 hover:bg-white/20 text-white'
                : 'bg-white/80 border-neutral-200 hover:bg-white text-neutral-800 shadow-sm'
            }`}
            title="Fechar Modo de Voz"
          >
            <X className={`w-5 h-5 ${isDark ? 'text-white' : 'text-neutral-800'}`} />
          </button>
        </div>

        {/* Center Logo & Visualizer */}
        <div className="flex-1 flex flex-col items-center justify-center w-full max-w-lg relative my-auto">
          {/* Concentric Waves when Listening */}
          {voiceState === 'listening' && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <motion.div
                animate={{ scale: [1, 1.8], opacity: [0.5, 0] }}
                transition={{ repeat: Infinity, duration: 2, ease: 'easeOut' }}
                className={`absolute w-48 h-48 sm:w-64 sm:h-64 rounded-full border ${isDark ? 'border-zeno/40' : 'border-zeno/50'}`}
              />
              <motion.div
                animate={{ scale: [1, 2.2], opacity: [0.3, 0] }}
                transition={{ repeat: Infinity, duration: 2, delay: 0.6, ease: 'easeOut' }}
                className={`absolute w-48 h-48 sm:w-64 sm:h-64 rounded-full border ${isDark ? 'border-zeno/30' : 'border-zeno/40'}`}
              />
            </div>
          )}

          {/* Concentric Waves when Speaking */}
          {voiceState === 'speaking' && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <motion.div
                animate={{ scale: [1, 1.6], opacity: [0.6, 0] }}
                transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
                className={`absolute w-48 h-48 sm:w-64 sm:h-64 rounded-full ${isDark ? 'bg-zeno/15' : 'bg-zeno/20'} blur-md`}
              />
            </div>
          )}

          <motion.div
            animate={
              voiceState === 'processing' ? { rotate: 360 } :
              voiceState === 'speaking' ? { scale: [1, 1.15, 1], opacity: [0.85, 1, 0.85] } :
              voiceState === 'listening' ? { scale: [1, 1.07, 1], opacity: [0.9, 1, 0.9] } :
              { scale: [1, 1.02, 1], opacity: [0.75, 0.85, 0.75] }
            }
            transition={
              voiceState === 'processing' ? { repeat: Infinity, duration: 2, ease: 'linear' } :
              voiceState === 'speaking' ? { repeat: Infinity, duration: 1.2, ease: 'easeInOut' } :
              voiceState === 'listening' ? { repeat: Infinity, duration: 1.8, ease: 'easeInOut' } :
              { repeat: Infinity, duration: 4, ease: 'easeInOut' }
            }
            className="relative z-10 flex items-center justify-center p-6 will-change-transform"
          >
            <ZenoLogo className={`w-44 h-44 sm:w-56 sm:h-56 transition-colors duration-300 ${
              voiceState === 'speaking' 
                ? 'text-zeno' 
                : isDark 
                  ? 'text-neutral-200' 
                  : 'text-neutral-800'
            }`} />
          </motion.div>
          
          {/* Real-time Audio Frequency Visualizer Canvas */}
          <div className="w-full max-w-sm px-4 h-16 flex items-center justify-center z-10 my-2">
            <AudioVisualizerCanvas
              analyserNode={voiceState === 'speaking' ? outputAnalyserNode : null}
              mediaStream={null}
              isActive={isOpen}
              isAudioActive={voiceState === 'speaking' || voiceState === 'listening'}
              mode={voiceState}
              variant="combined"
              theme={isDark ? 'dark' : 'light'}
              className="h-16 w-full"
            />
          </div>

          {/* Status Text & Live Transcript */}
          <div className="mt-12 w-full flex flex-col items-center justify-start text-center min-h-[90px] z-10">
            <AnimatePresence mode="wait">
              {error ? (
                <motion.span 
                  key="error"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className={`flex items-center justify-center gap-2 text-sm px-4 py-2 rounded-full border backdrop-blur-md ${
                    isDark
                      ? 'text-red-400 bg-red-950/40 border-red-500/30'
                      : 'text-red-600 bg-red-50 border-red-200 shadow-sm'
                  }`}
                >
                  <AlertCircle className="w-4 h-4"/> {error}
                </motion.span>
              ) : (
                <motion.span 
                  key={voiceState}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className={`text-lg sm:text-xl font-light tracking-wide transition-colors ${
                    isDark ? 'text-neutral-300' : 'text-neutral-700'
                  }`}
                >
                  {voiceState === 'idle' && 'Toque no microfone para conversar'}
                  {voiceState === 'listening' && 'Ouvindo você...'}
                  {voiceState === 'processing' && 'Pensando na resposta...'}
                  {voiceState === 'speaking' && 'Zeno está falando...'}
                </motion.span>
              )}
            </AnimatePresence>
            
            <div className="h-12 mt-3 flex items-center justify-center w-full px-4">
              <AnimatePresence>
                {displayedTranscript && voiceState === 'listening' && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -5 }}
                    className={`text-zeno font-medium text-base sm:text-lg max-w-lg px-6 py-1.5 rounded-full bg-zeno/10 border backdrop-blur-md truncate ${
                      isDark ? 'border-zeno/20' : 'border-zeno/30 shadow-xs'
                    }`}
                  >
                    "{displayedTranscript}"
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="w-full flex justify-center pb-8 sm:pb-12 z-10">
          <div className="relative flex items-center justify-center">
            {/* Pulsing ring behind record button when listening */}
            {voiceState === 'listening' && (
              <motion.div
                animate={{ scale: [1, 1.45], opacity: [0.6, 0] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: 'easeOut' }}
                className={`absolute w-20 h-20 rounded-full pointer-events-none ${
                  isDark ? 'bg-white/30' : 'bg-zeno/25'
                }`}
              />
            )}

            {voiceState === 'speaking' ? (
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={(e) => {
                  e.stopPropagation();
                  stopSpeaking();
                }}
                className={`w-20 h-20 rounded-full border flex items-center justify-center transition-all cursor-pointer ${
                  isDark
                    ? 'bg-neutral-800/90 hover:bg-neutral-700 border-neutral-700 text-white shadow-[0_0_25px_rgba(0,0,0,0.5)]'
                    : 'bg-white hover:bg-neutral-100 border-neutral-300 text-neutral-800 shadow-[0_0_25px_rgba(0,0,0,0.12)]'
                }`}
                title="Interromper fala"
              >
                <Square className={`w-7 h-7 fill-current ${isDark ? 'text-white' : 'text-neutral-800'}`} />
              </motion.button>
            ) : (
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleListening();
                }}
                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer ${
                  voiceState === 'listening' 
                    ? isDark
                      ? 'bg-white text-black shadow-[0_0_40px_rgba(255,255,255,0.6)]' 
                      : 'bg-neutral-900 text-white shadow-[0_0_40px_rgba(0,132,223,0.35)]'
                    : 'bg-zeno text-white hover:bg-zeno/90 shadow-[0_0_35px_rgba(0,132,223,0.6)]'
                }`}
                title={voiceState === 'listening' ? 'Enviar ou parar' : 'Iniciar escuta'}
              >
                {voiceState === 'listening' ? <Square className="w-7 h-7 fill-current" /> : <Mic className="w-8 h-8 text-white" />}
              </motion.button>
            )}
          </div>
        </div>

        {/* Temporary Real-Time Event Debug Console Overlay */}
        {DEBUG_VOICE && (
          <div 
            onClick={(e) => e.stopPropagation()} 
            className={`fixed bottom-2 right-2 left-2 sm:left-auto sm:right-4 sm:bottom-4 z-[220] sm:w-[380px] backdrop-blur-xl border rounded-xl shadow-2xl p-3 text-xs font-mono transition-all select-text ${
              isDark
                ? 'bg-black/90 border-white/20 text-neutral-200'
                : 'bg-white/95 border-neutral-300 text-neutral-800 shadow-xl'
            }`}
          >
            <div className={`flex items-center justify-between pb-2 border-b mb-2 ${isDark ? 'border-white/10' : 'border-neutral-200'}`}>
              <div className="flex items-center gap-1.5 font-bold text-zeno text-[11px] tracking-wide uppercase">
                <Terminal className="w-3.5 h-3.5 text-zeno" />
                <span>Log Eventos (Debug Voz)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setDebugLogs([])}
                  className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border transition-colors ${
                    isDark
                      ? 'text-neutral-400 hover:text-white bg-white/5 border-white/10 hover:bg-white/10'
                      : 'text-neutral-600 hover:text-neutral-900 bg-neutral-100 border-neutral-200 hover:bg-neutral-200'
                  }`}
                  title="Limpar logs"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Limpar</span>
                </button>
                <button
                  onClick={() => setIsDebugExpanded(!isDebugExpanded)}
                  className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border transition-colors ${
                    isDark
                      ? 'text-neutral-400 hover:text-white bg-white/5 border-white/10 hover:bg-white/10'
                      : 'text-neutral-600 hover:text-neutral-900 bg-neutral-100 border-neutral-200 hover:bg-neutral-200'
                  }`}
                  title={isDebugExpanded ? "Minimizar log" : "Expandir log"}
                >
                  {isDebugExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                  <span>{isDebugExpanded ? 'Ocultar' : 'Ver'}</span>
                </button>
              </div>
            </div>

            {isDebugExpanded && (
              <>
                {/* Gemini TTS Voice Selector & Test */}
                <div className={`mb-2 pb-2 border-b flex flex-col gap-1.5 p-2 rounded-lg ${
                  isDark ? 'border-white/10 bg-white/5' : 'border-neutral-200 bg-neutral-50'
                }`}>
                  <div className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-1">
                      <span className="font-semibold text-zeno">TTS Nativo Gemini</span>
                      <span className={`text-[9px] px-1.5 py-0.2 rounded border ${
                        isDark ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        Ativo
                      </span>
                    </div>
                    <span className={`text-[9.5px] ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>({GEMINI_TTS_VOICES.length} vozes)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={geminiVoice}
                      onChange={(e) => {
                        const newVoice = e.target.value;
                        setGeminiVoice(newVoice);
                        addDebugLog(`Voz Gemini alterada para: ${newVoice}`, 'success');
                      }}
                      className={`flex-1 text-[10px] rounded px-1.5 py-1 focus:outline-none focus:border-zeno truncate border ${
                        isDark 
                          ? 'bg-black/60 border-white/20 text-white' 
                          : 'bg-white border-neutral-300 text-neutral-900'
                      }`}
                    >
                      {GEMINI_TTS_VOICES.map((v) => (
                        <option key={v.id} value={v.id} className={isDark ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-900'}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleTestVoice()}
                      className="flex items-center gap-1 text-[10px] bg-zeno hover:bg-zeno/90 text-white px-2 py-1 rounded font-medium transition-all active:scale-95 shrink-0"
                      title="Ouvir teste de fala com Gemini TTS"
                    >
                      <Play className="w-2.5 h-2.5 fill-current" />
                      <span>Testar</span>
                    </button>
                  </div>
                </div>

                <div className={`max-h-40 sm:max-h-52 overflow-y-auto space-y-1 pr-1 text-[10.5px] leading-tight select-text scrollbar-thin ${
                  isDark ? 'scrollbar-thumb-white/20' : 'scrollbar-thumb-neutral-300'
                }`}>
                  {debugLogs.length === 0 ? (
                    <p className={`italic py-1 ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>Aguardando eventos de voz...</p>
                  ) : (
                    debugLogs.map((log) => (
                      <div key={log.id} className="flex items-start gap-1.5 break-words py-0.5">
                        <span className={`shrink-0 font-mono text-[9.5px] ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>[{log.time}]</span>
                        <span className={
                          log.type === 'error' ? (isDark ? 'text-red-400 font-semibold' : 'text-red-600 font-semibold') :
                          log.type === 'warn' ? (isDark ? 'text-yellow-300' : 'text-amber-600') :
                          log.type === 'success' ? (isDark ? 'text-emerald-400' : 'text-emerald-600') :
                          (isDark ? 'text-neutral-200' : 'text-neutral-800')
                        }>
                          {log.text}
                        </span>
                      </div>
                    ))
                  )}
                  <div ref={debugLogsEndRef} />
                </div>
              </>
            )}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

