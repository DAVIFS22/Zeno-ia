import { motion, AnimatePresence } from "motion/react";
import React, { useMemo, useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import { 
  Copy, Check, Edit3, Volume2, VolumeX, ThumbsUp, ThumbsDown, RefreshCw, Sparkles, AlertCircle, ChevronUp, Layers,
  Globe, Share2, MoreHorizontal, ExternalLink, ChevronDown, Target, Terminal, BrainCircuit, Zap, Palette, Frown, Minimize2, Maximize2, AlertTriangle, HelpCircle, ShieldAlert,
  FileText, FileCode, Image as ImageIcon, Loader2
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message, ModelType } from '../types';
import { SourcesBottomSheet } from './SourcesBottomSheet';
import { SourcesCard, getUniqueSources } from './SourcesCard';
import { ErrorBanner } from './ErrorBanner';
import { Countdown } from './Countdown';
import { ThinkingIndicator } from './ThinkingIndicator';
import { YouTubeProcessor } from './YouTubeProcessor';
import { useTranslation } from '../i18n';
import { copyToClipboard } from '../utils/clipboard';

const StreamingProgress = ({ theme }: { theme: 'dark' | 'light' }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // faux progress simulation over ~10 seconds
    const interval = setInterval(() => {
      setProgress(p => {
        if (p < 40) return p + 3;
        if (p < 75) return p + 1.5;
        if (p < 95) return p + 0.5;
        return p;
      });
    }, 150);
    return () => clearInterval(interval);
  }, []);

  const estimatedTotal = 15; // 15 seconds estimated baseline
  const elapsed = (progress / 100) * estimatedTotal;
  const timeLeft = Math.max(1, Math.ceil(estimatedTotal - elapsed));

  return (
    <div className="mt-4 flex flex-col gap-1.5 animate-in fade-in duration-300 select-none">
       <div className="flex justify-between items-center text-[10px] uppercase tracking-widest font-semibold text-zeno/80">
         <span className="flex items-center gap-1.5">
           <BrainCircuit className="w-3 h-3 animate-pulse" /> 
           Processando resposta
         </span>
         <span>~ {timeLeft}s restantes</span>
       </div>
       <div className={`w-full h-1 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-[#2C2C2E]' : 'bg-neutral-200'}`}>
         <div 
           className="h-full bg-zeno rounded-full transition-all duration-300 ease-out" 
           style={{ width: `${progress}%` }} 
         />
       </div>
    </div>
  );
};

const MessageStatus = ({ status, theme, isLocked }: { status?: 'syncing' | 'sent' | 'error', theme: 'dark' | 'light', isLocked?: boolean }) => {
  if (!status) return null;

  const configMap = {
    syncing: { 
      icon: RefreshCw, 
      text: isLocked ? 'Gerando' : 'Sincronizando', 
      color: isLocked ? 'text-zeno' : 'text-neutral-500', 
      spin: true 
    },
    sent: { icon: Check, text: 'Enviado', color: 'text-zeno', spin: false },
    error: { icon: AlertCircle, text: 'Erro', color: 'text-rose-500', spin: false },
  };

  const config = configMap[status];
  if (!config) return null;

  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-1 text-[10px] font-semibold ${config.color} mt-1.5 mr-1 select-none`}>
      <Icon className={`w-3 h-3 ${config.spin ? 'animate-spin' : ''}`} strokeWidth={2.5} />
      <span className="uppercase tracking-wider opacity-80">{config.text}</span>
    </div>
  );
};

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
  const { t } = useTranslation('MessageList');
  const [showFeedbackTags, setShowFeedbackTags] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [showSourcesSheet, setShowSourcesSheet] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showFeedbackMenu, setShowFeedbackMenu] = useState(false);
  const [sharedSuccess, setSharedSuccess] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const [moreCoords, setMoreCoords] = useState<{ top: number; left: number } | null>(null);

  const feedbackButtonRef = useRef<HTMLButtonElement>(null);
  const feedbackMenuRef = useRef<HTMLDivElement>(null);
  const [feedbackCoords, setFeedbackCoords] = useState<{ top: number; left: number } | null>(null);

  const parseCitations = useCallback((children: React.ReactNode) => {
    return React.Children.toArray(children).flatMap(child => {
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
          let domain = source.domain || 'web';
          if (!source.domain && source.url) {
            try {
              domain = new URL(source.url).hostname.replace(/^www\./, '');
            } catch (e) {
              domain = 'web';
            }
          }
          const shortName = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
          
          segments.push(
            <a
              key={`${msg.id}-cite-${match.index}`}
              href={source.url || '#'}
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
  }, [msg.id, msg.searchSources, theme]);

  const handleToggleMoreMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!showMoreMenu && moreButtonRef.current) {
      const rect = moreButtonRef.current.getBoundingClientRect();
      setMoreCoords({
        top: rect.top - 4,
        left: rect.left
      });
    }
    setShowMoreMenu(!showMoreMenu);
  };

  const handleToggleFeedbackMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!showFeedbackMenu && feedbackButtonRef.current) {
      const rect = feedbackButtonRef.current.getBoundingClientRect();
      setFeedbackCoords({
        top: rect.top - 4,
        left: rect.left
      });
    }
    setShowFeedbackMenu(!showFeedbackMenu);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        moreMenuRef.current && 
        !moreMenuRef.current.contains(e.target as Node) &&
        moreButtonRef.current &&
        !moreButtonRef.current.contains(e.target as Node)
      ) {
        setShowMoreMenu(false);
      }
      if (
        feedbackMenuRef.current && 
        !feedbackMenuRef.current.contains(e.target as Node) &&
        feedbackButtonRef.current &&
        !feedbackButtonRef.current.contains(e.target as Node)
      ) {
        setShowFeedbackMenu(false);
      }
    };
    if (showMoreMenu || showFeedbackMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('resize', () => { setShowMoreMenu(false); setShowFeedbackMenu(false); });
      window.addEventListener('scroll', () => { setShowMoreMenu(false); setShowFeedbackMenu(false); }, true);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', () => { setShowMoreMenu(false); setShowFeedbackMenu(false); });
      window.removeEventListener('scroll', () => { setShowMoreMenu(false); setShowFeedbackMenu(false); }, true);
    };
  }, [showMoreMenu, showFeedbackMenu]);

  const uniqueSources = useMemo(() => 
    msg.searchSources ? getUniqueSources(msg.searchSources) : [], 
    [msg.searchSources]
  );

  const handleShare = async () => {
    setIsSharing(true);
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Resposta do ZENO AI',
          text: msg.text,
        });
        setIsSharing(false);
        setSharedSuccess(true);
        setTimeout(() => setSharedSuccess(false), 2000);
        return;
      } catch (e) {
        // user cancelled or share failed, fallback to copy
      }
    }
    await copyToClipboard(msg.text);
    setIsSharing(false);
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
      <motion.div initial={{ opacity: 0, scale: 0.95, originX: 1 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 20 }} className="group flex w-full justify-end px-3 sm:px-4 py-2" style={{ contain: 'content' }}>
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
              <div className="flex flex-col items-end gap-2">
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 justify-end">
                    {msg.attachments.map((att) => {
                      const isImg = att.type === 'image' || 
                                    (att.url && att.url.startsWith('data:image/')) || 
                                    (att.name && !!att.name.match(/\.(png|jpe?g|webp|gif|heic|bmp|svg)$/i));

                      return (
                        <div key={att.id} className="relative group max-w-[200px]">
                          {isImg && att.url ? (
                            <div className="relative rounded-xl overflow-hidden border border-neutral-700/30 shadow-sm transition-transform hover:scale-[1.02]">
                               <img 
                                 src={att.url} 
                                 alt={att.name} 
                                 className="max-h-48 w-auto object-contain bg-neutral-800"
                                 onError={(e) => {
                                   // Fallback if image load fails
                                   (e.currentTarget as HTMLElement).style.display = 'none';
                                 }}
                               />
                               <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                 <ImageIcon className="w-5 h-5 text-white" />
                               </div>
                            </div>
                          ) : (
                            <div className={`p-2 rounded-xl border flex items-center gap-2 text-xs font-medium transition-colors ${
                              theme === 'dark' 
                                ? 'bg-[#232326] border-[#2C2C2E] text-neutral-300 hover:border-neutral-500' 
                                : 'bg-white border-neutral-200 text-neutral-700 hover:border-neutral-400 shadow-sm'
                            }`}>
                              <div className={`p-1.5 rounded-lg ${theme === 'dark' ? 'bg-zeno/20 text-zeno' : 'bg-zeno/10 text-zeno'}`}>
                                {att.type === 'document' ? <FileText className="w-3.5 h-3.5" /> : <FileCode className="w-3.5 h-3.5" />}
                              </div>
                              <span className="truncate max-w-[120px]">{att.name}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className={`px-4 sm:px-5 py-3 rounded-2xl rounded-tr-xs text-[15px] leading-relaxed break-words shadow-2xs ${
                  theme === 'dark'
                    ? 'bg-[#1e1e24] text-neutral-100 border border-[#2C2C2E]'
                    : 'bg-[#f2f2f5] text-neutral-900 border border-neutral-200'
                }`}>
                  {msg.text}
                </div>
                <MessageStatus status={msg.syncStatus} theme={theme} isLocked={msg.isLocked} />
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
                  {isCopied ? <Check className="w-3.5 h-3.5 text-zeno" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 260, damping: 20 }} className="group flex flex-col w-full px-3 sm:px-4 py-6 border-b border-neutral-100/5 dark:border-white/5 last:border-b-0" style={{ contain: 'content' }}>
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
              <div className="flex items-center gap-2 mb-3 text-zeno">
                <ShieldAlert className="w-4 h-4" />
                <span className="font-semibold text-xs uppercase tracking-wider text-neutral-400">Limite Diário Atingido</span>
              </div>
              <p className={`text-sm mb-4 leading-relaxed ${theme === 'dark' ? 'text-neutral-300' : 'text-neutral-700'}`}>
                Você atingiu o limite diário do plano gratuito. Renovação automática em <Countdown />.
              </p>
              <div className="space-y-2 mb-5 text-xs text-neutral-400">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-zeno" />
                  <span>Mensagens e buscas ilimitadas</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-zeno" />
                  <span>Geração avançada de imagens e áudio</span>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-3 border-t border-neutral-800/50">
                <button
                  onClick={onOpenSubscriptionModal}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl font-medium bg-zeno text-white hover:bg-zeno transition-colors flex items-center justify-center gap-2 text-sm"
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
                        <div className="flex items-center gap-2 text-zeno text-sm font-semibold animate-pulse">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>{msg.toolName === 'createSupportTicket' ? 'Abrindo ticket de suporte...' : 'Executando ferramenta...'}</span>
                        </div>
                     </div>
                   ) : (msg.isSearching || msg.isSearch || msg.modelSpeed === 'search') ? (
                     <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2 text-zeno text-sm font-semibold animate-pulse">
                          <Globe className="w-4 h-4 animate-spin" />
                          <span>{msg.isSearching ? t.composer.speedSearch : t.composer.speedSearch}</span>
                        </div>
                        {uniqueSources.length > 0 && (
                          <div className="flex items-center gap-2 flex-wrap animate-in fade-in slide-in-from-left-2">
                            {uniqueSources.slice(0, 5).map((source, sIdx) => {
                              let d = source.domain || 'web';
                              if (!source.domain && source.url) {
                                try {
                                  d = new URL(source.url).hostname.replace(/^www\./, '');
                                } catch (e) {
                                  d = 'web';
                                }
                              }
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
                        <Sparkles className="w-4 h-4 text-zeno" />
                        <span className="font-medium">{t.common.loading}</span>
                     </div>
                   )}
                </div>
              ) : (
                <div className="space-y-3">
                  {msg.thought && (
                    <details className={`group p-3 rounded-xl border text-xs ${theme === 'dark' ? 'bg-[#1C1C1E]/60 border-[#2C2C2E] text-neutral-300' : 'bg-neutral-50 border-neutral-200 text-neutral-700'}`}>
                      <summary className="flex items-center gap-2 cursor-pointer font-medium text-zeno select-none">
                        <BrainCircuit className="w-4 h-4" />
                        <span>Processo de Pensamento (Raciocínio Avançado)</span>
                      </summary>
                      <div className={`mt-2.5 pt-2.5 border-t whitespace-pre-wrap font-mono text-[11px] leading-relaxed ${theme === 'dark' ? 'border-[#2C2C2E] text-neutral-400' : 'border-neutral-200 text-neutral-600'}`}>
                        {msg.thought}
                      </div>
                    </details>
                  )}
                  <div className="markdown-body">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        ...markdownComponents,
                        p: ({ children }) => <div className="mb-4 last:mb-0 leading-relaxed">{parseCitations(children)}</div>,
                        li: ({ children }) => <li className="mb-2 last:mb-0 leading-relaxed">{parseCitations(children)}</li>,
                        span: ({ children }) => <span>{parseCitations(children)}</span>,
                        td: ({ children }) => <td className="p-2 border border-neutral-700/30">{parseCitations(children)}</td>
                      }}
                    >
                      {msg.text}
                    </ReactMarkdown>
                    {isLoadingLast && isLastMessage && msg.role === 'model' && (
                      <motion.span
                        animate={{ opacity: [1, 0.2, 1] }}
                        transition={{ repeat: Infinity, duration: 0.8, ease: "easeInOut" }}
                        className="inline-block w-2 h-4 bg-zeno ml-1 rounded-sm align-middle shadow-[0_0_8px_rgba(0,132,223,0.7)]"
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Streaming Progress Bar */}
              {isLoadingLast && msg.role === 'model' && (
                <>
                  <ThinkingIndicator theme={theme} isVisible={!msg.text} thoughtContent={msg.thought} />
                  {msg.text && <StreamingProgress theme={theme} />}
                </>
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
            <div className="mt-3 flex flex-wrap items-center gap-2 opacity-90 group-hover:opacity-100 transition-opacity">
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => onCopy(msg.id, msg.text)}
                className={`p-1.5 rounded-lg transition-colors flex items-center justify-center text-xs ${
                  isCopied ? 'bg-zeno/10 text-zeno' : (
                    theme === 'dark' ? 'hover:bg-[#232326] text-neutral-400 hover:text-neutral-200' : 'hover:bg-neutral-200/70 text-neutral-600 hover:text-neutral-900'
                  )
                }`}
                title="Copiar resposta"
              >
                <AnimatePresence mode="wait" initial={false}>
                  {isCopied ? (
                    <motion.div
                      key="check"
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      exit={{ scale: 0, rotate: 180 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                    >
                      <Check className="w-4 h-4 text-zeno" strokeWidth={2} />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="copy"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <Copy className="w-4 h-4" strokeWidth={1.5} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>

              <div className="relative">
                <motion.button
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  ref={feedbackButtonRef}
                  onClick={handleToggleFeedbackMenu}
                  className={`p-1.5 rounded-lg transition-colors flex items-center justify-center text-xs ${
                    itemFeedback === 'up' ? 'text-zeno bg-zeno/15' : 
                    itemFeedback === 'down' ? 'text-rose-500 bg-rose-500/15' : (
                      theme === 'dark' ? 'hover:bg-[#232326] text-neutral-400 hover:text-neutral-200' : 'hover:bg-neutral-200/70 text-neutral-600 hover:text-neutral-900'
                    )
                  }`}
                  title="Avaliar resposta"
                >
                  <motion.div 
                    className="flex items-center -space-x-1"
                    animate={itemFeedback ? { scale: [1, 1.25, 1] } : { scale: 1 }}
                    transition={{ duration: 0.3, type: 'tween', ease: 'easeInOut' }}
                  >
                    <ThumbsUp className={`w-3.5 h-3.5 ${itemFeedback === 'up' ? 'text-zeno' : 'text-neutral-400'}`} strokeWidth={1.5} />
                    <ThumbsDown className={`w-3.5 h-3.5 ${itemFeedback === 'down' ? 'text-rose-500' : 'text-neutral-400'}`} strokeWidth={1.5} />
                  </motion.div>
                </motion.button>

                {showFeedbackMenu && feedbackCoords && createPortal(
                  <div 
                    ref={feedbackMenuRef}
                    style={{
                      position: 'fixed',
                      top: `${feedbackCoords.top}px`,
                      left: `${feedbackCoords.left}px`,
                      transform: 'translateY(-100%)',
                      zIndex: 999999
                    }}
                    className={`w-40 rounded-xl border shadow-2xl py-1 animate-fadeIn ${
                      theme === 'dark' ? 'bg-[#1e1e24] border-[#2C2C2E] text-neutral-200' : 'bg-white border-neutral-200 text-neutral-800'
                    }`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => {
                        setShowFeedbackMenu(false);
                        handleFeedbackClick('up');
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-neutral-500/10 flex items-center gap-2 transition-transform active:scale-95"
                    >
                      <ThumbsUp className={`w-3.5 h-3.5 ${itemFeedback === 'up' ? 'text-zeno' : 'text-neutral-400'}`} strokeWidth={2} />
                      <span className={itemFeedback === 'up' ? 'font-semibold text-zeno' : ''}>Boa resposta</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowFeedbackMenu(false);
                        handleFeedbackClick('down');
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-neutral-500/10 flex items-center gap-2 transition-transform active:scale-95"
                    >
                      <ThumbsDown className={`w-3.5 h-3.5 ${itemFeedback === 'down' ? 'text-rose-500' : 'text-neutral-400'}`} strokeWidth={2} />
                      <span className={itemFeedback === 'down' ? 'font-semibold text-rose-500' : ''}>Resposta ruim</span>
                    </button>
                  </div>,
                  document.body
                )}
              </div>

              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={handleShare}
                disabled={isSharing}
                className={`p-1.5 rounded-lg transition-colors flex items-center justify-center text-xs ${
                  sharedSuccess ? 'bg-zeno/10 text-zeno' : (
                    theme === 'dark' ? 'hover:bg-[#232326] text-neutral-400 hover:text-neutral-200' : 'hover:bg-neutral-200/70 text-neutral-600 hover:text-neutral-900'
                  )
                }`}
                title="Compartilhar"
              >
                <AnimatePresence mode="wait" initial={false}>
                  {isSharing ? (
                    <motion.div
                      key="sharing"
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.5 }}
                    >
                      <Loader2 className="w-4 h-4 animate-spin text-zeno" strokeWidth={2} />
                    </motion.div>
                  ) : sharedSuccess ? (
                    <motion.div
                      key="shared"
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      exit={{ scale: 0, rotate: 180 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                    >
                      <Check className="w-4 h-4 text-zeno" strokeWidth={2} />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="share"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                    >
                      <Share2 className="w-4 h-4" strokeWidth={1.5} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>

              {isLastMessage && !isLoadingLast && (
                <motion.button
                  whileHover={{ scale: 1.08, rotate: 360 }}
                  whileTap={{ scale: 0.92 }}
                  transition={{ duration: 0.6, ease: "easeInOut" }}
                  onClick={onRegenerate}
                  className={`p-1.5 rounded-lg transition-colors flex items-center justify-center text-xs ${
                    theme === 'dark' ? 'hover:bg-[#232326] text-neutral-400 hover:text-neutral-200' : 'hover:bg-neutral-200/70 text-neutral-600 hover:text-neutral-900'
                  }`}
                  title="Regenerar resposta"
                >
                  <RefreshCw className="w-4 h-4" strokeWidth={1.5} />
                </motion.button>
              )}

              {/* More options dropdown */}
              <div className="relative">
                <button
                  ref={moreButtonRef}
                  onClick={handleToggleMoreMenu}
                  className={`p-1.5 rounded-lg transition-colors flex items-center justify-center text-xs ${
                    theme === 'dark' ? 'hover:bg-[#232326] text-neutral-400 hover:text-neutral-200' : 'hover:bg-neutral-200/70 text-neutral-600 hover:text-neutral-900'
                  }`}
                  title="Mais opções"
                >
                  <MoreHorizontal className="w-4 h-4" strokeWidth={1.5} />
                </button>

                {showMoreMenu && moreCoords && createPortal(
                  <div 
                    ref={moreMenuRef}
                    style={{
                      position: 'fixed',
                      top: `${moreCoords.top}px`,
                      left: `${moreCoords.left}px`,
                      transform: 'translateY(-100%)',
                      zIndex: 999999
                    }}
                    className={`w-36 rounded-xl border shadow-2xl py-1 animate-fadeIn ${
                      theme === 'dark' ? 'bg-[#1e1e24] border-[#2C2C2E] text-neutral-200' : 'bg-white border-neutral-200 text-neutral-800'
                    }`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => {
                        setShowMoreMenu(false);
                        onCopy(msg.id, msg.text);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-500/10 flex items-center gap-2"
                    >
                      <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />
                      Copiar texto
                    </button>
                  </div>,
                  document.body
                )}
              </div>

              {/* Fontes Button */}
              {uniqueSources.length > 0 && (
                <button
                  onClick={() => setShowSourcesSheet(!showSourcesSheet)}
                  className={`ml-auto sm:ml-1 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border ${
                    showSourcesSheet
                      ? (theme === 'dark' ? 'bg-zeno/20 text-zeno border-zeno/40' : 'bg-sky-50 text-zeno border-zeno/30')
                      : (theme === 'dark' ? 'bg-[#232326]/60 hover:bg-[#232326] text-neutral-300 border-[#2C2C2E]/50' : 'bg-neutral-100 hover:bg-neutral-200/80 text-neutral-700 border-neutral-300/60')
                  }`}
                  title="Ver fontes de pesquisa"
                >
                  <Globe className="w-3.5 h-3.5 text-zeno" strokeWidth={1.5} />
                  <span>Fontes ({uniqueSources.length})</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${showSourcesSheet ? 'rotate-180' : ''}`} strokeWidth={1.5} />
                </button>
              )}

              <button
                onClick={() => onToggleSpeech(msg.id, msg.text)}
                className={`p-1.5 rounded-lg transition-colors flex items-center justify-center text-xs ${
                  isSpeaking ? 'text-neutral-100 animate-pulse bg-[#232326]' : (
                    theme === 'dark' ? 'hover:bg-[#232326] text-neutral-400 hover:text-neutral-200' : 'hover:bg-neutral-200/70 text-neutral-600 hover:text-neutral-900'
                  )
                }`}
                title={isSpeaking ? "Parar áudio" : "Ouvir em Voz Alta"}
              >
                {isSpeaking ? <VolumeX className="w-4 h-4" strokeWidth={1.5} /> : <Volume2 className="w-4 h-4" strokeWidth={1.5} />}
              </button>
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
                <div className="flex items-center gap-2 text-xs font-bold text-zeno py-1">
                  <Sparkles className="w-4 h-4 text-zeno animate-pulse" />
                  <span>Feedback registrado! ZENO atualizou seu perfil de aprendizado adaptativo.</span>
                </div>
              ) : (
                <div>
                  <div className="text-[11px] font-bold text-neutral-400 mb-2 flex items-center justify-between">
                    <span className={`flex items-center gap-1.5 ${theme === 'dark' ? 'text-[#F5F5F5]' : 'text-neutral-800'}`}>
                      <Sparkles className="w-3.5 h-3.5 text-zeno" />
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
                              ? 'bg-zeno/10 border-zeno text-zeno font-bold' 
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
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-zeno text-[#F5F5F5] hover:bg-zeno/10 transition-colors flex items-center gap-1.5 shadow-md shadow-zeno/10"
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
    </motion.div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.msg.id === nextProps.msg.id &&
    prevProps.msg.text === nextProps.msg.text &&
    prevProps.msg.role === nextProps.msg.role &&
    prevProps.msg.hasError === nextProps.msg.hasError &&
    prevProps.msg.errorMessage === nextProps.msg.errorMessage &&
    prevProps.msg.syncStatus === nextProps.msg.syncStatus &&
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null);

  // Filter welcome message when there are actual messages
  const visibleMessages = useMemo(() => {
    return messages.filter(msg => !(msg.id.startsWith('welcome') && messages.length === 1));
  }, [messages]);

  useEffect(() => {
    if (containerRef.current) {
      setScrollElement(containerRef.current.closest('.overflow-y-auto') as HTMLElement);
    }
  }, []);

  const rowVirtualizer = useVirtualizer({
    count: visibleMessages.length,
    getScrollElement: () => scrollElement,
    estimateSize: () => 160,
    overscan: 5,
  });

  if (visibleMessages.length === 0) return null;

  return (
    <div ref={containerRef} className="w-full flex flex-col gpu-accelerated" style={{ contain: 'content' }}>
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const msg = visibleMessages[virtualRow.index];
          if (!msg) return null;
          
          const isLastMessage = virtualRow.index === visibleMessages.length - 1;
          
          return (
            <motion.div
              key={msg.id}
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25 }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
                paddingBottom: '2rem',
                willChange: 'opacity, transform'
              }}
            >
              <MessageItem
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
            </motion.div>
          );
        })}
      </div>

      <div ref={messagesEndRef} className="h-2" />
    </div>
  );
});

MessageList.displayName = 'MessageList';
