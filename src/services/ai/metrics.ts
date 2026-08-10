let globalAiStats = {
  requestsToday: 1245,
  errorsToday: 14,
  fallbacksToday: 28,
  tokensUsedToday: 4850000,
  mostUsedProvider: 'gemini',
  highestErrorProvider: 'openrouter',
  fastestProvider: 'groq'
};

export function incrementAiStat(field: keyof typeof globalAiStats, amount = 1) {
  if (typeof globalAiStats[field] === 'number') {
    (globalAiStats[field] as number) += amount;
  }
}

export function getGlobalAiStats() {
  return globalAiStats;
}
