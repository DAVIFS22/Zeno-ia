import { useState, useEffect, useCallback, useRef } from 'react';
import { ChatSession } from '../types';
import { loadSessionsFromIndexedDB } from '../lib/indexedDBStorage';

interface UseDataReconciliationOptions {
  userId: string | undefined;
  onSyncComplete?: (syncedSessions: ChatSession[]) => void;
}

export function useDataReconciliation({ userId, onSyncComplete }: UseDataReconciliationOptions) {
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  const syncingRef = useRef<boolean>(false);

  const performSync = useCallback(async () => {
    if (!userId || syncingRef.current) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOnline(false);
      return;
    }

    try {
      syncingRef.current = true;
      setIsSyncing(true);
      console.log('[DataReconciliation] Verificando mensagens e sessões pendentes no IndexedDB para o usuário:', userId);

      const localSessions = await loadSessionsFromIndexedDB(userId);
      if (!localSessions || !Array.isArray(localSessions) || localSessions.length === 0) {
        setPendingCount(0);
        setIsSyncing(false);
        syncingRef.current = false;
        return;
      }

      setPendingCount(localSessions.length);
      console.log(`[DataReconciliation] Encontradas ${localSessions.length} sessões locais. Executando fila de sincronização para o Firestore...`);

      const response = await fetch('/api/sync/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, sessions: localSessions })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[DataReconciliation] Sincronização com o Firestore concluída com sucesso:', data);
        setLastSyncedAt(Date.now());
        setPendingCount(0);
        if (onSyncComplete) {
          onSyncComplete(localSessions);
        }
      } else {
        console.warn('[DataReconciliation] Falha na resposta da API de sincronização:', response.status);
      }
    } catch (err: any) {
      // Gracefully handle network drops during background sync without raising error logs
      if (err?.message?.includes('Failed to fetch') || err?.name === 'TypeError') {
        // Silently keep offline data ready for next reconnection
      } else {
        console.warn('[DataReconciliation] Sync notice:', err?.message || err);
      }
    } finally {
      setIsSyncing(false);
      syncingRef.current = false;
    }
  }, [userId, onSyncComplete]);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      console.log('[DataReconciliation] Conexão com a internet restabelecida (navigator.onLine = true). Disparando reconciliação...');
      setIsOnline(true);
      performSync();
    };

    const handleOffline = () => {
      console.log('[DataReconciliation] Conexão perdida (navigator.onLine = false). Entrando em modo offline.');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check on mount if online
    if (navigator.onLine) {
      performSync();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [performSync]);

  return {
    isOnline,
    isSyncing,
    pendingCount,
    lastSyncedAt,
    syncNow: performSync
  };
}
