// fix: valida pipeline de release apos correcao do email do bot
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './lib/firebase';
import { getOrCreateUserId } from './lib/userId';
import { Sparkles, AlertCircle } from 'lucide-react';
import { Message, ChatSession, FileAttachment, UserSettings, ModelType, DailyUsage, AdaptiveLearningProfile } from './types';
import { DEFAULT_ADAPTIVE_PROFILE } from './lib/adaptiveLearning';
import { groupSessionsByDate, generateTitleFromMessage } from './utils/date';
import { CodeBlock } from './components/CodeBlock';
import { ImageWithLoader } from './components/ImageWithLoader';
import { ZenoLogo } from './components/ZenoLogo';
import { syncLibraryWithBackend, scanAndSaveImagesFromText } from './lib/imageLibraryStorage';
import { WelcomeScreen } from './components/WelcomeScreen';
import { PlanUsageCard } from './components/PlanUsageCard';
import { ComposerInput } from './components/ComposerInput';
import { SidebarNav } from './components/SidebarNav';
import { YouTubeProcessor } from './components/YouTubeProcessor';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthScreen } from './components/AuthScreen';
import { useCloudSync } from './hooks/useCloudSync';
import { useDraftManager } from './hooks/useDraftManager';
import { useRealtimeSubscription } from './hooks/useRealtimeSubscription';
import { MessageList } from './components/MessageList';
import { AppHeader } from './components/AppHeader';
import { AppModals } from './components/AppModals';
import { ContextualPrompts } from './components/ContextualPrompts';
import { UIProvider } from './contexts/UIContext';
import { SubscriptionProvider, useSubscription } from './contexts/SubscriptionContext';
import { useUIState } from './hooks/useUIState';
import { usePerformanceMetrics, measureApiLatency } from './hooks/usePerformanceMetrics';
import { useAppSettings } from './hooks/useAppSettings';
import { useUsage } from './hooks/useUsage';
import { useSessions } from './hooks/useSessions';
import { useChat } from './hooks/useChat';
import { detectIntent } from './utils/intent';
import { LanguageProvider, useTranslation } from './i18n';
import { VersionProvider } from './contexts/VersionContext';
import { hasPremiumAccess } from './config/admin';
import { filterValidSources } from './utils/sourceValidation';
import { isAuthorizedImageUrl } from './utils/imageSecurity';
import { copyToClipboard as performCopyToClipboard } from './utils/clipboard';
import { checkAndGetNewVersion, markVersionAsSeen, hasRelevantContent } from './lib/versionSystem';

const STORAGE_KEY_SESSIONS = 'zeno_chat_sessions_v3';
const STORAGE_KEY_CURRENT_ID = 'zeno_current_session_id_v3';
const STORAGE_KEY_SETTINGS = 'zeno_user_settings_v3';
const STORAGE_KEY_USAGE = 'zeno_daily_usage_v3';

const YOUTUBE_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
import { 
  getTodayString, 
  getInitialUsage, 
  isModelPro, 
  checkUsageLimit, 
  FREE_LIMITS,
  getModelDef
} from './lib/subscription';

function MainAppInner() {
  const { t } = useTranslation();
  const ui = useUIState();
  const { trackApi } = usePerformanceMetrics('MainApp');
  const { isPro } = useSubscription();

  const { 
    user, 
    profile, 
    loading: authLoading, 
    signInWithGoogle, 
    logout, 
    switchAccount, 
    session 
  } = useAuth();

  const userId = profile?.uid || getOrCreateUserId(profile?.uid);

  const { userSettings, setUserSettings, updateSettings } = useAppSettings(userId, profile);
  const { dailyUsage, setDailyUsage, backendLimits, adminConfig, fetchLimits } = useUsage(userId);
  const { 
    sessions, 
    setSessions, 
    currentSessionId, 
    setCurrentSessionId, 
    deleteSession, 
    clearHistory 
  } = useSessions(userId);

  const [speed, setSpeed] = useState<ModelType>('smart');
  const [showUsageCard, setShowUsageCard] = useState(true);

  useEffect(() => {
    const { isNew, version } = checkAndGetNewVersion();
    if (isNew) {
      if (hasRelevantContent(version)) {
        ui.openModal('versionNews');
      } else {
        markVersionAsSeen(version.version);
      }
    }
  }, []);

  useEffect(() => {
    if (isPro || (profile && hasPremiumAccess(profile)) || hasPremiumAccess(userSettings) || hasPremiumAccess(profile?.email)) {
      if (userSettings.plan !== 'ZENO Pro') {
        setUserSettings(prev => ({ ...prev, plan: 'ZENO Pro' }));
      }
    }
  }, [isPro, profile, userSettings.userEmail]);

  // Adaptive Learning Profile State & Effects
  const [adaptiveProfile, setAdaptiveProfile] = useState<AdaptiveLearningProfile>(DEFAULT_ADAPTIVE_PROFILE);

  useEffect(() => {
    if (userId) {
      const fetchProfile = async () => {
        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (user) {
            try {
              const token = await user.getIdToken();
              headers['Authorization'] = `Bearer ${token}`;
            } catch (tokenErr) {
              console.warn('Could not get auth token for adaptive profile:', tokenErr);
            }
          }
          const res = await fetch(`/api/adaptive/profile?userId=${encodeURIComponent(userId)}`, { 
            headers,
            cache: 'no-store'
          });
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const data = await res.json();
            if (data && data.profile) {
              setAdaptiveProfile(data.profile);
            }
          }
        } catch (err) {
          console.error('Erro ao carregar perfil adaptativo:', err);
        }
      };
      fetchProfile();
    }
  }, [userId, user]);

  const handleSendAdaptiveFeedback = useCallback(async (msgId: string, type: 'up' | 'down', tags: string[], comment?: string) => {
    try {
      const res = await fetch('/api/adaptive/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          feedback: {
            messageId: msgId,
            type,
            tags,
            userComment: comment,
            timestamp: Date.now()
          }
        })
      });
      const data = await res.json();
      if (data.profile) {
        setAdaptiveProfile(data.profile);
      }
    } catch (err) {
      console.error('Erro ao enviar feedback adaptativo:', err);
    }
  }, [userId]);

  // Switch context reset & server init when userId changes
  const prevUserIdRef = useRef<string>(userId);

  useEffect(() => {
    if (prevUserIdRef.current !== userId) {
      prevUserIdRef.current = userId;
      console.log('[ACCOUNT ISOLATION] Alternando contexto para o UID:', userId);

      // 1. Initialize account on frontend directly, because backend admin SDK lacks permissions in preview
      const initAccountLocally = async () => {
        try {
          const userRef = doc(db, 'users', userId);
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              userId,
              email: profile?.email || '',
              name: profile?.displayName || 'Usuário ZENO',
              photoURL: profile?.photoURL || '',
              createdAt: Date.now(),
              role: 'user',
              plan: 'ZENO Free',
              isPro: false,
              unlimited: false
            }, { merge: true });
            
            const subRef = doc(db, 'subscriptions', userId);
            await setDoc(subRef, {
              userId,
              plan: 'ZENO Free',
              status: 'active',
              trialUsed: false,
              history: []
            }, { merge: true });
          }
        } catch(e) {
          console.error("Failed to initialize user in Firestore:", e);
        }
      };
      
      initAccountLocally().then(() => {
        // optionally still call backend to track usage etc
        fetch('/api/account/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            email: profile?.email || '',
            name: profile?.displayName || 'Usuário ZENO',
            photoURL: profile?.photoURL || ''
          })
        }).catch(() => {});
      });

      // 2. Load user settings for new UID
      try {
        const savedSettings = localStorage.getItem(`${STORAGE_KEY_SETTINGS}_${userId}`);
        if (savedSettings) {
          setUserSettings(JSON.parse(savedSettings));
        } else {
          setUserSettings({
            userName: profile?.displayName || 'Usuário ZENO',
            userEmail: profile?.email || '',
            userAvatar: profile?.photoURL || '',
            plan: 'ZENO Free',
            theme: 'dark',
      showHomeSuggestions: false,
            logoVariant: 'monochrome',
            fontSize: 'normal',
            defaultSpeed: 'smart',
            temperature: 0.7,
            systemInstruction: '',
            autoRead: false,
            voiceSpeed: 1.0,
            speechLanguage: 'pt-BR',
            customInstructions: '',
            memoryEnabled: true,
            saveHistory: true,
            anonymousMode: false,
            rememberDevice: true,
            language: 'pt-BR',
            isSmartMode: true,
            soundEnabled: true,
            notificationsEnabled: true,
          });
        }
      } catch (e) {
        console.error('Erro ao carregar configurações isoladas:', e);
      }

      // 3. Load chat sessions for new UID
      try {
        const savedSessions = localStorage.getItem(`${STORAGE_KEY_SESSIONS}_${userId}`);
        if (savedSessions) {
          const parsed = JSON.parse(savedSessions);
          setSessions(Array.isArray(parsed) ? parsed : []);
        } else {
          setSessions([]);
        }
      } catch (e) {
        setSessions([]);
      }

      // 4. Load current session ID for new UID
      const savedId = localStorage.getItem(`${STORAGE_KEY_CURRENT_ID}_${userId}`);
      setCurrentSessionId(savedId && savedId !== 'null' ? savedId : null);

      // 5. Fetch limits for new UID
      fetchLimits();
    }
  }, [userId, profile]);

  useEffect(() => {
    const reconcileAndCheckSubscription = async () => {
      if (!userId) return;
      try {
        const res = await measureApiLatency('/api/subscription/details', () => 
          fetch(`/api/subscription/details?userId=${userId}`)
        );
        if (res.ok) {
          let data = await res.json();

          // Check if renewalDate in Firestore is outdated compared to server time
          const isOutdated = data && (
            data.needsReconciliation ||
            data.renewalDateOutdated ||
            (data.renewDate && new Date(data.renewDate).getTime() < Date.now() && data.isPro)
          );

          if (isOutdated) {
            console.log('[RECONCILIATION] Real-time forced reconciliation triggered for userId:', userId);
            const syncRes = await fetch('/api/subscription/reconcile', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId })
            });
            if (syncRes.ok) {
              const syncData = await syncRes.json();
              if (syncData && syncData.details) {
                data = syncData.details;
              }
            }
          }

          if (data && data.pendingNotification) {
            ui.openModal('renewalNotification', { data: { activeNotification: data.pendingNotification } });
          }

          if (data && typeof data.isPro === 'boolean') {
            const expectedPlan = data.isPro ? 'ZENO Pro' : 'ZENO Free';
            setUserSettings(prev => prev.plan === expectedPlan ? prev : { ...prev, plan: expectedPlan });
          }
        }
      } catch (e) {
        console.warn("Could not reconcile subscription details:", e);
      }
    };
    
    reconcileAndCheckSubscription();

    const handleWindowFocus = () => {
      reconcileAndCheckSubscription();
    };

    window.addEventListener('focus', handleWindowFocus);
    return () => {
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [userId, ui]);

  const handleOpenSubscriptionModal = useCallback((reasonMessage?: string) => {
    if (!user && !user?.isAnonymous) {
      ui.openModal('auth', { data: { message: t.common.profile } });
      return;
    }
    if (isPro) {
      ui.openModal('subscription', { data: { reasonMessage } });
    } else {
      ui.openModal('plans');
    }
  }, [ui, isPro, user, t]);

  const handleOpenProFeatureModal = useCallback(() => {
    if (!user && !user?.isAnonymous) {
      ui.openModal('auth', { data: { message: t.common.profile } });
      return;
    }
    ui.openModal('proFeature');
  }, [ui, user, t]);

  const {
    input,
    setInput,
    attachments,
    setAttachments,
    isLoading,
    handleSubmit,
    abortChat
  } = useChat(
    userId,
    userSettings,
    isPro,
    sessions,
    setSessions,
    currentSessionId,
    setCurrentSessionId,
    dailyUsage,
    setDailyUsage,
    ui
  );

  const handleChatSubmit = useCallback(async (e?: React.FormEvent, overrideText?: string, extraContext?: string) => {
    setIsNewChat(false);
    await handleSubmit(e, overrideText, extraContext);
  }, [handleSubmit]);

  const [systemTheme, setSystemTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const theme = useMemo(() => {
    if (userSettings.theme === 'auto') {
      return systemTheme;
    }
    return userSettings.theme || 'dark';
  }, [userSettings.theme, systemTheme]);

  const logoVariant = userSettings.logoVariant;

  const handleUpdateSettings = useCallback((newSettings: Partial<UserSettings>) => {
    setUserSettings(prev => {
      const updated = { ...prev, ...newSettings };
      if (userId) {
        localStorage.setItem(`${STORAGE_KEY_SETTINGS}_${userId}`, JSON.stringify(updated));
      }
      return updated;
    });
  }, [userId]);

  // Real-time Firestore Subscription Listener using onSnapshot
  const handleRealtimePlanChange = useCallback((newPlan: 'ZENO Pro' | 'ZENO Free') => {
    setUserSettings(prev => {
      if (prev.plan === newPlan) return prev;
      const updated = { ...prev, plan: newPlan };
      if (userId) {
        localStorage.setItem(`${STORAGE_KEY_SETTINGS}_${userId}`, JSON.stringify(updated));
      }
      return updated;
    });
  }, [userId]);

  useRealtimeSubscription(
    profile?.uid, // ONLY use real Firebase UID for Firestore listeners to avoid permission errors
    handleRealtimePlanChange,
    handleUpdateSettings
  );

  // Sync theme to HTML root
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
    }
  }, [theme]);

  const [isNewChat, setIsNewChat] = useState<boolean>(true);
  const [feedback, setFeedback] = useState<Record<string, 'up' | 'down'>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleAddAttachment = useCallback((file: FileAttachment) => {
    setAttachments(prev => [...prev, file]);
  }, [setAttachments]);

  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  }, [setAttachments]);

  const handleOpenImageStudioModal = useCallback(() => {
    ui.openModal('imageStudio');
  }, [ui]);

  // Sync image library from backend on start
  useEffect(() => {
    syncLibraryWithBackend(userId).catch(() => {});
  }, [userId]);

  // Cloud Sync Integration
  useCloudSync(
    userId,
    sessions,
    setSessions,
    userSettings,
    handleUpdateSettings
  );

  // Multi-layer Draft Manager Integration (LocalStorage + Cloud Sync)
  const {
    cloudDraftPrompt,
    acceptCloudDraft,
    dismissCloudDraft,
    clearDraft,
  } = useDraftManager({
    userId,
    sessionId: currentSessionId,
    input,
    setInput,
  });

  // Session renaming
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

  // Inline User Message Editing
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageText, setEditingMessageText] = useState('');

  // Audio Speech Recognition State
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Text-To-Speech
  const toggleSpeech = useCallback((id: string, text: string) => {
    if (!('speechSynthesis' in window)) {
      alert(t.common.error);
      return;
    }

    if (speakingMessageId === id) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = userSettings.speechLanguage || 'pt-BR';
    utterance.rate = userSettings.voiceSpeed || 1.0;

    utterance.onend = () => setSpeakingMessageId(null);
    utterance.onerror = () => setSpeakingMessageId(null);

    setSpeakingMessageId(id);
    window.speechSynthesis.speak(utterance);
  }, [speakingMessageId, userSettings.speechLanguage, userSettings.voiceSpeed]);

  // Active Session helper
  const activeSession = useMemo(() => {
    return currentSessionId ? sessions.find(s => s.id === currentSessionId) || null : null;
  }, [sessions, currentSessionId]);

  const messages = activeSession?.messages || [];

  // Sync model speed when active session changes
  useEffect(() => {
    if (activeSession?.speed) {
      setSpeed(activeSession.speed);
    }
  }, [currentSessionId, activeSession?.speed]);

  // Scan active chat messages for generated images to populate library automatically
  useEffect(() => {
    if (messages && messages.length > 0 && currentSessionId) {
      messages.forEach(msg => {
        if (msg.role === 'model' && msg.text && msg.text.includes('![')) {
          scanAndSaveImagesFromText(msg.text, currentSessionId, activeSession?.title || 'Conversa', speed, userId);
        }
      });
    }
  }, [messages, currentSessionId, activeSession?.title, speed, userId]);

  const handleLimitReached = useCallback(() => {
    fetchLimits();
    const limitWarningMessage: Message = {
      id: Date.now().toString(),
      role: 'model',
      text: t.composer.speedSearch, // Placeholder for limit message, should probably have its own key
      timestamp: Date.now(),
      modelSpeed: speed,
      isLimitWarning: true
    };
    
    setSessions(prev => {
      const activeId = currentSessionId;
      if (!activeId) return prev;
      return prev.map(s => {
        if (s.id === activeId) {
          return {
            ...s,
            messages: [...s.messages, limitWarningMessage],
            updatedAt: Date.now()
          };
        }
        return s;
      });
    });
  }, [currentSessionId, speed]);

  // Persistence Effects
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessions));
    } catch (e) {
      console.error('Error saving sessions:', e);
    }
  }, [sessions]);

  useEffect(() => {
    try {
      if (currentSessionId) {
        localStorage.setItem(STORAGE_KEY_CURRENT_ID, currentSessionId);
      } else {
        localStorage.removeItem(STORAGE_KEY_CURRENT_ID);
      }
    } catch (e) {
      console.error('Error saving current session ID:', e);
    }
  }, [currentSessionId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  // New Chat Handler
  const handleNewChat = useCallback(() => {
    if (isLoading) {
      abortChat();
    }
    setIsNewChat(true);
    setCurrentSessionId(null);
    setInput('');
    setAttachments([]);
    ui.setSidebarOpen(false);
  }, [isLoading, ui, abortChat, setCurrentSessionId, setInput, setAttachments]);

  const originalInputRef = useRef<string>('');
  const sessionFinalRef = useRef<string>('');

  // Handle Speech Recognition Toggle

  // Handle Select Speed
  const handleSelectSpeed = useCallback((newSpeed: ModelType) => {
    if (isModelPro(newSpeed) && !isPro) {
      handleOpenProFeatureModal();
      return;
    }

    setSpeed(newSpeed);
    if (currentSessionId) {
      setSessions(prev =>
        prev.map(s => (s.id === currentSessionId ? { ...s, speed: newSpeed } : s))
      );
    }
  }, [isPro, currentSessionId, handleOpenProFeatureModal]);

  // Stop Generation
  const handleStopGeneration = useCallback(() => {
    abortChat();
  }, [abortChat]);

  // Regenerate Response
  const handleRegenerate = useCallback(async () => {
    if (!activeSession || messages.length < 2 || isLoading) return;

    let lastUserMsg: Message | null = null;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        lastUserMsg = messages[i];
        break;
      }
    }

    if (!lastUserMsg) return;

    setSessions(prev =>
      prev.map(s => {
        if (s.id === currentSessionId) {
          const updated = [...s.messages];
          if (updated[updated.length - 1].role === 'model') {
            updated.pop();
          }
          return { ...s, messages: updated };
        }
        return s;
      })
    );

    handleSubmit(undefined, lastUserMsg.text);
  }, [activeSession, messages, isLoading, currentSessionId]);

  // Edit Message Handlers
  const handleStartEditMessage = useCallback((id: string, text: string) => {
    setEditingMessageId(id);
    setEditingMessageText(text);
  }, []);

  const handleCancelEditMessage = useCallback(() => {
    setEditingMessageId(null);
    setEditingMessageText('');
  }, []);

  const handleSaveEditMessage = useCallback(async (id: string) => {
    if (!editingMessageText.trim() || !currentSessionId) return;

    const newText = editingMessageText;
    setEditingMessageId(null);
    setEditingMessageText('');

    setSessions(prev =>
      prev.map(s => {
        if (s.id === currentSessionId) {
          const msgIdx = s.messages.findIndex(m => m.id === id);
          if (msgIdx !== -1) {
            const truncated = s.messages.slice(0, msgIdx);
            return { ...s, messages: truncated };
          }
        }
        return s;
      })
    );

    handleSubmit(undefined, newText);
  }, [editingMessageText, currentSessionId]);

  const handleYouTubeAction = useCallback(async (action: string, transcript: string, metadata: any) => {
    let prompt = "";
    const videoTitle = metadata?.title || "este vídeo";
    
    switch(action) {
      case 'resumir': prompt = `Resuma o conteúdo do vídeo "${videoTitle}" de forma clara e objetiva.`; break;
      case 'traduzir': prompt = `Traduza os principais pontos do vídeo "${videoTitle}" para o português, mantendo o contexto original.`; break;
      case 'topicos': prompt = `Organize os principais temas e tópicos abordados no vídeo "${videoTitle}" em uma lista estruturada.`; break;
      case 'pontos': prompt = `Destaque os insights e pontos mais importantes discutidos no vídeo "${videoTitle}".`; break;
      case 'perguntar': prompt = `O que você gostaria de saber sobre o vídeo "${videoTitle}"?`; setInput(prompt); return;
      case 'corrigir': prompt = `Corrija a pontuação e gramática da transcrição do vídeo "${videoTitle}" e apresente-a de forma legível.`; break;
      default: return;
    }
    
    const contextWithTranscript = `[TRANSCRICÃO DO VÍDEO DO YOUTUBE "${videoTitle}"]:\n${transcript}\n\n`;
    handleSubmit(undefined, prompt, contextWithTranscript);
  }, [handleSubmit]);

  // Copy to Clipboard
  const copyToClipboard = useCallback((id: string, text: string) => {
    performCopyToClipboard(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  // Memoized ReactMarkdown Custom Components
  const markdownComponents = useMemo(() => ({
    p({ children }: any) {
      return <div className="mb-2 last:mb-0">{children}</div>;
    },
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : '';
      const codeString = String(children).replace(/\n$/, '');

      if (!inline) {
        return (
          <CodeBlock
            language={language}
            value={codeString}
            theme={theme}
          />
        );
      }

      return (
        <code className={`px-1.5 py-0.5 rounded text-[13px] font-mono ${
          theme === 'dark' ? 'bg-[#28282e] text-neutral-200' : 'bg-neutral-200 text-neutral-800'
        }`} {...props}>
          {children}
        </code>
      );
    },
    img({ src, alt }: any) {
      if (!src || !isAuthorizedImageUrl(src)) return null;
      return (
        <ImageWithLoader
          src={src}
          alt={alt || 'Imagem'}
        />
      );
    },
  }), [theme, copyToClipboard]);

  // Feedback Handler
  const handleSetFeedback = useCallback((msgId: string, value: 'up' | 'down') => {
    setFeedback(prev => ({
      ...prev,
      [msgId]: prev[msgId] === value ? undefined as any : value,
    }));
  }, []);

  // Select Session
  const handleSelectSession = useCallback((id: string) => {
    if (isLoading) handleStopGeneration();
    setIsNewChat(false);
    setCurrentSessionId(id);
    ui.setSidebarOpen(false);
  }, [isLoading, handleStopGeneration, ui]);

  // Delete Session
  const handleDeleteSession = useCallback((id: string) => {
    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== id);
      if (filtered.length === 0) {
        setCurrentSessionId(null);
        return [];
      } else {
        if (currentSessionId === id) {
          setCurrentSessionId(filtered[0].id);
        }
        return filtered;
      }
    });
    ui.closeModal('deleteSession');
  }, [currentSessionId, ui]);

  const togglePinSession = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions(prev =>
      prev.map(s => (s.id === id ? { ...s, isPinned: !s.isPinned } : s))
    );
  }, []);

  const startRenameSession = useCallback((session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditingTitle(session.title);
  }, []);

  const saveRenameSession = useCallback((id: string) => {
    if (!editingTitle.trim()) {
      setEditingSessionId(null);
      return;
    }
    setSessions(prev =>
      prev.map(s => (s.id === id ? { ...s, title: editingTitle.trim() } : s))
    );
    setEditingSessionId(null);
  }, [editingTitle]);

  const handleClearAllHistory = useCallback(() => {
    setSessions([]);
    setCurrentSessionId(null);
    localStorage.removeItem(STORAGE_KEY_SESSIONS);
    localStorage.removeItem(STORAGE_KEY_CURRENT_ID);
    ui.closeModal('settings');
  }, [ui]);

  const handleExportAllData = useCallback(() => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(sessions, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `zeno_chat_export_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }, [sessions]);

  const handleToggleSearchVisible = useCallback(() => {
    ui.toggleSearchVisible();
  }, [ui]);

  const handleCloseSidebar = useCallback(() => {
    ui.setSidebarOpen(false);
    ui.setSidebarCollapsed(true);
  }, [ui]);

  const handleOpenSidebar = useCallback(() => {
    if (window.innerWidth < 768) {
      ui.setSidebarOpen(true);
    } else {
      ui.setSidebarCollapsed(false);
    }
  }, [ui]);

  const handleToggleTheme = useCallback(() => {
    handleUpdateSettings({ theme: theme === 'dark' ? 'light' : 'dark' });
  }, [theme, handleUpdateSettings]);

  // Filter & Group Sessions
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter(
      s => s.title.toLowerCase().includes(q) || s.messages.some(m => m.text.toLowerCase().includes(q))
    );
  }, [sessions, searchQuery]);

  const groupedSessions = useMemo(() => {
    return groupSessionsByDate(filteredSessions, userSettings.groupByDate !== false);
  }, [filteredSessions, userSettings.groupByDate]);

  return (
    <LanguageProvider userLanguage={userSettings.language}>
      <div className={`flex h-[100dvh] font-sans overflow-hidden relative transition-colors duration-150 ${
        theme === 'dark' ? 'bg-[#0D0D0D] text-white' : 'bg-white text-neutral-900'
      }`}>
      {/* Mobile Overlay */}
      {ui.isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/70 z-30 md:hidden backdrop-blur-xs transition-opacity"
          onClick={() => ui.setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <SidebarNav
        theme={theme}
        logoVariant={logoVariant}
        isSidebarOpen={ui.isSidebarOpen}
        isSidebarCollapsed={ui.isSidebarCollapsed}
        isSearchVisible={ui.isSearchVisible}
        searchQuery={searchQuery}
        groupedSessions={groupedSessions}
        currentSessionId={currentSessionId}
        editingSessionId={editingSessionId}
        editingTitle={editingTitle}
        userSettings={userSettings}
        onCloseSidebar={handleCloseSidebar}
        onNewChat={handleNewChat}
        onToggleSearchVisible={handleToggleSearchVisible}
        onOpenSettings={() => ui.openModal('settings')}
        onOpenImageLibrary={() => ui.openModal('imageLibrary')}
        onOpenProjects={() => ui.openModal('projects')}
        onOpenPlugins={() => ui.openModal('plugins')}
        onOpenMore={() => ui.openModal('more')}
        onSearchQueryChange={setSearchQuery}
        onSelectSession={handleSelectSession}
        onSetEditingTitle={setEditingTitle}
        onSetEditingSessionId={setEditingSessionId}
        onSaveRenameSession={saveRenameSession}
        onTogglePinSession={togglePinSession}
        onStartRenameSession={startRenameSession}
        onSetDeletingSessionId={(id) => {
          if (id) {
            ui.openModal('deleteSession', { data: { sessionId: id } });
          } else {
            ui.closeModal('deleteSession');
          }
        }}
        onOpenSubscriptionModal={handleOpenSubscriptionModal}
        onOpenVersionNews={() => ui.openModal('versionNews')}
        user={profile}
        session={session}
        onSwitchAccount={switchAccount}
      />

      {/* Main Container */}
      <main className={`flex-1 flex flex-col min-w-0 relative h-full transition-colors duration-150 ${
        theme === 'dark' ? 'bg-[#0D0D0D]' : 'bg-[#F9F9FA]'
      }`}>
        {/* Top Header */}
        <AppHeader
          theme={theme}
          logoVariant={logoVariant}
          userSettings={userSettings}
          isSidebarCollapsed={ui.isSidebarCollapsed}
          onOpenSidebar={handleOpenSidebar}
          onOpenSubscriptionModal={handleOpenSubscriptionModal}
          onToggleTheme={handleToggleTheme}
          onOpenSettings={() => ui.openModal('settings')}
          onNewChat={handleNewChat}
          user={profile}
        />

        {/* Main Conversation Feed */}
        <div className="flex-1 overflow-y-auto w-full scrollbar-custom">
          <div className="flex flex-col w-full min-h-full pb-36 pt-4 max-w-4xl mx-auto">
            
            {/* Warning Banner */}
            {!isPro && backendLimits && adminConfig && (
              (() => {
                const limit = adminConfig.messages;
                const used = backendLimits.messages;
                const remaining = Math.max(0, limit - used);
                if (remaining <= 10 && remaining > 0) {
                  return (
                    <div className="w-full mx-auto px-4 sm:px-8 mb-2">
                      <div className="bg-neutral-50 dark:bg-[#1C1C1E]/20 text-neutral-800 dark:text-neutral-200 text-sm py-2.5 px-4 rounded-xl flex items-center justify-between border border-neutral-200 dark:border-[#2C2C2E]/50">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">Restam apenas {remaining} mensage{remaining === 1 ? 'm' : 'ns'} hoje.</span>
                          <span className="hidden sm:inline opacity-80">Faça upgrade para o ZENO Pro para continuar sem interrupções.</span>
                        </div>
                        <button onClick={() => handleOpenSubscriptionModal()} className="font-semibold underline underline-offset-2 hover:opacity-80">
                          Upgrade
                        </button>
                      </div>
                    </div>
                  );
                }
                return null;
              })()
            )}

            {/* Plan Usage Card */}
            {showUsageCard && !isPro && (messages.length === 0 || (messages.length === 1 && messages[0].id.startsWith('welcome'))) && (
              <div className="w-full px-4 sm:px-8 flex flex-col pt-4">
                <PlanUsageCard 
                  plan={userSettings.plan} 
                  limits={adminConfig} 
                  usage={backendLimits} 
                  onClose={() => setShowUsageCard(false)} 
                  onUpgrade={() => handleOpenSubscriptionModal()} 
                />
              </div>
            )}
            
            {/* Model Welcome Card on New Chat */}
            {isNewChat && messages.length === 0 && (
              <WelcomeScreen
                speed={speed}
                theme={theme}
                logoVariant={logoVariant}
                userName={userSettings.userName}
                onSelectPrompt={(prompt) => setInput(prompt)}
                onOpenMusicStudio={() => ui.openModal('musicStudio')}
                onSelectSpeed={handleSelectSpeed}
                user={profile}
                onLogin={() => ui.openModal('auth')}
                authLoading={authLoading}
              />
            )}

            {/* Conversation Messages Container */}

            <MessageList
              messages={messages}
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
              messagesEndRef={messagesEndRef}
              onCopy={copyToClipboard}
              onToggleSpeech={toggleSpeech}
              onSetFeedback={handleSetFeedback}
              onRegenerate={handleRegenerate}
              onStartEditMessage={handleStartEditMessage}
              onCancelEditMessage={handleCancelEditMessage}
              onSaveEditMessage={handleSaveEditMessage}
              onEditingTextChange={setEditingMessageText}
              onOpenSubscriptionModal={handleOpenSubscriptionModal}
              userId={userId}
              userToken={session?.access_token || null}
              onYouTubeAction={handleYouTubeAction}
              onSendAdaptiveFeedback={handleSendAdaptiveFeedback}
            />
          </div>
        </div>

        {/* Composer Input Area */}
        <div className="flex-shrink-0 w-full flex flex-col">
          <ComposerInput
            input={input}
            setInput={setInput}
            isLoading={isLoading}
            attachments={attachments}
            onAddAttachment={handleAddAttachment}
            onRemoveAttachment={handleRemoveAttachment}
            onSubmit={handleChatSubmit}
            onStopGeneration={handleStopGeneration}
            speed={speed}
            onSelectSpeed={handleSelectSpeed}
            theme={theme}
            plan={userSettings.plan}
            onOpenSubscriptionModal={handleOpenSubscriptionModal}
            onOpenProFeatureModal={handleOpenProFeatureModal}
            dailyUsage={dailyUsage}
            cloudDraftPrompt={cloudDraftPrompt}
            onAcceptCloudDraft={acceptCloudDraft}
            onDismissCloudDraft={dismissCloudDraft}
          />
        </div>
      </main>

      {/* Global App Modals */}
      <AppModals
        theme={theme}
        userSettings={userSettings}
        onUpdateSettings={handleUpdateSettings}
        adaptiveProfile={adaptiveProfile}
        onUpdateAdaptiveProfile={setAdaptiveProfile}
        userId={userId}
        profile={profile}
        session={session}
        logout={logout}
        signInWithGoogle={signInWithGoogle}
        switchAccount={switchAccount}
        authLoading={authLoading}
        backendLimits={backendLimits}
        adminConfig={adminConfig}
        onClearHistory={handleClearAllHistory}
        onExportAllData={handleExportAllData}
        onDeleteSession={handleDeleteSession}
        onSubmitPrompt={handleChatSubmit}
        sessions={sessions}
        onSelectSession={setCurrentSessionId}
        onLimitReached={handleLimitReached}
        dailyUsage={dailyUsage}
        onUpdateUsage={setDailyUsage}
      />

    </div>
  </LanguageProvider>
);
}

function MainAppWrapper() {
  const { profile } = useAuth();
  // For the provider, we prefer the real Firebase UID. 
  // If not available, we use the local ID, but most Firestore-based logic should wait for the UID.
  const userId = profile?.uid || getOrCreateUserId(profile?.uid);
  const userEmail = profile?.email || '';

  return (
    <SubscriptionProvider userId={userId} userEmail={userEmail}>
      <MainAppInner />
    </SubscriptionProvider>
  );
}

  const AuthWrapper = () => {
    const { loading } = useAuth();
    const { t } = useTranslation();
    if (loading) return <div className="flex items-center justify-center min-h-screen bg-[#050505] text-white">{t.common.loading}...</div>;
    return <MainAppWrapper />;
  }

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <UIProvider>
          <VersionProvider>
            <AuthWrapper />
          </VersionProvider>
        </UIProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}
