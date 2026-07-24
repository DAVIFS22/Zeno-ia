import React, { useState, useRef, useEffect, useMemo } from 'react';
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
import { ImageWithLoader } from './components/ImageWithLoader';
import { SettingsModal } from './components/SettingsModal';
import { ErrorBanner } from './components/ErrorBanner';
import { WelcomeScreen } from './components/WelcomeScreen';
import { ComposerInput } from './components/ComposerInput';
import { SubscriptionModal } from './components/SubscriptionModal';
import { 
  getTodayString, 
  getInitialUsage, 
  isModelPro, 
  checkUsageLimit, 
  FREE_LIMITS,
  getModelDef
} from './lib/subscription';

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
      language: 'pt-BR',
      soundEnabled: true,
      notificationsEnabled: true,
    };
  });

  // Subscription System State
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [subscriptionReasonMessage, setSubscriptionReasonMessage] = useState<string | undefined>(undefined);

  const handleOpenSubscriptionModal = (reasonMessage?: string) => {
    setSubscriptionReasonMessage(reasonMessage);
    setIsSubscriptionModalOpen(true);
  };

  // Daily Usage Tracker State
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

  const theme = userSettings.theme;
  const logoVariant = userSettings.logoVariant;

  const handleUpdateSettings = (newSettings: Partial<UserSettings>) => {
    setUserSettings(prev => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(updated));
      return updated;
    });
  };

  // Sync theme to HTML root
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
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
    // Default initial session
    const defaultSession: ChatSession = {
      id: 'session-' + Date.now(),
      title: 'Novo Chat',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [
        {
          id: 'welcome',
          role: 'model',
          text: 'Olá! Eu sou **ZENO**, sua inteligência artificial avançada. Como posso ajudá-lo hoje?\n\n*Zeno Inc. — O futuro da inteligência começa agora.*',
        },
      ],
      speed: 'smart',
    };
    return [defaultSession];
  });

  const [currentSessionId, setCurrentSessionId] = useState<string>(() => {
    const savedId = localStorage.getItem(STORAGE_KEY_CURRENT_ID);
    if (savedId && sessions.some(s => s.id === savedId)) {
      return savedId;
    }
    return sessions[0]?.id || '';
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
  const [speed, setSpeed] = useState<ModelType>('zeno');
  const [searchQuery, setSearchQuery] = useState('');

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
    return sessions.find(s => s.id === currentSessionId) || sessions[0];
  }, [sessions, currentSessionId]);

  const messages = activeSession?.messages || [];

  // Sync model speed when active session changes
  useEffect(() => {
    if (activeSession?.speed) {
      setSpeed(activeSession.speed);
    }
  }, [currentSessionId, activeSession?.speed]);

  const handleSelectSpeed = (newSpeed: any) => {
    if (isModelPro(newSpeed) && userSettings.plan !== 'ZENO Pro') {
      handleOpenSubscriptionModal(`O modelo ${getModelDef(newSpeed).name} é exclusivo para assinantes do plano ZENO Pro.`);
      return;
    }
    setSpeed(newSpeed);
    setSessions(prev =>
      prev.map(s => (s.id === currentSessionId ? { ...s, speed: newSpeed } : s))
    );
  };

  // Sync sessions & current id to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessions));
      localStorage.setItem(STORAGE_KEY_CURRENT_ID, currentSessionId);
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
      const isBlock = !inline || codeStr.includes('\n') || !!match;
      return isBlock ? (
        <CodeBlock language={match ? match[1] : ''} value={codeStr} theme={theme} />
      ) : (
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
      return <ImageWithLoader src={src || ''} alt={alt} />;
    },
    table({ node, children, ...props }: any) {
      return (
        <div className="overflow-x-auto my-4 rounded-xl border border-neutral-700/50">
          <table className="w-full text-left text-sm" {...props}>
            {children}
          </table>
        </div>
      );
    }
  }), [theme]);

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Chat Sessions Operations
  const handleNewChat = () => {
    if (isLoading) handleStopGeneration();

    const newSession: ChatSession = {
      id: 'session-' + Date.now(),
      title: 'Novo Chat',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [
        {
          id: 'welcome-' + Date.now(),
          role: 'model',
          text: 'Olá! Eu sou **ZENO**, sua inteligência artificial avançada. Como posso ajudá-lo hoje?\n\n*Zeno Inc. — O futuro da inteligência começa agora.*',
        },
      ],
      speed: speed,
    };

    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setIsSidebarOpen(false);
    setInput('');
    setAttachments([]);
  };

  const handleSelectSession = (id: string) => {
    if (isLoading) handleStopGeneration();
    setCurrentSessionId(id);
    setIsSidebarOpen(false);
  };

  const handleDeleteSession = (id: string) => {
    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== id);
      if (filtered.length === 0) {
        const fresh: ChatSession = {
          id: 'session-' + Date.now(),
          title: 'Novo Chat',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messages: [
            {
              id: 'welcome-' + Date.now(),
              role: 'model',
              text: 'Olá! Eu sou **ZENO**, sua inteligência artificial avançada. Como posso ajudá-lo hoje?',
            },
          ],
          speed: speed,
        };
        setCurrentSessionId(fresh.id);
        return [fresh];
      } else {
        if (currentSessionId === id) {
          setCurrentSessionId(filtered[0].id);
        }
        return filtered;
      }
    });
    setDeletingSessionId(null);
  };

  const togglePinSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions(prev =>
      prev.map(s => (s.id === id ? { ...s, isPinned: !s.isPinned } : s))
    );
  };

  const toggleFavoriteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions(prev =>
      prev.map(s => (s.id === id ? { ...s, isFavorite: !s.isFavorite } : s))
    );
  };

  const startRenameSession = (session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditingTitle(session.title);
  };

  const saveRenameSession = (id: string) => {
    const trimmed = editingTitle.trim();
    if (trimmed) {
      setSessions(prev =>
        prev.map(s => (s.id === id ? { ...s, title: trimmed, updatedAt: Date.now() } : s))
      );
    }
    setEditingSessionId(null);
    setEditingTitle('');
  };

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
    const fresh: ChatSession = {
      id: 'session-' + Date.now(),
      title: 'Novo Chat',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [
        {
          id: 'welcome-' + Date.now(),
          role: 'model',
          text: 'Olá! Eu sou **ZENO**, sua inteligência artificial avançada. Como posso ajudá-lo hoje?',
        },
      ],
      speed: speed,
    };
    setSessions([fresh]);
    setCurrentSessionId(fresh.id);
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

    // 2. Subscription & Usage Check: Daily Message Limit for ZENO Free
    if (userSettings.plan === 'ZENO Free') {
      const msgCheck = checkUsageLimit(userSettings.plan, dailyUsage, 'message');
      if (!msgCheck.allowed) {
        handleOpenSubscriptionModal(`Você atingiu o limite de ${FREE_LIMITS.MESSAGES_PER_DAY} mensagens diárias do plano ZENO Free. Faça upgrade para ZENO Pro e continue conversando sem limites.`);
        return;
      }

      if (attachments.length > 0) {
        const docCheck = checkUsageLimit(userSettings.plan, dailyUsage, 'doc');
        if (!docCheck.allowed) {
          handleOpenSubscriptionModal(`Você atingiu o limite de upload do plano Free (${FREE_LIMITS.DOCS_PER_DAY} documentos/dia). Assine o ZENO Pro para análises ilimitadas.`);
          return;
        }
      }
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

    // Increment Usage Stats for Free Users
    setDailyUsage(prev => {
      const today = getTodayString();
      const base = prev.date === today ? prev : getInitialUsage();
      return {
        ...base,
        messagesCount: base.messagesCount + 1,
        imageGenCount: (speed === 'vision' || speed === 'image') ? base.imageGenCount + 1 : base.imageGenCount,
        webSearchCount: (speed === 'search' || speed === 'mega') ? base.webSearchCount + 1 : base.webSearchCount,
        docUploadCount: attachments.length > 0 ? base.docUploadCount + attachments.length : base.docUploadCount
      };
    });

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

    const targetSession = sessions.find(s => s.id === currentSessionId);
    const isDefaultTitle = !targetSession || targetSession.title === 'Novo Chat' || targetSession.title === 'Exploração Neural';
    const fallbackTitle = isDefaultTitle ? generateTitleFromMessage(userMessage.text) : (targetSession?.title || 'Novo Chat');

    setSessions(prev =>
      prev.map(s => {
        if (s.id === currentSessionId) {
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

    // Asynchronously call small LLM to generate concise title summary
    if (isDefaultTitle) {
      const sessionIdToUpdate = currentSessionId;
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
        }),
        signal: abortController.signal,
      });

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
                      if (s.id === currentSessionId) {
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
                      if (s.id === currentSessionId) {
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
            if (s.id === currentSessionId) {
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
  const handleSaveEditMessage = (msgId: string) => {
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
  };

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
    <div className={`flex h-[100dvh] font-sans overflow-hidden relative transition-colors duration-200 ${
      theme === 'dark' ? 'bg-[#0b0b0d] text-neutral-100' : 'bg-white text-neutral-900'
    }`}>
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/70 z-30 md:hidden backdrop-blur-xs transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`fixed md:relative top-0 left-0 h-full flex-col z-40 flex-shrink-0 transform transition-all duration-[220ms] ease-out border-r ${
        theme === 'dark'
          ? 'bg-[#171717] border-[#2A2A2A] text-neutral-100'
          : 'bg-[#f7f7f8] border-neutral-200 text-neutral-900'
      } ${
        isSidebarOpen ? 'translate-x-0 w-[300px]' : '-translate-x-full md:translate-x-0'
      } ${
        isSidebarCollapsed ? 'md:w-0 md:opacity-0 md:overflow-hidden md:border-r-0' : 'md:w-[300px] md:opacity-100'
      } flex`}>
        
        {/* Sidebar Header & Nova conversa */}
        <div className="p-3.5 space-y-3">
          <div className="flex items-center gap-2">
            <button 
              onClick={handleNewChat}
              className={`flex items-center gap-3 px-3.5 h-[52px] rounded-2xl transition-all duration-150 w-full text-left text-sm font-medium group ${
                theme === 'dark'
                  ? 'bg-[#232323] hover:bg-[#2C2C2C] text-neutral-100 border border-[#303030]'
                  : 'bg-white hover:bg-neutral-100 text-neutral-900 border border-neutral-200 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-center flex-shrink-0">
                <ZenoLogo size={20} variant={logoVariant} theme={theme} />
              </div>
              <span className="flex-1 font-medium truncate">Nova conversa</span>
              <span className="text-xs text-neutral-500 font-mono hidden sm:inline">⌘K</span>
            </button>

            <button
              onClick={() => {
                setIsSidebarOpen(false);
                setIsSidebarCollapsed(true);
              }}
              className="p-2.5 rounded-xl text-neutral-400 hover:text-white hover:bg-[#232323] transition-colors flex-shrink-0"
              title="Fechar barra lateral"
            >
              <PanelLeftClose className="w-5 h-5" />
            </button>
          </div>

          {/* Search Input */}
          <div className={`flex items-center gap-2.5 px-3.5 h-[44px] rounded-xl text-sm border transition-all duration-150 ${
            theme === 'dark' 
              ? 'bg-[#202020] border-[#2E2E2E] text-neutral-200 focus-within:border-[#3B82F6] focus-within:shadow-sm' 
              : 'bg-white border-neutral-200 text-neutral-800 focus-within:border-neutral-400 focus-within:shadow-2xs'
          }`}>
            <Search className="w-5 h-5 text-[#9CA3AF] flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar conversas..."
              className="bg-transparent border-none focus:outline-none w-full text-sm placeholder-[#9CA3AF] font-normal"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="p-1 hover:text-white transition-colors">
                <X className="w-4 h-4 text-neutral-400" />
              </button>
            )}
          </div>
        </div>

        {/* Sessions Group List */}
        <div className="flex-1 overflow-y-auto px-3 py-1 space-y-4 scrollbar-custom">
          {groupedSessions.length === 0 ? (
            <div className="text-center py-8 px-4 text-sm text-[#9CA3AF]">
              Nenhuma conversa encontrada.
            </div>
          ) : (
            groupedSessions.map(group => (
              <div key={group.label || 'all'} className="space-y-1">
                {group.label && (
                  <div className="text-[11px] font-medium uppercase tracking-wider text-[#9CA3AF] px-3 py-1.5">
                    {group.label}
                  </div>
                )}
                {group.sessions.map(session => {
                  const isActive = session.id === currentSessionId;
                  const isEditing = editingSessionId === session.id;

                  return (
                    <div
                      key={session.id}
                      onClick={() => handleSelectSession(session.id)}
                      className={`group relative flex items-center gap-3 px-3 h-[46px] rounded-xl text-sm transition-all duration-150 cursor-pointer ${
                        isActive
                          ? theme === 'dark'
                            ? 'bg-[#2A2A2A] text-white font-medium'
                            : 'bg-white text-neutral-900 font-medium border border-neutral-200 shadow-2xs'
                          : theme === 'dark'
                            ? 'text-neutral-300 hover:text-white hover:bg-[#232323]'
                            : 'text-neutral-700 hover:text-neutral-900 hover:bg-neutral-200/60'
                      }`}
                    >
                      <MessageSquare className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-[#9CA3AF] group-hover:text-white'}`} />
                      
                      {isEditing ? (
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveRenameSession(session.id);
                            if (e.key === 'Escape') setEditingSessionId(null);
                          }}
                          onBlur={() => saveRenameSession(session.id)}
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                          className={`w-full bg-transparent border-b border-neutral-500 focus:outline-none text-sm px-1 py-0.5 ${
                            theme === 'dark' ? 'text-white' : 'text-black'
                          }`}
                        />
                      ) : (
                        <span className="truncate flex-1 text-sm font-normal">
                          {session.title}
                        </span>
                      )}

                      {/* Quick Action Icons */}
                      {!isEditing && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => togglePinSession(session.id, e)}
                            className={`p-1.5 rounded-lg ${session.isPinned ? 'text-amber-400' : 'text-neutral-400 hover:text-white hover:bg-[#333333]'}`}
                            title={session.isPinned ? "Desfixar" : "Fixar no topo"}
                          >
                            <Pin className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => startRenameSession(session, e)}
                            className="p-1.5 hover:bg-[#333333] rounded-lg text-neutral-400 hover:text-white"
                            title="Renomear"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => handleExportSession(session, e)}
                            className="p-1.5 hover:bg-[#333333] rounded-lg text-neutral-400 hover:text-white"
                            title="Exportar Markdown"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingSessionId(session.id);
                            }}
                            className="p-1.5 hover:bg-rose-500/20 rounded-lg text-neutral-400 hover:text-rose-400"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Sidebar Footer */}
        <div className={`p-3 space-y-1 border-t ${theme === 'dark' ? 'border-[#2A2A2A] bg-[#171717]' : 'border-neutral-200 bg-[#f7f7f8]'}`}>
          <button 
            onClick={() => setIsSettingsOpen(true)} 
            className={`flex items-center gap-3 px-3 h-[42px] rounded-xl transition-colors duration-150 w-full text-left text-sm font-normal ${
              theme === 'dark' ? 'hover:bg-[#232323] text-neutral-200 hover:text-white' : 'hover:bg-white text-neutral-700'
            }`}
          >
            <Settings className="w-5 h-5 text-[#9CA3AF]" />
            <span>Configurações</span>
          </button>

          <button 
            onClick={() => setIsSettingsOpen(true)} 
            className={`flex items-center gap-3 px-3 h-[42px] rounded-xl transition-colors duration-150 w-full text-left text-sm font-normal ${
              theme === 'dark' ? 'hover:bg-[#232323] text-neutral-200 hover:text-white' : 'hover:bg-white text-neutral-700'
            }`}
          >
            <HelpCircle className="w-5 h-5 text-[#9CA3AF]" />
            <span>Ajuda e Suporte</span>
          </button>

          <button 
            onClick={() => handleOpenSubscriptionModal()} 
            className={`flex items-center justify-between px-3 h-[42px] rounded-xl transition-colors duration-150 w-full text-left text-sm font-normal ${
              theme === 'dark' ? 'hover:bg-[#232323] text-neutral-200 hover:text-white' : 'hover:bg-white text-neutral-700'
            }`}
          >
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <span>Atualizações / Pro</span>
            </div>
            <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300">
              {userSettings.plan === 'ZENO Pro' ? 'Ativo' : 'Upgrade'}
            </span>
          </button>
          
          <div className="flex items-center justify-between px-3 pt-2 text-xs text-[#9CA3AF] font-normal">
            <div className="flex items-center gap-2 truncate">
              <ZenoLogo size={18} variant={logoVariant} theme={theme} />
              <span className="truncate font-medium text-xs text-neutral-400">ZENO v3.6.0</span>
            </div>
            <span className="text-[11px] text-neutral-500 font-normal">Zeno Inc.</span>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <main className="flex-1 flex flex-col min-w-0 relative h-full">
        {/* Top Header */}
        <header className={`h-12 flex items-center justify-between px-3 sm:px-4 border-b flex-shrink-0 z-20 ${
          theme === 'dark' 
            ? 'bg-[#0b0b0d]/90 border-neutral-800/60 backdrop-blur-md text-neutral-200' 
            : 'bg-white/90 border-neutral-200 backdrop-blur-md text-neutral-800'
        }`}>
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button 
              className={`p-1.5 hover:bg-neutral-800/20 rounded-lg transition-colors ${
                isSidebarCollapsed ? 'block' : 'md:hidden'
              }`}
              onClick={() => {
                if (window.innerWidth < 768) setIsSidebarOpen(true);
                else setIsSidebarCollapsed(false);
              }}
              title="Abrir barra lateral"
            >
              <PanelLeftOpen className="w-4.5 h-4.5 text-neutral-400" />
            </button>

            {/* Header Title / Brand Indicator */}
            <div className="flex items-center gap-2">
              <ZenoLogo size={20} variant={logoVariant} theme={theme} />
              <span className="font-extrabold text-xs sm:text-sm tracking-tight">ZENO</span>
              <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-neutral-800/60 text-neutral-400 border border-neutral-800 hidden sm:inline-block">
                Zeno Inc.
              </span>
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* ZENO Pro Badge Button */}
            <button
              onClick={() => handleOpenSubscriptionModal()}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1.5 ${
                userSettings.plan === 'ZENO Pro'
                  ? 'bg-neutral-800 text-neutral-200 border border-neutral-700 hover:bg-neutral-700'
                  : 'bg-neutral-100 text-neutral-950 hover:bg-white border border-neutral-300 font-extrabold'
              }`}
            >
              <Sparkles className="w-3 h-3 text-neutral-400" />
              <span>{userSettings.plan === 'ZENO Pro' ? 'ZENO Pro' : 'Upgrade Pro'}</span>
            </button>

            <button
              onClick={() => handleUpdateSettings({ theme: theme === 'dark' ? 'light' : 'dark' })}
              className={`p-1.5 rounded-lg transition-colors ${
                theme === 'dark' ? 'hover:bg-neutral-800 text-neutral-400 hover:text-white' : 'hover:bg-neutral-100 text-neutral-600 hover:text-black'
              }`}
              title="Alternar Tema Claro/Escuro"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-neutral-300" /> : <Moon className="w-4 h-4 text-neutral-700" />}
            </button>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className={`p-1.5 rounded-lg transition-colors ${
                theme === 'dark' ? 'hover:bg-neutral-800 text-neutral-400 hover:text-white' : 'hover:bg-neutral-100 text-neutral-600 hover:text-black'
              }`}
              title="Configurações"
            >
              <Settings className="w-4 h-4" />
            </button>

            <button
              onClick={handleNewChat}
              className={`p-1.5 rounded-lg transition-colors ${
                theme === 'dark' ? 'hover:bg-neutral-800 text-neutral-400 hover:text-white' : 'hover:bg-neutral-100 text-neutral-600 hover:text-black'
              }`}
              title="Nova conversa"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Main Conversation Feed */}
        <div className="flex-1 overflow-y-auto w-full scrollbar-custom">
          <div className="flex flex-col items-center min-h-full pb-36 pt-4">
            
            {/* Home / Welcome Screen if no user messages */}
            {(messages.length === 0 || (messages.length === 1 && messages[0].id === 'welcome')) && (
              <WelcomeScreen
                theme={theme}
                logoVariant={logoVariant}
                userName={userSettings.userName}
                onSelectPrompt={(prompt) => handleSubmit(undefined, prompt)}
                onOpenImageStudio={() => setIsImageStudioOpen(true)}
                onSelectSpeed={handleSelectSpeed}
              />
            )}

            {/* Conversation Messages Container - Max Width 4xl for comfortable line lengths */}
            {messages.filter(msg => !(msg.id === 'welcome' && messages.length === 1)).length > 0 && (
              <div className="w-full max-w-4xl px-4 sm:px-6 flex flex-col space-y-8">
                {messages.filter(msg => !(msg.id === 'welcome' && messages.length === 1)).map((msg) => (
                  <div key={msg.id} className={`group flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'user' ? (
                      <div className="flex flex-col items-end max-w-[88%] sm:max-w-[82%]">
                        {editingMessageId === msg.id ? (
                          <div className={`w-full p-3 rounded-2xl border flex flex-col gap-2.5 ${
                            theme === 'dark' ? 'bg-[#18181c] border-neutral-700' : 'bg-white border-neutral-300 shadow-md'
                          }`}>
                            <textarea
                              value={editingMessageText}
                              onChange={(e) => setEditingMessageText(e.target.value)}
                              rows={3}
                              className={`w-full bg-transparent border-none focus:outline-none resize-none text-[15px] leading-relaxed ${
                                theme === 'dark' ? 'text-white' : 'text-neutral-900'
                              }`}
                              autoFocus
                            />
                            <div className="flex justify-end gap-2 pt-1 border-t border-neutral-700/30">
                              <button
                                onClick={() => {
                                  setEditingMessageId(null);
                                  setEditingMessageText('');
                                }}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-400 hover:text-neutral-200"
                              >
                                Cancelar
                              </button>
                              <button
                                onClick={() => handleSaveEditMessage(msg.id)}
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
                                onClick={() => {
                                  setEditingMessageId(msg.id);
                                  setEditingMessageText(msg.text);
                                }}
                                className="p-1 hover:bg-neutral-800/40 rounded-md text-neutral-500 hover:text-neutral-300 text-xs"
                                title="Editar mensagem"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => copyToClipboard(msg.id, msg.text)}
                                className="p-1 hover:bg-neutral-800/40 rounded-md text-neutral-500 hover:text-neutral-300 text-xs"
                                title="Copiar mensagem"
                              >
                                {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="flex gap-3 sm:gap-4 w-full max-w-4xl">
                        <div className="flex-shrink-0 mt-0.5">
                          <ZenoLogo size={28} variant={logoVariant} theme={theme} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className={`text-xs font-bold ${
                              theme === 'dark' ? 'text-neutral-200' : 'text-neutral-800'
                            }`}>
                              {(msg.modelSpeed || speed) === 'image' ? 'ZENO Vision' :
                               (msg.modelSpeed || speed) === 'mega' ? 'ZENO Mega Sábio' :
                               (msg.modelSpeed || speed) === 'fast' ? 'ZENO Rápido' :
                               'ZENO Inteligente'}
                            </span>
                          </div>

                          {/* Error Banner or Streamed Text */}
                          {msg.hasError ? (
                            <ErrorBanner
                              errorMessage={msg.errorMessage || msg.text}
                              rawDetails={msg.rawErrorDetails}
                              onRetry={handleRegenerate}
                              theme={theme}
                            />
                          ) : (
                            <div className={`markdown-body max-w-none text-[15px] sm:text-[16px] leading-[1.8] ${
                              theme === 'dark' ? 'text-neutral-200' : 'text-neutral-800'
                            }`}>
                              {(!msg.text && isLoading && msg.role === 'model') ? (
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
                                onClick={() => copyToClipboard(msg.id, msg.text)}
                                className={`p-1.5 rounded-lg transition-colors flex items-center justify-center text-xs ${
                                  theme === 'dark' ? 'hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200' : 'hover:bg-neutral-200/70 text-neutral-600 hover:text-neutral-900'
                                }`}
                                title="Copiar resposta"
                              >
                                {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>

                              <button
                                onClick={() => toggleSpeech(msg.id, msg.text)}
                                className={`p-1.5 rounded-lg transition-colors flex items-center justify-center text-xs ${
                                  speakingMessageId === msg.id ? 'text-neutral-100 animate-pulse bg-neutral-800' : (
                                    theme === 'dark' ? 'hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200' : 'hover:bg-neutral-200/70 text-neutral-600 hover:text-neutral-900'
                                  )
                                }`}
                                title={speakingMessageId === msg.id ? "Parar áudio" : "Ouvir em Voz Alta"}
                              >
                                {speakingMessageId === msg.id ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                              </button>

                              <button
                                onClick={() => setFeedback(prev => ({ ...prev, [msg.id]: 'up' }))}
                                className={`p-1.5 rounded-lg transition-colors flex items-center justify-center text-xs ${
                                  feedback[msg.id] === 'up' ? 'text-neutral-100 bg-neutral-800' : (
                                    theme === 'dark' ? 'hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200' : 'hover:bg-neutral-200/70 text-neutral-600 hover:text-neutral-900'
                                  )
                                }`}
                                title="Gostei"
                              >
                                <ThumbsUp className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => setFeedback(prev => ({ ...prev, [msg.id]: 'down' }))}
                                className={`p-1.5 rounded-lg transition-colors flex items-center justify-center text-xs ${
                                  feedback[msg.id] === 'down' ? 'text-rose-400 bg-rose-500/10' : (
                                    theme === 'dark' ? 'hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200' : 'hover:bg-neutral-200/70 text-neutral-600 hover:text-neutral-900'
                                  )
                                }`}
                                title="Não gostei"
                              >
                                <ThumbsDown className="w-3.5 h-3.5" />
                              </button>

                              {messages[messages.length - 1].id === msg.id && !isLoading && (
                                <button
                                  onClick={handleRegenerate}
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
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} className="h-2" />
              </div>
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
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={userSettings}
        onUpdateSettings={handleUpdateSettings}
        onClearHistory={handleClearAllHistory}
        onExportAllData={handleExportAllData}
        onOpenSubscriptionModal={() => handleOpenSubscriptionModal()}
      />

      {/* Image Generation Studio Modal */}
      <ImageStudioModal
        isOpen={isImageStudioOpen}
        onClose={() => setIsImageStudioOpen(false)}
        theme={theme}
        onSendToChat={(imageUrl, promptText) => {
          handleSubmit(undefined, `Criei esta imagem com o ZENO Vision:\n\n![${promptText}](${imageUrl})`);
        }}
      />
    </div>
  );
}
