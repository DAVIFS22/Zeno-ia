import { useState, useEffect, useCallback } from 'react';
import { UserSettings } from '../types';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const STORAGE_KEY_SETTINGS = 'zeno_user_settings_v3';

export function useAppSettings(userId: string | null, profile: any) {
  const [userSettings, setUserSettings] = useState<UserSettings>(() => {
    const DEFAULT_SETTINGS: UserSettings = {
      userName: 'Usuário ZENO',
      userEmail: '',
      userAvatar: '',
      plan: 'ZENO Free',
      theme: 'dark',
      showHomeSuggestions: false,
      logoVariant: 'monochrome',
      fontSize: 'normal',
      autoScrollToBottom: true,
      intelligentAutoScroll: true,
      defaultSpeed: 'smart',
      temperature: 0.7,
      systemInstruction: '',
      autoRead: false,
      voiceSpeed: 1.0,
      voicePersonality: 'friendly',
      speechLanguage: 'pt-BR',
      customInstructions: '',
      memoryEnabled: true,
      saveHistory: true,
      anonymousMode: false,
      rememberDevice: true,
      language: 'auto',
      isSmartMode: true,
      soundEnabled: true,
      notificationsEnabled: true,
    };

    try {
      const storageKey = userId ? `${STORAGE_KEY_SETTINGS}_${userId}` : STORAGE_KEY_SETTINGS;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (e) {
      console.error('Error loading settings:', e);
    }
    return DEFAULT_SETTINGS;
  });

  // Load from Firestore when userId is available
  useEffect(() => {
    if (userId && profile) {
      const fetchSettings = async () => {
        try {
          const userRef = doc(db, 'users', userId);
          const snap = await getDoc(userRef);
          if (snap.exists()) {
            const data = snap.data();
            if (data.settings) {
              setUserSettings(prev => ({ ...prev, ...data.settings }));
              // Also update localStorage
              const storageKey = `${STORAGE_KEY_SETTINGS}_${userId}`;
              localStorage.setItem(storageKey, JSON.stringify({ ...userSettings, ...data.settings }));
            }
          }
        } catch (e) {
          console.error('Error fetching settings from Firestore:', e);
        }
      };
      fetchSettings();
    }
  }, [userId]);

  // Sync profile to settings
  useEffect(() => {
    if (profile) {
      setUserSettings(prev => {
        const newName = profile.displayName || prev.userName;
        const newEmail = profile.email || prev.userEmail;
        const newAvatar = profile.photoURL || prev.userAvatar;

        if (
          prev.userName === newName &&
          prev.userEmail === newEmail &&
          prev.userAvatar === newAvatar
        ) {
          return prev;
        }

        return {
          ...prev,
          userName: newName,
          userEmail: newEmail,
          userAvatar: newAvatar
        };
      });
    }
  }, [profile]);

  const updateSettings = useCallback(async (newSettings: Partial<UserSettings>) => {
    setUserSettings(prev => {
      const updated = { ...prev, ...newSettings };
      const storageKey = userId ? `${STORAGE_KEY_SETTINGS}_${userId}` : STORAGE_KEY_SETTINGS;
      localStorage.setItem(storageKey, JSON.stringify(updated));
      return updated;
    });

    // Persist to Firestore if logged in
    if (userId && profile) {
      try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
          settings: newSettings
        });
        console.log('[SETTINGS] Persisted to Firestore:', newSettings);
      } catch (e) {
        console.error('Error persisting settings to Firestore:', e);
      }
    }
  }, [userId, profile]);

  return {
    userSettings,
    setUserSettings,
    updateSettings,
  };
}
