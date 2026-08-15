const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 2,
  initialDelayMs = 500,
  onRetry?: (attempt: number, error: any) => void
): Promise<{ result: T; attempts: number }> {
  let attempt = 0;
  while (true) {
    try {
      attempt += 1;
      const result = await fn();
      return { result, attempts: attempt };
    } catch (err: any) {
      const isRecoverable = isRecoverableError(err);
      if (attempt > maxRetries || !isRecoverable) {
        throw err;
      }

      if (onRetry) {
        onRetry(attempt, err);
      }

      // Exponential backoff + jitter
      const exponentialDelay = initialDelayMs * Math.pow(2, attempt - 1);
      const jitter = Math.random() * 300; // random jitter up to 300ms
      const delay = Math.round(exponentialDelay + jitter);

      console.warn(`[RETRY MANAGER] Tentativa ${attempt} falhou (${err.message}). Tentando novamente em ${delay}ms...`);
      await sleep(delay);
    }
  }
}

function isRecoverableError(err: any): boolean {
  const msg = (err?.message || String(err)).toLowerCase();
  
  // Permanent errors or rate limits that should NOT be retried (jump to next provider immediately)
  if (
    msg.includes('429') ||
    msg.includes('rate limit') ||
    msg.includes('401') ||
    msg.includes('403') ||
    msg.includes('unauthorized') ||
    msg.includes('forbidden') ||
    msg.includes('invalid_api_key') ||
    msg.includes('api_key_invalid') ||
    msg.includes('invalid_argument') ||
    msg.includes('api key not valid') ||
    msg.includes('insufficient_quota') ||
    msg.includes('402') ||
    msg.includes('404') || // endpoint not found
    msg.includes('credits') ||
    msg.includes('exceeded your current quota') ||
    msg.includes('resource_exhausted') ||
    msg.includes('tokens per day') || // Groq hard limit
    msg.includes('tpd') // Tokens per day
  ) {
    return false;
  }

  // Recoverable errors (Network/Timeout/5xx)
  return (
    msg.includes('500') ||
    msg.includes('502') ||
    msg.includes('503') ||
    msg.includes('504') ||
    msg.includes('timeout') ||
    msg.includes('temporarily_unavailable') ||
    msg.includes('fetch failed') ||
    msg.includes('network')
  );
}
