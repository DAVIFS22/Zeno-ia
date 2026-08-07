import React, { useMemo, useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { 
  Copy, Check, Edit3, Volume2, VolumeX, ThumbsUp, ThumbsDown, RefreshCw, Sparkles, AlertCircle, ChevronUp, Layers,
  Globe, Share2, MoreHorizontal, ExternalLink, ChevronDown, Target, Terminal, BrainCircuit, Zap, Palette, Frown, Minimize2, Maximize2, AlertTriangle, HelpCircle, ShieldAlert
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message, ModelType } from '../types';
import { SourcesBottomSheet } from './SourcesBottomSheet';
import { SourcesCard, getUniqueSources } from './SourcesCard';
import { ZenoLogo } from './ZenoLogo';
import { ErrorBanner } from './ErrorBanner';
import { Countdown } from './Countdown';
import { YouTubeProcessor } from './YouTubeProcessor';
import { useTranslation } from '../i18n';
import { copyToClipboard } from '../utils/clipboard';

const INITIAL_PAGE_SIZE = 25;
const BATCH_SIZE = 25;

interface MessageItemProps {
  msg: Message;
  isLastMessage: boolean;
  theme: 'dark' | 'light';
  logoVariant: 'monochrome' | 'gradient';
  speed: ModelType;
  isLoadingLast: boolean;
  isCopied: boolean;
  isSpeaking: boolean;
  itemFeedback?: 'up' | 'down';
  isEditing: boolean;
  editingText: string;
  markdownComponents: any;
  onCopy: (id: string, text: string) => void;
  onToggleSpeech: (id: string, text: string) => void;
  onSetFeedback: (msgId: string, value: 'up' | 'down') => void;
  onRegenerate: () => void;
  onStartEditMessage: (id: string, text: string) => void;
  onCancelEditMessage: () => void;
  onSaveEditMessage: (id: string) => void;
  onEditingTextChange: (text: string) => void;
  onOpenSubscriptionModal?: () => void;
  userId: string | null;
  userToken: string | null;
  onYouTubeAction: (action: string, transcript: string, metadata: any) => void;
  onSendAdaptiveFeedback?: (msgId: string, type: 'up' | 'down', tags: string[], comment?: string) => void;
}

export const MessageItem = React.memo<MessageItemProps>(({
  msg,
  isLastMessage,
  theme,
  logoVariant,
  speed,
  isLoadingLast,
  isCopied,
  isSpeaking,
  itemFeedback,
  isEditing,
  editingText,
  markdownComponents,
  onCopy,
  onToggleSpeech,
  onSetFeedback,
  onRegenerate,
  onStartEditMessage,
  onCancelEditMessage,
  onSaveEditMessage,
  onEditingTextChange,
  onOpenSubscriptionModal,
  userId,
  userToken,
  onYouTubeAction,
  onSendAdaptiveFeedback
}) => {
  const { t } = useTranslation();
  const [showFeedbackTags, setShowFeedbackTags] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [showSourcesSheet, setShowSourcesSheet] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [sharedSuccess, setSharedSuccess] = useState(false);

  const uniqueSources = useMemo(() => 
    msg.searchSources ? getUniqueSources(msg.searchSources) : [], 
    [msg.searchSources]
  );

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Resposta do ZENO AI',
          text: msg.text,
        });
        return;
      } catch (e) {}
    }
    await copyToClipboard(msg.text);
    setSharedSuccess(true);
    setTimeout(() => setSharedSuccess(false), 2000);
  };

  const handleFeedbackClick = (type: 'up' | 'down') => {
    onSetFeedback(msg.id, type);
    setShowFeedbackTags(true);
    setSelectedTags([]);
    setFeedbackSubmitted(false);
  };

  const handleToggleTag = (tagId: string) => {
    if (selectedTags.includes(tagId)) {
      setSelectedTags(selectedTags.filter(t => t !== tagId));
    } else {
      setSelectedTags([...selectedTags, tagId]);
    }
  };

  const handleConfirmFeedback = () => {
    if (onSendAdaptiveFeedback && itemFeedback) {
      onSendAdaptiveFeedback(msg.id, itemFeedback, selectedTags);
    }
    setFeedbackSubmitted(true);
    setTimeout(() => {
      setShowFeedbackTags(false);
    }, 2500);
  };
  if (msg.role === 'user') {
    return (
      <div className="group flex w-full justify-end px-3 sm:px-4 py-2" style={{ contain: 'content' }}>
        <div className="flex flex-col items-end max-w-[90%] sm:max-w-[85%]">
          {isEditing ? (
            <div className={`w-full p-3 rounded-2xl border flex flex-col gap-2.5 ${
              theme === 'dark' ? 'bg-[#18181c] border-[#2C2C2E]' : 'bg-white border-neutral-300 shadow-md'
            }`}>
              <textarea
                value={editingText}
                onChange={(e) => onEditingTextChange(e.target.value)}
                rows={3}
                className={`w-full bg-transparent border-none focus:outline-none resize-none text-[15px] leading-relaxed ${
                  theme === 'dark' ? 'text-white' : 'text-neutral-900'
                }`}
                autoFocus
              />
              <div className="flex justify-end gap-2 pt-1 border-t border-[#2C2C2E]/30">
                <button
                  onClick={onCancelEditMessage}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-400 hover:text-neutral-200"
                >
                  {t.common.cancel}
                </button>
                <button
                  onClick={() => onSaveEditMessage(msg.id)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-neutral-200 hover:bg-white text-neutral-900 shadow-xs"
                >
                  {t.common.save}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className={`px-4 sm:px-5 py-3 rounded-2xl rounded-tr-xs text-[15px] leading-relaxed break-words shadow-2xs ${
                theme === 'dark'
                  ? 'bg-[#1e1e24] text-neutral-100 border border-[#2C2C2E]'
                  : 'bg-[#f2f2f5] text-neutral-900 border border-neutral-200'
              }`}>
                {msg.text}
              </div>
              <div className="mt-1 mr-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                <button
                  onClick={() => onStartEditMessage(msg.id, msg.text)}
                  className={`p-1 rounded-md text-xs transition-colors ${
                    theme === 'dark' 
                      ? 'hover:bg-[#232326]/40 text-neutral-500 hover:text-neutral-300' 
                      : 'hover:bg-neutral-200 text-neutral-500 hover:text-neutral-800'
                  }`}
                  title="Editar mensagem"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onCopy(msg.id, msg.text)}
                  className={`p-1 rounded-md text-xs transition-colors ${
                    theme === 'dark' 
                      ? 'hover:bg-[#232326]/40 text-neutral-500 hover:text-neutral-300' 
                      : 'hover:bg-neutral-200 text-neutral-500 hover:text-neutral-800'
                  }`}
                  title="Copiar mensagem"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-sky-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Model response
  const activeSpeed = msg.modelSpeed || speed;
  const modelName = activeSpeed === 'think' ? 'ZENO Think' :
                    activeSpeed === 'search' ? 'ZENO Search' :
                    activeSpeed === 'vision' ? 'ZENO Vision' :
                    activeSpeed === 'code' ? 'ZENO Código' :
                    activeSpeed === 'fast' ? 'ZENO Flash' :
                    activeSpeed === 'mega' ? 'ZENO Mega' :
                    activeSpeed === 'image' ? 'ZENO Studio' :
                    activeSpeed === 'smart' ? 'ZENO Smart' :
                    activeSpeed === 'strategy' ? 'ZENO Estrategista' :
                    activeSpeed === 'summary' ? 'ZENO Sumário' :
                    'ZENO Flash';

  return (
    <div className="group flex flex-col w-full px-3 sm:px-4 py-6 border-b border-neutral-100/5 dark:border-white/5 last:border-b-0 animate-in fade-in slide-in-from-bottom-2 duration-500" style={{ contain: 'content' }}>
      {/* Avatar and Name Header */}
      <div className="flex items-center gap-3 mb-3.5">
        <div className="relative">
          <ZenoLogo size={28} variant={logoVariant} theme={theme} />
          {isLoadingLast && (
            <div className="absolute -top-1 -right-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
              </span>
            </div>
          )}
        </div>
        <div className="flex flex-col">
          <span className={`text-[14px] font-bold tracking-tight ${
            theme === 'dark' ? 'text-neutral-100' : 'text-neutral-900'
          }`}>
            {modelName}
          </span>
        </div>
      </div>

      {/* Message Content (Full Width) */}
      <div className="w-full max-w-full overflow-hidden">


          {msg.youtubeUrl && (
            <YouTubeProcessor 
              url={msg.youtubeUrl}
              userId={userId}
              userToken={userToken}
              onProcessed={(transcript) => {
                // We can inform the parent or just let it be.
                // For now, the transcript is inside the processor.
              }}
              onActionRequest={(action, transcript, metadata) => onYouTubeAction(action, transcript, metadata)}
            />
          )}

          {/* Error Banner or Streamed Text */}
          {msg.isLimitWarning ? (
            <div className={`mt-3 p-6 rounded-2xl border ${theme === 'dark' ? 'bg-[#1C1C1E] border-[#2C2C2E]' : 'bg-neutral-50 border-neutral-200'} shadow-sm`}>
              <div className="flex items-center gap-2 mb-3 text-sky-400">
                <ShieldAlert className="w-4 h-4" />
                <span className="font-semibold text-xs uppercase tracking-wider text-neutral-400">Limite Diário Atingido</span>
              </div>
              <p className={`text-sm mb-4 leading-relaxed ${theme === 'dark' ? 'text-neutral-300' : 'text-neutral-700'}`}>
                Você atingiu o limite diário do plano gratuito. Renovação automática em <Countdown />.
              </p>
              <div className="space-y-2 mb-5 text-xs text-neutral-400">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                  <span>Mensagens e buscas ilimitadas</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                  <span>Geração avançada de imagens e áudio</span>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-3 border-t border-neutral-800/50">
                <button
                  onClick={onOpenSubscriptionModal}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl font-medium bg-sky-600 text-white hover:bg-sky-500 transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <Sparkles className="w-4 h-4" />
                  Upgrade para o ZENO Pro
                </button>
                <div className={`text-xs font-medium text-neutral-500`}>
                  Sem compromisso, cancele quando quiser.
                </div>
              </div>
            </div>
          ) : msg.hasError ? (
            <ErrorBanner
              errorMessage={msg.errorMessage || msg.text}
              rawDetails={msg.rawErrorDetails}
              onRetry={onRegenerate}
              theme={theme}
            />
          ) : (
            <div className={`w-full max-w-none break-words text-[15px] sm:text-[16px] leading-[1.8] ${
              theme === 'dark' ? 'text-neutral-200' : 'text-neutral-800'
            }`}>
              {(!msg.text && isLoadingLast && msg.role === 'model') ? (
                /* Single Loading Container to avoid duplicates */
                <div className="py-2">
                   {msg.isToolCalling ? (
                     <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2 text-sky-500 text-sm font-semibold animate-pulse">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>{msg.toolName === 'createSupportTicket' ? 'Abrindo ticket de suporte...' : 'Executando ferramenta...'}</span>
                        </div>
                     </div>
                   ) : (msg.isSearching || msg.isSearch || msg.modelSpeed === 'search') ? (
                     <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2 text-sky-500 text-sm font-semibold animate-pulse">
                          <Globe className="w-4 h-4 animate-spin" />
                          <span>{msg.isSearching ? t.composer.speedSearch : t.composer.speedSearch}</span>
                        </div>
                        {uniqueSources.length > 0 && (
                          <div className="flex items-center gap-2 flex-wrap animate-in fade-in slide-in-from-left-2">
                            {uniqueSources.slice(0, 5).map((source, sIdx) => {
                              const d = source.domain || (() => { try { return new URL(source.url).hostname; } catch(e) { return 'web'; } })();
                              return (
                                <div key={sIdx} className={`inline-flex items-center gap-2 px-2 py-1 rounded-lg border text-[11px] font-medium ${
                                  theme === 'dark' ? 'bg-white/5 border-white/10 text-neutral-300' : 'bg-neutral-100 border-neutral-200 text-neutral-700'
                                }`}>
                                  <img src={`https://www.google.com/s2/favicons?domain=${d}&sz=32`} alt="" className="w-3.5 h-3.5 rounded-sm" />
                                  <span className="truncate max-w-[100px]">{source.title || d}</span>
                                </div>
                              );
                            })}
                            {uniqueSources.length > 5 && <span className="text-[10px] text-neutral-500">+{uniqueSources.length - 5} fontes</span>}
                          </div>
                        )}
                     </div>
                   ) : (
                     <div className="flex items-center gap-2.5 text-neutral-400 text-sm animate-pulse">
                        <Sparkles className="w-4 h-4 text-sky-400" />
                        <span className="font-medium">{t.common.loading}</span>
                     </div>
                   )}
                </div>
              ) : (
                <div className="markdown-body">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      ...markdownComponents,
                      p: ({ children }) => {
                        const parts = React.Children.toArray(children).flatMap(child => {
                          if (typeof child !== 'string') return child;
                          
                          const segments = [];
                          let lastIdx = 0;
                          const citeRegex = /\[\[cite:(\d+)\]\]/g;
                          let match;
                          
                          while ((match = citeRegex.exec(child)) !== null) {
                            if (match.index > lastIdx) {
                              segments.push(child.slice(lastIdx, match.index));
                            }
                            
                            const sourceIdx = parseInt(match[1]);
                            const source = msg.searchSources?.[sourceIdx];
                            
                            if (source) {
                              const domain = source.domain || (source.url ? new URL(source.url).hostname.replace(/^www\./, '') : 'web');
                              const shortName = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
                              
                              segments.push(
                                <a
                                  key={match.index}
                                  href={source.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 mx-0.5 rounded-full text-[11px] font-semibold border transition-all align-middle hover:scale-105 active:scale-95 ${
                                    theme === 'dark' 
                                    ? 'bg-[#1e1e24] border-[#2C2C2E] text-neutral-300 hover:bg-[#2C2C2E] hover:text-white' 
                                    : 'bg-neutral-100 border-neutral-200 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-800'
                                  }`}
                                >
                                  <img 
                                    src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
                                    alt=""
                                    className="w-3 h-3 rounded-full object-contain bg-white p-0.5"
                                    onError={(e) => (e.currentTarget.style.display = 'none')}
                                  />
                                  <span className="truncate max-w-[80px]">{shortName}</span>
                                  <span className="opacity-40 font-bold">·</span>
                                  <span className="opacity-70">{sourceIdx + 1}</span>
                                </a>
                              );
                            }
                            lastIdx = citeRegex.lastIndex;
                          }
                          
                          if (lastIdx < child.length) {
                            segments.push(child.slice(lastIdx));
                          }
                          
                          return segments;
                        });
                        
                        return <div className="mb-2 last:mb-0">{parts}</div>;
                      }
                    }}
                  >
                    {msg.text}
                  </ReactMarkdown>
                </div>
              )}

              {/* Discrete Source Citation Bar */}
              {msg.text && msg.isSearch && uniqueSources.length > 0 && (
                <SourcesCard 
                  sources={uniqueSources} 
                  theme={theme} 
                  onClick={() => setShowSourcesSheet(true)} 
                />
              )}
            </div>
          )}

          {/* Message Actions Footer */}
          {msg.role === 'model' && msg.text && !msg.hasError && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onCopy(msg.id, msg.text)}
                className={`p-1.5 rounded-lg transition-colors flex items-center justify-center text-xs ${
                  theme === 'dark' ? 'hover:bg-[#232326] text-neutral-400 hover:text-neutral-200' : 'hover:bg-neutral-200/70 text-neutral-600 hover:text-neutral-900'
                }`}
                title="Copiar resposta"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-sky-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={() => onToggleSpeech(msg.id, msg.text)}
                className={`p-1.5 rounded-lg transition-colors flex items-center justify-center text-xs ${
                  isSpeaking ? 'text-neutral-100 animate-pulse bg-[#232326]' : (
                    theme === 'dark' ? 'hover:bg-[#232326] text-neutral-400 hover:text-neutral-200' : 'hover:bg-neutral-200/70 text-neutral-600 hover:text-neutral-900'
                  )
                }`}
                title={isSpeaking ? "Parar áudio" : "Ouvir em Voz Alta"}
              >
                {isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={() => handleFeedbackClick('up')}
                className={`p-1.5 rounded-lg transition-colors flex items-center justify-center text-xs ${
                  itemFeedback === 'up' ? 'text-sky-400 bg-sky-500/15' : (
                    theme === 'dark' ? 'hover:bg-[#232326] text-neutral-400 hover:text-neutral-200' : 'hover:bg-neutral-200/70 text-neutral-600 hover:text-neutral-900'
                  )
                }`}
                title="Gostei"
              >
                <ThumbsUp className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => handleFeedbackClick('down')}
                className={`p-1.5 rounded-lg transition-colors flex items-center justify-center text-xs ${
                  itemFeedback === 'down' ? 'text-neutral-400 bg-neutral-500/10' : (
                    theme === 'dark' ? 'hover:bg-[#232326] text-neutral-400 hover:text-neutral-200' : 'hover:bg-neutral-200/70 text-neutral-600 hover:text-neutral-900'
                  )
                }`}
                title="Não gostei"
              >
                <ThumbsDown className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={handleShare}
                className={`p-1.5 rounded-lg transition-colors flex items-center justify-center text-xs ${
                  theme === 'dark' ? 'hover:bg-[#232326] text-neutral-400 hover:text-neutral-200' : 'hover:bg-neutral-200/70 text-neutral-600 hover:text-neutral-900'
                }`}
                title="Compartilhar"
              >
                {sharedSuccess ? <Check className="w-3.5 h-3.5 text-sky-400" /> : <Share2 className="w-3.5 h-3.5" />}
              </button>

              {/* More options dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowMoreMenu(!showMoreMenu)}
                  className={`p-1.5 rounded-lg transition-colors flex items-center justify-center text-xs ${
                    theme === 'dark' ? 'hover:bg-[#232326] text-neutral-400 hover:text-neutral-200' : 'hover:bg-neutral-200/70 text-neutral-600 hover:text-neutral-900'
                  }`}
                  title="Mais opções"
                >
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </button>

                {showMoreMenu && (
                  <div className={`absolute left-0 bottom-full mb-1 w-36 rounded-xl border shadow-lg py-1 z-30 ${
                    theme === 'dark' ? 'bg-[#1e1e24] border-[#2C2C2E] text-neutral-200' : 'bg-white border-neutral-200 text-neutral-800'
                  }`}>
                    <button
                      onClick={() => {
                        setShowMoreMenu(false);
                        onRegenerate();
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-500/10 flex items-center gap-2"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Regenerar
                    </button>
                    <button
                      onClick={() => {
                        setShowMoreMenu(false);
                        onCopy(msg.id, msg.text);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-500/10 flex items-center gap-2"
                    >
                      <Copy className="w-3 h-3" />
                      Copiar texto
                    </button>
                  </div>
                )}
              </div>

              {/* Fontes Button */}
              {uniqueSources.length > 0 && (
                <button
                  onClick={() => setShowSourcesSheet(!showSourcesSheet)}
                  className={`ml-auto sm:ml-1 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border ${
                    showSourcesSheet
                      ? (theme === 'dark' ? 'bg-sky-500/20 text-sky-300 border-sky-500/40' : 'bg-sky-50 text-sky-700 border-sky-200')
                      : (theme === 'dark' ? 'bg-[#232326]/60 hover:bg-[#232326] text-neutral-300 border-[#2C2C2E]/50' : 'bg-neutral-100 hover:bg-neutral-200/80 text-neutral-700 border-neutral-300/60')
                  }`}
                  title="Ver fontes de pesquisa"
                >
                  <Globe className="w-3.5 h-3.5 text-sky-400" />
                  <span>Fontes ({uniqueSources.length})</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${showSourcesSheet ? 'rotate-180' : ''}`} />
                </button>
              )}

              {isLastMessage && !isLoadingLast && (!msg.searchSources || msg.searchSources.length === 0) && (
                <button
                  onClick={onRegenerate}
                  className={`ml-1 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    theme === 'dark' ? 'hover:bg-[#232326] text-neutral-400 hover:text-neutral-200' : 'hover:bg-neutral-200/70 text-neutral-600 hover:text-neutral-900'
                  }`}
                  title="Regenerar resposta"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Regenerar</span>
                </button>
              )}
            </div>
          )}

          <SourcesBottomSheet
            isOpen={showSourcesSheet}
            onClose={() => setShowSourcesSheet(false)}
            sources={uniqueSources}
            theme={theme}
          />

          {/* Interactive Adaptive Feedback Tag Bar */}
          {showFeedbackTags && itemFeedback && (
            <div className={`mt-2.5 p-3 rounded-xl border animate-fadeIn w-full ${
              theme === 'dark' ? 'bg-[#1C1C1E]/90 border-[#2C2C2E]/80 text-neutral-200' : 'bg-neutral-100 border-neutral-200 text-neutral-800'
            }`}>
              {feedbackSubmitted ? (
                <div className="flex items-center gap-2 text-xs font-bold text-sky-400 py-1">
                  <Sparkles className="w-4 h-4 text-sky-400 animate-pulse" />
                  <span>Feedback registrado! ZENO atualizou seu perfil de aprendizado adaptativo.</span>
                </div>
              ) : (
                <div>
                  <div className="text-[11px] font-bold text-neutral-400 mb-2 flex items-center justify-between">
                    <span className={`flex items-center gap-1.5 ${theme === 'dark' ? 'text-[#F5F5F5]' : 'text-neutral-800'}`}>
                      <Sparkles className="w-3.5 h-3.5 text-[#4A9EFF]" />
                      Como o ZENO pode adaptar esta resposta?
                    </span>
                    <button 
                      onClick={() => setShowFeedbackTags(false)} 
                      className="text-neutral-500 hover:text-neutral-300 text-xs px-1"
                    >
                      X
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {(itemFeedback === 'up' ? [
                      { id: 'precisao_perfeita', label: 'Precisão Perfeita', icon: Target },
                      { id: 'excelente_codigo', label: 'Excelente Código', icon: Terminal },
                      { id: 'nivel_exato', label: 'Nível Exato', icon: BrainCircuit },
                      { id: 'direto_ao_ponto', label: 'Direto ao Ponto', icon: Zap },
                      { id: 'muito_criativo', label: 'Muito Criativo', icon: Palette }
                    ] : [
                      { id: 'muito_complexo', label: 'Muito Complexo', icon: Minimize2 },
                      { id: 'muito_simples', label: 'Muito Simples', icon: Maximize2 },
                      { id: 'muito_longo', label: 'Longo Demais', icon: Frown },
                      { id: 'faltou_exemplo', label: 'Faltou Exemplo', icon: HelpCircle },
                      { id: 'impreciso', label: 'Impreciso', icon: AlertTriangle }
                    ]).map(tag => {
                      const isSel = selectedTags.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          onClick={() => handleToggleTag(tag.id)}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                            isSel 
                              ? 'bg-sky-500/10 border-[#4A9EFF] text-sky-400 font-bold' 
                              : `${theme === 'dark' ? 'bg-[#232326] border-[#2C2C2E] text-neutral-300 hover:bg-[#232326]' : 'bg-white border-neutral-300 text-neutral-700'}`
                          }`}
                        >
                          {tag.icon && <tag.icon className="w-3.5 h-3.5" />}
                          {tag.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={handleConfirmFeedback}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#4A9EFF] text-[#F5F5F5] hover:bg-sky-400 transition-colors flex items-center gap-1.5 shadow-md shadow-sky-500/10"
                    >
                      <Check className="w-3.5 h-3.5 text-[#F5F5F5]" />
                      <span>Enviar & Adaptar ZENO</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.msg.id === nextProps.msg.id &&
    prevProps.msg.text === nextProps.msg.text &&
    prevProps.msg.role === nextProps.msg.role &&
    prevProps.msg.hasError === nextProps.msg.hasError &&
    prevProps.msg.errorMessage === nextProps.msg.errorMessage &&
    prevProps.msg.isLimitWarning === nextProps.msg.isLimitWarning &&
    prevProps.msg.modelSpeed === nextProps.msg.modelSpeed &&
    prevProps.isLastMessage === nextProps.isLastMessage &&
    prevProps.theme === nextProps.theme &&
    prevProps.logoVariant === nextProps.logoVariant &&
    prevProps.speed === nextProps.speed &&
    prevProps.isLoadingLast === nextProps.isLoadingLast &&
    prevProps.isCopied === nextProps.isCopied &&
    prevProps.isSpeaking === nextProps.isSpeaking &&
    prevProps.itemFeedback === nextProps.itemFeedback &&
    prevProps.isEditing === nextProps.isEditing &&
    prevProps.editingText === nextProps.editingText &&
    prevProps.markdownComponents === nextProps.markdownComponents &&
    prevProps.userId === nextProps.userId &&
    prevProps.userToken === nextProps.userToken &&
    prevProps.msg.youtubeUrl === nextProps.msg.youtubeUrl
  );
});

MessageItem.displayName = 'MessageItem';

interface MessageListProps {
  messages: Message[];
  theme: 'dark' | 'light';
  logoVariant: 'monochrome' | 'gradient';
  speed: ModelType;
  isLoading: boolean;
  copiedId: string | null;
  speakingMessageId: string | null;
  feedback: Record<string, 'up' | 'down'>;
  editingMessageId: string | null;
  editingMessageText: string;
  markdownComponents: any;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onCopy: (id: string, text: string) => void;
  onToggleSpeech: (id: string, text: string) => void;
  onSetFeedback: (msgId: string, value: 'up' | 'down') => void;
  onRegenerate: () => void;
  onStartEditMessage: (id: string, text: string) => void;
  onCancelEditMessage: () => void;
  onSaveEditMessage: (id: string) => void;
  onEditingTextChange: (text: string) => void;
  onOpenSubscriptionModal?: () => void;
  userId: string | null;
  userToken: string | null;
  onYouTubeAction: (action: string, transcript: string, metadata: any) => void;
  onSendAdaptiveFeedback?: (msgId: string, type: 'up' | 'down', tags: string[], comment?: string) => void;
}

export const MessageList = React.memo<MessageListProps>(({
  messages,
  theme,
  logoVariant,
  speed,
  isLoading,
  copiedId,
  speakingMessageId,
  feedback,
  editingMessageId,
  editingMessageText,
  markdownComponents,
  messagesEndRef,
  onCopy,
  onToggleSpeech,
  onSetFeedback,
  onRegenerate,
  onStartEditMessage,
  onCancelEditMessage,
  onSaveEditMessage,
  onEditingTextChange,
  onOpenSubscriptionModal,
  userId,
  userToken,
  onYouTubeAction,
  onSendAdaptiveFeedback
}) => {
  const [visibleLimit, setVisibleLimit] = useState<number>(INITIAL_PAGE_SIZE);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const prevScrollHeightRef = useRef<number | null>(null);
  const prevFirstMsgIdRef = useRef<string | null>(null);

  // Filter welcome message when there are actual messages
  const visibleMessages = useMemo(() => {
    return messages.filter(msg => !(msg.id.startsWith('welcome') && messages.length === 1));
  }, [messages]);

  const firstMsgId = visibleMessages[0]?.id || null;

  // Reset pagination limit when chat session switches or message set is replaced
  useEffect(() => {
    if (prevFirstMsgIdRef.current !== firstMsgId) {
      prevFirstMsgIdRef.current = firstMsgId;
      setVisibleLimit(INITIAL_PAGE_SIZE);
    }
  }, [firstMsgId]);

  // Keep latest messages visible when new messages arrive
  const prevTotalCountRef = useRef(visibleMessages.length);
  useEffect(() => {
    if (visibleMessages.length > prevTotalCountRef.current) {
      const addedCount = visibleMessages.length - prevTotalCountRef.current;
      // If messages were added at the end, expand visibleLimit so the new message is visible
      setVisibleLimit(prev => Math.max(prev + addedCount, INITIAL_PAGE_SIZE));
    }
    prevTotalCountRef.current = visibleMessages.length;
  }, [visibleMessages.length]);

  const hasMore = visibleMessages.length > visibleLimit;
  const remainingCount = visibleMessages.length - visibleLimit;

  const slicedMessages = useMemo(() => {
    return visibleMessages.slice(-visibleLimit);
  }, [visibleMessages, visibleLimit]);

  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const scrollParent = container.closest('.overflow-y-auto');
    if (!scrollParent) return;

    const handleScroll = () => {
      setScrollTop((scrollParent as HTMLElement).scrollTop);
    };

    scrollParent.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => {
      scrollParent.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Windowing calculation
  const ITEM_ESTIMATED_HEIGHT = 160;
  const OVERSCAN = 10;

  const windowedData = useMemo(() => {
    if (slicedMessages.length <= 40) {
      return {
        items: slicedMessages,
        startIndex: 0,
        topSpacerHeight: 0,
        bottomSpacerHeight: 0
      };
    }

    const containerHeight = containerRef.current?.closest('.overflow-y-auto')?.clientHeight || 600;
    const estimatedStartIndex = Math.floor(scrollTop / ITEM_ESTIMATED_HEIGHT);
    const startIndex = Math.max(0, estimatedStartIndex - OVERSCAN);
    const visibleCount = Math.ceil(containerHeight / ITEM_ESTIMATED_HEIGHT) + (2 * OVERSCAN);
    const endIndex = Math.min(slicedMessages.length, startIndex + visibleCount);

    const items = slicedMessages.slice(startIndex, endIndex);
    const topSpacerHeight = startIndex * ITEM_ESTIMATED_HEIGHT;
    const bottomSpacerHeight = (slicedMessages.length - endIndex) * ITEM_ESTIMATED_HEIGHT;

    return {
      items,
      startIndex,
      topSpacerHeight,
      bottomSpacerHeight
    };
  }, [slicedMessages, scrollTop]);

  const handleLoadMore = useCallback(() => {
    if (!hasMore) return;
    // Capture parent scroll container height before prepending older messages
    if (containerRef.current) {
      const scrollParent = containerRef.current.closest('.overflow-y-auto');
      if (scrollParent) {
        prevScrollHeightRef.current = scrollParent.scrollHeight;
      }
    }
    setVisibleLimit(prev => prev + BATCH_SIZE);
  }, [hasMore]);

  const handleLoadAll = useCallback(() => {
    if (containerRef.current) {
      const scrollParent = containerRef.current.closest('.overflow-y-auto');
      if (scrollParent) {
        prevScrollHeightRef.current = scrollParent.scrollHeight;
      }
    }
    setVisibleLimit(visibleMessages.length);
  }, [visibleMessages.length]);

  // Preserve scroll position when older messages are loaded above current view
  useLayoutEffect(() => {
    if (prevScrollHeightRef.current !== null && containerRef.current) {
      const scrollParent = containerRef.current.closest('.overflow-y-auto') as HTMLElement | null;
      if (scrollParent) {
        const delta = scrollParent.scrollHeight - prevScrollHeightRef.current;
        if (delta > 0) {
          scrollParent.scrollTop += delta;
        }
      }
      prevScrollHeightRef.current = null;
    }
  }, [slicedMessages.length]);

  // Lazy loading observer when user scrolls up to the top sentinel
  useEffect(() => {
    if (!hasMore) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry && entry.isIntersecting) {
          handleLoadMore();
        }
      },
      {
        root: sentinel.closest('.overflow-y-auto') || null,
        rootMargin: '100px 0px 0px 0px', // trigger 100px before reaching top
        threshold: 0.1
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, handleLoadMore]);

  if (visibleMessages.length === 0) return null;

  return (
    <div ref={containerRef} className="w-full flex flex-col space-y-8 gpu-accelerated" style={{ contain: 'content' }}>
      {/* Sentinel & Pagination Controls */}
      {hasMore && (
        <div className="flex flex-col items-center gap-2 my-2 transition-all">
          <div ref={sentinelRef} className="h-1 w-full" />
          
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <button
              onClick={handleLoadMore}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-2xs flex items-center gap-2 ${
                theme === 'dark' 
                  ? 'bg-[#1e1e24] hover:bg-[#232326] text-neutral-300 border border-[#2C2C2E]' 
                  : 'bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200 shadow-2xs'
              }`}
            >
              <ChevronUp className="w-3.5 h-3.5 text-neutral-500" />
              <span>Carregar {Math.min(BATCH_SIZE, remainingCount)} mensagens anteriores ({remainingCount} restantes)</span>
            </button>

            {remainingCount > BATCH_SIZE && (
              <button
                onClick={handleLoadAll}
                className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                  theme === 'dark'
                    ? 'hover:bg-[#232326] text-neutral-400 hover:text-neutral-200'
                    : 'hover:bg-neutral-200 text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Carregar todas ({visibleMessages.length})
              </button>
            )}
          </div>

          <div className={`text-[11px] font-medium flex items-center gap-1.5 opacity-60 ${
            theme === 'dark' ? 'text-neutral-400' : 'text-neutral-500'
          }`}>
            <Layers className="w-3 h-3" />
            <span>Exibindo {slicedMessages.length} de {visibleMessages.length} mensagens no histórico</span>
          </div>
        </div>
      )}

      {windowedData.topSpacerHeight > 0 && (
        <div style={{ height: windowedData.topSpacerHeight }} aria-hidden="true" />
      )}

      {windowedData.items.map((msg, idx) => {
        const absoluteIndex = windowedData.startIndex + idx;
        const isLastMessage = absoluteIndex === slicedMessages.length - 1;
        return (
          <MessageItem
            key={msg.id}
            msg={msg}
            isLastMessage={isLastMessage}
            theme={theme}
            logoVariant={logoVariant}
            speed={speed}
            isLoadingLast={isLastMessage ? isLoading : false}
            isCopied={copiedId === msg.id}
            isSpeaking={speakingMessageId === msg.id}
            itemFeedback={feedback[msg.id]}
            isEditing={editingMessageId === msg.id}
            editingText={editingMessageId === msg.id ? editingMessageText : ''}
            markdownComponents={markdownComponents}
            onCopy={onCopy}
            onToggleSpeech={onToggleSpeech}
            onSetFeedback={onSetFeedback}
            onRegenerate={onRegenerate}
            onStartEditMessage={onStartEditMessage}
            onCancelEditMessage={onCancelEditMessage}
            onSaveEditMessage={onSaveEditMessage}
            onEditingTextChange={onEditingTextChange}
            onOpenSubscriptionModal={onOpenSubscriptionModal}
            userId={userId}
            userToken={userToken}
            onYouTubeAction={onYouTubeAction}
            onSendAdaptiveFeedback={onSendAdaptiveFeedback}
          />
        );
      })}

      {windowedData.bottomSpacerHeight > 0 && (
        <div style={{ height: windowedData.bottomSpacerHeight }} aria-hidden="true" />
      )}

      <div ref={messagesEndRef} className="h-2" />
    </div>
  );
});

MessageList.displayName = 'MessageList';
