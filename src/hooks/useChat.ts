import { useState, useCallback, useRef } from 'react';
import { Message, ChatSession, FileAttachment, ModelType, UserSettings, DailyUsage, AdaptiveLearningProfile } from '../types';
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
  ui: any,
  adaptiveProfile?: AdaptiveLearningProfile
) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedInput = localStorage.getItem('zeno_draft_input');
      return savedInput || '';
    }
    return '';
  });
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [isThinkingMode, setIsThinkingMode] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleSubmit = useCallback(async (e?: React.FormEvent, overrideText?: string, extraContext?: string) => {
    if (e) e.preventDefault();

    let textToSend = overrideText !== undefined ? overrideText : input;
    
    const hasImageAttachment = attachments.some(
      a => a.type === 'image' || (a.url && a.url.startsWith('data:image/')) || !!a.name?.match(/\.(png|jpe?g|webp|gif|heic|bmp|svg)$/i)
    );

    // Auto-inject default prompt if attachments exist but text is empty
    if (textToSend.trim() === '' && attachments.length > 0) {
      if (hasImageAttachment) {
        textToSend = "Analise esta imagem em detalhes. Descreva o que você vê e extraia quaisquer textos, recibos, cardápios ou gráficos presentes com alta precisão.";
      } else {
        textToSend = "Analise este arquivo.";
      }
    }

    if ((!textToSend.trim() && attachments.length === 0) || isLoading) return;

    const intent = detectIntent(textToSend);
    let finalSpeed = userSettings.defaultSpeed as ModelType;

    if (intent === 'image') {
      finalSpeed = 'image';
    } else if (hasImageAttachment) {
      finalSpeed = 'vision';
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
      localStorage.removeItem('zeno_draft_input');
      setAttachments([]);
    }

    console.log('[DEBUG - handleSubmit] START', { currentSessionId, currentInput });

    let sessionId = currentSessionId;
    if (!sessionId) {
      const newSessionId = Date.now().toString();
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        text: currentInput,
        timestamp: Date.now(),
        attachments: currentAttachments,
        syncStatus: 'syncing',
        isLocked: true,
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
        isLocked: true,
        isStreaming: true,
      };

      const newSession: ChatSession = {
        id: newSessionId,
        title: generateTitleFromMessage(currentInput),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [userMessage, initialModelMessage],
        speed: finalSpeed,
        isNew: true, // Mark as new to protect from sync overrides
      };

      console.log('[DEBUG - handleSubmit] Creating new session', { newSessionId, messagesCount: newSession.messages.length });
      
      sessionId = newSessionId;
      // We set current session ID first to prepare the UI
      setCurrentSessionId(sessionId);
      
      setSessions(prev => {
        console.log('[DEBUG - setSessions] Adding new session. Prev count:', prev.length);
        const next = [newSession, ...prev];
        return next;
      });
      
      // Define messages for the rest of the flow
      var messagesForFlow = { userMessage, initialModelMessage };
    } else {
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        text: currentInput,
        timestamp: Date.now(),
        attachments: currentAttachments,
        syncStatus: 'syncing',
        isLocked: true,
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
        isLocked: true,
        isStreaming: true,
      };

      console.log('[DEBUG - handleSubmit] Adding messages to existing session', { sessionId });

      setSessions(prev => {
        console.log('[DEBUG - setSessions] Mapping prev sessions. Count:', prev.length);
        const next = prev.map(s => (s.id === sessionId ? {
          ...s,
          messages: [...s.messages, userMessage, initialModelMessage],
          updatedAt: Date.now(),
        } : s));
        const updatedSession = next.find(s => s.id === sessionId);
        console.log('[DEBUG - setSessions] Updated session message count:', updatedSession?.messages.length);
        return next;
      });
      
      var messagesForFlow = { userMessage, initialModelMessage };
    }

    const { userMessage, initialModelMessage } = messagesForFlow;

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
        adaptiveProfile: adaptiveProfile || userSettings.adaptiveProfile,
        isThinkingMode,
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
        let errorMsg = `Falha na conexão com o servidor (${response.status})`;
        try {
          const rawText = await response.text();
          if (rawText && rawText.trim().length > 0) {
            const lowerText = rawText.toLowerCase();
            if (lowerText.includes('rate exceeded') || lowerText.includes('rate limit') || response.status === 429) {
              errorMsg = "⚠️ **Limite de requisições excedido**: O servidor de desenvolvimento atingiu a capacidade temporária de tráfego de rede do AI Studio. Por favor, aguarde alguns instantes e envie sua mensagem novamente.";
            } else {
              try {
                const parsed = JSON.parse(rawText);
                if (parsed.error) {
                  errorMsg = parsed.error;
                }
              } catch {
                errorMsg = rawText.length > 200 ? rawText.slice(0, 200) + '...' : rawText;
              }
            }
          }
        } catch {
          // ignore
        }
        throw new Error(errorMsg);
      }

      // Mark user message as sent
      setSessions(prev =>
        prev.map(s => (s.id === sessionId ? {
          ...s,
          messages: s.messages.map(m => m.id === userMessage.id ? { ...m, syncStatus: 'sent', isLocked: false } : m)
        } : s))
      );

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
                  else if (data.delta?.content) {
                    accumulatedText += data.delta.content;
                    // Diagnostic log for stream content:
                    if (data.delta.content.match(/[\u4e00-\u9fa5]/)) {
                       console.warn('[Diagnostic - Stream] Non-Portuguese (Chinese) character detected in stream:', data.delta.content);
                    }
                  }

                  setSessions(prev => {
                    const sessionIndex = prev.findIndex(s => s.id === sessionId);
                    if (sessionIndex !== -1) {
                      const newSessions = [...prev];
                      const currentSession = newSessions[sessionIndex];
                      console.log('[DEBUG - streaming] Updating session:', sessionId, 'current messages:', currentSession.messages.length);
                      
                      newSessions[sessionIndex] = {
                        ...currentSession,
                        updatedAt: Date.now(),
                        messages: currentSession.messages.map((m) => 
                          m.id === initialModelMessage.id ? {
                            ...m,
                            text: accumulatedText,
                            thought: data.thought ?? m.thought,
                            isSearching: data.isSearching ?? m.isSearching,
                            searchSources: data.sources ? filterValidSources(data.sources) : m.searchSources,
                            isToolCalling: data.toolCall ? true : false,
                            isStreaming: true,
                            isLocked: true
                          } : m
                        )
                      };
                      return newSessions;
                    } else {
                      console.warn('[BUG INVESTIGATION] Session missing from state during streaming! SessionId:', sessionId, 'Total sessions:', prev.length);
                      return prev;
                    }
                  });
                } catch (e) {}
              }
            }
          }
        }
      } finally {
        if (watchdogTimer) clearTimeout(watchdogTimer);
        // Clear streaming flag and isNew when done
        setSessions(prev =>
          prev.map(s => s.id === sessionId ? {
            ...s,
            updatedAt: Date.now(),
            isNew: false, // Clearing the new protection flag
            messages: s.messages.map(m => m.id === initialModelMessage.id ? { ...m, isStreaming: false, isLocked: false } : m)
          } : s)
        );
      }
      return accumulatedText;
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
      } else if (errorMessage.includes("PROVIDER_NOT_CONFIGURED") || errorMessage.includes("chave inválida")) {
        errorMessage = "Configuração de IA necessária. Por favor, verifique se as chaves da API de IA foram configuradas corretamente nas configurações do app.";
      } else if (errorMessage.includes("rate limit") || errorMessage.includes("quota")) {
        errorMessage = "Nossos limites de uso de IA foram atingidos momentaneamente. Por favor, tente novamente em alguns instantes.";
      }

      setSessions(prev =>
        prev.map(s => (s.id === sessionId ? {
          ...s,
          updatedAt: Date.now(),
          isNew: false, // Clearing the new protection flag
          messages: s.messages.map((m) => {
            if (m.id === userMessage.id) return { ...m, syncStatus: 'error', isLocked: false };
            if (m.id === initialModelMessage.id) {
              return {
                ...m,
                hasError: true,
                errorMessage,
                isSearching: false,
                isStreaming: false,
                isLocked: false
              };
            }
            return m;
          })
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
    isThinkingMode,
    setIsThinkingMode,
    isLoading,
    handleSubmit,
    abortChat: () => {
      abortControllerRef.current?.abort();
      setIsLoading(false);
    },
  };
}
