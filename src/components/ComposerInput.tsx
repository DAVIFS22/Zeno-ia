import React, { useRef, useState, useEffect } from 'react';
import { 
  ArrowUp, Square, Mic, MicOff, Paperclip, X, FileText, Code, AlertCircle, Wand2, ChevronDown, Sparkles, Lock
} from 'lucide-react';
import { FileAttachment, UserPlan, ModelType, DailyUsage } from '../types';
import { ZENO_MODELS, getModelDef, FREE_LIMITS } from '../lib/subscription';

interface ComposerInputProps {
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  isListening: boolean;
  speechError: string | null;
  attachments: FileAttachment[];
  onAddAttachment: (file: FileAttachment) => void;
  onRemoveAttachment: (id: string) => void;
  onToggleListening: () => void;
  onSubmit: (e?: React.FormEvent) => void;
  onStopGeneration: () => void;
  onOpenImageStudio: () => void;
  speed: ModelType;
  onSelectSpeed: (speed: ModelType) => void;
  theme: 'dark' | 'light';
  plan?: UserPlan;
  onOpenSubscriptionModal?: (reason?: string) => void;
  dailyUsage?: DailyUsage;
}

export function ComposerInput({
  input,
  setInput,
  isLoading,
  isListening,
  speechError,
  attachments,
  onAddAttachment,
  onRemoveAttachment,
  onToggleListening,
  onSubmit,
  onStopGeneration,
  onOpenImageStudio,
  speed,
  onSelectSpeed,
  theme,
  plan = 'ZENO Free',
  onOpenSubscriptionModal,
  dailyUsage
}: ComposerInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSpeedMenuOpen, setIsSpeedMenuOpen] = useState(false);

  const isDark = theme === 'dark';
  const isPro = plan === 'ZENO Pro';

  const currentModel = getModelDef(speed);

  const handleModelClick = (modelId: ModelType, isModelPro: boolean, modelName: string) => {
    setIsSpeedMenuOpen(false);
    if (isModelPro && !isPro) {
      if (onOpenSubscriptionModal) {
        onOpenSubscriptionModal(`O modelo ${modelName} é exclusivo para assinantes ZENO Pro.`);
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
      const isCode = file.name.match(/\.(ts|tsx|js|jsx|py|json|html|css|md)$/i);

      reader.onload = (event) => {
        const newAttachment: FileAttachment = {
          id: 'file-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
          name: file.name,
          size: file.size,
          type: isImg ? 'image' : isCode ? 'code' : 'document',
          url: isImg ? (event.target?.result as string) : undefined,
          content: !isImg ? (event.target?.result as string) : undefined,
        };
        onAddAttachment(newAttachment);
      };

      if (isImg) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsText(file);
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
      className={`fixed bottom-0 left-0 right-0 md:left-[270px] z-30 pt-3 pb-4 px-3 sm:px-6 pointer-events-none transition-all ${
        isDark 
          ? 'bg-gradient-to-t from-[#0f0f0f] via-[#0f0f0f]/95 to-transparent' 
          : 'bg-gradient-to-t from-white via-white/95 to-transparent'
      }`}
    >
      <div className="max-w-3xl mx-auto relative px-1 sm:px-0 pointer-events-auto">
        
        {/* Model Indicator & Vision Studio Link (Above Capsule Bar) */}
        <div className="flex items-center justify-between mb-2 px-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsSpeedMenuOpen(!isSpeedMenuOpen)}
              className="text-[11px] text-neutral-400 hover:text-neutral-200 transition-colors flex items-center gap-1.5 font-medium"
            >
              <span>Modelo:</span>
              <span className="font-bold text-neutral-200 flex items-center gap-1">
                {currentModel.name}
                {currentModel.isPro && !isPro && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-neutral-800 text-neutral-300 border border-neutral-700">
                    <Lock className="w-2.5 h-2.5" /> PRO
                  </span>
                )}
              </span>
              <ChevronDown className="w-3 h-3 text-neutral-500" />
            </button>

            {isSpeedMenuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setIsSpeedMenuOpen(false)} />
                <div className={`absolute bottom-full left-0 mb-2 w-72 p-2 rounded-2xl border shadow-2xl z-40 animate-fadeIn ${
                  isDark ? 'bg-[#1e1e24] border-neutral-800 text-white' : 'bg-white border-neutral-200 text-black'
                }`}>
                  <div className="px-2.5 py-1.5 mb-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400 border-b border-neutral-800 flex justify-between items-center">
                    <span>Modelos ZENO</span>
                    <span className="text-neutral-500">{isPro ? 'Plano Pro' : 'Plano Free'}</span>
                  </div>

                  {ZENO_MODELS.map(m => {
                    const isSelected = getModelDef(speed).id === m.id;
                    const isLocked = m.isPro && !isPro;

                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handleModelClick(m.id, m.isPro, m.name)}
                        className={`w-full text-left p-2.5 rounded-xl transition-all flex items-center justify-between group ${
                          isSelected
                            ? isDark ? 'bg-neutral-800 text-neutral-100 font-bold' : 'bg-neutral-100 text-neutral-900 font-bold'
                            : isDark ? 'hover:bg-neutral-800/60 text-neutral-300' : 'hover:bg-neutral-100 text-neutral-700'
                        }`}
                      >
                        <div className="flex-1 pr-2">
                          <div className="text-xs font-semibold flex items-center gap-1.5">
                            <span>{m.name}</span>
                            {m.badge && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded font-medium bg-neutral-800 text-neutral-400 border border-neutral-700">
                                {m.badge}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-neutral-400 mt-0.5 leading-tight">{m.description}</div>
                        </div>

                        {isLocked ? (
                          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-300 text-[10px] font-bold flex-shrink-0">
                            <Lock className="w-3 h-3 text-neutral-400" />
                            <span>PRO</span>
                          </div>
                        ) : isSelected ? (
                          <div className="w-2 h-2 rounded-full bg-neutral-200 flex-shrink-0" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={onOpenImageStudio}
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            <Wand2 className="w-3.5 h-3.5 text-neutral-400" />
            <span>Estúdio ZENO Vision</span>
          </button>
        </div>

        {/* Daily Limit Banner for Free users */}
        {!isPro && (isAtLimit || isNearLimit) && (
          <div className={`mb-2 px-4 py-2 rounded-2xl text-xs flex items-center justify-between border animate-fadeIn ${
            isAtLimit 
              ? isDark ? 'bg-neutral-900 border-neutral-700 text-neutral-200' : 'bg-neutral-100 border-neutral-300 text-neutral-900'
              : isDark ? 'bg-neutral-900/60 border-neutral-800 text-neutral-400' : 'bg-neutral-50 border-neutral-200 text-neutral-700'
          }`}>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-neutral-400 flex-shrink-0" />
              <span>
                {isAtLimit 
                  ? `Você atingiu o limite de ${FREE_LIMITS.MESSAGES_PER_DAY} mensagens diárias do plano Free.` 
                  : `Você usou ${messagesCount}/${FREE_LIMITS.MESSAGES_PER_DAY} mensagens gratuitas de hoje.`}
              </span>
            </div>
            {onOpenSubscriptionModal && (
              <button
                type="button"
                onClick={() => onOpenSubscriptionModal("Aumente seus limites com o ZENO Pro para conversas ilimitadas.")}
                className="px-3 py-1 rounded-xl text-[11px] font-bold bg-neutral-200 hover:bg-white text-neutral-950 transition-all shadow-xs ml-2 flex-shrink-0"
              >
                Upgrade Pro
              </button>
            )}
          </div>
        )}

        {/* Speech Error Banner */}
        {speechError && (
          <div className="mb-2 px-3 py-2 rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-300 text-xs flex items-center gap-2 animate-fadeIn">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-neutral-400" />
            <span>{speechError}</span>
          </div>
        )}

        {/* Voice Recording Active Bar */}
        {isListening && (
          <div className="mb-2 px-4 py-1.5 rounded-full bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs inline-flex items-center gap-2 shadow-sm animate-pulse">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
            <span className="font-semibold">Ouvindo sua voz... Fale agora</span>
            <button
              type="button"
              onClick={onToggleListening}
              className="ml-2 font-bold hover:underline text-neutral-300"
            >
              Concluir
            </button>
          </div>
        )}

        {/* Attached Files Chips */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-2 px-2">
            {attachments.map(att => (
              <div
                key={att.id}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border shadow-xs ${
                  isDark ? 'bg-[#2F2F2F] border-[#3F3F46] text-neutral-200' : 'bg-white border-neutral-300 text-neutral-800'
                }`}
              >
                {att.type === 'image' && att.url ? (
                  <img src={att.url} alt={att.name} className="w-4 h-4 rounded object-cover" />
                ) : att.type === 'code' ? (
                  <Code className="w-3.5 h-3.5 text-neutral-400" />
                ) : (
                  <FileText className="w-3.5 h-3.5 text-neutral-400" />
                )}
                <span className="truncate max-w-[140px]">{att.name}</span>
                <button
                  type="button"
                  onClick={() => onRemoveAttachment(att.id)}
                  className="p-0.5 hover:bg-neutral-700/40 rounded text-neutral-400 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ChatGPT Style Pill Capsule Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (hasContent && !isLoading) {
              onSubmit(e);
            }
          }}
          className={`relative flex items-center gap-2 rounded-[9999px] min-h-[56px] max-h-[180px] px-4 py-2 transition-all duration-200 border shadow-lg ${
            isDragging 
              ? 'ring-2 ring-blue-500 border-blue-500/80 bg-[#2F2F2F]' 
              : isDark
                ? 'bg-[#2F2F2F] border-[#3F3F46] focus-within:ring-1 focus-within:ring-[#52525b] focus-within:border-[#52525b]'
                : 'bg-[#F4F4F6] border-[#E4E4E7] focus-within:ring-1 focus-within:ring-neutral-400 focus-within:border-neutral-400'
          } ${isListening ? 'ring-2 ring-blue-500/50' : ''}`}
        >
          {/* Paperclip Button (Far Left) */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            title="Anexar arquivo"
            className={`p-2 rounded-full transition-colors flex items-center justify-center flex-shrink-0 ${
              isDark
                ? 'text-[#9CA3AF] hover:text-white hover:bg-[#3F3F46]/50'
                : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200'
            }`}
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            multiple
            className="hidden"
            accept="image/*,.txt,.ts,.tsx,.js,.jsx,.py,.json,.md,.css,.html,.pdf"
          />

          {/* Text Area (Spans full available width) */}
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
              isDragging ? "Solte seus arquivos aqui..." :
              isListening ? "Fale agora, o áudio será transcrito..." :
              "Pergunte qualquer coisa"
            }
            disabled={isLoading}
            rows={1}
            className={`flex-1 bg-transparent border-none focus:outline-none resize-none overflow-y-auto scrollbar-custom max-h-[140px] text-[15px] sm:text-base leading-snug py-1.5 px-1 font-normal ${
              isDark 
                ? 'text-white placeholder-[#9CA3AF]' 
                : 'text-neutral-900 placeholder-neutral-400'
            }`}
          />

          {/* Microphone Button (Right side, next to send) */}
          <button
            type="button"
            onClick={onToggleListening}
            disabled={isLoading}
            title={isListening ? "Parar de ouvir" : "Falar com ZENO"}
            className={`p-2 rounded-full transition-colors flex items-center justify-center flex-shrink-0 ${
              isListening
                ? 'bg-blue-600 text-white animate-pulse'
                : isDark
                  ? 'text-[#9CA3AF] hover:text-white hover:bg-[#3F3F46]/50'
                  : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200'
            }`}
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Circular Send / Stop Button */}
          {isLoading ? (
            <button
              type="button"
              onClick={onStopGeneration}
              title="Parar geração"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white text-black hover:bg-neutral-200 transition-all flex items-center justify-center flex-shrink-0 shadow-xs"
            >
              <Square className="w-4 h-4 fill-current text-black" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!hasContent}
              title="Enviar mensagem"
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full transition-all flex items-center justify-center flex-shrink-0 ${
                hasContent
                  ? 'bg-[#3B82F6] hover:bg-blue-600 text-white shadow-md cursor-pointer scale-100'
                  : isDark
                    ? 'bg-[#38383E] text-[#9CA3AF] cursor-not-allowed opacity-80'
                    : 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
              }`}
            >
              <ArrowUp className="w-5 h-5 stroke-[2.5]" />
            </button>
          )}
        </form>

        <div className="text-center text-[11px] text-neutral-500 mt-2 font-medium">
          ZENO pode cometer erros. Recomenda-se checar informações críticas.
        </div>
      </div>
    </div>
  );
}

