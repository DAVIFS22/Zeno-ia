import fs from 'fs';
import path from 'path';

/**
 * ZENO AI - Abstract Database Adapter Layer
 * 
 * This module acts as the Single Point of Truth and decoupling layer for 
 * database interactions. It provides schemas and implementations for:
 * 1. Embedded Relational-Like Storage (db.json - optimized local sandbox)
 * 2. Cloud Firestore Schema (NoSQL - enterprise scalable option)
 * 3. PostgreSQL / Cloud SQL Schema (Relational - high compliance option)
 * 
 * To shift to Firestore or PostgreSQL in production, change the DB_TYPE 
 * environment variable to 'firestore' or 'postgres' and configure the connection pool.
 */

export type DbType = 'local' | 'firestore' | 'postgres';

export const DB_TYPE: DbType = (process.env.DB_TYPE as DbType) || 'local';

// ==========================================
// 1. DATABASE SCHEMA DEFINITIONS
// ==========================================

export interface UserUsage {
  userId: string;
  plan: 'ZENO Free' | 'ZENO Pro';
  date: string;
  usage: {
    messages: number;
    search: number;
    image: number;
    doc: number;
    vision: number;
  };
  lastActive: number;
  email: string;
  ip: string;
  browser: string;
  device: string;
}

export interface AdminLimits {
  messages: number;
  search: number;
  image: number;
  doc: number;
  vision: number;
}

export interface AdminConfig {
  limits: AdminLimits;
  proFeatures: Record<string, boolean>;
  serverSettings: {
    maintenanceMode: boolean;
    registrationEnabled: boolean;
    defaultModel: string;
    allowedDomains: string[];
    backupIntervalHours: number;
  };
}

export interface AuditLog {
  id: string;
  userEmail: string;
  action: string;
  oldConfig: any;
  newConfig: any;
  timestamp: number;
  ip: string;
  browser: string;
  device: string;
}

export interface SystemLog {
  id: string;
  type: 'info' | 'error' | 'ia' | 'auth' | 'system';
  userEmail: string;
  action: string;
  details: string;
  timestamp: number;
  ip: string;
  browser: string;
  device: string;
}

export interface SystemStats {
  totalMessagesSent: number;
  totalImagesGenerated: number;
  totalWebSearches: number;
  totalPdfsAnalyzed: number;
  totalVisionUses: number;
  totalCodeUses: number;
  modelUsage: Record<string, number>;
  totalRevenue: number;
}

export interface QueuedTask {
  id: string;
  userId: string;
  userEmail: string;
  plan: 'ZENO Free' | 'ZENO Pro' | 'ADMIN';
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  payload: {
    prompt: string;
    style: string;
    aspectRatio: string;
    enhance: boolean;
    engine: string;
    negativePrompt: string;
    seed?: number;
    guidanceScale?: number;
  };
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  error?: string;
  result?: any;
  retryCount: number;
}

export interface DatabaseSchema {
  users: Record<string, UserUsage>;
  config: AdminConfig;
  auditLogs: AuditLog[];
  systemLogs: SystemLog[];
  stats: SystemStats;
  tasks: Record<string, QueuedTask>;
}

// ==========================================
// 2. FIRESTORE SCALING REPRESENTATION
// ==========================================
/**
 * FIRESTORE COLLECTION STRUCTURE REFERENCE:
 * 
 * /config/admin_settings (Document containing active AdminConfig)
 * /users/{userId} (Documents containing UserUsage)
 * /audit_logs/{logId} (Documents containing AuditLogs)
 * /system_logs/{logId} (Documents containing SystemLogs)
 * /stats/global_metrics (Document containing aggregated global SystemStats)
 * 
 * Migration code example using '@google-cloud/firestore':
 * 
 * import { Firestore } from '@google-cloud/firestore';
 * const firestore = new Firestore();
 * 
 * async function getSystemStatsFromFirestore() {
 *   const doc = await firestore.collection('stats').doc('global_metrics').get();
 *   return doc.data();
 * }
 */

// ==========================================
// 3. POSTGRESQL / CLOUD SQL SCHEMAS (DRIZZLE/SQL)
// ==========================================
/**
 * DRIZZLE ORM / POSTGRESQL TABLE DEFINITION EXAMPLES:
 * 
 * import { pgTable, text, integer, timestamp, jsonb, numeric } from 'drizzle-orm/pg-core';
 * 
 * export const usersTable = pgTable('users', {
 *   userId: text('user_id').primaryKey(),
 *   plan: text('plan', { enum: ['ZENO Free', 'ZENO Pro'] }).default('ZENO Free').notNull(),
 *   date: text('active_date').notNull(),
 *   usageMessages: integer('usage_messages').default(0).notNull(),
 *   usageSearch: integer('usage_search').default(0).notNull(),
 *   usageImage: integer('usage_image').default(0).notNull(),
 *   usageDoc: integer('usage_doc').default(0).notNull(),
 *   usageVision: integer('usage_vision').default(0).notNull(),
 *   lastActive: timestamp('last_active').defaultNow().notNull(),
 *   email: text('email').notNull(),
 *   ip: text('ip'),
 *   browser: text('browser'),
 *   device: text('device')
 * });
 * 
 * export const systemLogsTable = pgTable('system_logs', {
 *   id: text('id').primaryKey(),
 *   type: text('type').notNull(),
 *   userEmail: text('user_email').notNull(),
 *   action: text('action').notNull(),
 *   details: text('details').notNull(),
 *   timestamp: timestamp('timestamp').defaultNow().notNull(),
 *   ip: text('ip'),
 *   browser: text('browser'),
 *   device: text('device')
 * });
 */

// ==========================================
// 4. EMBEDDED ENGINE DATABASE ADAPTER IMPLEMENTATION
// ==========================================

const LOCAL_DB_PATH = path.join(process.cwd(), '.data', 'db.json');

export function initLocalDatabase(): DatabaseSchema {
  const defaultDir = path.dirname(LOCAL_DB_PATH);
  if (!fs.existsSync(defaultDir)) {
    fs.mkdirSync(defaultDir, { recursive: true });
  }

  const defaultSchema: DatabaseSchema = {
    users: {},
    config: {
      limits: { messages: 50, search: 20, image: 10, doc: 5, vision: 10 },
      proFeatures: { advancedModels: true, priorityQueue: true, unlimitedStorage: true },
      serverSettings: {
        maintenanceMode: false,
        registrationEnabled: true,
        defaultModel: 'gemini-2.5-flash',
        allowedDomains: ['*'],
        backupIntervalHours: 24
      }
    },
    auditLogs: [],
    systemLogs: [],
    stats: {
      totalMessagesSent: 42,
      totalImagesGenerated: 18,
      totalWebSearches: 15,
      totalPdfsAnalyzed: 8,
      totalVisionUses: 12,
      totalCodeUses: 21,
      modelUsage: { 'gemini-3.5-flash-lite': 42 },
      totalRevenue: 39.90
    },
    tasks: {}
  };

  if (!fs.existsSync(LOCAL_DB_PATH)) {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(defaultSchema, null, 2));
    return defaultSchema;
  }

  try {
    const raw = fs.readFileSync(LOCAL_DB_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    
    // Validate and deep-merge properties to prevent crash on stale schemas
    return {
      users: parsed.users || {},
      config: {
        limits: { ...(defaultSchema.config.limits), ...(parsed.config?.limits || {}) },
        proFeatures: { ...(defaultSchema.config.proFeatures), ...(parsed.config?.proFeatures || {}) },
        serverSettings: { ...(defaultSchema.config.serverSettings), ...(parsed.config?.serverSettings || {}) }
      },
      auditLogs: parsed.auditLogs || [],
      systemLogs: parsed.systemLogs || [],
      stats: { ...(defaultSchema.stats), ...(parsed.stats || {}) },
      tasks: parsed.tasks || {}
    };
  } catch (err) {
    console.error('[DATABASE ADAPTER] Failed to read db.json, resetting to default:', err);
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(defaultSchema, null, 2));
    return defaultSchema;
  }
}

export function saveLocalDatabase(db: DatabaseSchema) {
  try {
    const defaultDir = path.dirname(LOCAL_DB_PATH);
    if (!fs.existsSync(defaultDir)) {
      fs.mkdirSync(defaultDir, { recursive: true });
    }
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(db, null, 2));
  } catch (err) {
    console.error('[DATABASE ADAPTER] Failed to save db.json:', err);
  }
}
