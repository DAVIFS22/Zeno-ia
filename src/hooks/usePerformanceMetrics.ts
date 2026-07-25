import { useRef, useEffect, useCallback, useState } from 'react';

export interface ComponentRenderMetric {
  componentName: string;
  renderCount: number;
  lastRenderTimeMs: number;
  avgRenderTimeMs: number;
  maxRenderTimeMs: number;
}

export interface ApiLatencyMetric {
  endpoint: string;
  timestamp: number;
  durationMs: number;
  success: boolean;
  status?: number;
}

export interface PerformanceSummary {
  components: Record<string, ComponentRenderMetric>;
  apiLogs: ApiLatencyMetric[];
  avgApiLatencyMs: number;
  slowRenderCount: number; // > 16ms
}

// In-memory global performance buffer
const globalMetrics: PerformanceSummary = {
  components: {},
  apiLogs: [],
  avgApiLatencyMs: 0,
  slowRenderCount: 0,
};

const MAX_API_LOGS = 50;

/**
 * Global utility to measure API latency from anywhere in the app
 */
export async function measureApiLatency<T>(
  endpoint: string,
  apiCall: () => Promise<T>
): Promise<T> {
  const startTime = performance.now();
  let success = true;
  let status: number | undefined;

  try {
    const result = await apiCall();
    if (result instanceof Response) {
      status = result.status;
      success = result.ok;
    } else {
      status = 200;
    }
    return result;
  } catch (error) {
    success = false;
    throw error;
  } finally {
    const durationMs = Math.round((performance.now() - startTime) * 100) / 100;
    const metric: ApiLatencyMetric = {
      endpoint,
      timestamp: Date.now(),
      durationMs,
      success,
      status,
    };

    globalMetrics.apiLogs.unshift(metric);
    if (globalMetrics.apiLogs.length > MAX_API_LOGS) {
      globalMetrics.apiLogs.pop();
    }

    // Recalculate average API latency
    const totalLatency = globalMetrics.apiLogs.reduce((sum, log) => sum + log.durationMs, 0);
    globalMetrics.avgApiLatencyMs = Math.round((totalLatency / globalMetrics.apiLogs.length) * 100) / 100;

    if (durationMs > 1000) {
      console.warn(`[ZENO Performance] Slow API request to "${endpoint}": ${durationMs}ms`);
    } else {
      console.debug(`[ZENO Performance] API "${endpoint}": ${durationMs}ms`);
    }
  }
}

/**
 * React Hook to track re-render timing of critical components and access real-time metrics
 */
export function usePerformanceMetrics(componentName?: string) {
  const renderStartTime = useRef<number>(performance.now());
  const [metrics, setMetrics] = useState<PerformanceSummary>(globalMetrics);

  // Measure render duration for the calling component
  useEffect(() => {
    if (!componentName) return;

    const renderDuration = Math.round((performance.now() - renderStartTime.current) * 100) / 100;
    
    const existing = globalMetrics.components[componentName] || {
      componentName,
      renderCount: 0,
      lastRenderTimeMs: 0,
      avgRenderTimeMs: 0,
      maxRenderTimeMs: 0,
    };

    const newRenderCount = existing.renderCount + 1;
    const newMax = Math.max(existing.maxRenderTimeMs, renderDuration);
    const newAvg = Math.round(((existing.avgRenderTimeMs * existing.renderCount + renderDuration) / newRenderCount) * 100) / 100;

    globalMetrics.components[componentName] = {
      componentName,
      renderCount: newRenderCount,
      lastRenderTimeMs: renderDuration,
      avgRenderTimeMs: newAvg,
      maxRenderTimeMs: newMax,
    };

    if (renderDuration > 16) {
      globalMetrics.slowRenderCount++;
      console.warn(`[ZENO Performance] Slow render in <${componentName}>: ${renderDuration}ms (Frame dropped threshold: 16ms)`);
    }

    renderStartTime.current = performance.now();
  });

  // Function to fetch up-to-date metrics snapshot
  const getMetrics = useCallback(() => {
    return { ...globalMetrics };
  }, []);

  // Refresh component state with current metrics snapshot
  const refreshMetrics = useCallback(() => {
    setMetrics({ ...globalMetrics });
  }, []);

  // Function to wrap API promises and track latency
  const trackApi = useCallback(async <T>(endpoint: string, fn: () => Promise<T>): Promise<T> => {
    const res = await measureApiLatency(endpoint, fn);
    refreshMetrics();
    return res;
  }, [refreshMetrics]);

  // Reset performance buffer
  const clearMetrics = useCallback(() => {
    globalMetrics.components = {};
    globalMetrics.apiLogs = [];
    globalMetrics.avgApiLatencyMs = 0;
    globalMetrics.slowRenderCount = 0;
    refreshMetrics();
  }, [refreshMetrics]);

  return {
    metrics,
    getMetrics,
    refreshMetrics,
    trackApi,
    clearMetrics,
    measureApiLatency,
  };
}
