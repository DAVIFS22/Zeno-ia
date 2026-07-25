import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { getOrCreateUserId } from './lib/userId';
import { 
  Copy, Check, Plus, MessageSquare, 
  Sparkles, ThumbsUp, ThumbsDown, Settings, X, Moon, Sun, Zap, Brain, 
  Trash2, Edit2, Edit3, Volume2, VolumeX, Download, 
  Search, RefreshCw, PanelLeftClose, PanelLeftOpen, ChevronDown, Globe,
  Wand2, Pin, Star, FileText, Code, Lock, HelpCircle
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message, ChatSession, FileAttachment, UserSettings, ModelType, DailyUsage } from './types';
import { groupSessionsByDate, generateTitleFromMessage } from './utils/date';
import { CodeBlock } from './components/CodeBlock';
import { ZenoLogo } from './components/ZenoLogo';
import { ImageStudioModal } from './components/ImageStudioModal';
import { ImageLibraryModal } from './components/ImageLibraryModal';
import { ProjectsModal } from './components/ProjectsModal';
import { PluginsModal } from './components/PluginsModal';
import { MoreModal } from './components/MoreModal';
import { ImageWithLoader } from './components/ImageWithLoader';
import { syncLibraryWithBackend, scanAndSaveImagesFromText } from './lib/imageLibraryStorage';
import { SettingsModal } from './components/SettingsModal';
import { ErrorBanner } from './components/ErrorBanner';
import { WelcomeScreen } from './components/WelcomeScreen';
import { LimitReachedScreen } from './components/LimitReachedScreen';
import { PlanUsageCard } from './components/PlanUsageCard';
import { ComposerInput } from './components/ComposerInput';
import { SubscriptionModal } from './components/SubscriptionModal';
import { SidebarNav } from './components/SidebarNav';
import { useAuth } from './hooks/useAuth';
import { MessageList } from './components/MessageList';
import { AppHeader } from './components/AppHeader';
import { 
  getTodayString, 
  getInitialUsage, 
  isModelPro, 
  checkUsageLimit, 
  FREE_LIMITS,
  getModelDef
} from './lib/subscription';
import { syncUserProfile } from './lib/firebase';
import { LogIn, LogOut, User as UserIcon, Shield } from 'lucide-react';

const STORAGE_KEY_SESSIONS = 'zeno_chat_sessions_v3';
const STORAGE_KEY_CURRENT_ID = 'zeno_current_session_id_v3';
const STORAGE_KEY_SETTINGS = 'zeno_user_settings_v3';
const STORAGE_KEY_USAGE = 'zeno_daily_usage_v3';

export default function App() {
  // User Settings State
  const [userSettings, setUserSettings] = useState<UserSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.plan !== 'ZENO Pro' && parsed.plan !== 'ZENO Free') {
          parsed.plan = 'ZENO Free';
        }
        return parsed;
      }
    } catch (e) {
      console.error('Error loading settings:', e);
    }
    return {
      userName: 'Davi Fernandes',
      userEmail: 'davifernandes0024509@gmail.com',
      userAvatar: '',
      plan: 'ZENO Free',
      theme: 'dark',
      logoVariant: 'monochrome',
      fontSize: 'normal',
      defaultSpeed: 'zeno',
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
      soundEnabled: true,
      notificationsEnabled: true,
    };
  });

  // Auth State
  const { 
    user, 
    profile, 
    loading: authLoading, 
    login: signInWithGoogle, 
    logout, 
    switchAccount, 
    session 
  } = useAuth();

  // Sync user profile data to settings when logged in
  useEffect(() => {
    if (profile) {
      setUserSettings(prev => ({
        ...prev,
        userName: profile.displayName || prev.userName,
        userEmail: profile.email || prev.userEmail,
        userAvatar: profile.photoURL || prev.userAvatar,
      }));
    }
  }, [profile]);

  // Subscription System State
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [subscriptionReasonMessage, setSubscriptionReasonMessage] = useState<string | undefined>(undefined);

  const handleOpenSubscriptionModal = useCallback((reasonMessage?: string) => {
    setSubscriptionReasonMessage(reasonMessage);
    setIsSubscriptionModalOpen(true);
  }, []);

  // Daily Usage Tracker State
  
  const userId = getOrCreateUserId();
  const [backendLimits, setBackendLimits] = useState<any>(null);
  const [adminConfig, setAdminConfig] = useState<any>({
    messages: 50,
    search: 20,
    image: 10,
    doc: 5,
    vision: 10,
  });
  const [limitReachedScreen, setLimitReachedScreen] = useState<string | null>(null);
  const [showUsageCard, setShowUsageCard] = useState(true); // 'messages', 'image', etc

  const fetchLimits = async () => {
    try {
      const res = await fetch(`/api/limits?userId=${userId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.usage?.usage) setBackendLimits(data.usage.usage);
        if (data.config?.limits) setAdminConfig(data.config.limits);
      }
    } catch (e) {
      console.warn("Could not fetch limits from server, using local defaults:", e);
    }
  };

  useEffect(() => {
    fetchLimits();
    // Poll every 30s to keep countdown/limits fresh if needed, but fetch on mount is enough
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
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(updated));
      return updated;
    });
  }, []);

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
      const saved = localStorage.getItem(STORAGE_KEY_SESSIONS);
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
    const savedId = localStorage.getItem(STORAGE_KEY_CURRENT_ID);
    if (savedId && savedId !== 'null' && sessions.some(s => s.id === savedId)) {
      return savedId;
    }
    return null;
  });

  // UI State
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, 'up' | 'down'>>({});
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile drawer
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false); // Desktop collapse
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isImageStudioOpen, setIsImageStudioOpen] = useState(false);
  const [isImageLibraryOpen, setIsImageLibraryOpen] = useState(false);
  const [isProjectsOpen, setIsProjectsOpen] = useState(false);
  const [isPluginsOpen, setIsPluginsOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [speed, setSpeed] = useState<ModelType>('zeno');
  const [searchQuery, setSearchQuery] = useState('');

  // Sync image library from backend on start
  useEffect(() => {
    syncLibraryWithBackend().catch(() => {});
  }, []);

  // Session renaming/deleting
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
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
          scanAndSaveImagesFromText(msg.text, currentSessionId, activeSession?.title || 'Conversa', speed);
        }
      });
    }
  }, [messages, currentSessionId, activeSession?.title, speed]);

  const handleSelectSpeed = useCallback((newSpeed: any) => {
    if (isModelPro(newSpeed) && userSettings.plan !== 'ZENO Pro') {
      handleOpenSubscriptionModal(`O modelo ${getModelDef(newSpeed).name} é exclusivo para assinantes do plano ZENO Pro.`);
      return;
    }
    setSpeed(newSpeed);
    setSessions(prev =>
      prev.map(s => (s.id === currentSessionId ? { ...s, speed: newSpeed } : s))
    );
  }, [userSettings.plan, currentSessionId, handleOpenSubscriptionModal]);

  // Sync sessions & current id to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessions));
      if (currentSessionId) {
        localStorage.setItem(STORAGE_KEY_CURRENT_ID, currentSessionId);
      } else {
        localStorage.removeItem(STORAGE_KEY_CURRENT_ID);
      }
    } catch (e) {
      console.error('Failed to save state to localStorage:', e);
    }
  }, [sessions, currentSessionId]);

  // Keyboard shortcut: Cmd/Ctrl + Shift + O for New Chat
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        handleNewChat();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Check for Stripe Checkout success & Sync subscription state
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    const success = urlParams.get('success');

    const fetchSubscription = async (queryParam: string) => {
      try {
        const res = await fetch(`/api/subscription/retrieve?${queryParam}`);
        if (res.ok) {
          const data = await res.json();
          if (data.subscriptionId) {
            const updatePayload: Partial<UserSettings> = {
              stripeSubscription: {
                subscriptionId: data.subscriptionId,
                status: data.status,
                trialEnd: data.trialEnd,
                cancelAtPeriodEnd: data.cancelAtPeriodEnd,
                currentPeriodEnd: data.currentPeriodEnd,
                amount: data.amount,
                currency: data.currency
              }
            };
            
            // Marca o teste gratuito como utilizado permanentemente
            if (data.trialEnd) {
              updatePayload.hasUsedFreeTrial = true;
            }

            // If trial expired and canceled, downgrade plan
            if (data.status === 'canceled' || data.status === 'past_due' || data.status === 'unpaid') {
              updatePayload.plan = 'ZENO Free';
              updatePayload.stripeSubscription = undefined;
            } else {
              updatePayload.plan = 'ZENO Pro';
            }
            
            handleUpdateSettings(updatePayload);
          }
        }
      } catch (e) {
        console.error('Failed to verify subscription:', e);
      }
    };

    if (success === "true" && sessionId) {
      window.history.replaceState({}, document.title, window.location.pathname);
      fetchSubscription(`session_id=${sessionId}`).then(() => {
        alert("Assinatura ativada com sucesso! Bem-vindo ao ZENO Pro.");
      });
    } else if (userSettings.stripeSubscription?.subscriptionId) {
      fetchSubscription(`subscription_id=${userSettings.stripeSubscription.subscriptionId}`);
    }
  }, []);

  // Listen to Server-Sent Events (SSE) for real-time Stripe webhook updates
  useEffect(() => {
    const subscriptionId = userSettings.stripeSubscription?.subscriptionId;
    if (!subscriptionId) return;

    const eventSource = new EventSource(`/api/subscription/stream?subscription_id=${subscriptionId}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data && data.subscriptionId) {
          const updatePayload: Partial<UserSettings> = {
            stripeSubscription: {
              subscriptionId: data.subscriptionId,
              status: data.status,
              trialEnd: data.trialEnd,
              cancelAtPeriodEnd: data.cancelAtPeriodEnd,
              currentPeriodEnd: data.currentPeriodEnd,
              amount: data.amount,
              currency: data.currency
            }
          };

          if (data.status === "canceled" || data.status === "past_due" || data.status === "unpaid") {
            updatePayload.plan = "ZENO Free";
            updatePayload.stripeSubscription = undefined;
          } else {
            updatePayload.plan = "ZENO Pro";
          }

          setUserSettings((prev) => {
            const updated = { ...prev, ...updatePayload };
            localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(updated));
            return updated;
          });
        }
      } catch (err) {
        console.error("Error parsing SSE data", err);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [userSettings.stripeSubscription?.subscriptionId]);

  // Handle Speech Recognition
  const startListening = () => {
    setSpeechError(null);
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechError('Seu navegador não suporta reconhecimento de voz.');
      setTimeout(() => setSpeechError(null), 4000);
      return;
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'pt-BR';

      let initialText = input;

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setInput(initialText ? `${initialText} ${currentTranscript}` : currentTranscript);
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'not-allowed') {
          setSpeechError('Permissão do microfone negada.');
        } else if (event.error !== 'no-speech') {
          setSpeechError(`Erro no áudio: ${event.error}`);
        }
        setIsListening(false);
        setTimeout(() => setSpeechError(null), 4000);
      };

      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      setSpeechError('Erro ao iniciar captura de áudio.');
      setIsListening(false);
      setTimeout(() => setSpeechError(null), 4000);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  const toggleListening = () => {
    if (isListening) stopListening();
    else startListening();
  };

  // Text-To-Speech
  const toggleSpeech = (id: string, text: string) => {
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
    const cleanText = text
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/```[\s\S]*?```/g, 'Bloco de código omitido.')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/#+\s/g, '');

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'pt-BR';
    utterance.rate = userSettings.voiceSpeed || 1.0;

    utterance.onend = () => setSpeakingMessageId(null);
    utterance.onerror = () => setSpeakingMessageId(null);

    setSpeakingMessageId(id);
    window.speechSynthesis.speak(utterance);
  };

  // Memoized ReactMarkdown Custom Components
  const markdownComponents = useMemo(() => ({
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');
      const codeStr = String(children).replace(/\n$/, '');
      
      // Defensively check for block content to avoid hydration errors
      const hasNewline = codeStr.includes('\n');
      
      if (!inline || hasNewline || !!match) {
        return <CodeBlock language={match ? match[1] : ''} value={codeStr} theme={theme} />;
      }
      
      return (
        <code className={`px-1.5 py-0.5 rounded text-xs sm:text-sm font-mono ${
          theme === 'dark' ? 'bg-[#282832] text-sky-300 border border-neutral-700/50' : 'bg-neutral-200 text-sky-800 border border-neutral-300'
        }`} {...props}>
          {children}
        </code>
      );
    },
    a({ node, children, href, ...props }: any) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline font-semibold" {...props}>
          {children}
        </a>
      );
    },
    img({ node, src, alt }: any) {
      return (
        <ImageWithLoader
          src={src || ''}
          alt={alt}
          onRegenerate={() => {
            handleSubmit(undefined, alt || "Gere uma imagem");
          }}
          onVary={() => {
            handleSubmit(undefined, `Crie uma variação da imagem: ${alt || "imagem"}`);
          }}
          onEdit={() => {
            setInput(alt || "");
            const textarea = document.getElementById("composer-textarea");
            if (textarea) {
              textarea.focus();
            }
          }}
        />
      );
    },
    table({ node, children, ...props }: any) {
      return (
        <div className="overflow-x-auto my-4 rounded-xl border border-neutral-700/50">
          <table className="w-full text-left text-sm" {...props}>
            {children}
          </table>
        </div>
      );
    },
    p({ children }: any) {
      // Rendering as div to avoid hydration errors when AI generates block elements inside paragraphs
      return <div className="mb-4 last:mb-0 leading-relaxed">{children}</div>;
    },
    li({ children, ...props }: any) {
      return <li className="mb-1" {...props}>{children}</li>;
    }
  }), [theme]);

  const copyToClipboard = useCallback((id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  // Chat Sessions Operations
  const handleNewChat = useCallback(() => {
    setShowUsageCard(true);
    if (isLoading) handleStopGeneration();

    setCurrentSessionId(null);
    setIsSidebarOpen(false);
    setInput('');
    setAttachments([]);
  }, [isLoading]);

  const handleSelectSession = useCallback((id: string) => {
    if (isLoading) handleStopGeneration();
    setCurrentSessionId(id);
    setIsSidebarOpen(false);
  }, [isLoading]);

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
    setDeletingSessionId(null);
  }, [currentSessionId]);

  const togglePinSession = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions(prev =>
      prev.map(s => (s.id === id ? { ...s, isPinned: !s.isPinned } : s))
    );
  }, []);

  const toggleFavoriteSession = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions(prev =>
      prev.map(s => (s.id === id ? { ...s, isFavorite: !s.isFavorite } : s))
    );
  }, []);

  const startRenameSession = useCallback((session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditingTitle(session.title);
  }, []);

  const saveRenameSession = useCallback((id: string) => {
    const trimmed = editingTitle.trim();
    if (trimmed) {
      setSessions(prev =>
        prev.map(s => (s.id === id ? { ...s, title: trimmed, updatedAt: Date.now() } : s))
      );
    }
    setEditingSessionId(null);
    setEditingTitle('');
  }, [editingTitle]);

  const handleExportSession = (session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    const markdownContent = `# ${session.title}\n\n` + 
      session.messages.map(m => `### ${m.role === 'user' ? 'Você' : 'ZENO'}\n${m.text}\n`).join('\n---\n\n');

    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${session.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportAllData = () => {
    const allMarkdown = sessions.map(s => `# ${s.title}\n` + s.messages.map(m => `**${m.role === 'user' ? 'Você' : 'ZENO'}**: ${m.text}`).join('\n\n')).join('\n\n====================\n\n');
    const blob = new Blob([allMarkdown], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `zeno_backup_${Date.now()}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClearAllHistory = () => {
    setSessions([]);
    setCurrentSessionId(null);
    setIsSettingsOpen(false);
  };

  // Stop Generation
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  };

  // Submit User Message
  const handleSubmit = async (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    if (isListening) stopListening();

    // 1. Subscription & Usage Check: Model Pro gating
    if (isModelPro(speed) && userSettings.plan !== 'ZENO Pro') {
      handleOpenSubscriptionModal(`O modelo ${getModelDef(speed).name} é exclusivo para assinantes do plano ZENO Pro.`);
      return;
    }

    let textToSend = customText || input;
    if (attachments.length > 0 && !customText) {
      const attachSummary = attachments.map(a => {
        if (a.type === 'image' && a.url) {
          return `\n![${a.name}](${a.url})`;
        } else if (a.content) {
          return `\n\n\`\`\`${a.name}\n${a.content}\n\`\`\``;
        }
        return `\n[Arquivo: ${a.name}]`;
      }).join('\n');
      textToSend = `${textToSend.trim()} ${attachSummary}`.trim();
    }

    if (!textToSend.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: textToSend.trim(),
      timestamp: Date.now(),
      attachments: attachments.length > 0 ? [...attachments] : undefined,
    };

    const modelMessageId = (Date.now() + 1).toString();
    const placeholderMessage: Message = {
      id: modelMessageId,
      role: 'model',
      text: '',
      timestamp: Date.now(),
      modelSpeed: speed,
    };

    let activeId = currentSessionId;
    let targetSession = sessions.find(s => s.id === activeId);

    let isDefaultTitle = false;
    let fallbackTitle = 'Novo Chat';

    if (!targetSession) {
      const newSession: ChatSession = {
        id: 'session-' + Date.now(),
        title: generateTitleFromMessage(userMessage.text),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [userMessage, placeholderMessage],
        speed: speed,
      };
      setSessions(prev => [newSession, ...prev]);
      setCurrentSessionId(newSession.id);
      activeId = newSession.id;
      targetSession = newSession;
      isDefaultTitle = true; // Needs LLM title gen
    } else {
      isDefaultTitle = targetSession.title === 'Novo Chat' || targetSession.title === 'Exploração Neural';
      fallbackTitle = isDefaultTitle ? generateTitleFromMessage(userMessage.text) : targetSession.title;

      setSessions(prev =>
        prev.map(s => {
          if (s.id === activeId) {
            return {
              ...s,
              title: isDefaultTitle ? fallbackTitle : s.title,
              updatedAt: Date.now(),
              messages: [...s.messages, userMessage, placeholderMessage],
            };
          }
          return s;
        })
      );
    }

    // Asynchronously call small LLM to generate concise title summary
    if (isDefaultTitle) {
      const sessionIdToUpdate = activeId;
      fetch('/api/generate-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage.text }),
      })
        .then(res => res.json())
        .then(data => {
          if (data?.title) {
            setSessions(prev =>
              prev.map(s => {
                if (s.id === sessionIdToUpdate && (s.title === fallbackTitle || s.title === 'Novo Chat' || s.title === 'Exploração Neural')) {
                  return { ...s, title: data.title };
                }
                return s;
              })
            );
          }
        })
        .catch(err => {
          console.error('Erro ao gerar título de chat com IA:', err);
        });
    }

    if (!customText) {
      setInput('');
      setAttachments([]);
    }
    setIsLoading(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.text,
          history: messages.map(m => ({ role: m.role, text: m.text })),
          speed: speed,
          customInstructions: userSettings.customInstructions,
          attachments: attachments,
          userId: userId,
          plan: userSettings.plan
        }),
        signal: abortController.signal,
      });

      if (response.status === 403) {
        const errorData = await response.json();
        setIsLoading(false);
        setSessions(prev => prev.map(s => {
          if (s.id === activeId) {
            return { ...s, messages: s.messages.slice(0, -2) };
          }
          return s;
        }));
        setSubscriptionReasonMessage(errorData.error || 'Este modelo é exclusivo para assinantes ZENO Pro.');
        setIsSubscriptionModalOpen(true);
        return;
      }

      if (response.status === 429) {
        const errorData = await response.json();
        setLimitReachedScreen(errorData.actionType || 'messages');
        fetchLimits(); // refresh to get the latest usage
        setIsLoading(false);
        // We must remove the placeholder message and user message from the session
        setSessions(prev => prev.map(s => {
          if (s.id === activeId) {
            return { ...s, messages: s.messages.slice(0, -2) };
          }
          return s;
        }));
        return;
      }
      if (!response.body) throw new Error('Servidor não retornou dados de resposta');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                done = true;
                break;
              }
              try {
                const parsed = JSON.parse(data);
                if (parsed.text) {
                  setSessions(prev =>
                    prev.map(s => {
                      if (s.id === activeId) {
                        return {
                          ...s,
                          updatedAt: Date.now(),
                          messages: s.messages.map(msg =>
                            msg.id === modelMessageId ? { ...msg, text: msg.text + parsed.text } : msg
                          ),
                        };
                      }
                      return s;
                    })
                  );
                } else if (parsed.error) {
                  setSessions(prev =>
                    prev.map(s => {
                      if (s.id === activeId) {
                        return {
                          ...s,
                          messages: s.messages.map(msg =>
                            msg.id === modelMessageId ? {
                              ...msg,
                              text: parsed.error,
                              hasError: true,
                              errorMessage: parsed.error,
                            } : msg
                          ),
                        };
                      }
                      return s;
                    })
                  );
                }
              } catch (e) {
                console.error('Error parsing stream chunk:', e);
              }
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Geração interrompida pelo usuário.');
      } else {
        console.error('Erro no fluxo de mensagens:', error);
        setSessions(prev =>
          prev.map(s => {
            if (s.id === activeId) {
              return {
                ...s,
                messages: s.messages.map(msg =>
                  msg.id === modelMessageId
                    ? {
                        ...msg,
                        text: 'Não foi possível estabelecer conexão com os servidores do ZENO.',
                        hasError: true,
                        errorMessage: 'Ocorreu uma falha de comunicação com os servidores do ZENO.',
                        rawErrorDetails: String(error?.message || error)
                      }
                    : msg
                ),
              };
            }
            return s;
          })
        );
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  // Regenerate last response
  const handleRegenerate = () => {
    if (isLoading || messages.length < 2) return;
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMsg) {
      setSessions(prev =>
        prev.map(s => {
          if (s.id === currentSessionId) {
            const filtered = s.messages.filter(m => !(m.role === 'model' && m.id === messages[messages.length - 1].id));
            return { ...s, messages: filtered };
          }
          return s;
        })
      );
      handleSubmit(undefined, lastUserMsg.text);
    }
  };

  // Edit User Message
  const handleStartEditMessage = useCallback((id: string, text: string) => {
    setEditingMessageId(id);
    setEditingMessageText(text);
  }, []);

  const handleCancelEditMessage = useCallback(() => {
    setEditingMessageId(null);
    setEditingMessageText('');
  }, []);

  const handleSaveEditMessage = useCallback((msgId: string) => {
    if (!editingMessageText.trim() || isLoading) return;
    const msgIndex = messages.findIndex(m => m.id === msgId);
    if (msgIndex === -1) return;

    const updatedMessages = messages.slice(0, msgIndex);
    setSessions(prev =>
      prev.map(s => {
        if (s.id === currentSessionId) return { ...s, messages: updatedMessages };
        return s;
      })
    );

    const textToSubmit = editingMessageText.trim();
    setEditingMessageId(null);
    setEditingMessageText('');
    handleSubmit(undefined, textToSubmit);
  }, [editingMessageText, isLoading, messages, currentSessionId]);

  const handleSetFeedback = useCallback((msgId: string, value: 'up' | 'down') => {
    setFeedback(prev => ({ ...prev, [msgId]: value }));
  }, []);

  const handleToggleSearchVisible = useCallback(() => {
    setIsSearchVisible(prev => !prev);
  }, []);

  const handleCloseSidebar = useCallback(() => {
    setIsSidebarOpen(false);
    setIsSidebarCollapsed(true);
  }, []);

  const handleOpenSidebar = useCallback(() => {
    if (window.innerWidth < 768) setIsSidebarOpen(true);
    else setIsSidebarCollapsed(false);
  }, []);

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
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/70 z-30 md:hidden backdrop-blur-xs transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <SidebarNav
        theme={theme}
        logoVariant={logoVariant}
        isSidebarOpen={isSidebarOpen}
        isSidebarCollapsed={isSidebarCollapsed}
        isSearchVisible={isSearchVisible}
        searchQuery={searchQuery}
        groupedSessions={groupedSessions}
        currentSessionId={currentSessionId}
        editingSessionId={editingSessionId}
        editingTitle={editingTitle}
        userSettings={userSettings}
        onCloseSidebar={handleCloseSidebar}
        onNewChat={handleNewChat}
        onToggleSearchVisible={handleToggleSearchVisible}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenImageLibrary={() => setIsImageLibraryOpen(true)}
        onOpenProjects={() => setIsProjectsOpen(true)}
        onOpenPlugins={() => setIsPluginsOpen(true)}
        onOpenMore={() => setIsMoreOpen(true)}
        onSearchQueryChange={setSearchQuery}
        onSelectSession={handleSelectSession}
        onSetEditingTitle={setEditingTitle}
        onSetEditingSessionId={setEditingSessionId}
        onSaveRenameSession={saveRenameSession}
        onTogglePinSession={togglePinSession}
        onStartRenameSession={startRenameSession}
        onSetDeletingSessionId={setDeletingSessionId}
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
          isSidebarCollapsed={isSidebarCollapsed}
          onOpenSidebar={handleOpenSidebar}
          onOpenSubscriptionModal={handleOpenSubscriptionModal}
          onToggleTheme={handleToggleTheme}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onNewChat={handleNewChat}
          user={profile}
        />

        {/* Main Conversation Feed */}
        <div className="flex-1 overflow-y-auto w-full scrollbar-custom">
          <div className="flex flex-col items-center min-h-full pb-36 pt-4">
            
            {/* Limit Reached Screen */}
            {limitReachedScreen && (
              <LimitReachedScreen 
                actionType={limitReachedScreen} 
                onUpgrade={() => { setLimitReachedScreen(null); handleOpenSubscriptionModal('Faça upgrade para o ZENO Pro para utilizar sem limites.'); }} 
                onBack={() => setLimitReachedScreen(null)} 
              />
            )}
            
            {/* Warning Banner */}
            {userSettings.plan === 'ZENO Free' && backendLimits && adminConfig && (
              (() => {
                const limit = adminConfig.messages;
                const used = backendLimits.messages;
                const remaining = Math.max(0, limit - used);
                if (remaining <= 10 && remaining > 0) {
                  return (
                    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 mb-2">
                      <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 text-sm py-2.5 px-4 rounded-xl flex items-center justify-between border border-amber-200 dark:border-amber-800/50">
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
            {!limitReachedScreen && showUsageCard && userSettings.plan === 'ZENO Free' && (messages.length === 0 || (messages.length === 1 && messages[0].id.startsWith('welcome'))) && (
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
            
            {/* Home / Welcome Screen if no user messages */}
            {!limitReachedScreen && (messages.length === 0 || (messages.length === 1 && messages[0].id.startsWith('welcome'))) && (
        <WelcomeScreen
                theme={theme}
                logoVariant={logoVariant}
                userName={userSettings.userName}
                onSelectPrompt={(prompt) => handleSubmit(undefined, prompt)}
                onOpenImageStudio={() => setIsImageStudioOpen(true)}
                onSelectSpeed={handleSelectSpeed}
                user={profile}
                onLogin={(remember) => signInWithGoogle(remember)}
                authLoading={authLoading}
              />
            )}

            {/* Conversation Messages Container - Max Width 4xl for comfortable line lengths */}
            {!limitReachedScreen && (
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
              />
            )}
          </div>
        </div>

        {/* Composer Input Area */}
        <ComposerInput
          input={input}
          setInput={setInput}
          isLoading={isLoading}
          isListening={isListening}
          speechError={speechError}
          attachments={attachments}
          onAddAttachment={(att) => setAttachments(prev => [...prev, att])}
          onRemoveAttachment={(id) => setAttachments(prev => prev.filter(a => a.id !== id))}
          onToggleListening={toggleListening}
          onSubmit={handleSubmit}
          onStopGeneration={handleStopGeneration}
          onOpenImageStudio={() => setIsImageStudioOpen(true)}
          speed={speed}
          onSelectSpeed={handleSelectSpeed}
          theme={theme}
          plan={userSettings.plan}
          onOpenSubscriptionModal={handleOpenSubscriptionModal}
          dailyUsage={dailyUsage}
        />
      </main>

      {/* Delete Confirmation Modal */}
      {deletingSessionId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className={`rounded-2xl p-6 max-w-sm w-full border shadow-2xl ${
            theme === 'dark' ? 'bg-[#1e1e24] border-neutral-800 text-neutral-100' : 'bg-white border-neutral-200 text-neutral-900'
          }`}>
            <h3 className="font-bold text-lg mb-2">Excluir Conversa</h3>
            <p className="text-sm text-neutral-400 mb-6 leading-relaxed">
              Tem certeza de que deseja apagar esta conversa? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingSessionId(null)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  theme === 'dark' ? 'hover:bg-neutral-800 text-neutral-300' : 'hover:bg-neutral-100 text-neutral-700'
                }`}
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteSession(deletingSessionId)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ZENO Subscription Modal */}
      <SubscriptionModal
        isOpen={isSubscriptionModalOpen}
        onClose={() => setIsSubscriptionModalOpen(false)}
        settings={userSettings}
        onUpdateSettings={handleUpdateSettings}
        reasonMessage={subscriptionReasonMessage}
      />

      {/* Tabbed Settings Modal */}
      <SettingsModal backendLimits={backendLimits} adminConfig={adminConfig}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={userSettings}
        onUpdateSettings={handleUpdateSettings}
        onClearHistory={handleClearAllHistory}
        onExportAllData={handleExportAllData}
        onOpenSubscriptionModal={() => handleOpenSubscriptionModal()}
        user={profile}
        session={session}
        onLogout={logout}
        onLogin={(remember) => signInWithGoogle(remember)}
        onSwitchAccount={switchAccount}
        authLoading={authLoading}
      />

      {/* Image Generation Studio Modal */}
      <ImageStudioModal
        isOpen={isImageStudioOpen}
        onClose={() => setIsImageStudioOpen(false)}
        theme={theme}
        userEmail={userSettings.userEmail}
        userId={userId}
        plan={userSettings.plan}
        onSendToChat={(imageUrl, promptText) => {
          handleSubmit(undefined, `Criei esta imagem com o ZENO Vision:\n\n![${promptText}](${imageUrl})`);
        }}
      />

      {/* ZENO Image Library Modal */}
      <ImageLibraryModal
        isOpen={isImageLibraryOpen}
        onClose={() => setIsImageLibraryOpen(false)}
        userPlan={userSettings.plan}
        theme={theme}
        onOpenConversation={(sessionId) => {
          if (sessions.some(s => s.id === sessionId)) {
            setCurrentSessionId(sessionId);
          }
        }}
        onOpenStudioWithPrompt={(prompt) => {
          setIsImageStudioOpen(true);
        }}
        onUpgradeClick={() => {
          setIsImageLibraryOpen(false);
          handleOpenSubscriptionModal('Faça upgrade para o Plano Pro para ter armazenamento de imagens ilimitado.');
        }}
      />

      {/* Projects Modal */}
      <ProjectsModal
        isOpen={isProjectsOpen}
        onClose={() => setIsProjectsOpen(false)}
      />

      {/* Plugins Modal */}
      <PluginsModal
        isOpen={isPluginsOpen}
        onClose={() => setIsPluginsOpen(false)}
      />

      {/* More Modal */}
      <MoreModal
        isOpen={isMoreOpen}
        onClose={() => setIsMoreOpen(false)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenSubscription={() => handleOpenSubscriptionModal()}
      />
    </div>
  );
}
