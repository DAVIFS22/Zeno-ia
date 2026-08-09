import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowUp, Square, Mic, MicOff, Paperclip, X, FileText, Code, AlertCircle, Wand2, ChevronDown, Sparkles, Lock, Cloud
} from 'lucide-react';
import { FileAttachment, UserPlan, ModelType, DailyUsage } from '../types';
import { ZENO_MODELS, getModelDef, FREE_LIMITS } from '../lib/subscription';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useTranslation } from '../i18n';
import { auth } from '../lib/firebase';
import { signInAnonymously } from 'firebase/auth';
import { getOrCreateUserId } from '../lib/userId';
import { startAudioLevelMeter, stopAudioLevelMeter } from '../hooks/useAudioLevel';

const VoiceBlob = ({ className = "" }: { className?: string }) => {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
      </span>
    </div>
  );
};

interface ComposerInputProps {
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  attachments: FileAttachment[];
  onAddAttachment: (file: FileAttachment) => void;
  onRemoveAttachment: (id: string) => void;
  onSubmit: (e?: React.FormEvent) => void;
  onStopGeneration: () => void;
  speed: ModelType;
  onSelectSpeed: (speed: ModelType) => void;
  theme: 'dark' | 'light';
  plan?: UserPlan;
  onOpenSubscriptionModal?: (reason?: string) => void;
  onOpenProFeatureModal?: () => void;
  dailyUsage?: DailyUsage;
  cloudDraftPrompt?: { text: string; timestamp: number } | null;
  onAcceptCloudDraft?: () => void;
  onDismissCloudDraft?: () => void;
}

export const ComposerInput = React.memo<ComposerInputProps>(({
  input,
  setInput,
  isLoading,
  attachments,
  onAddAttachment,
  onRemoveAttachment,
  onSubmit,
  onStopGeneration,
  speed,
  onSelectSpeed,
  theme,
  plan = 'ZENO Free',
  onOpenSubscriptionModal,
  onOpenProFeatureModal,
  dailyUsage,
  cloudDraftPrompt,
  onAcceptCloudDraft,
  onDismissCloudDraft,
}) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSpeedMenuOpen, setIsSpeedMenuOpen] = useState(false);

    // --- Groq Whisper Transcription Logic via MediaRecorder ---
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const stopRecordingAndTranscribe = useCallback(() => {
    console.log('[Groq Whisper Stage 1] Stopping microphone recording...');
    setIsListening(false);
    stopAudioLevelMeter();

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const onToggleListening = useCallback(async () => {
    if (isListening) {
      stopRecordingAndTranscribe();
      return;
    }

    setSpeechError(null);
    audioChunksRef.current = [];

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setSpeechError('Microfone não suportado neste navegador.');
      return;
    }

    try {
      console.log('[Groq Whisper Stage 1] Solicita permissão do microfone...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      console.log('[Groq Whisper Stage 1] Permissão concedida. Iniciando medidor de nível e MediaRecorder...');
      await startAudioLevelMeter(stream);

      let mimeType = '';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm';
      } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        mimeType = 'audio/ogg;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      }

      console.log(`[Groq Whisper Stage 1] MediaRecorder configurado com mimeType: "${mimeType || 'padrão'}"`);
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log(`[Groq Whisper Stage 1] Chunk de áudio gravado: ${event.data.size} bytes. Total de chunks: ${audioChunksRef.current.length}`);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('[Groq Whisper Stage 1] Gravação finalizada. Criando Blob de áudio...');
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        console.log(`[Groq Whisper Stage 1 Resultado] Audio Blob final criado: tamanho = ${audioBlob.size} bytes, tipo = "${audioBlob.type}"`);

        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach(track => track.stop());
          mediaStreamRef.current = null;
        }

        if (audioBlob.size === 0) {
          console.warn('[Groq Whisper Stage 1 Falha] Blob de áudio gerado com 0 bytes (vazio).');
          setSpeechError('Nenhum som/áudio foi capturado pelo microfone.');
          return;
        }

        setIsTranscribing(true);

        try {
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64String = reader.result as string;
            const audioBase64 = base64String.split(',')[1];

            console.log(`[Groq Whisper Stage 2] Disparando requisição POST para /api/transcribe. Tamanho do Base64: ${audioBase64.length}`);

            let currentUser = auth.currentUser;
            if (!currentUser) {
              try {
                const cred = await signInAnonymously(auth);
                currentUser = cred.user;
              } catch (anonErr) {
                console.error('[Groq Whisper Auth Error] Anonymous sign in failed:', anonErr);
              }
            }

            let idToken = '';
            if (currentUser) {
              try {
                idToken = await currentUser.getIdToken();
              } catch (tokenErr) {
                console.error('[Groq Whisper Auth Error] Failed to get ID token:', tokenErr);
              }
            }

            if (!idToken || !currentUser) {
              console.error('[Groq Whisper Auth Error]', 'Usuário não autenticado.');
              setSpeechError("Por favor, faça login para usar a transcrição.");
              setIsTranscribing(false);
              return;
            }

            const res = await fetch('/api/transcribe', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
              },
              body: JSON.stringify({
                audioBase64,
                userId: currentUser.uid
              })
            });

            console.log(`[Groq Whisper Stage 2 & 3] Resposta HTTP recebida do backend: status = ${res.status}`);
            const data = await res.json();

            if (!res.ok) {
              console.error('[Groq Whisper Stage 3 Error]', data);
              setSpeechError(data.error || 'Erro ao transcrever o áudio.');
            } else if (data.text) {
              console.log(`[Groq Whisper Stage 4 Success] Texto transcrito recebido com sucesso: "${data.text}"`);
              setInput(input ? `${input.trim()} ${data.text.trim()}` : data.text.trim());
            } else {
              console.warn('[Groq Whisper Stage 4 Warning] Backend retornou texto vazio.');
              setSpeechError('Nenhuma fala foi identificada no áudio.');
            }

            setIsTranscribing(false);
          };
        } catch (transcribeErr: any) {
          console.error('[Groq Whisper Exception]', transcribeErr);
          setSpeechError('Erro ao converter ou enviar o áudio.');
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start(250);
      setIsListening(true);
      console.log('[Groq Whisper Stage 1 Success] MediaRecorder iniciado e gravando.');
    } catch (err: any) {
      console.error('[Groq Whisper Stage 1 Error]', err);
      const errMsg = (err.message || err.toString() || '').toLowerCase();
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || errMsg.includes('permission denied')) {
        setSpeechError('Permissão do microfone negada. Permita o acesso ao microfone no navegador.');
      } else {
        setSpeechError(`Erro ao acessar o microfone: ${err.message || err.name}`);
      }
      setIsListening(false);
      stopAudioLevelMeter();
    }
  }, [isListening, stopRecordingAndTranscribe, setInput]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      }
      stopAudioLevelMeter();
    };
  }, []);


  const isDark = theme === 'dark';
  const { isPro } = useSubscription();

  const currentModel = getModelDef(speed);

  // Close model menu smoothly on outside clicks without conflicting with toggle button
  useEffect(() => {
    if (!isSpeedMenuOpen) return;

    const handleClickOutside = (event: Event) => {
      const target = event.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        console.log('[ComposerInput] Outside click detected. Closing model selector dropdown.');
        setIsSpeedMenuOpen(false);
      }
    };

    // Use setTimeout to ensure the click/touch event that opened the dropdown finishes before outside listener is active
    const timeoutId = setTimeout(() => {
      document.addEventListener('pointerdown', handleClickOutside);
      document.addEventListener('click', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('pointerdown', handleClickOutside);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isSpeedMenuOpen]);

  const handleModelClick = (modelId: ModelType, isModelPro: boolean) => {
    setIsSpeedMenuOpen(false);
    if (isModelPro && !isPro) {
      if (onOpenProFeatureModal) {
        onOpenProFeatureModal();
      }
    } else {
      onSelectSpeed(modelId);
    }
  };

  const messagesCount = dailyUsage?.messagesCount || 0;
  const isNearLimit = !isPro && messagesCount >= FREE_LIMITS.MESSAGES_PER_DAY - 3 && messagesCount < FREE_LIMITS.MESSAGES_PER_DAY;
  const isAtLimit = !isPro && messagesCount >= FREE_LIMITS.MESSAGES_PER_DAY;

  const hasContent = input.trim().length > 0 || attachments.length > 0;

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [input]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      const isImg = file.type.startsWith('image/');
      const isCode = file.name.match(/\.(ts|tsx|js|jsx|py|json|html|css|md|csv|txt)$/i);
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

      if (isImg) {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            const newAttachment: FileAttachment = {
              id: 'file-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
              name: file.name,
              size: Math.round((dataUrl.length - 22) * 3 / 4), // Approximate size
              type: 'image',
              url: dataUrl,
            };
            onAddAttachment(newAttachment);
          }
        };
        img.src = URL.createObjectURL(file);
      } else {
        const reader = new FileReader();
        reader.onload = (event) => {
          const newAttachment: FileAttachment = {
            id: 'file-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
            name: file.name,
            size: file.size,
            type: isPdf ? 'document' : isCode ? 'code' : 'document',
            url: isPdf ? (event.target?.result as string) : undefined,
            content: !isPdf ? (event.target?.result as string) : undefined,
          };
          onAddAttachment(newAttachment);
        };
        if (isPdf) {
          reader.readAsDataURL(file);
        } else {
          reader.readAsText(file);
        }
      }
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const event = { target: { files } } as any;
      handleFileChange(event);
    }
  };

  return (
    <div 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`fixed bottom-0 left-0 right-0 md:left-[260px] z-30 pt-2 pb-4 pb-[env(safe-area-inset-bottom)] px-3 sm:px-6 pointer-events-none transition-all gpu-accelerated ${
        isDark 
          ? 'bg-gradient-to-t from-[#0f0f11] via-[#0f0f11]/95 to-transparent' 
          : 'bg-gradient-to-t from-white via-white/95 to-transparent'
      }`}
    >
      <div className="w-full relative px-1 sm:px-4 pointer-events-auto">

        {/* Cloud Draft Discovery Discrete Banner */}
        {cloudDraftPrompt && (
          <div className={`mb-2 p-2.5 px-3.5 rounded-xl border shadow-lg flex items-center justify-between gap-3 text-xs animate-fadeIn ${
            isDark ? 'bg-[#1c1c20] border-neutral-500/30 text-neutral-200' : 'bg-neutral-50 border-neutral-200 text-neutral-900'
          }`}>
            <div className="flex items-center gap-2 min-w-0">
              <Cloud className="w-4 h-4 text-neutral-500 shrink-0 animate-pulse" />
              <span className="truncate">
                {t.composer.cloudDraft}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onAcceptCloudDraft}
                className="px-2.5 py-1 rounded-lg bg-neutral-500 hover:bg-neutral-600 active:bg-neutral-700 text-white font-medium text-[11px] transition-colors cursor-pointer"
              >
                {t.common.save}
              </button>
              <button
                type="button"
                onClick={onDismissCloudDraft}
                className={`p-1 rounded-md transition-colors cursor-pointer ${
                  isDark ? 'hover:bg-[#232326] text-neutral-400' : 'hover:bg-neutral-100 text-neutral-700'
                }`}
                title="Manter rascunho atual"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
        
        {/* Model Indicator & Image Studio Action */}
        <div className="flex items-center justify-between mb-1.5 px-2">
          <div ref={menuRef} className="model-selector relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsSpeedMenuOpen(prev => !prev);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
              className={`text-xs flex items-center gap-1.5 font-medium cursor-pointer px-2 py-1 -mx-2 rounded-lg transition-all duration-150 ease-out active:scale-95 focus:outline-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#4A4A4E] ${
                isDark 
                  ? 'text-neutral-400 hover:text-neutral-200 hover:bg-[#232326] active:bg-[#2C2C2E]' 
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 active:bg-neutral-200'
              }`}
            >
              <span>Modelo:</span>
              <span className={`font-semibold flex items-center gap-1 ${
                isDark ? 'text-neutral-200' : 'text-neutral-900'
              }`}>
                {currentModel.name}
                {currentModel.isPro && !isPro && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#232326] text-neutral-300 border border-[#2C2C2E]">
                    <Lock className="w-2.5 h-2.5" /> PRO
                  </span>
                )}
              </span>
              <ChevronDown className={`w-3 h-3 text-neutral-400 transition-transform duration-200 ease-in-out transform ${isSpeedMenuOpen ? 'rotate-180' : 'rotate-0'}`} />
            </button>

            {/* Model Selection Menu */}
            {isSpeedMenuOpen && (
              <div 
                className={`absolute bottom-full left-0 mb-2 w-72 p-2 rounded-xl border shadow-2xl z-50 animate-fadeIn ${
                  isDark ? 'bg-[#18181b] border-[#2C2C2E] text-white' : 'bg-white border-neutral-200 text-neutral-900'
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className={`px-2 py-1 mb-1 text-[10px] font-bold uppercase tracking-wider flex justify-between items-center border-b ${
                    isDark ? 'text-neutral-400 border-[#2C2C2E]' : 'text-neutral-500 border-neutral-100'
                  }`}>
                    <span>{t.composer.speedSmart}</span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectSpeed('smart');
                      }}
                      className={`px-1.5 py-0.5 rounded transition-colors ${
                        speed === 'smart' 
                          ? 'bg-sky-600 text-white' 
                          : isDark ? 'bg-[#232326] text-neutral-400' : 'bg-neutral-100 text-neutral-500'
                      }`}
                    >
                      {speed === 'smart' ? 'Ativo' : 'Ativar'}
                    </button>
                  </div>

                  {ZENO_MODELS.map(m => {
                    const isSelected = getModelDef(speed).id === m.id;
                    const isLocked = m.isPro && !isPro;

                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handleModelClick(m.id, m.isPro)}
                        className={`w-full text-left p-2 rounded-lg transition-all flex items-center justify-between group ${
                          isSelected
                            ? isDark ? 'bg-[#232326] text-white font-medium' : 'bg-neutral-100 text-neutral-900 font-medium'
                            : isDark ? 'hover:bg-[#232326]/50 text-neutral-300' : 'hover:bg-neutral-50 text-neutral-700'
                        }`}
                      >
                        <div className="flex-1 pr-2">
                          <div className="text-xs font-medium flex items-center gap-1.5">
                            <span>{m.name}</span>
                          </div>
                          <div className="text-[10px] text-neutral-400 mt-0.5 leading-tight">{m.description}</div>
                        </div>

                        {isLocked ? (
                          <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                            isDark ? 'bg-[#232326] border-[#2C2C2E] text-neutral-400' : 'bg-neutral-100 border-neutral-200 text-neutral-600'
                          }`}>
                            <Lock className="w-2.5 h-2.5" /> PRO
                          </div>
                        ) : isSelected ? (
                          <div className={`w-1.5 h-1.5 rounded-full ${
                            isDark ? 'bg-white' : 'bg-[#1C1C1E]'
                          }`} />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
            )}
          </div>
        </div>

        {/* Daily Limit Warning */}
        {!isPro && (isAtLimit || isNearLimit) && (
          <div className={`mb-2 px-3.5 py-1.5 rounded-xl text-xs flex items-center justify-between border ${
            isAtLimit 
              ? isDark ? 'bg-[#1C1C1E] border-[#2C2C2E] text-neutral-200' : 'bg-neutral-100 border-neutral-300 text-neutral-900'
              : isDark ? 'bg-[#1C1C1E]/60 border-[#2C2C2E] text-neutral-400' : 'bg-neutral-50 border-neutral-200 text-neutral-700'
          }`}>
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
              <span>
                {isAtLimit 
                  ? `Limite de ${FREE_LIMITS.MESSAGES_PER_DAY} mensagens diárias atingido.` 
                  : `${messagesCount}/${FREE_LIMITS.MESSAGES_PER_DAY} mensagens grátis utilizadas.`}
              </span>
            </div>
            {onOpenProFeatureModal && (
              <button
                type="button"
                onClick={() => onOpenProFeatureModal()}
                className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-neutral-200 hover:bg-white text-neutral-950 transition-all ml-2"
              >
                Upgrade Pro
              </button>
            )}
          </div>
        )}

        {/* Speech Error Banner */}
        {speechError && (
          <div className="mb-2 px-3 py-1.5 rounded-lg bg-[#232326] border border-[#2C2C2E] text-neutral-300 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-neutral-400" />
              <span>{speechError}</span>
            </div>
            <button
              onClick={() => setSpeechError(null)}
              className="text-neutral-500 hover:text-neutral-300 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (hasContent && !isLoading) {
              onSubmit(e);
            }
          }}
          className={`relative flex flex-col rounded-[24px] min-h-[54px] max-h-[300px] py-2 transition-all duration-200 border ${
            isDragging 
              ? isDark 
                ? 'border-neutral-600 bg-[#232326]'
                : 'border-neutral-400 bg-neutral-50' 
              : isDark
                ? 'bg-[#151518] border-[#2C2C2E] focus-within:border-[#3C3C3E]'
                : 'bg-white border-neutral-200/90 focus-within:border-neutral-400 shadow-2xs'
          }`}
        >
          {/* Attached Files Preview */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 pt-2 pb-2 px-4">
              {attachments.map(att => (
                <div
                  key={att.id}
                  className="relative group shrink-0"
                  title={att.name}
                >
                  <div className={`w-14 h-14 rounded-xl overflow-hidden border flex flex-col items-center justify-center ${
                    isDark ? 'bg-[#232326] border-[#2C2C2E]' : 'bg-neutral-100 border-neutral-200'
                  }`}>
                    {att.type === 'image' && att.url ? (
                      <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
                    ) : (
                      <>
                        {att.type === 'code' ? <Code className="w-5 h-5 text-neutral-400 mb-0.5" /> : <FileText className="w-5 h-5 text-neutral-400 mb-0.5" />}
                        <span className="truncate w-full text-center px-1 text-[9px] font-medium text-neutral-500">{att.name.split('.').pop()?.toUpperCase()}</span>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveAttachment(att.id)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center bg-black/70 hover:bg-black text-white rounded-full backdrop-blur-md shadow-sm transition-colors border border-white/10"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input Controls Row */}
          <div className="flex items-center gap-2 w-full px-2">
            {/* File Attachment */}
            <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || isListening || isTranscribing}
            title={t.composer.uploadDoc}
            className={`p-2 rounded-full transition-colors flex-shrink-0 cursor-pointer ${
              isDark
                ? 'text-neutral-400 hover:text-white hover:bg-[#232326] disabled:opacity-40'
                : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 disabled:opacity-40'
            }`}
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            multiple
            className="hidden"
            accept="image/*,.txt,.ts,.tsx,.js,.jsx,.py,.json,.md,.css,.html,.pdf"
          />

          {/* Text Area or Inline Voice Recording Indicator */}
          {isListening ? (
            <div className="flex-1 flex items-center gap-2 py-1.5 px-1 min-w-0">
              <VoiceBlob className="w-4 h-4 text-blue-500 shrink-0" />
              <span className="text-sm font-medium text-blue-500 animate-pulse truncate">
                Ouvindo... fale agora
              </span>
            </div>
          ) : isTranscribing ? (
            <div className="flex-1 flex items-center gap-2 py-1.5 px-1 min-w-0">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
              <span className="text-sm font-medium text-blue-500 truncate">
                Transcrevendo áudio...
              </span>
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (hasContent && !isLoading) {
                    onSubmit(e);
                  }
                }
              }}
              placeholder={
                isDragging ? t.composer.uploadDoc : t.composer.placeholder
              }
              disabled={isLoading}
              rows={1}
              className={`flex-1 bg-transparent border-none focus:outline-none resize-none overflow-y-auto scrollbar-custom max-h-[140px] text-sm py-1.5 font-normal ${
                isDark 
                  ? 'text-white placeholder-neutral-500' 
                  : 'text-neutral-900 placeholder-neutral-400'
              }`}
            />
          )}

          {/* Voice Input / Finish Button */}
          {isListening ? (
            <button
              type="button"
              onClick={onToggleListening}
              className="px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition-all flex items-center gap-1.5 flex-shrink-0 cursor-pointer shadow-xs shadow-blue-600/20"
            >
              <span>Finalizar</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onToggleListening}
              disabled={isLoading || isTranscribing}
              title={isTranscribing ? "Transcrevendo..." : t.composer.voiceSearch}
              className={`relative p-2 rounded-full transition-all duration-300 flex items-center justify-center gap-1.5 flex-shrink-0 cursor-pointer overflow-hidden ${
                isDark
                  ? 'text-neutral-400 hover:text-white hover:bg-[#232326] disabled:opacity-40'
                  : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 disabled:opacity-40'
              }`}
            >
              <Mic className="w-4 h-4" />
            </button>
          )}

          {/* Submit / Stop Button */}
          {!isListening && (
            isLoading ? (
              <button
                type="button"
                onClick={onStopGeneration}
                title={t.common.stop}
                className="w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-700 text-white transition-all flex items-center justify-center flex-shrink-0 cursor-pointer shadow-xs shadow-blue-600/20"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!hasContent}
                title={t.common.send}
                className={`w-9 h-9 rounded-full transition-all flex items-center justify-center flex-shrink-0 ${
                  hasContent
                    ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-xs shadow-blue-600/20'
                    : isDark
                      ? 'bg-[#232326] text-neutral-600 cursor-not-allowed'
                      : 'bg-neutral-100 text-neutral-300 cursor-not-allowed'
                }`}
              >
                <ArrowUp className="w-4 h-4 stroke-[2.5]" />
              </button>
            )
          )}
          </div>
        </form>

        <div className="text-center text-[10px] text-neutral-500 mt-1.5">
          {t.welcome.footer}
        </div>
      </div>
    </div>
  );
});

ComposerInput.displayName = 'ComposerInput';
