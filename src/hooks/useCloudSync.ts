import { useEffect, useRef } from 'react';
import { ChatSession, UserSettings } from '../types';

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

  // Pull data from cloud on login or user switch
  useEffect(() => {
    if (!userId) {
      isInitialSync.current = true;
      return;
    }

    let isSubscribed = true;

    const pullData = async () => {
      try {
        console.log('[CLOUD SYNC] Puxando dados isolados da nuvem para UID:', userId);
        
        // Fetch Settings
        const settingsRes = await fetch(`/api/sync/settings?userId=${userId}`);
        const settingsData = await settingsRes.json();
        if (isSubscribed && settingsData.settings) {
          setSettings(settingsData.settings);
        }

        // Fetch Sessions - strictly replace sessions for this UID
        const sessionsRes = await fetch(`/api/sync/sessions?userId=${userId}`);
        const sessionsData = await sessionsRes.json();
        if (isSubscribed) {
          if (Array.isArray(sessionsData.sessions)) {
            const sorted = [...sessionsData.sessions].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
            setSessions(sorted);
            lastSessionsStr.current = JSON.stringify(sorted);
          } else {
            setSessions([]);
            lastSessionsStr.current = JSON.stringify([]);
          }
        }
        
        if (isSubscribed) {
          isInitialSync.current = false;
          lastSettingsStr.current = JSON.stringify(settings);
        }
      } catch (err) {
        console.error('[CLOUD SYNC] Erro ao sincronizar dados da nuvem:', err);
      }
    };

    pullData();

    return () => {
      isSubscribed = false;
    };
  }, [userId]);

  // Push data to cloud when it changes
  useEffect(() => {
    if (!userId || isInitialSync.current) return;

    const currentSessionsStr = JSON.stringify(sessions);
    if (currentSessionsStr !== lastSessionsStr.current) {
      const pushSessions = async () => {
        try {
          await fetch('/api/sync/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, sessions })
          });
          lastSessionsStr.current = currentSessionsStr;
        } catch (err) {
          console.error('[CLOUD SYNC] Erro ao salvar sessões na nuvem:', err);
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
          await fetch('/api/sync/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, settings })
          });
          lastSettingsStr.current = currentSettingsStr;
        } catch (err) {
          console.error('[CLOUD SYNC] Erro ao salvar configurações na nuvem:', err);
        }
      };

      const timeout = setTimeout(pushSettings, 1500); // Debounce
      return () => clearTimeout(timeout);
    }
  }, [settings, userId]);
}
