import React, { useRef, useState, useEffect } from 'react';
import { 
  ArrowUp, Square, Mic, MicOff, Paperclip, X, FileText, Code, AlertCircle, Wand2, ChevronDown, Sparkles, Lock
} from 'lucide-react';
import { FileAttachment, UserPlan, ModelType, DailyUsage } from '../types';
import { ZENO_MODELS, getModelDef, FREE_LIMITS } from '../lib/subscription';
import { useSubscription } from '../contexts/SubscriptionContext';

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
  onOpenProFeatureModal?: () => void;
  dailyUsage?: DailyUsage;
}

export const ComposerInput = React.memo<ComposerInputProps>(({
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
  onOpenProFeatureModal,
  dailyUsage
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSpeedMenuOpen, setIsSpeedMenuOpen] = useState(false);

  const isDark = theme === 'dark';
  const { isPro } = useSubscription();

  const currentModel = getModelDef(speed);

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
    if (!isPro && onOpenProFeatureModal) {
      onOpenProFeatureModal();
      return;
    }
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      const isImg = file.type.startsWith('image/');
      const isCode = file.name.match(/\.(ts|tsx|js|jsx|py|json|html|css|md|csv|txt)$/i);
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

      reader.onload = (event) => {
        const newAttachment: FileAttachment = {
          id: 'file-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
          name: file.name,
          size: file.size,
          type: isImg ? 'image' : isPdf ? 'document' : isCode ? 'code' : 'document',
          url: (isImg || isPdf) ? (event.target?.result as string) : undefined,
          content: !(isImg || isPdf) ? (event.target?.result as string) : undefined,
        };
        onAddAttachment(newAttachment);
      };

      if (isImg || isPdf) {
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
      className={`fixed bottom-0 left-0 right-0 md:left-[260px] z-30 pt-2 pb-4 pb-[env(safe-area-inset-bottom)] px-3 sm:px-6 pointer-events-none transition-all ${
        isDark 
          ? 'bg-gradient-to-t from-[#0f0f11] via-[#0f0f11]/95 to-transparent' 
          : 'bg-gradient-to-t from-white via-white/95 to-transparent'
      }`}
    >
      <div className="max-w-3xl mx-auto relative px-1 sm:px-0 pointer-events-auto">
        
        {/* Model Indicator */}
        <div className="flex items-center justify-between mb-1.5 px-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsSpeedMenuOpen(!isSpeedMenuOpen)}
              className={`text-xs transition-colors flex items-center gap-1.5 font-medium ${
                isDark ? 'text-neutral-400 hover:text-neutral-200' : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <span>Modelo:</span>
              <span className={`font-semibold flex items-center gap-1 ${
                isDark ? 'text-neutral-200' : 'text-neutral-900'
              }`}>
                {currentModel.name}
                {currentModel.isPro && !isPro && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-neutral-800 text-neutral-300 border border-neutral-700">
                    <Lock className="w-2.5 h-2.5" /> PRO
                  </span>
                )}
              </span>
              <ChevronDown className="w-3 h-3 text-neutral-400" />
            </button>

            {/* Model Selection Menu */}
            {isSpeedMenuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setIsSpeedMenuOpen(false)} />
                <div className={`absolute bottom-full left-0 mb-2 w-72 p-2 rounded-xl border shadow-xl z-40 animate-fadeIn ${
                  isDark ? 'bg-[#18181b] border-neutral-800 text-white' : 'bg-white border-neutral-200 text-neutral-900'
                }`}>
                  <div className={`px-2 py-1 mb-1 text-[10px] font-bold uppercase tracking-wider flex justify-between items-center border-b ${
                    isDark ? 'text-neutral-400 border-neutral-800' : 'text-neutral-500 border-neutral-100'
                  }`}>
                    <span>Modo Inteligente</span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectSpeed('smart');
                      }}
                      className={`px-1.5 py-0.5 rounded transition-colors ${
                        speed === 'smart' 
                          ? 'bg-blue-600 text-white' 
                          : isDark ? 'bg-neutral-800 text-neutral-400' : 'bg-neutral-100 text-neutral-500'
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
                            ? isDark ? 'bg-neutral-800 text-white font-medium' : 'bg-neutral-100 text-neutral-900 font-medium'
                            : isDark ? 'hover:bg-neutral-800/50 text-neutral-300' : 'hover:bg-neutral-50 text-neutral-700'
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
                            isDark ? 'bg-neutral-800 border-neutral-700 text-neutral-400' : 'bg-neutral-100 border-neutral-200 text-neutral-600'
                          }`}>
                            <Lock className="w-2.5 h-2.5" /> PRO
                          </div>
                        ) : isSelected ? (
                          <div className={`w-1.5 h-1.5 rounded-full ${
                            isDark ? 'bg-white' : 'bg-neutral-900'
                          }`} />
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
            onClick={() => {
              if (!isPro && onOpenProFeatureModal) {
                onOpenProFeatureModal();
              } else {
                onOpenImageStudio();
              }
            }}
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium transition-colors ${
              isDark ? 'text-neutral-400 hover:text-neutral-200' : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5 text-neutral-400" />
            <span>Gerar Imagem</span>
          </button>
        </div>

        {/* Daily Limit Warning */}
        {!isPro && (isAtLimit || isNearLimit) && (
          <div className={`mb-2 px-3.5 py-1.5 rounded-xl text-xs flex items-center justify-between border ${
            isAtLimit 
              ? isDark ? 'bg-neutral-900 border-neutral-700 text-neutral-200' : 'bg-neutral-100 border-neutral-300 text-neutral-900'
              : isDark ? 'bg-neutral-900/60 border-neutral-800 text-neutral-400' : 'bg-neutral-50 border-neutral-200 text-neutral-700'
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
          <div className="mb-2 px-3 py-1.5 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-neutral-400" />
            <span>{speechError}</span>
          </div>
        )}

        {/* Voice Active Bar */}
        {isListening && (
          <div className="mb-2 px-3 py-1 rounded-full bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs inline-flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <span>Ouvindo...</span>
            <button
              type="button"
              onClick={onToggleListening}
              className="ml-2 font-semibold hover:underline"
            >
              Concluir
            </button>
          </div>
        )}

        {/* Attached Files */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mb-2 px-1">
            {attachments.map(att => (
              <div
                key={att.id}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${
                  isDark ? 'bg-neutral-800 border-neutral-700 text-neutral-200' : 'bg-neutral-100 border-neutral-200 text-neutral-800'
                }`}
              >
                {att.type === 'image' && att.url ? (
                  <img src={att.url} alt={att.name} className="w-3.5 h-3.5 rounded object-cover" />
                ) : att.type === 'code' ? (
                  <Code className="w-3.5 h-3.5 text-neutral-400" />
                ) : (
                  <FileText className="w-3.5 h-3.5 text-neutral-400" />
                )}
                <span className="truncate max-w-[120px]">{att.name}</span>
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

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (hasContent && !isLoading) {
              onSubmit(e);
            }
          }}
          className={`relative flex items-center gap-2 rounded-2xl min-h-[52px] max-h-[180px] px-3.5 py-2 transition-all duration-200 border ${
            isDragging 
              ? isDark 
                ? 'border-neutral-600 bg-neutral-800'
                : 'border-neutral-400 bg-neutral-50' 
              : isDark
                ? 'bg-[#151518] border-neutral-800 focus-within:border-neutral-700'
                : 'bg-white border-neutral-200/90 focus-within:border-neutral-400 shadow-2xs'
          }`}
        >
          {/* File Attachment */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            title="Anexar arquivo"
            className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${
              isDark
                ? 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
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

          {/* Text Area */}
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
              isListening ? "Fale agora..." :
              "Enviar mensagem para ZENO..."
            }
            disabled={isLoading}
            rows={1}
            className={`flex-1 bg-transparent border-none focus:outline-none resize-none overflow-y-auto scrollbar-custom max-h-[140px] text-sm py-1 font-normal ${
              isDark 
                ? 'text-white placeholder-neutral-500' 
                : 'text-neutral-900 placeholder-neutral-400'
            }`}
          />

          {/* Voice Input */}
          <button
            type="button"
            onClick={onToggleListening}
            disabled={isLoading}
            title={isListening ? "Parar de ouvir" : "Falar"}
            className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${
              isListening
                ? isDark
                  ? 'bg-neutral-100 text-neutral-950'
                  : 'bg-neutral-900 text-white'
                : isDark
                  ? 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                  : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Submit / Stop Button */}
          {isLoading ? (
            <button
              type="button"
              onClick={onStopGeneration}
              title="Parar geração"
              className={`w-8 h-8 rounded-lg transition-all flex items-center justify-center flex-shrink-0 ${
                isDark ? 'bg-white text-black' : 'bg-neutral-900 text-white'
              }`}
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!hasContent}
              title="Enviar mensagem"
              className={`w-8 h-8 rounded-lg transition-all flex items-center justify-center flex-shrink-0 ${
                hasContent
                  ? isDark
                    ? 'bg-white text-black cursor-pointer'
                    : 'bg-neutral-900 text-white cursor-pointer'
                  : isDark
                    ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed'
                    : 'bg-neutral-100 text-neutral-300 cursor-not-allowed'
              }`}
            >
              <ArrowUp className="w-4 h-4 stroke-[2.5]" />
            </button>
          )}
        </form>

        <div className="text-center text-[10px] text-neutral-500 mt-1.5">
          ZENO pode apresentar imprecisões. Valide informações importantes.
        </div>
      </div>
    </div>
  );
});

ComposerInput.displayName = 'ComposerInput';
