/**
 * Centralized Configuration for Admin & Role-Based Access Control (RBAC)
 * 
 * To change the administrator email in the future, simply update ADMIN_EMAIL below.
 */

export const ADMIN_EMAIL = 'davifernandes0024509@gmail.com';

export type UserRole = 'admin' | 'user';

export interface FreePlanLimits {
  messages: number;
  search: number;
  image: number;
  doc: number;
  vision: number;
}

export interface ProPlanFeatures {
  limitMultiplier: number;
  priorityQueue: boolean;
  unlimitedImageGen: boolean;
  vectorMemoryAccess: boolean;
  exclusiveModelsAccess: boolean;
}

export interface ServerSettings {
  maintenanceMode: boolean;
  defaultModel: string;
  maxContextLength: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  requestTimeoutMs: number;
  enableVectorMemory: boolean;
}

export interface ModelConfigSetting {
  id: string;
  name: string;
  enabled: boolean;
  requiredPlan: 'free' | 'pro';
  description: string;
}

export interface AuditLog {
  id: string;
  adminEmail: string;
  timestamp: number;
  date: string;
  time: string;
  ip: string;
  device: string;
  browser: string;
  action: string;
  oldValue: string;
  newValue: string;
  details?: string;
}

export interface SystemLog {
  id: string;
  timestamp: number;
  date: string;
  time: string;
  type: 'info' | 'error' | 'auth' | 'ia' | 'payment';
  userEmail: string;
  action: string;
  details: string;
  ip: string;
  browser: string;
}

export interface FullAdminConfig {
  limits: FreePlanLimits;
  proFeatures: ProPlanFeatures;
  serverSettings: ServerSettings;
  models: ModelConfigSetting[];
}

export const DEFAULT_FULL_ADMIN_CONFIG: FullAdminConfig = {
  limits: {
    messages: 50,
    search: 20,
    image: 10,
    doc: 5,
    vision: 10,
  },
  proFeatures: {
    limitMultiplier: 10,
    priorityQueue: true,
    unlimitedImageGen: true,
    vectorMemoryAccess: true,
    exclusiveModelsAccess: true,
  },
  serverSettings: {
    maintenanceMode: false,
    defaultModel: 'zeno',
    maxContextLength: 32000,
    logLevel: 'info',
    requestTimeoutMs: 60000,
    enableVectorMemory: true,
  },
  models: [
    {
      id: 'zeno',
      name: 'ZENO Inteligente',
      enabled: true,
      requiredPlan: 'free',
      description: 'Modelo equilibrado para raciocínio avançado e diálogos.'
    },
    {
      id: 'fast',
      name: 'ZENO Rápido',
      enabled: true,
      requiredPlan: 'free',
      description: 'Respostas ultrarrápidas para tarefas simples.'
    },
    {
      id: 'mega',
      name: 'ZENO Mega Sábio',
      enabled: true,
      requiredPlan: 'pro',
      description: 'Modelo de altíssima capacidade e análise complexa.'
    },
    {
      id: 'image',
      name: 'ZENO Vision & Imagem',
      enabled: true,
      requiredPlan: 'pro',
      description: 'Geração e compreensão multimodal de imagens.'
    }
  ]
};

/**
 * Returns 'admin' if email strictly matches ADMIN_EMAIL, otherwise returns 'user'.
 */
export function getUserRole(email?: string | null): UserRole {
  if (!email || typeof email !== 'string') return 'user';
  return email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase() ? 'admin' : 'user';
}

/**
 * Returns true if the email is the authorized administrator.
 */
export function isAdminUser(email?: string | null): boolean {
  return getUserRole(email) === 'admin';
}
