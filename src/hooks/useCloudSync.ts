import { useEffect, useRef, useCallback } from 'react';
import { ChatSession, UserSettings } from '../types';
import { loadSessionsFromIndexedDB } from '../lib/indexedDBStorage';

export function useCloudSync(
  userId: string | undefined,
  sessions: ChatSession[],
  setSessions: React.Dispatch<React.SetStateAction<ChatSession[]>>,
  settings: UserSettings,
  setSettings: (settings: Partial<UserSettings>) => void
) {
  const isInitialSync = useRef(true);
  const activeUserRef = useRef<string | undefined>(userId);
  const lastSessionsStr = useRef(JSON.stringify(sessions));
  const lastSettingsStr = useRef(JSON.stringify(settings));

  // Reset sync flag when user changes
  useEffect(() => {
    if (activeUserRef.current !== userId) {
      activeUserRef.current = userId;
      isInitialSync.current = true;
    }
  }, [userId]);

  const pullAndReconcile = useCallback(async () => {
    if (!userId) return;

    // Granular message merging helper
    const mergeMessages = (msgsA: any[] = [], msgsB: any[] = []) => {
      const map = new Map<string, any>();
      [...msgsA, ...msgsB].forEach(m => {
        if (!m || !m.id) return;
        const existing = map.get(m.id);
        // Favor version with content, or streaming/locked status, or newer timestamp
        if (!existing || m.isStreaming || m.isLocked || (m.timestamp || 0) > (existing.timestamp || 0) || (m.text && !existing.text)) {
          map.set(m.id, m);
        }
      });
      return Array.from(map.values()).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    };

    try {
      console.log('[CLOUD SYNC] Reconciliando dados locais com o Firestore para UID:', userId);
      
      let localSessionsToPush: ChatSession[] = [];
      try {
        const idbSessions = await loadSessionsFromIndexedDB(userId);
        if (idbSessions && Array.isArray(idbSessions)) {
          localSessionsToPush = idbSessions;
        }
      } catch (idbErr) {
        console.warn('[CLOUD SYNC] Could not read from IndexedDB during reconciliation:', idbErr);
      }

      // Fetch Settings
      try {
        const settingsRes = await fetch(`/api/sync/settings?userId=${encodeURIComponent(userId)}`);
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json().catch(() => ({}));
          if (settingsData?.settings) {
            setSettings(settingsData.settings);
          }
        }
      } catch (e) {
        console.warn('[CLOUD SYNC] Settings sync error:', e);
      }

      // Fetch Sessions
      try {
        const sessionsRes = await fetch(`/api/sync/sessions?userId=${encodeURIComponent(userId)}`);
        if (sessionsRes.ok) {
          const sessionsData = await sessionsRes.json().catch(() => ({}));
          if (Array.isArray(sessionsData?.sessions)) {
            const cloudSessions: ChatSession[] = sessionsData.sessions;
            
            setSessions(prev => {
              const map = new Map<string, ChatSession>();
              
              // 1. Initial Cloud Data
              cloudSessions.forEach(cs => { if (cs && cs.id) map.set(cs.id, cs); });
              
              // 2. Merge IndexedDB data
              localSessionsToPush.forEach(loc => {
                if (!loc || !loc.id) return;
                const existing = map.get(loc.id);
                if (!existing) {
                  map.set(loc.id, loc);
                } else {
                  map.set(loc.id, { 
                    ...existing, 
                    ...loc, 
                    messages: mergeMessages(existing.messages, loc.messages) 
                  });
                }
              });

              // 3. Merge Current React State (Highest priority for active UI)
              prev.forEach(local => {
                if (!local || !local.id) return;
                const existing = map.get(local.id);
                
                const lastUpdatedSecsAgo = (Date.now() - (local.updatedAt || 0)) / 1000;
                const hasLockedMessage = local.messages?.some(m => m.isLocked || m.isStreaming);
                const isHot = hasLockedMessage || local.messages?.some(m => m.syncStatus === 'syncing') || lastUpdatedSecsAgo < 60 || local.isNew;

                if (!existing) {
                  map.set(local.id, local);
                } else {
                  // Always merge messages to prevent "vanishing message" during race conditions
                  const mergedMsgs = mergeMessages(existing.messages, local.messages);
                  
                  // If hot, local metadata (streaming flags, etc.) takes precedence
                  if (isHot) {
                    map.set(local.id, { ...existing, ...local, messages: mergedMsgs });
                  } else {
                    // Otherwise, keep newer metadata
                    const newer = (local.updatedAt || 0) >= (existing.updatedAt || 0) ? local : existing;
                    map.set(local.id, { ...newer, messages: mergedMsgs });
                  }
                }
              });

              const merged = Array.from(map.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
              lastSessionsStr.current = JSON.stringify(merged);
              return merged;
            });
          }
        }
      } catch (e) {
        console.warn('[CLOUD SYNC] Sessions sync error:', e);
      }

      isInitialSync.current = false;
      lastSettingsStr.current = JSON.stringify(settings);
    } catch (err) {
      console.warn('[CLOUD SYNC] Reconciliation error:', err);
    }
  }, [userId, setSessions, setSettings, settings]);

  // Pull data from cloud on login or user switch
  useEffect(() => {
    if (!userId) {
      isInitialSync.current = true;
      return;
    }

    let isSubscribed = true;
    pullAndReconcile().then(() => {
      if (isSubscribed) {
        isInitialSync.current = false;
      }
    });

    // Reconnection listener to automatically reconcile offline saves when online status is restored
    const handleOnline = () => {
      console.log('[NETWORK] Conexão reestabelecida. Iniciando reconciliação automática de mensagens offline...');
      pullAndReconcile();
    };

    window.addEventListener('online', handleOnline);

    return () => {
      isSubscribed = false;
      window.removeEventListener('online', handleOnline);
    };
  }, [userId, pullAndReconcile]);

  // Push data to cloud when it changes
  useEffect(() => {
    if (!userId || isInitialSync.current) return;

    const currentSessionsStr = JSON.stringify(sessions);
    if (currentSessionsStr !== lastSessionsStr.current) {
      const pushSessions = async () => {
        try {
          const res = await fetch('/api/sync/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, sessions })
          });
          if (res.ok) {
            lastSessionsStr.current = currentSessionsStr;
            console.log('[CLOUD SYNC] Sincronização de sessões/mensagens com o Firestore concluída com sucesso.');
          }
        } catch (err) {
          console.warn('[CLOUD SYNC] Falha ao enviar sessões (offline). Mantidas no armazenamento local (IndexedDB).');
        }
      };
      
      const timeout = setTimeout(pushSessions, 1500); // Debounce
      return () => clearTimeout(timeout);
    }
  }, [sessions, userId]);

  useEffect(() => {
    if (!userId || isInitialSync.current) return;

    const currentSettingsStr = JSON.stringify(settings);
    if (currentSettingsStr !== lastSettingsStr.current) {
      const pushSettings = async () => {
        try {
          const res = await fetch('/api/sync/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, settings })
          });
          if (res.ok) {
            lastSettingsStr.current = currentSettingsStr;
          }
        } catch (err) {
          console.warn('[CLOUD SYNC] Falha ao enviar configurações (offline).');
        }
      };

      const timeout = setTimeout(pushSettings, 1500); // Debounce
      return () => clearTimeout(timeout);
    }
  }, [settings, userId]);
}
