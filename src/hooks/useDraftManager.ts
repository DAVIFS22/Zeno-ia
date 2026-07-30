import { useState, useEffect, useRef, useCallback } from 'react';

export interface DraftData {
  text: string;
  timestamp: number;
}

interface UseDraftManagerOptions {
  userId: string | undefined;
  sessionId?: string | null;
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
}

export function useDraftManager({
  userId,
  sessionId,
  input,
  setInput,
}: UseDraftManagerOptions) {
  const [cloudDraftPrompt, setCloudDraftPrompt] = useState<DraftData | null>(null);

  // Storage key uniquely identifying user + session
  const storageKey = `zeno_draft_${userId || 'guest'}_${sessionId || 'default'}`;

  const localDraftRef = useRef<DraftData | null>(null);
  const inputRef = useRef(input);
  inputRef.current = input;

  const localTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cloudTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialLoadRef = useRef(true);

  // 1. Initial Load & Restoration (Local First, Cloud Second)
  useEffect(() => {
    isInitialLoadRef.current = true;
    setCloudDraftPrompt(null);

    // Layer 1: Read localStorage immediately
    let initialLocalDraft: DraftData | null = null;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed: DraftData = JSON.parse(saved);
        if (parsed && typeof parsed.text === 'string' && parsed.text.trim().length > 0) {
          initialLocalDraft = parsed;
          localDraftRef.current = parsed;
          // Restore immediately if current input is empty
          if (!inputRef.current.trim()) {
            setInput(parsed.text);
          }
        }
      }
    } catch (e) {
      console.warn('[DRAFT MANAGER] Error loading local draft:', e);
    }

    // Layer 2: Cloud Sync Fetch (Parallel & Non-blocking)
    if (!userId) {
      isInitialLoadRef.current = false;
      return;
    }

    let isSubscribed = true;

    const fetchCloudDraft = async () => {
      try {
        const url = `/api/sync/draft?userId=${encodeURIComponent(userId)}${sessionId ? `&sessionId=${encodeURIComponent(sessionId)}` : ''}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json().catch(() => ({ draft: null }));
          const cloudDraft: DraftData | null = data?.draft;

          if (isSubscribed && cloudDraft && cloudDraft.text && cloudDraft.text.trim().length > 0) {
            const localText = initialLocalDraft?.text || inputRef.current;
            const localTime = initialLocalDraft?.timestamp || 0;

            // Priority Logic:
            // If cloud draft is different and strictly newer than local draft (or no local draft was found)
            if (cloudDraft.text.trim() !== localText.trim()) {
              if (cloudDraft.timestamp > localTime) {
                console.log('[DRAFT MANAGER] Newer cloud draft discovered. Prompting user.');
                setCloudDraftPrompt(cloudDraft);
              }
            }
          }
        }
      } catch (err) {
        // Silently maintain local storage as source of truth
      } finally {
        if (isSubscribed) {
          isInitialLoadRef.current = false;
        }
      }
    };

    fetchCloudDraft();

    return () => {
      isSubscribed = false;
    };
  }, [userId, sessionId, storageKey, setInput]);

  // Sync to Cloud Helper
  const syncDraftToCloud = useCallback(async (textToSync: string, timestamp: number) => {
    if (!userId) return;
    try {
      if (!textToSync.trim()) {
        await fetch(`/api/sync/draft?userId=${encodeURIComponent(userId)}${sessionId ? `&sessionId=${encodeURIComponent(sessionId)}` : ''}`, {
          method: 'DELETE'
        }).catch(() => {});
      } else {
        await fetch('/api/sync/draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            sessionId: sessionId || '',
            text: textToSync,
            timestamp
          })
        }).catch(() => {});
      }
    } catch (err) {
      // Quiet fallback - never interrupt user
    }
  }, [userId, sessionId]);

  // 2. Debounced Local Save (~500ms) & Cloud Sync (~5s)
  useEffect(() => {
    // Skip saving during initial setup load
    if (isInitialLoadRef.current) return;

    const text = input;
    const now = Date.now();

    // --- LOCAL SAVING (500ms debounce) ---
    if (localTimerRef.current) clearTimeout(localTimerRef.current);
    localTimerRef.current = setTimeout(() => {
      try {
        if (!text.trim()) {
          localStorage.removeItem(storageKey);
          localDraftRef.current = null;
        } else {
          const draftPayload: DraftData = { text, timestamp: now };
          localStorage.setItem(storageKey, JSON.stringify(draftPayload));
          localDraftRef.current = draftPayload;
        }
      } catch (e) {
        console.warn('[DRAFT MANAGER] Error saving to localStorage:', e);
      }
    }, 500);

    // --- CLOUD SAVING (5000ms debounce) ---
    if (cloudTimerRef.current) clearTimeout(cloudTimerRef.current);
    cloudTimerRef.current = setTimeout(() => {
      syncDraftToCloud(text, now);
    }, 5000);

    return () => {
      if (localTimerRef.current) clearTimeout(localTimerRef.current);
      if (cloudTimerRef.current) clearTimeout(cloudTimerRef.current);
    };
  }, [input, storageKey, syncDraftToCloud]);

  // 3. Instant Cloud Sync on Tab Blur / Visibility Change
  useEffect(() => {
    const handleInactivity = () => {
      if (inputRef.current) {
        syncDraftToCloud(inputRef.current, Date.now());
      }
    };

    window.addEventListener('blur', handleInactivity);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        handleInactivity();
      }
    });

    return () => {
      window.removeEventListener('blur', handleInactivity);
      document.removeEventListener('visibilitychange', handleInactivity);
    };
  }, [syncDraftToCloud]);

  // Actions
  const acceptCloudDraft = useCallback(() => {
    if (cloudDraftPrompt) {
      setInput(cloudDraftPrompt.text);
      try {
        localStorage.setItem(storageKey, JSON.stringify(cloudDraftPrompt));
        localDraftRef.current = cloudDraftPrompt;
      } catch (e) {}
      setCloudDraftPrompt(null);
    }
  }, [cloudDraftPrompt, setInput, storageKey]);

  const dismissCloudDraft = useCallback(() => {
    setCloudDraftPrompt(null);
  }, []);

  const clearDraft = useCallback(() => {
    if (localTimerRef.current) clearTimeout(localTimerRef.current);
    if (cloudTimerRef.current) clearTimeout(cloudTimerRef.current);

    try {
      localStorage.removeItem(storageKey);
      localDraftRef.current = null;
    } catch (e) {}

    setCloudDraftPrompt(null);

    if (userId) {
      syncDraftToCloud('', Date.now());
    }
  }, [storageKey, userId, syncDraftToCloud]);

  return {
    cloudDraftPrompt,
    acceptCloudDraft,
    dismissCloudDraft,
    clearDraft,
  };
}
