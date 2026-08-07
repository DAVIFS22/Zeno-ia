import { useState, useEffect, useCallback } from 'react';
import { DailyUsage } from '../types';
import { getTodayString, getInitialUsage } from '../lib/subscription';
import { measureApiLatency } from './usePerformanceMetrics';

const STORAGE_KEY_USAGE = 'zeno_daily_usage_v3';

export function useUsage(userId: string | null) {
  const [dailyUsage, setDailyUsage] = useState<DailyUsage>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_USAGE);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.date === getTodayString()) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error loading daily usage:', e);
    }
    return getInitialUsage();
  });

  const [backendLimits, setBackendLimits] = useState<any>(null);
  const [adminConfig, setAdminConfig] = useState<any>({
    messages: 50,
    search: 20,
    image: 10,
    doc: 5,
    vision: 10,
  });

  const fetchLimits = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await measureApiLatency('/api/limits', () => fetch(`/api/limits?userId=${userId}`));
      if (res.ok) {
        const data = await res.json();
        if (data.usage?.usage) {
          setBackendLimits(data.usage.usage);
        }
        if (data.config?.limits) {
          setAdminConfig(data.config.limits);
        }
      }
    } catch (e) {
      console.warn("Could not fetch limits from server:", e);
    }
  }, [userId]);

  useEffect(() => {
    fetchLimits();
    const interval = setInterval(fetchLimits, 60000);
    return () => clearInterval(interval);
  }, [fetchLimits]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_USAGE, JSON.stringify(dailyUsage));
  }, [dailyUsage]);

  return {
    dailyUsage,
    setDailyUsage,
    backendLimits,
    adminConfig,
    fetchLimits,
  };
}
