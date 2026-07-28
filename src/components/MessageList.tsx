import React, { useMemo, useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { 
  Copy, Check, Edit3, Volume2, VolumeX, ThumbsUp, ThumbsDown, RefreshCw, Sparkles, AlertCircle, ChevronUp, Layers
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message, ModelType } from '../types';
import { ZenoLogo } from './ZenoLogo';
import { ErrorBanner } from './ErrorBanner';
import { Countdown } from './Countdown';
import { YouTubeProcessor } from './YouTubeProcessor';

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
  onYouTubeAction
}) => {
  if (msg.role === 'user') {
    return (
      <div className="group flex w-full justify-end">
        <div className="flex flex-col items-end max-w-[88%] sm:max-w-[82%]">
          {isEditing ? (
            <div className={`w-full p-3 rounded-2xl border flex flex-col gap-2.5 ${
              theme === 'dark' ? 'bg-[#18181c] border-neutral-700' : 'bg-white border-neutral-300 shadow-md'
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
              <div className="flex justify-end gap-2 pt-1 border-t border-neutral-700/30">
                <button
                  onClick={onCancelEditMessage}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-400 hover:text-neutral-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => onSaveEditMessage(msg.id)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-neutral-200 hover:bg-white text-neutral-900 shadow-xs"
                >
                  Salvar e Enviar
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className={`px-4 sm:px-5 py-3 rounded-2xl rounded-tr-xs text-[15px] leading-relaxed break-words shadow-2xs ${
                theme === 'dark'
                  ? 'bg-[#1e1e24] text-neutral-100 border border-neutral-800'
                  : 'bg-[#f2f2f5] text-neutral-900 border border-neutral-200'
              }`}>
                {msg.text}
              </div>
              <div className="mt-1 mr-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                <button
                  onClick={() => onStartEditMessage(msg.id, msg.text)}
                  className={`p-1 rounded-md text-xs transition-colors ${
                    theme === 'dark' 
                      ? 'hover:bg-neutral-800/40 text-neutral-500 hover:text-neutral-300' 
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
                      ? 'hover:bg-neutral-800/40 text-neutral-500 hover:text-neutral-300' 
                      : 'hover:bg-neutral-200 text-neutral-500 hover:text-neutral-800'
                  }`}
                  title="Copiar mensagem"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
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
                    'ZENO Flash';

  return (
    <div className="group flex w-full justify-start">
      <div className="flex gap-3 sm:gap-4 w-full max-w-4xl">
        <div className="flex-shrink-0 mt-0.5">
          <ZenoLogo size={28} variant={logoVariant} theme={theme} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`text-xs font-bold ${
              theme === 'dark' ? 'text-neutral-200' : 'text-neutral-800'
            }`}>
              {modelName}
            </span>
          </div>

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
            <div className={`mt-2 p-5 rounded-2xl border ${theme === 'dark' ? 'bg-[#1e1e24] border-neutral-800' : 'bg-neutral-50 border-neutral-200'} `}>
              <div className="flex items-center gap-2 mb-3 text-red-500">
                <AlertCircle className="w-4 h-4" />
                <span className="font-bold text-[13px] uppercase tracking-wider">Limite Diário Atingido</span>
              </div>
              <p className={`text-[15px] mb-5 leading-relaxed ${theme === 'dark' ? 'text-neutral-300' : 'text-neutral-700'}`}>
                {msg.text}
              </p>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <button
                  onClick={onOpenSubscriptionModal}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold bg-neutral-900 text-white hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <Sparkles className="w-4 h-4" />
                  Upgrade para o ZENO Pro
                </button>
                <div className={`text-[11px] font-medium max-w-[200px] leading-tight ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-400'}`}>
                   Sua cota gratuita será renovada automaticamente em <Countdown />.
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
            <div className={`markdown-body max-w-none text-[15px] sm:text-[16px] leading-[1.8] ${
              theme === 'dark' ? 'text-neutral-200' : 'text-neutral-800'
            }`}>
              {(!msg.text && isLoadingLast && msg.role === 'model') ? (
                <div className="flex items-center gap-2 py-1 text-neutral-400 text-sm animate-pulse">
                  <Sparkles className="w-4 h-4 text-neutral-400" />
                  <span>ZENO está sintetizando a resposta...</span>
                </div>
              ) : (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={markdownComponents}
                >
                  {msg.text}
                </ReactMarkdown>
              )}
            </div>
          )}

          {/* Message Actions */}
          {msg.role === 'model' && msg.text && !msg.hasError && (
            <div className="mt-3 flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onCopy(msg.id, msg.text)}
                className={`p-1.5 rounded-lg transition-colors flex items-center justify-center text-xs ${
                  theme === 'dark' ? 'hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200' : 'hover:bg-neutral-200/70 text-neutral-600 hover:text-neutral-900'
                }`}
                title="Copiar resposta"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={() => onToggleSpeech(msg.id, msg.text)}
                className={`p-1.5 rounded-lg transition-colors flex items-center justify-center text-xs ${
                  isSpeaking ? 'text-neutral-100 animate-pulse bg-neutral-800' : (
                    theme === 'dark' ? 'hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200' : 'hover:bg-neutral-200/70 text-neutral-600 hover:text-neutral-900'
                  )
                }`}
                title={isSpeaking ? "Parar áudio" : "Ouvir em Voz Alta"}
              >
                {isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={() => onSetFeedback(msg.id, 'up')}
                className={`p-1.5 rounded-lg transition-colors flex items-center justify-center text-xs ${
                  itemFeedback === 'up' ? 'text-neutral-100 bg-neutral-800' : (
                    theme === 'dark' ? 'hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200' : 'hover:bg-neutral-200/70 text-neutral-600 hover:text-neutral-900'
                  )
                }`}
                title="Gostei"
              >
                <ThumbsUp className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => onSetFeedback(msg.id, 'down')}
                className={`p-1.5 rounded-lg transition-colors flex items-center justify-center text-xs ${
                  itemFeedback === 'down' ? 'text-rose-400 bg-rose-500/10' : (
                    theme === 'dark' ? 'hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200' : 'hover:bg-neutral-200/70 text-neutral-600 hover:text-neutral-900'
                  )
                }`}
                title="Não gostei"
              >
                <ThumbsDown className="w-3.5 h-3.5" />
              </button>

              {isLastMessage && !isLoadingLast && (
                <button
                  onClick={onRegenerate}
                  className={`ml-1 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    theme === 'dark' ? 'hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200' : 'hover:bg-neutral-200/70 text-neutral-600 hover:text-neutral-900'
                  }`}
                  title="Regenerar resposta"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Regenerar</span>
                </button>
              )}
            </div>
          )}
        </div>
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
  onYouTubeAction
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
    <div ref={containerRef} className="w-full max-w-4xl px-4 sm:px-6 flex flex-col space-y-8">
      {/* Sentinel & Pagination Controls */}
      {hasMore && (
        <div className="flex flex-col items-center gap-2 my-2 transition-all">
          <div ref={sentinelRef} className="h-1 w-full" />
          
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <button
              onClick={handleLoadMore}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-2xs flex items-center gap-2 ${
                theme === 'dark' 
                  ? 'bg-[#1e1e24] hover:bg-neutral-800 text-neutral-300 border border-neutral-800' 
                  : 'bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200 shadow-2xs'
              }`}
            >
              <ChevronUp className="w-3.5 h-3.5 text-amber-500" />
              <span>Carregar {Math.min(BATCH_SIZE, remainingCount)} mensagens anteriores ({remainingCount} restantes)</span>
            </button>

            {remainingCount > BATCH_SIZE && (
              <button
                onClick={handleLoadAll}
                className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                  theme === 'dark'
                    ? 'hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200'
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

      {slicedMessages.map((msg, index) => {
        const isLastMessage = index === slicedMessages.length - 1;
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
          />
        );
      })}
      <div ref={messagesEndRef} className="h-2" />
    </div>
  );
});

MessageList.displayName = 'MessageList';
