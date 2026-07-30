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
import { 
  getTodayString, 
  getInitialUsage, 
  isModelPro, 
  checkUsageLimit, 
  FREE_LIMITS,
  getModelDef
} from './lib/subscription';
import { hasPremiumAccess } from './config/admin';

const STORAGE_KEY_SESSIONS = 'zeno_chat_sessions_v3';
const STORAGE_KEY_CURRENT_ID = 'zeno_current_session_id_v3';
const STORAGE_KEY_SETTINGS = 'zeno_user_settings_v3';
const STORAGE_KEY_USAGE = 'zeno_daily_usage_v3';

const YOUTUBE_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

function MainAppInner() {
  const ui = useUIState();
  const { trackApi } = usePerformanceMetrics('MainApp');
  const { isPro } = useSubscription();

  // User Settings State
  const [userSettings, setUserSettings] = useState<UserSettings>(() => {
    const DEFAULT_SETTINGS: UserSettings = {
      userName: 'Davi Fernandes',
      userEmail: 'davifernandes0024509@gmail.com',
      userAvatar: '',
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
    };

    try {
      const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Ensure all default keys exist, especially autoRead
        const merged = { ...DEFAULT_SETTINGS, ...parsed };
        
        if (merged.plan !== 'ZENO Pro' && merged.plan !== 'ZENO Free') {
          merged.plan = 'ZENO Free';
        }
        return merged;
      }
    } catch (e) {
      console.error('Error loading settings:', e);
    }
    return DEFAULT_SETTINGS;
  });

  // Auth State
  const { 
    user, 
    profile, 
    loading: authLoading, 
    signInWithGoogle, 
    logout, 
    switchAccount, 
    session 
  } = useAuth();

  // Sync user profile data to settings when logged in
  useEffect(() => {
    if (profile) {
      setUserSettings(prev => {
        const newName = profile.displayName || prev.userName;
        const newEmail = profile.email || prev.userEmail;
        const newAvatar = profile.photoURL || prev.userAvatar;

        if (
          prev.userName === newName &&
          prev.userEmail === newEmail &&
          prev.userAvatar === newAvatar
        ) {
          return prev;
        }

        return {
          ...prev,
          userName: newName,
          userEmail: newEmail,
          userAvatar: newAvatar
        };
      });
    }
  }, [profile]);

  useEffect(() => {
    if (isPro || (profile && hasPremiumAccess(profile)) || hasPremiumAccess(userSettings) || hasPremiumAccess(profile?.email)) {
      if (userSettings.plan !== 'ZENO Pro') {
        setUserSettings(prev => ({ ...prev, plan: 'ZENO Pro' }));
      }
    }
  }, [isPro, profile, userSettings.userEmail]);

  const userId = getOrCreateUserId(profile?.uid);

  // Adaptive Learning Profile State & Effects
  const [adaptiveProfile, setAdaptiveProfile] = useState<AdaptiveLearningProfile>(DEFAULT_ADAPTIVE_PROFILE);

  useEffect(() => {
    if (userId) {
      fetch(`/api/adaptive/profile?userId=${encodeURIComponent(userId)}`)
        .then(async res => {
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            return res.json();
          }
          return { profile: DEFAULT_ADAPTIVE_PROFILE };
        })
        .then(data => {
          if (data && data.profile) {
            setAdaptiveProfile(data.profile);
          }
        })
        .catch(err => console.error('Erro ao carregar perfil adaptativo:', err));
    }
  }, [userId]);

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
      ui.openModal('auth', { data: { message: "Crie uma conta ou faça login para assinar um plano e salvar seus dados." } });
      return;
    }
    if (isPro) {
      ui.openModal('subscription', { data: { reasonMessage } });
    } else {
      ui.openModal('plans');
    }
  }, [ui, isPro, user]);

  const handleOpenProFeatureModal = useCallback(() => {
    if (!user && !user?.isAnonymous) {
      ui.openModal('auth', { data: { message: "Crie uma conta ou faça login para acessar recursos Pro." } });
      return;
    }
    ui.openModal('proFeature');
  }, [ui, user]);

  // Daily Usage Tracker State
  const [backendLimits, setBackendLimits] = useState<any>(null);
  const [adminConfig, setAdminConfig] = useState<any>({
    messages: 50,
    search: 20,
    image: 10,
    doc: 5,
    vision: 10,
  });
  const [showUsageCard, setShowUsageCard] = useState(true);

  const fetchLimits = async () => {
    try {
      const res = await measureApiLatency('/api/limits', () => fetch(`/api/limits?userId=${userId}`));
      if (res.ok) {
        const data = await res.json();
        if (data.usage?.usage) {
          setBackendLimits((prev: any) => {
            const next = data.usage.usage;
            if (prev && JSON.stringify(prev) === JSON.stringify(next)) return prev;
            return next;
          });
        }
        if (data.config?.limits) {
          setAdminConfig((prev: any) => {
            const next = data.config.limits;
            if (prev && JSON.stringify(prev) === JSON.stringify(next)) return prev;
            return next;
          });
        }
      }
    } catch (e) {
      console.warn("Could not fetch limits from server, using local defaults:", e);
    }
  };

  useEffect(() => {
    fetchLimits();
    const interval = setInterval(fetchLimits, 60000);
    return () => clearInterval(interval);
  }, []);

  const [dailyUsage, setDailyUsage] = useState<DailyUsage>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_USAGE);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.date === getTodayString()) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error loading daily usage:', e);
    }
    return getInitialUsage();
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_USAGE, JSON.stringify(dailyUsage));
    } catch (e) {
      console.error('Error saving usage:', e);
    }
  }, [dailyUsage]);

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
    userId,
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

  // Sessions & Active Chat State
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY_SESSIONS}_${userId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Error loading chat sessions:', e);
    }
    return [];
  });

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(() => {
    const savedId = localStorage.getItem(`${STORAGE_KEY_CURRENT_ID}_${userId}`);
    if (savedId && savedId !== 'null' && sessions.some(s => s.id === savedId)) {
      return savedId;
    }
    return null;
  });

  // Auto-save sessions per userId
  useEffect(() => {
    if (userId) {
      localStorage.setItem(`${STORAGE_KEY_SESSIONS}_${userId}`, JSON.stringify(sessions));
    }
  }, [sessions, userId]);

  // Auto-save currentSessionId per userId
  useEffect(() => {
    if (userId) {
      localStorage.setItem(`${STORAGE_KEY_CURRENT_ID}_${userId}`, currentSessionId || 'null');
    }
  }, [currentSessionId, userId]);

  // Local Chat UI State
  const [isNewChat, setIsNewChat] = useState<boolean>(true);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, 'up' | 'down'>>({});
  const [speed, setSpeed] = useState<ModelType>('smart');
  const [searchQuery, setSearchQuery] = useState('');

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
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Text-To-Speech
  const toggleSpeech = useCallback((id: string, text: string) => {
    if (!('speechSynthesis' in window)) {
      alert('Seu navegador não suporta leitura de áudio em voz alta.');
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
      text: "Você atingiu o limite diário do Plano Gratuito.\n\nFaça upgrade para o ZENO Pro e continue utilizando todos os modelos sem limites, com prioridade máxima, geração de imagens ilimitada, pesquisas avançadas, análise de arquivos, maior velocidade de resposta, acesso antecipado aos novos modelos e todos os recursos Premium.",
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
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      setIsLoading(false);
    }
    setIsNewChat(true);
    setCurrentSessionId(null);
    setInput('');
    setAttachments([]);
    ui.setSidebarOpen(false);
  }, [isLoading, ui]);

  // Handle Speech Recognition Toggle
  const toggleListening = useCallback(() => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechError('Reconhecimento de voz não é suportado pelo seu navegador.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = userSettings.speechLanguage || 'pt-BR';

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setInput(prev => prev + (prev ? ' ' : '') + transcript);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setSpeechError(`Erro no reconhecimento: ${event.error}`);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (e) {
      console.error('Failed to start speech recognition:', e);
      setSpeechError('Não foi possível iniciar o microfone.');
      setIsListening(false);
    }
  }, [isListening, userSettings.speechLanguage]);

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
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  }, []);

  // Main Submit Handler
  const handleSubmit = useCallback(async (e?: React.FormEvent, overrideText?: string, extraContext?: string) => {
    if (e) e.preventDefault();
    setIsNewChat(false);

    const textToSend = overrideText !== undefined ? overrideText : input;
    if ((!textToSend.trim() && attachments.length === 0) || isLoading) return;

    if (isModelPro(speed) && !isPro) {
      handleOpenProFeatureModal();
      return;
    }

    const usageAction = speed === 'image' ? 'image' : speed === 'search' ? 'search' : 'message';
    const usageCheck = checkUsageLimit(isPro ? 'ZENO Pro' : userSettings.plan, dailyUsage, usageAction);
    if (!usageCheck.allowed) {
      handleLimitReached();
      return;
    }

    if (!isPro) {
      const limitKey = speed === 'image' ? 'image' : speed === 'vision' ? 'vision' : 'messages';
      const currentCount = (dailyUsage as any)[limitKey] || 0;
      setDailyUsage(prev => ({
        ...prev,
        [limitKey]: currentCount + 1,
      }));
    }

    const currentInput = textToSend;
    const currentAttachments = [...attachments];

    if (overrideText === undefined) {
      setInput('');
      setAttachments([]);
      clearDraft();
    }

    let sessionId = currentSessionId;
    let isNewSession = false;

    if (!sessionId) {
      isNewSession = true;
      const newSession: ChatSession = {
        id: Date.now().toString(),
        title: generateTitleFromMessage(currentInput),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [],
        speed,
      };
      sessionId = newSession.id;
      setSessions(prev => [newSession, ...prev]);
      setCurrentSessionId(sessionId);
    }

    const userMsgId = Date.now().toString();
    const userMessage: Message = {
      id: userMsgId,
      role: 'user',
      text: currentInput,
      timestamp: Date.now(),
      attachments: currentAttachments,
    };

    const youtubeMatch = currentInput.match(YOUTUBE_REGEX);
    const youtubeUrl = youtubeMatch ? youtubeMatch[0] : undefined;

    const msgLower = currentInput.toLowerCase();
    const clientSearchTriggers = [
      'buscar', 'pesquisar', 'procurar', 'notícias sobre', 'noticias sobre',
      'o que é', 'o que e', 'quem é', 'quem e', 'últimas notícias', 'ultimas noticias',
      'pesquise', 'procure', 'busque', 'notícia de hoje', 'noticia de hoje'
    ];
    const isClientSearch = speed === 'search' || clientSearchTriggers.some(t => msgLower.includes(t));

    const initialModelMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'model',
      text: youtubeUrl ? '' : '', // Placeholder
      timestamp: Date.now(),
      modelSpeed: isClientSearch ? 'search' : speed,
      youtubeUrl: youtubeUrl,
      isSearching: isClientSearch,
      isSearch: isClientSearch,
    };

    setSessions(prev =>
      prev.map(s => {
        if (s.id === sessionId) {
          return {
            ...s,
            messages: [...s.messages, userMessage, initialModelMessage],
            updatedAt: Date.now(),
          };
        }
        return s;
      })
    );

    setIsLoading(true);
    abortControllerRef.current = new AbortController();
    const chatTimeoutId = setTimeout(() => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    }, 120000); // 2 minute timeout safety

    try {
      const token = user ? await user.getIdToken() : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await measureApiLatency('/api/chat', () =>
        fetch('/api/chat', {
          method: 'POST',
          headers,
          signal: abortControllerRef.current?.signal,
          body: JSON.stringify({
            message: extraContext ? `${extraContext}\n\n[SOLICITAÇÃO]: ${textToSend}` : textToSend,
            speed: speed,
            isSmartMode: userSettings.isSmartMode,
            attachments: currentAttachments,
            systemInstruction: userSettings.systemInstruction,
            temperature: userSettings.temperature,
            customInstructions: userSettings.customInstructions,
            userId: userId,
            userEmail: userSettings.userEmail,
            history: messages.slice(-10).map(m => ({ role: m.role, text: m.text })),
          }),
        })
      );
      clearTimeout(chatTimeoutId);

      if (!response.ok) {
        let errorMsg = `Ocorreu uma instabilidade ao conectar com o servidor ZENO (HTTP ${response.status}). Por favor, tente novamente em instantes.`;
        try {
          const errorData = await response.json();
          console.error('[ZENO API ERROR DETAILED - Status ' + response.status + ']:', errorData);
          if (errorData) {
            errorMsg = typeof errorData.error === 'string' ? errorData.error : (errorData.message || JSON.stringify(errorData) || errorMsg);
          }
        } catch (e) {
          const errText = await response.text().catch(() => '');
          console.error('[ZENO API ERROR NON-JSON - Status ' + response.status + ']:', errText);
        }
        if (response.status === 429) {
          handleLimitReached();
          setIsLoading(false);
          return;
        }
        if (response.status === 403) {
          // If 403 is due to Pro plan requirement for models like search/mega/vision/think
          handleOpenProFeatureModal();
        }
        throw new Error(errorMsg);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';
      let buffer = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunkText = decoder.decode(value, { stream: true });
          buffer += chunkText;

          // SSE Parsing
          let textUpdated = false;
          while (buffer.includes('\n\n')) {
            const eventIndex = buffer.indexOf('\n\n');
            const eventStr = buffer.slice(0, eventIndex);
            buffer = buffer.slice(eventIndex + 2); // Remove processed event

            const lines = eventStr.split('\n');
            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith('data:')) {
                const dataStr = trimmed.substring(5).trim();
                if (dataStr === '[DONE]') continue;
                
                try {
                  const data = JSON.parse(dataStr);
                  if (data.activeModel && data.modelId) {
                    setSessions(prev =>
                      prev.map(s => {
                        if (s.id === sessionId) {
                          const updatedMsgs = [...s.messages];
                          const lastIdx = updatedMsgs.length - 1;
                          if (lastIdx >= 0 && updatedMsgs[lastIdx].role === 'model') {
                            updatedMsgs[lastIdx] = {
                              ...updatedMsgs[lastIdx],
                              modelSpeed: data.modelId
                            };
                          }
                          return { ...s, messages: updatedMsgs };
                        }
                        return s;
                      })
                    );
                    continue;
                  }
                  if (data.error) {
                    accumulatedText = data.error;
                    textUpdated = true;
                    continue;
                  }
                  if (data.isSearch !== undefined || data.sources !== undefined) {
                    setSessions(prev =>
                      prev.map(s => {
                        if (s.id === sessionId) {
                          const updatedMsgs = [...s.messages];
                          const lastIdx = updatedMsgs.length - 1;
                          if (lastIdx >= 0 && updatedMsgs[lastIdx].role === 'model') {
                            updatedMsgs[lastIdx] = {
                              ...updatedMsgs[lastIdx],
                              isSearch: data.isSearch !== undefined ? data.isSearch : updatedMsgs[lastIdx].isSearch,
                              searchSources: data.sources || updatedMsgs[lastIdx].searchSources,
                              isSearching: false,
                            };
                          }
                          return { ...s, messages: updatedMsgs };
                        }
                        return s;
                      })
                    );
                  }
                  if (data.text !== undefined) {
                    // Replace full text (since server often sends full text replacements)
                    accumulatedText = data.text;
                    textUpdated = true;
                  } else if (data.delta && data.delta.content) {
                    accumulatedText += data.delta.content;
                    textUpdated = true;
                  }
                } catch (e) {
                  // Fallback: If it's valid SSE but not JSON, append plain text
                  if (dataStr && !dataStr.startsWith('{') && !dataStr.startsWith('[')) {
                    accumulatedText += dataStr;
                    textUpdated = true;
                  }
                }
              }
            }
          }

          // Fallback if the backend is just sending raw text without SSE format
          if (textUpdated === false && !buffer.includes('data:') && !buffer.includes('event:')) {
             try {
                // Try to parse the entire buffer as JSON in case it's a single JSON response
                const data = JSON.parse(buffer);
                if (data.text) {
                   accumulatedText = data.text;
                   textUpdated = true;
                   buffer = '';
                }
             } catch (e) {
                // If it's just plain text being streamed and doesn't look like SSE at all
                if (buffer.length > 0 && !buffer.startsWith('{')) {
                   accumulatedText += buffer;
                   textUpdated = true;
                   buffer = '';
                }
             }
          }

          if (textUpdated) {
            setSessions(prev =>
              prev.map(s => {
                if (s.id === sessionId) {
                  const updatedMsgs = [...s.messages];
                  const lastIdx = updatedMsgs.length - 1;
                  if (lastIdx >= 0 && updatedMsgs[lastIdx].role === 'model') {
                    updatedMsgs[lastIdx] = {
                      ...updatedMsgs[lastIdx],
                      text: accumulatedText,
                    };
                  }
                  return { ...s, messages: updatedMsgs };
                }
                return s;
              })
            );
          }
        }
      }

      if (userSettings.autoRead && accumulatedText) {
        toggleSpeech(initialModelMessage.id, accumulatedText);
      }

      if (accumulatedText.includes('![')) {
        scanAndSaveImagesFromText(accumulatedText, sessionId, activeSession?.title || 'Conversa', speed);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Geração cancelada ou tempo limite atingido.');
        setSessions(prev =>
          prev.map(s => {
            if (s.id === sessionId) {
              const updatedMsgs = [...s.messages];
              const lastIdx = updatedMsgs.length - 1;
              if (lastIdx >= 0 && updatedMsgs[lastIdx].role === 'model' && !updatedMsgs[lastIdx].text) {
                updatedMsgs[lastIdx] = {
                  ...updatedMsgs[lastIdx],
                  hasError: true,
                  errorMessage: 'Tempo limite de resposta excedido ou geração interrompida.',
                };
              }
              return { ...s, messages: updatedMsgs };
            }
            return s;
          })
        );
      } else {
        console.error('Erro na requisição da IA:', err);
        setSessions(prev =>
          prev.map(s => {
            if (s.id === sessionId) {
              const updatedMsgs = [...s.messages];
              const lastIdx = updatedMsgs.length - 1;
              if (lastIdx >= 0 && updatedMsgs[lastIdx].role === 'model') {
                updatedMsgs[lastIdx] = {
                  ...updatedMsgs[lastIdx],
                  hasError: true,
                  errorMessage: err.message || 'Ocorreu uma falha ao comunicar com a inteligência do ZENO.',
                  rawErrorDetails: err.stack || String(err),
                };
              }
              return { ...s, messages: updatedMsgs };
            }
            return s;
          })
        );
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [
    input, 
    attachments, 
    isLoading, 
    speed, 
    isPro, 
    dailyUsage, 
    userSettings, 
    currentSessionId, 
    userId, 
    user, 
    messages, 
    activeSession?.title, 
    handleOpenProFeatureModal, 
    handleLimitReached, 
    toggleSpeech
  ]);

  // Attachment & Modal Handlers (Memoized)
  const handleAddAttachment = useCallback((att: FileAttachment) => {
    setAttachments(prev => [...prev, att]);
  }, []);

  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  }, []);

  const handleOpenImageStudioModal = useCallback(() => {
    ui.openModal('imageStudio');
  }, [ui]);

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
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  // Memoized ReactMarkdown Custom Components
  const markdownComponents = useMemo(() => ({
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : '';
      const codeString = String(children).replace(/\n$/, '');

      if (!inline && language) {
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
      if (!src) return null;
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
          <div className="flex flex-col items-center min-h-full pb-36 pt-4">
            
            {/* Warning Banner */}
            {!isPro && backendLimits && adminConfig && (
              (() => {
                const limit = adminConfig.messages;
                const used = backendLimits.messages;
                const remaining = Math.max(0, limit - used);
                if (remaining <= 10 && remaining > 0) {
                  return (
                    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 mb-2">
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
              <div className="w-full max-w-4xl px-4 sm:px-6 flex flex-col pt-4">
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
                onOpenImageStudio={() => ui.openModal('imageStudio')}
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
            isListening={isListening}
            speechError={speechError}
            attachments={attachments}
            onAddAttachment={handleAddAttachment}
            onRemoveAttachment={handleRemoveAttachment}
            onToggleListening={toggleListening}
            onSubmit={handleSubmit}
            onStopGeneration={handleStopGeneration}
            onOpenImageStudio={handleOpenImageStudioModal}
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
        onSubmitPrompt={handleSubmit}
        sessions={sessions}
        onSelectSession={setCurrentSessionId}
        onLimitReached={handleLimitReached}
        dailyUsage={dailyUsage}
        onUpdateUsage={setDailyUsage}
      />
    </div>
  );
}

function MainAppWrapper() {
  const { profile } = useAuth();
  const userId = getOrCreateUserId(profile?.uid);
  const userEmail = profile?.email || '';

  return (
    <SubscriptionProvider userId={userId} userEmail={userEmail}>
      <MainAppInner />
    </SubscriptionProvider>
  );
}

function AuthWrapper() {
  const { loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen bg-[#050505] text-white">Carregando...</div>;
  return <MainAppWrapper />;
}

export default function App() {
  return (
    <AuthProvider>
      <UIProvider>
        <AuthWrapper />
      </UIProvider>
    </AuthProvider>
  );
}
