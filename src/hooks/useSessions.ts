import { useState, useEffect, useCallback } from 'react';
import { ChatSession, Message } from '../types';
import { generateTitleFromMessage } from '../utils/date';

const STORAGE_KEY_SESSIONS = 'zeno_chat_sessions_v3';
const STORAGE_KEY_CURRENT_ID = 'zeno_current_session_id_v3';

export function useSessions(userId: string | null) {
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      if (userId) {
        const saved = localStorage.getItem(`${STORAGE_KEY_SESSIONS}_${userId}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
        }
      }
    } catch (e) {
      console.error('Error loading chat sessions:', e);
    }
    return [];
  });

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(() => {
    if (userId) {
      const savedId = localStorage.getItem(`${STORAGE_KEY_CURRENT_ID}_${userId}`);
      if (savedId && savedId !== 'null') return savedId;
    }
    return null;
  });

  // Reload sessions when userId changes
  useEffect(() => {
    if (!userId) return;
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY_SESSIONS}_${userId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSessions(prev => {
            const map = new Map<string, ChatSession>();
            parsed.forEach((s: ChatSession) => { if (s && s.id) map.set(s.id, s); });
            prev.forEach((s: ChatSession) => {
              if (!s || !s.id) return;
              const existing = map.get(s.id);
              if (!existing || (s.messages?.length || 0) >= (existing.messages?.length || 0)) {
                map.set(s.id, s);
              }
            });
            return Array.from(map.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
          });
        }
      }
      const savedId = localStorage.getItem(`${STORAGE_KEY_CURRENT_ID}_${userId}`);
      if (savedId && savedId !== 'null') {
        setCurrentSessionId(savedId);
      }
    } catch (e) {
      console.error('Error switching chat sessions for user:', e);
    }
  }, [userId]);

  // Auto-save sessions
  useEffect(() => {
    if (userId) {
      try {
        localStorage.setItem(`${STORAGE_KEY_SESSIONS}_${userId}`, JSON.stringify(sessions));
      } catch (e: any) {
        console.error('Error saving sessions:', e);
        if (e.name === 'QuotaExceededError' || e.message?.includes('exceeded the quota')) {
          try {
            let trimSize = Math.max(1, Math.floor(sessions.length / 2));
            while (trimSize > 0) {
              try {
                const trimmed = sessions.slice(0, trimSize);
                localStorage.setItem(`${STORAGE_KEY_SESSIONS}_${userId}`, JSON.stringify(trimmed));
                // If it succeeds, update state so it stops trying to save the big one over and over
                setSessions(trimmed);
                break;
              } catch (retryError: any) {
                if (retryError.name === 'QuotaExceededError' || retryError.message?.includes('exceeded the quota')) {
                  if (trimSize === 1) break; // can't trim further
                  trimSize = Math.floor(trimSize / 2);
                } else {
                  break;
                }
              }
            }
          } catch (retryError) {
            console.error('Failed even after aggressive trimming:', retryError);
          }
        }
      }
      
      try {
        if (currentSessionId) {
          localStorage.setItem(`${STORAGE_KEY_CURRENT_ID}_${userId}`, currentSessionId);
        } else {
          localStorage.removeItem(`${STORAGE_KEY_CURRENT_ID}_${userId}`);
        }
      } catch (e) {
        console.error('Error saving current session ID:', e);
      }
    }
  }, [sessions, currentSessionId, userId]);

  const addSession = useCallback((session: ChatSession) => {
    setSessions(prev => [session, ...prev]);
  }, []);

  const updateSession = useCallback((sessionId: string, updater: (session: ChatSession) => ChatSession) => {
    setSessions(prev => prev.map(s => (s.id === sessionId ? updater(s) : s)));
  }, []);

  const deleteSession = useCallback((sessionId: string) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    if (currentSessionId === sessionId) {
      setCurrentSessionId(null);
    }
  }, [currentSessionId]);

  const clearHistory = useCallback(() => {
    setSessions([]);
    setCurrentSessionId(null);
  }, []);

  return {
    sessions,
    setSessions,
    currentSessionId,
    setCurrentSessionId,
    addSession,
    updateSession,
    deleteSession,
    clearHistory,
  };
}
