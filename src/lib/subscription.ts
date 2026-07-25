import { UserPlan, DailyUsage, ModelType } from '../types';
import { ZENO_MODELS_CONFIG, getModelConfig } from './models';

export interface ModelDef {
  id: ModelType;
  name: string;
  badge?: string;
  description: string;
  isPro: boolean;
  category: 'general' | 'think' | 'search' | 'vision';
}

export const ZENO_MODELS: ModelDef[] = Object.values(ZENO_MODELS_CONFIG)
  .filter(m => ['zeno', 'think', 'search', 'vision', 'code', 'strategy', 'summary', 'pdf'].includes(m.id))
  .map(m => ({
    id: m.id,
    name: m.name,
    badge: m.badge,
    description: m.description,
    isPro: m.isPro,
    category: m.category
  }));

export const FREE_LIMITS = {
  MESSAGES_PER_DAY: 15,
  IMAGES_PER_DAY: 2,
  SEARCHES_PER_DAY: 3,
  DOCS_PER_DAY: 2
};

export function getTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getInitialUsage(): DailyUsage {
  return {
    date: getTodayString(),
    messagesCount: 0,
    imageGenCount: 0,
    webSearchCount: 0,
    docUploadCount: 0
  };
}

export function normalizeModelId(model: ModelType | string): ModelType {
  const m = (model || 'zeno') as ModelType;
  if (ZENO_MODELS_CONFIG[m]) return m;
  if (m === 'smart' || m === 'fast') return 'zeno';
  if (m === 'mega') return 'search';
  if (m === 'image') return 'vision';
  return 'zeno';
}

export function isModelPro(model: ModelType | string): boolean {
  const norm = normalizeModelId(model);
  const cfg = getModelConfig(norm);
  return cfg ? (cfg.requiredPlan === 'pro' || cfg.isPro) : false;
}

export function getModelDef(model: ModelType | string): ModelDef {
  const norm = normalizeModelId(model);
  const cfg = getModelConfig(norm);
  return {
    id: cfg.id,
    name: cfg.name,
    badge: cfg.badge,
    description: cfg.description,
    isPro: cfg.requiredPlan === 'pro' || cfg.isPro,
    category: cfg.category
  };
}

export function checkModelAccess(plan: UserPlan, model: ModelType | string): { allowed: boolean; needsPro: boolean } {
  const norm = normalizeModelId(model);
  const cfg = getModelConfig(norm);
  const isProRequired = cfg ? (cfg.requiredPlan === 'pro' || cfg.isPro) : false;
  if (isProRequired && plan !== 'ZENO Pro') {
    return { allowed: false, needsPro: true };
  }
  return { allowed: true, needsPro: false };
}

export function checkUsageLimit(
  plan: UserPlan,
  usage: DailyUsage,
  action: 'message' | 'image' | 'search' | 'doc'
): { allowed: boolean; current: number; limit: number; remaining: number } {
  // Ensure date matches today, else reset
  const today = getTodayString();
  const currentUsage = usage.date === today ? usage : getInitialUsage();

  if (plan === 'ZENO Pro') {
    return { allowed: true, current: 0, limit: Infinity, remaining: Infinity };
  }

  switch (action) {
    case 'message': {
      const current = currentUsage.messagesCount;
      const limit = FREE_LIMITS.MESSAGES_PER_DAY;
      return {
        allowed: current < limit,
        current,
        limit,
        remaining: Math.max(0, limit - current)
      };
    }
    case 'image': {
      const current = currentUsage.imageGenCount;
      const limit = FREE_LIMITS.IMAGES_PER_DAY;
      return {
        allowed: current < limit,
        current,
        limit,
        remaining: Math.max(0, limit - current)
      };
    }
    case 'search': {
      const current = currentUsage.webSearchCount;
      const limit = FREE_LIMITS.SEARCHES_PER_DAY;
      return {
        allowed: current < limit,
        current,
        limit,
        remaining: Math.max(0, limit - current)
      };
    }
    case 'doc': {
      const current = currentUsage.docUploadCount;
      const limit = FREE_LIMITS.DOCS_PER_DAY;
      return {
        allowed: current < limit,
        current,
        limit,
        remaining: Math.max(0, limit - current)
      };
    }
    default:
      return { allowed: true, current: 0, limit: FREE_LIMITS.MESSAGES_PER_DAY, remaining: 15 };
  }
}
