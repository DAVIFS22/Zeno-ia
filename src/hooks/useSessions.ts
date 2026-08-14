import { useState, useEffect, useCallback } from 'react';
import { ChatSession, Message } from '../types';
import { generateTitleFromMessage } from '../utils/date';
import { loadSessionsFromIndexedDB, saveSessionsToIndexedDB, clearSessionsFromIndexedDB } from '../lib/indexedDBStorage';

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
      console.error('Error loading chat sessions from localStorage:', e);
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

  // Load from IndexedDB on mount or userId change for robust and fast history loading
  useEffect(() => {
    if (!userId) return;

    let isMounted = true;
    loadSessionsFromIndexedDB(userId).then(idbSessions => {
      if (!isMounted) return;
      if (idbSessions && Array.isArray(idbSessions) && idbSessions.length > 0) {
        setSessions(prev => {
          const map = new Map<string, ChatSession>();
          // IDB sessions take priority or merge
          idbSessions.forEach((s: ChatSession) => { if (s && s.id) map.set(s.id, s); });
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
    }).catch(err => {
      console.warn('IndexedDB load background error:', err);
    });

    try {
      const savedId = localStorage.getItem(`${STORAGE_KEY_CURRENT_ID}_${userId}`);
      if (savedId && savedId !== 'null') {
        setCurrentSessionId(savedId);
      }
    } catch (e) {
      console.error('Error switching current session ID:', e);
    }

    return () => {
      isMounted = false;
    };
  }, [userId]);

  // Auto-save sessions to IndexedDB and lightweight localStorage backup
  useEffect(() => {
    if (userId) {
      // Save to IndexedDB (asynchronous, non-blocking, handles huge history without quota errors)
      saveSessionsToIndexedDB(userId, sessions).catch(err => {
        console.warn('Error saving sessions to IndexedDB:', err);
      });

      // Save lightweight backup to localStorage
      try {
        const lightweightSessions = sessions.map(s => ({
          ...s,
          messages: (s.messages || []).slice(-20).map(m => ({ // keep last 20 messages in localStorage cache
            ...m,
            attachments: (m.attachments || []).map(att => ({
              ...att,
              url: att.url && att.url.startsWith('data:') && att.url.length > 30000 ? '[omitted_large_data]' : att.url,
              content: att.content && att.content.length > 30000 ? '[omitted_large_content]' : att.content,
            }))
          }))
        }));
        localStorage.setItem(`${STORAGE_KEY_SESSIONS}_${userId}`, JSON.stringify(lightweightSessions));
      } catch (e: any) {
        console.error('Error saving sessions cache to localStorage:', e);
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
    if (userId) {
      clearSessionsFromIndexedDB(userId).catch(err => console.warn('Error clearing IDB:', err));
    }
  }, [userId]);

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
