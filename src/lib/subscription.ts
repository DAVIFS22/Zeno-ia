import { UserPlan, DailyUsage, ModelType } from '../types';

export interface ModelDef {
  id: ModelType;
  name: string;
  badge?: string;
  description: string;
  isPro: boolean;
  category: 'general' | 'think' | 'search' | 'vision';
}

export const ZENO_MODELS: ModelDef[] = [
  {
    id: 'zeno',
    name: 'ZENO',
    badge: 'Essencial',
    description: 'Conversas gerais, escrita e tarefas do dia a dia.',
    isPro: false,
    category: 'general'
  },
  {
    id: 'think',
    name: 'ZENO Think',
    badge: 'Raciocínio',
    description: 'Raciocínio avançado, matemática, código e problemas complexos.',
    isPro: true,
    category: 'think'
  },
  {
    id: 'search',
    name: 'ZENO Search',
    badge: 'Pesquisa Web',
    description: 'Navegação na web em tempo real com síntese e análise de fontes.',
    isPro: true,
    category: 'search'
  },
  {
    id: 'vision',
    name: 'ZENO Vision',
    badge: 'Visão & Artes',
    description: 'Geração de imagens em alta resolução e análise de arquivos visuais.',
    isPro: true,
    category: 'vision'
  }
];

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
  if (model === 'smart' || model === 'fast' || model === 'zeno') return 'zeno';
  if (model === 'think') return 'think';
  if (model === 'mega' || model === 'search') return 'search';
  if (model === 'image' || model === 'vision') return 'vision';
  return 'zeno';
}

export function isModelPro(model: ModelType | string): boolean {
  const norm = normalizeModelId(model);
  const m = ZENO_MODELS.find(x => x.id === norm);
  return m ? m.isPro : false;
}

export function getModelDef(model: ModelType | string): ModelDef {
  const norm = normalizeModelId(model);
  return ZENO_MODELS.find(x => x.id === norm) || ZENO_MODELS[0];
}

export function checkModelAccess(plan: UserPlan, model: ModelType | string): { allowed: boolean; needsPro: boolean } {
  const isProRequired = isModelPro(model);
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
