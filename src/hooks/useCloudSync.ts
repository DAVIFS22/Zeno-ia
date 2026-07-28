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
        try {
          const settingsRes = await fetch(`/api/sync/settings?userId=${encodeURIComponent(userId)}`);
          if (settingsRes.ok) {
            const settingsData = await settingsRes.json().catch(() => ({}));
            if (isSubscribed && settingsData?.settings) {
              setSettings(settingsData.settings);
            }
          }
        } catch (e) {
          // Graceful fallback when cloud sync endpoint is unavailable
        }

        // Fetch Sessions - strictly replace sessions for this UID
        try {
          const sessionsRes = await fetch(`/api/sync/sessions?userId=${encodeURIComponent(userId)}`);
          if (sessionsRes.ok) {
            const sessionsData = await sessionsRes.json().catch(() => ({}));
            if (isSubscribed) {
              if (Array.isArray(sessionsData?.sessions)) {
                const sorted = [...sessionsData.sessions].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
                setSessions(sorted);
                lastSessionsStr.current = JSON.stringify(sorted);
              }
            }
          }
        } catch (e) {
          // Graceful fallback when cloud sync endpoint is unavailable
        }
        
        if (isSubscribed) {
          isInitialSync.current = false;
          lastSettingsStr.current = JSON.stringify(settings);
        }
      } catch (err) {
        // Fall back gracefully to local storage
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
          const res = await fetch('/api/sync/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, sessions })
          });
          if (res.ok) {
            lastSessionsStr.current = currentSessionsStr;
          }
        } catch (err) {
          // Local storage fallback maintained silently
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
          // Local storage fallback maintained silently
        }
      };

      const timeout = setTimeout(pushSettings, 1500); // Debounce
      return () => clearTimeout(timeout);
    }
  }, [settings, userId]);
}
