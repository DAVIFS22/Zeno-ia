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

import { MessageItem } from './MessageItem';

interface MessageRowProps {
  msg: Message;
  index: number;
  totalLength: number;
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
  chatId: string;
  onYouTubeAction: (action: string, transcript: string, metadata: any) => void;
  onSendAdaptiveFeedback?: (msgId: string, type: 'up' | 'down', tags: string[], comment?: string) => void;
}

const MessageRow = React.memo<MessageRowProps>(({
  msg,
  index,
  totalLength,
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
  chatId,
  onYouTubeAction,
  onSendAdaptiveFeedback
}) => {
  const isLastMessage = index === totalLength - 1;

  return (
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
      chatId={chatId}
      onYouTubeAction={onYouTubeAction}
      onSendAdaptiveFeedback={onSendAdaptiveFeedback}
    />
  );
}, (prevProps, nextProps) => {
  const isLastPrev = prevProps.index === prevProps.totalLength - 1;
  const isLastNext = nextProps.index === nextProps.totalLength - 1;

  // If this message is not the last message and length didn't change, skip re-renders if core props are identical
  if (!isLastPrev && !isLastNext && prevProps.totalLength === nextProps.totalLength) {
    return (
      prevProps.msg === nextProps.msg &&
      prevProps.theme === nextProps.theme &&
      prevProps.logoVariant === nextProps.logoVariant &&
      prevProps.speed === nextProps.speed &&
      prevProps.copiedId === nextProps.copiedId &&
      prevProps.speakingMessageId === nextProps.speakingMessageId &&
      prevProps.feedback[prevProps.msg.id] === nextProps.feedback[nextProps.msg.id] &&
      prevProps.editingMessageId === nextProps.editingMessageId
    );
  }

  // For the last message or when array length changes
  return (
    prevProps.msg === nextProps.msg &&
    prevProps.index === nextProps.index &&
    prevProps.totalLength === nextProps.totalLength &&
    prevProps.isLoading === nextProps.isLoading &&
    prevProps.theme === nextProps.theme &&
    prevProps.logoVariant === nextProps.logoVariant &&
    prevProps.speed === nextProps.speed &&
    prevProps.copiedId === nextProps.copiedId &&
    prevProps.speakingMessageId === nextProps.speakingMessageId &&
    prevProps.feedback[prevProps.msg.id] === nextProps.feedback[nextProps.msg.id] &&
    prevProps.editingMessageId === nextProps.editingMessageId &&
    prevProps.editingMessageText === nextProps.editingMessageText
  );
});

MessageRow.displayName = 'MessageRow';

export interface MessageListProps {
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
  chatId: string;
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
  chatId,
  onYouTubeAction,
  onSendAdaptiveFeedback
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null);
  
  const animatedMessages = useRef(new Set<string>());
  const listMountTime = useRef(Date.now());

  useEffect(() => {
    animatedMessages.current.clear();
    listMountTime.current = Date.now();
  }, [chatId]);

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
          
          const hasAnimated = animatedMessages.current.has(msg.id);
          const isInitialBatch = (Date.now() - listMountTime.current) < 1000;
          const delay = (!hasAnimated && isInitialBatch) ? Math.min(virtualRow.index * 0.05, 0.4) : 0;

          return (
            <div
              key={msg.id}
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
                paddingBottom: '2rem',
                willChange: 'transform'
              }}
            >
              <motion.div
                initial={hasAnimated ? false : { opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ 
                  duration: 0.4, 
                  delay: delay,
                  ease: [0.25, 0.1, 0.25, 1] 
                }}
                onAnimationComplete={() => {
                  animatedMessages.current.add(msg.id);
                }}
              >
                <MessageRow
                  msg={msg}
                  index={virtualRow.index}
                  totalLength={visibleMessages.length}
                  theme={theme}
                  logoVariant={logoVariant}
                  speed={speed}
                  isLoading={isLoading}
                  copiedId={copiedId}
                  speakingMessageId={speakingMessageId}
                  feedback={feedback}
                  editingMessageId={editingMessageId}
                  editingMessageText={editingMessageText}
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
                  chatId={chatId}
                  onYouTubeAction={onYouTubeAction}
                  onSendAdaptiveFeedback={onSendAdaptiveFeedback}
                />
              </motion.div>
            </div>
          );
        })}
      </div>

      <div ref={messagesEndRef} className="h-2" />
    </div>
  );
});

MessageList.displayName = 'MessageList';
