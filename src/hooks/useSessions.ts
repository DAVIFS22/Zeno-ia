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
      localStorage.setItem(`${STORAGE_KEY_SESSIONS}_${userId}`, JSON.stringify(sessions));
      localStorage.setItem(`${STORAGE_KEY_CURRENT_ID}_${userId}`, currentSessionId || 'null');
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
