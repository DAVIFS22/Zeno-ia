export function logAiEvent(event: 'REQUEST' | 'SUCCESS' | 'ERROR' | 'FALLBACK', details: {
  provider: string;
  model: string;
  requestId?: string;
  userId?: string;
  status?: string;
  latency?: number;
  tokens?: number;
  error?: string;
  retry?: boolean;
  attempt?: number;
  from?: string;
  to?: string;
  reason?: string;
}) {
  const reqId = details.requestId || Math.random().toString(36).substring(2, 9);
  
  if (event === 'REQUEST') {
    console.log(`[AI_REQUEST] provider=${details.provider} model=${details.model} requestId=${reqId} user=${details.userId || 'anon'} status=started`);
  } else if (event === 'SUCCESS') {
    console.log(`[AI_SUCCESS] provider=${details.provider} model=${details.model} requestId=${reqId} latency=${details.latency}ms fallback=${details.to ? true : false}`);
  } else if (event === 'ERROR') {
    console.warn(`[AI_ERROR] provider=${details.provider} model=${details.model} requestId=${reqId} error="${details.error}" retry=${details.retry} attempt=${details.attempt}`);
  } else if (event === 'FALLBACK') {
    console.warn(`[AI_FALLBACK] from=${details.from} to=${details.to} requestId=${reqId} reason="${details.reason}"`);
  }
}
