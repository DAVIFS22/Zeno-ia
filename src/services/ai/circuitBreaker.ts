import { CircuitState } from './types.js';

interface CircuitRecord {
  state: CircuitState;
  failures: number;
  successesInHalfOpen: number;
  cooldownUntil: number;
  lastStateChange: number;
}

const circuits: Record<string, CircuitRecord> = {};

const FAILURE_THRESHOLD = 3;
const COOLDOWN_PERIOD_MS = 30 * 1000; // 30 seconds fast recovery
const RATE_LIMIT_COOLDOWN_MS = 60 * 1000; // 1 minute fast recovery for 429
const HALF_OPEN_SUCCESS_THRESHOLD = 1;

export function getCircuitState(key: string): CircuitState {
  const record = circuits[key];
  if (!record) return 'CLOSED';

  // Check if OPEN state should transition to HALF_OPEN
  if (record.state === 'OPEN' && Date.now() >= record.cooldownUntil) {
    record.state = 'HALF_OPEN';
    record.successesInHalfOpen = 0;
    record.lastStateChange = Date.now();
    console.log(`[CIRCUIT BREAKER] ${key} mudou para HALF_OPEN para testes.`);
  }

  return record.state;
}

export function isCircuitAvailable(key: string): boolean {
  const state = getCircuitState(key);
  return state !== 'OPEN';
}

export function recordCircuitSuccess(key: string) {
  let record = circuits[key];
  if (!record) {
    record = {
      state: 'CLOSED',
      failures: 0,
      successesInHalfOpen: 0,
      cooldownUntil: 0,
      lastStateChange: Date.now()
    };
    circuits[key] = record;
  }

  if (record.state === 'HALF_OPEN') {
    record.successesInHalfOpen += 1;
    if (record.successesInHalfOpen >= HALF_OPEN_SUCCESS_THRESHOLD) {
      record.state = 'CLOSED';
      record.failures = 0;
      record.successesInHalfOpen = 0;
      record.lastStateChange = Date.now();
      console.log(`[CIRCUIT BREAKER] ${key} recuperado com sucesso -> CLOSED`);
    }
  } else if (record.state === 'CLOSED') {
    record.failures = 0;
  }
}

export function recordCircuitFailure(key: string, isRateLimit = false) {
  let record = circuits[key];
  if (!record) {
    record = {
      state: 'CLOSED',
      failures: 0,
      successesInHalfOpen: 0,
      cooldownUntil: 0,
      lastStateChange: Date.now()
    };
    circuits[key] = record;
  }

  record.failures += 1;

  // Trip open if HALF_OPEN, or if failures >= threshold, or if 2+ consecutive rate limits
  const rateLimitThreshold = 2;
  const shouldTrip = record.state === 'HALF_OPEN' || 
                    record.failures >= FAILURE_THRESHOLD || 
                    (isRateLimit && record.failures >= rateLimitThreshold);

  if (shouldTrip) {
    record.state = 'OPEN';
    const duration = isRateLimit ? RATE_LIMIT_COOLDOWN_MS : COOLDOWN_PERIOD_MS;
    record.cooldownUntil = Date.now() + duration;
    record.lastStateChange = Date.now();
    console.warn(`[CIRCUIT BREAKER] ${key} disparado -> OPEN (Cooldown: ${duration / 1000}s, Motivo: ${isRateLimit ? 'Rate Limit 429' : 'Múltiplas falhas'})`);
  }
}

export function resetAllCircuits() {
  for (const key in circuits) {
    circuits[key] = {
      state: 'CLOSED',
      failures: 0,
      successesInHalfOpen: 0,
      cooldownUntil: 0,
      lastStateChange: Date.now()
    };
    console.log(`[CIRCUIT BREAKER] ${key} resetado para CLOSED.`);
  }
}
