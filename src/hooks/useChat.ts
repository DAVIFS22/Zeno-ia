import { useState, useCallback, useRef } from 'react';
import { Message, ChatSession, FileAttachment, ModelType, UserSettings, DailyUsage } from '../types';
import { detectIntent } from '../utils/intent';
import { isModelPro, checkUsageLimit } from '../lib/subscription';
import { generateTitleFromMessage } from '../utils/date';
import { measureApiLatency } from './usePerformanceMetrics';
import { filterValidSources } from '../utils/sourceValidation';
import { useTranslation } from '../i18n';
import { auth } from '../lib/firebase';


const YOUTUBE_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

export function useChat(
  userId: string | null,
  userSettings: UserSettings,
  isPro: boolean,
  sessions: ChatSession[],
  setSessions: React.Dispatch<React.SetStateAction<ChatSession[]>>,
  currentSessionId: string | null,
  setCurrentSessionId: (id: string | null) => void,
  dailyUsage: DailyUsage,
  setDailyUsage: React.Dispatch<React.SetStateAction<DailyUsage>>,
  ui: any
) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleSubmit = useCallback(async (e?: React.FormEvent, overrideText?: string, extraContext?: string) => {
    if (e) e.preventDefault();

    let textToSend = overrideText !== undefined ? overrideText : input;
    
    // Auto-inject default prompt if attachments exist but text is empty
    if (textToSend.trim() === '' && attachments.length > 0) {
      const firstAttachment = attachments[0];
      if (firstAttachment.type === 'image') {
        textToSend = "Descreva esta imagem.";
      } else {
        textToSend = "Analise este arquivo.";
      }
    }

    if ((!textToSend.trim() && attachments.length === 0) || isLoading) return;

    const intent = detectIntent(textToSend);
    let finalSpeed = userSettings.defaultSpeed as ModelType;

    if (intent === 'image') {
      finalSpeed = 'image';
    }

    if (isModelPro(finalSpeed) && !isPro) {
      ui.openModal('proFeature');
      return;
    }

    const usageAction = finalSpeed === 'image' ? 'image' : finalSpeed === 'search' ? 'search' : 'message';
    const usageCheck = checkUsageLimit(isPro ? 'ZENO Pro' : userSettings.plan, dailyUsage, usageAction);
    if (!usageCheck.allowed) {
      ui.openModal('limitReached');
      return;
    }

    if (!isPro) {
      const limitKey = finalSpeed === 'image' ? 'image' : finalSpeed === 'vision' ? 'vision' : 'messages';
      setDailyUsage(prev => ({
        ...prev,
        [limitKey]: ((prev as any)[limitKey] || 0) + 1,
      }));
    }

    const currentInput = textToSend;
    const currentAttachments = [...attachments];

    if (overrideText === undefined) {
      setInput('');
      setAttachments([]);
    }

    let sessionId = currentSessionId;
    if (!sessionId) {
      const newSession: ChatSession = {
        id: Date.now().toString(),
        title: generateTitleFromMessage(currentInput),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [],
        speed: finalSpeed,
      };
      sessionId = newSession.id;
      setSessions(prev => [newSession, ...prev]);
      setCurrentSessionId(sessionId);
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: currentInput,
      timestamp: Date.now(),
      attachments: currentAttachments,
    };

    const youtubeMatch = currentInput.match(YOUTUBE_REGEX);
    const youtubeUrl = youtubeMatch ? youtubeMatch[0] : undefined;

    const msgLower = currentInput.toLowerCase();
    const isClientSearch = finalSpeed === 'search' || msgLower.includes('buscar') || msgLower.includes('pesquisar');
    
    const initialModelMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'model',
      text: '',
      timestamp: Date.now(),
      modelSpeed: isClientSearch ? 'search' : finalSpeed,
      youtubeUrl,
      isSearching: isClientSearch,
      isSearch: isClientSearch,
    };

    setSessions(prev =>
      prev.map(s => (s.id === sessionId ? {
        ...s,
        messages: [...s.messages, userMessage, initialModelMessage],
        updatedAt: Date.now(),
      } : s))
    );

    setIsLoading(true);
    abortControllerRef.current = new AbortController();

    try {
      const payload = {
        message: extraContext ? `${extraContext}\n\n${textToSend}` : textToSend,
        speed: finalSpeed,
        isSmartMode: userSettings.isSmartMode,
        language: userSettings.language,
        attachments: currentAttachments,
        userId,
        userEmail: userSettings.userEmail,
        plan: isPro ? 'ZENO Pro' : userSettings.plan,
        geminiApiKey: userSettings.geminiApiKey,
        history: sessions.find(s => s.id === sessionId)?.messages.slice(-10).map(m => ({ role: m.role, text: m.text })) || [],
      };



      // Retrieve Firebase ID token if user is authenticated
      let token: string | null = null;
      try {
        if (auth.currentUser) {
          token = await auth.currentUser.getIdToken();
        }
      } catch (tokenErr) {
        console.warn('[DIAGNOSTIC] Could not fetch ID token:', tokenErr);
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      if (userSettings.userEmail) {
        headers['x-user-email'] = userSettings.userEmail;
      }

      console.log("[DIAGNOSTIC - CHAT REQUEST]", {
        userId,
        userEmail: userSettings.userEmail,
        hasAuthHeader: !!headers['Authorization'],
        authHeaderPreview: headers['Authorization'] ? `${headers['Authorization'].substring(0, 30)}...` : 'NONE',
        speed: finalSpeed,
        isPro,
      });

      let response: Response | null = null;
      let fetchAttempts = 0;
      while (fetchAttempts < 2) {
        try {
          fetchAttempts++;
          response = await fetch('/api/chat', {
            method: 'POST',
            headers,
            signal: abortControllerRef.current.signal,
            body: JSON.stringify(payload),
          });
          break;
        } catch (fetchErr: any) {
          if (fetchErr.name === 'AbortError') throw fetchErr;
          if (fetchAttempts >= 2) throw fetchErr;
          console.warn(`[CHAT FETCH RETRY] Tentativa ${fetchAttempts} falhou, tentando novamente...`);
          await new Promise(r => setTimeout(r, 800));
        }
      }

      if (!response) {
        throw new Error("Falha na conexão com o servidor. Verifique sua internet e tente novamente.");
      }

      console.log("[DIAGNOSTIC - CHAT RESPONSE]", {
        status: response.status,
        ok: response.ok,
        statusText: response.statusText,
        hasAuthHeader: !!headers['Authorization'],
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Falha na conexão com o servidor (${response.status})`);
      }

      console.log("GETTING READER");
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';
      let streamBuffer = '';

      // Streaming Watchdog Timer (45 seconds timeout on inactivity)
      let watchdogTimer: any = null;
      const resetWatchdog = () => {
        if (watchdogTimer) clearTimeout(watchdogTimer);
        watchdogTimer = setTimeout(() => {
          console.warn('[WATCHDOG] Inatividade no streaming (45s). Cancelando requisição.');
          abortControllerRef.current?.abort();
        }, 45000);
      };

      try {
        if (reader) {
          resetWatchdog();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            resetWatchdog(); // Reset watchdog on every received chunk

            streamBuffer += decoder.decode(value, { stream: true });
            const lines = streamBuffer.split('\n');
            streamBuffer = lines.pop() || '';
            
            for (const line of lines) {
              if (line.trim() === '') continue;
              if (line.startsWith('data: ')) {
                const dataStr = line.slice(6).trim();
                if (dataStr === '[DONE]') continue;
                try {
                  const data = JSON.parse(dataStr);
                  
                  if (data.text) accumulatedText = data.text;
                  else if (data.delta?.content) accumulatedText += data.delta.content;

                  setSessions(prev => {
                    const exists = prev.some(s => s.id === sessionId);
                    if (exists) {
                      return prev.map(s => (s.id === sessionId ? {
                        ...s,
                        messages: s.messages.map((m, i) => i === s.messages.length - 1 ? {
                          ...m,
                          text: accumulatedText,
                          isSearching: data.isSearching ?? m.isSearching,
                          searchSources: data.sources ? filterValidSources(data.sources) : m.searchSources,
                          isToolCalling: data.toolCall ? true : false
                        } : m)
                      } : s));
                    } else {
                      // Re-insert session if removed by concurrent sync
                      const reconstructed: ChatSession = {
                        id: sessionId!,
                        title: generateTitleFromMessage(currentInput),
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                        messages: [userMessage, {
                          ...initialModelMessage,
                          text: accumulatedText,
                          isSearching: data.isSearching ?? false,
                          searchSources: data.sources ? filterValidSources(data.sources) : []
                        }],
                        speed: finalSpeed,
                      };
                      return [reconstructed, ...prev];
                    }
                  });
                } catch (e) {}
              }
            }
          }
        }
      } finally {
        if (watchdogTimer) clearTimeout(watchdogTimer);
      }
    } catch (err: any) {
      const isAbort = err.name === 'AbortError';
      const isWatchdogAbort = isAbort && abortControllerRef.current?.signal.aborted;
      
      console.error("Chat Submit Error:", err);
      
      let errorMessage = isWatchdogAbort 
        ? "Tempo limite excedido sem resposta do servidor (45s). Por favor, tente novamente."
        : (err.message || t.plans.processError);

      if (errorMessage === "Failed to fetch" || err.name === "TypeError") {
        errorMessage = "Falha na conexão com o servidor. Verifique sua conexão com a internet e tente novamente em instantes.";
      } else if (errorMessage.includes("Mensagem é obrigatória") || errorMessage.includes("message is required")) {
        errorMessage = "Por favor, digite uma mensagem ou inclua um anexo para enviar.";
      }

      setSessions(prev =>
        prev.map(s => (s.id === sessionId ? {
          ...s,
          messages: s.messages.map((m, i) => i === s.messages.length - 1 ? {
            ...m,
            hasError: true,
            errorMessage,
            isSearching: false
          } : m)
        } : s))
      );
    } finally {
      setIsLoading(false);
    }
  }, [input, attachments, isLoading, userSettings, isPro, dailyUsage, currentSessionId, userId, sessions, setSessions, setCurrentSessionId, setDailyUsage, ui]);

  return {
    input,
    setInput,
    attachments,
    setAttachments,
    isLoading,
    handleSubmit,
    abortChat: () => {
      abortControllerRef.current?.abort();
      setIsLoading(false);
    },
  };
}
