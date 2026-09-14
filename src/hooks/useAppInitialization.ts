import { useState, useEffect, useRef, useCallback } from 'react';
import { User } from 'firebase/auth';
import { AdaptiveLearningProfile, UserSettings, ModelType } from '../types';
import { DEFAULT_ADAPTIVE_PROFILE } from '../lib/adaptiveLearning';
import { getOrCreateUserId } from '../lib/userId';

const STORAGE_KEY_SETTINGS = 'zeno_user_settings_v3';

export function useAppInitialization(userId: string, user: User | null, profile: any, authLoading: boolean, fetchLimits: () => void, setUserSettings: React.Dispatch<React.SetStateAction<UserSettings>>) {
  const [adaptiveProfile, setAdaptiveProfile] = useState<AdaptiveLearningProfile>(DEFAULT_ADAPTIVE_PROFILE);
  const prevUserIdRef = useRef<string>(userId);

  // Fetch Adaptive Profile
  useEffect(() => {
    if (userId) {
      const fetchProfile = async () => {
        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (user) {
            try {
              const token = await user.getIdToken();
              headers['Authorization'] = `Bearer ${token}`;
            } catch (tokenErr) {
              console.warn('Could not get auth token for adaptive profile:', tokenErr);
            }
          }
          const res = await fetch(`/api/adaptive/profile?userId=${encodeURIComponent(userId)}`, { 
            headers,
            cache: 'no-store'
          });
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const data = await res.json();
            if (data && data.profile) {
              setAdaptiveProfile(data.profile);
            }
          }
        } catch (err) {
          console.warn('Falha silenciosa ao carregar perfil adaptativo:', err);
        }
      };
      fetchProfile();
    }
  }, [userId, user]);

  // Account Isolation and Server Init
  useEffect(() => {
    if (authLoading) return;

    if (prevUserIdRef.current !== userId) {
      prevUserIdRef.current = userId;
      
      if (profile && user && user.uid !== userId) return;

      const initAccountOnServer = async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        try {
          await fetch('/api/account/init', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId,
              email: profile?.email || '',
              name: profile?.displayName || 'Usuário ZENO',
              photoURL: profile?.photoURL || ''
            }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);
        } catch(e: any) {
          clearTimeout(timeoutId);
        }
      };
      
      initAccountOnServer();

      try {
        const savedSettings = localStorage.getItem(`${STORAGE_KEY_SETTINGS}_${userId}`);
        if (savedSettings) {
          setUserSettings(JSON.parse(savedSettings));
        }
      } catch (e) {}

      fetchLimits();
    }
  }, [userId, profile, authLoading, user, fetchLimits, setUserSettings]);

  const handleSendAdaptiveFeedback = useCallback(async (msgId: string, type: 'up' | 'down', tags: string[], comment?: string) => {
    try {
      const res = await fetch('/api/adaptive/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          feedback: {
            messageId: msgId,
            type,
            tags,
            userComment: comment,
            timestamp: Date.now()
          }
        })
      });
      const data = await res.json();
      if (data.profile) {
        setAdaptiveProfile(data.profile);
      }
    } catch (err) {
      console.error('Erro ao enviar feedback adaptativo:', err);
    }
  }, [userId]);

  return { userId, adaptiveProfile, setAdaptiveProfile, handleSendAdaptiveFeedback };
}
