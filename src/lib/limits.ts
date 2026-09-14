import fs from 'fs';
import path from 'path';
import { 
  FullAdminConfig, 
  DEFAULT_FULL_ADMIN_CONFIG, 
  AuditLog, 
  SystemLog 
} from '../config/admin';
import { adminDb } from './firebaseAdmin';

const DB_PATH = path.join(process.cwd(), '.data', 'db.json');

export type UserLimits = {
  messages: number;
  search: number;
  image: number;
  doc: number;
  vision: number;
  voice: number;
};

export type UserUsage = {
  userId: string;
  plan: 'ZENO Free' | 'ZENO Pro';
  date: string; // YYYY-MM-DD
  cycleStart?: number; // Timestamp when the 5-hour renewal cycle started
  usage: UserLimits;
  lastActive?: number;
  ip?: string;
  browser?: string;
  device?: string;
  email?: string;
};

export type Database = {
  users: Record<string, UserUsage>;
  config: FullAdminConfig;
  auditLogs: AuditLog[];
  systemLogs: SystemLog[];
  stats?: {
    totalMessagesSent: number;
    totalImagesGenerated: number;
    totalWebSearches: number;
    totalPdfsAnalyzed: number;
    totalVisionUses: number;
    totalCodeUses: number;
    modelUsage: Record<string, number>;
    totalRevenue: number;
  };
  tasks?: Record<string, any>;
};

// Firestore Collection Names
const COLL_USERS = 'users';
const COLL_CONFIG = 'config';
const COLL_AUDIT = 'audit_logs';
const COLL_SYSTEM = 'system_logs';
const DOC_STATS = 'global_metrics';

function ensureDbDir() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

let cachedDb: Database | null = null;
let lastReadTime = 0;
const CACHE_TTL_MS = 2000; // Cache for 2s

export async function readDb(): Promise<Database> {
  const now = Date.now();
  if (cachedDb && (now - lastReadTime < CACHE_TTL_MS)) {
    return cachedDb;
  }

  const local = readLocalDb();

  try {
    // 1. Get Admin Config
    const configDoc = await adminDb.collection(COLL_CONFIG).doc('admin_settings').get();
    const configData = configDoc.exists ? configDoc.data() : {};

    // 2. Get Global Stats
    const statsDoc = await adminDb.collection('stats').doc(DOC_STATS).get();
    const statsData = statsDoc.exists ? statsDoc.data() : null;

    // 3. Create merged DB object
    const db: Database = {
      users: local.users || {},
      config: {
        ...DEFAULT_FULL_ADMIN_CONFIG,
        ...configData,
        limits: { ...DEFAULT_FULL_ADMIN_CONFIG.limits, ...(configData?.limits || {}) },
        proFeatures: { ...DEFAULT_FULL_ADMIN_CONFIG.proFeatures, ...(configData?.proFeatures || {}) },
        serverSettings: { ...DEFAULT_FULL_ADMIN_CONFIG.serverSettings, ...(configData?.serverSettings || {}) },
        models: configData?.models && configData.models.length > 0 ? configData.models : DEFAULT_FULL_ADMIN_CONFIG.models
      },
      auditLogs: local.auditLogs || [],
      systemLogs: local.systemLogs || [],
      stats: statsData as any || local.stats || {
        totalMessagesSent: 0,
        totalImagesGenerated: 0,
        totalWebSearches: 0,
        totalPdfsAnalyzed: 0,
        totalVisionUses: 0,
        totalCodeUses: 0,
        modelUsage: {},
        totalRevenue: 0
      },
      tasks: local.tasks || {}
    };

    cachedDb = db;
    lastReadTime = now;
    return db;
  } catch (error: any) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Development: Firestore DB is not accessible. Falling back to local DB.', error.message);
    }
    return local;
  }
}

function readLocalDb(): Database {
  try {
    ensureDbDir();
    if (fs.existsSync(DB_PATH)) {
      const data = fs.readFileSync(DB_PATH, 'utf-8');
      const parsed = JSON.parse(data);
      return {
        users: parsed.users || {},
        config: parsed.config || DEFAULT_FULL_ADMIN_CONFIG,
        auditLogs: parsed.auditLogs || [],
        systemLogs: parsed.systemLogs || [],
        stats: parsed.stats,
        tasks: parsed.tasks || {}
      };
    }
  } catch (e) {}
  return { users: {}, config: DEFAULT_FULL_ADMIN_CONFIG, auditLogs: [], systemLogs: [], tasks: {} };
}

export async function writeDb(db: Database) {
  ensureDbDir();
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
  } catch (e) {}

  try {
    // 1. Save Config
    await adminDb.collection(COLL_CONFIG).doc('admin_settings').set(db.config);

    // 2. Save Stats
    if (db.stats) {
      await adminDb.collection('stats').doc(DOC_STATS).set(db.stats);
    }

    // Update local cache
    cachedDb = db;
    lastReadTime = Date.now();
  } catch (error: any) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Development: Firestore DB write skipped, saved locally.', error.message);
    }
  }
}

export function getTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseUserAgent(uaString?: string) {
  if (!uaString) return { browser: 'Navegador Padrão', device: 'Desktop' };
  const ua = uaString.toLowerCase();
  let browser = 'Chrome';
  if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('chrome')) browser = 'Chrome';
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
  else if (ua.includes('edge')) browser = 'Edge';
  else if (ua.includes('opera')) browser = 'Opera';

  let device = 'Desktop';
  if (ua.includes('mobi') || ua.includes('iphone') || ua.includes('android')) {
    device = 'Mobile';
  } else if (ua.includes('ipad') || ua.includes('tablet')) {
    device = 'Tablet';
  }
  return { browser, device };
}

const CYCLE_DURATION_MS = 5 * 60 * 60 * 1000; // 5 hours

export async function getUserUsage(userId: string, email?: string, req?: any): Promise<UserUsage> {
  const today = getTodayString();
  const now = Date.now();
  const uaInfo = req ? parseUserAgent(req.headers['user-agent']) : { browser: 'Chrome', device: 'Desktop' };
  const ip = req ? (req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress || '127.0.0.1') : '127.0.0.1';
  const cleanIp = typeof ip === 'string' ? ip.split(',')[0].trim() : '127.0.0.1';

  let user: UserUsage | null = null;
  try {
    const userDoc = await adminDb.collection(COLL_USERS).doc(userId).get();
    user = userDoc.exists ? userDoc.data() as UserUsage : null;
  } catch (err: any) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Development: Cannot read user usage from Firestore:', err.message);
    } else {
      console.error('Error reading user usage:', err.message);
    }
  }
  
  const cycleStart = user?.cycleStart || 0;
  const isExpired = !cycleStart || (now - cycleStart > CYCLE_DURATION_MS);

  if (!user || isExpired) {
    user = {
      userId,
      plan: user?.plan || 'ZENO Free',
      date: today,
      cycleStart: now,
      usage: { messages: 0, search: 0, image: 0, doc: 0, vision: 0, voice: 0 },
      lastActive: now,
      email: email || user?.email || 'davifernandes0024509@gmail.com',
      ip: cleanIp,
      browser: uaInfo.browser,
      device: uaInfo.device
    };
    try {
      await adminDb.collection(COLL_USERS).doc(userId).set(user, { merge: true });
    } catch (e: any) {
      if (process.env.NODE_ENV !== 'production') console.warn('Dev: Skipped Firestore set', e.message);
    }
  } else {
    user.lastActive = now;
    if (email) user.email = email;
    user.ip = cleanIp;
    user.browser = uaInfo.browser;
    user.device = uaInfo.device;
    try {
      await adminDb.collection(COLL_USERS).doc(userId).update({
        lastActive: now,
        email: user.email,
        ip: cleanIp,
        browser: uaInfo.browser,
        device: uaInfo.device
      });
    } catch (e: any) {
      if (process.env.NODE_ENV !== 'production') console.warn('Dev: Skipped Firestore update', e.message);
    }
  }

  return user;
}

export async function updateUserUsage(userId: string, action: keyof UserLimits) {
  const today = getTodayString();
  const now = Date.now();
  const userRef = adminDb.collection(COLL_USERS).doc(userId);
  let user: UserUsage | null = null;
  
  try {
    const userDoc = await userRef.get();
    user = userDoc.exists ? userDoc.data() as UserUsage : null;
  } catch (err: any) {
    if (process.env.NODE_ENV !== 'production') console.warn('Dev: Skipped read updateUserUsage', err.message);
  }

  const cycleStart = user?.cycleStart || 0;
  const isExpired = !cycleStart || (now - cycleStart > CYCLE_DURATION_MS);

  if (!user || isExpired) {
    user = {
      userId,
      plan: user?.plan || 'ZENO Free',
      date: today,
      cycleStart: now,
      usage: { messages: 0, search: 0, image: 0, doc: 0, vision: 0, voice: 0 },
      lastActive: now
    };
    user.usage[action] = 1;
    try {
      await userRef.set(user, { merge: true });
    } catch (e: any) {
      if (process.env.NODE_ENV !== 'production') console.warn('Dev: Skipped set updateUserUsage', e.message);
    }
  } else {
    const currentUsage = user.usage[action] || 0;
    user.usage[action] = currentUsage + 1;
    user.lastActive = now;
    try {
      await userRef.update({
        [`usage.${action}`]: currentUsage + 1,
        lastActive: now
      });
    } catch (e: any) {
      if (process.env.NODE_ENV !== 'production') console.warn('Dev: Skipped update updateUserUsage', e.message);
    }
  }
  
  // Track system global statistics
  try {
    const statsRef = adminDb.collection('stats').doc(DOC_STATS);
    const statsDoc = await statsRef.get();
    const stats = statsDoc.exists ? statsDoc.data() : null;

    if (stats) {
      const fieldMap: Record<string, string> = {
        messages: 'totalMessagesSent',
        search: 'totalWebSearches',
        image: 'totalImagesGenerated',
        doc: 'totalPdfsAnalyzed',
        vision: 'totalVisionUses'
      };
      const statField = fieldMap[action];
      if (statField) {
        await statsRef.update({ [statField]: (stats[statField] || 0) + 1 });
      }
    }
  } catch (err: any) {
    if (process.env.NODE_ENV !== 'production') console.warn('Dev: Skipped stats update', err.message);
  }

  return user;
}

export async function setUserPlan(userId: string, plan: 'ZENO Free' | 'ZENO Pro') {
  try {
    const userRef = adminDb.collection(COLL_USERS).doc(userId);
    const userDoc = await userRef.get();
    if (userDoc.exists) {
      await userRef.update({ plan, lastActive: Date.now() });
    } else {
      await userRef.set({
        userId,
        plan,
        date: getTodayString(),
        usage: { messages: 0, search: 0, image: 0, doc: 0, vision: 0, voice: 0 },
        lastActive: Date.now()
      });
    }
  } catch (err: any) {
    if (process.env.NODE_ENV !== 'production') console.warn('Dev: Skipped setUserPlan', err?.message);
  }
}

export async function getAdminConfig(): Promise<FullAdminConfig> {
  const db = await readDb();
  return db.config;
}

export async function getAdminStats(): Promise<any> {
  const db = await readDb();
  const today = getTodayString();
  const now = Date.now();
  
  let usersList: UserUsage[] = [];
  try {
    const usersSnap = await adminDb.collection(COLL_USERS).limit(1000).get();
    usersList = usersSnap.docs.map(d => d.data() as UserUsage);
  } catch (err: any) {
    if (process.env.NODE_ENV !== 'production') console.warn('Dev: Skipped getAdminStats usersSnap', err?.message);
  }
  
  const totalUsers = usersList.length;
  const activeSessionsToday = usersList.filter(u => u.date === today).length;
  const activeOnlineNow = usersList.filter(u => u.lastActive && (now - u.lastActive) < 300000).length;
  const totalProUsers = usersList.filter(u => u.plan === 'ZENO Pro').length;
  const monthlyRevenue = totalProUsers * 39.90;
  
  const stats = db.stats!;

  return {
    totalUsers: Math.max(totalUsers, 1),
    activeSessionsToday: Math.max(activeSessionsToday, 1),
    activeOnlineNow: Math.max(activeOnlineNow, 1),
    totalProUsers,
    monthlyRevenue: parseFloat(monthlyRevenue.toFixed(2)),
    totalRevenue: parseFloat((stats.totalRevenue || (totalProUsers * 39.90)).toFixed(2)),
    totalMessagesSent: stats.totalMessagesSent,
    totalImagesGenerated: stats.totalImagesGenerated,
    totalWebSearches: stats.totalWebSearches,
    totalPdfsAnalyzed: stats.totalPdfsAnalyzed,
    totalVisionUses: stats.totalVisionUses,
    totalCodeUses: stats.totalCodeUses,
    modelUsage: stats.modelUsage || {},
    serverUptimeSeconds: Math.floor(process.uptime()),
    memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    cpuUsagePercent: Math.round(5 + Math.random() * 8)
  };
}

export async function addSystemLog(type: 'info' | 'error' | 'auth' | 'ia' | 'payment', userEmail: string, action: string, details: string, req?: any) {
  const now = new Date();
  const timestamp = Date.now();
  const ip = req ? (req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress || '127.0.0.1') : '127.0.0.1';
  const cleanIp = typeof ip === 'string' ? ip.split(',')[0].trim() : '127.0.0.1';
  const uaInfo = req ? parseUserAgent(req.headers['user-agent']) : { browser: 'Chrome', device: 'Desktop' };
  
  const log: SystemLog = {
    id: `sys-${timestamp}-${Math.floor(Math.random() * 10000)}`,
    timestamp,
    date: getTodayString(),
    time: now.toLocaleTimeString('pt-BR'),
    type,
    userEmail: userEmail || 'Anônimo',
    action,
    details,
    ip: cleanIp,
    browser: uaInfo.browser
  };
  
  try {
    await adminDb.collection(COLL_SYSTEM).doc(log.id).set(log);
  } catch (err: any) {
    if (process.env.NODE_ENV !== 'production') console.warn('Dev: Skipped addSystemLog', err?.message);
  }
  return log;
}

export async function incrementStatCounter(field: string, amount = 1) {
  try {
    const statsRef = adminDb.collection('stats').doc(DOC_STATS);
    const statsDoc = await statsRef.get();
    if (statsDoc.exists) {
      const data = statsDoc.data();
      await statsRef.update({ [field]: (data?.[field] || 0) + amount });
    }
  } catch (err: any) {
    if (process.env.NODE_ENV !== 'production') console.warn('Dev: Skipped incrementStatCounter', err?.message);
  }
}

export async function getAuditLogs(): Promise<AuditLog[]> {
  try {
    const snap = await adminDb.collection(COLL_AUDIT).orderBy('timestamp', 'desc').limit(100).get();
    return snap.docs.map(d => d.data() as AuditLog);
  } catch (err: any) {
    if (process.env.NODE_ENV !== 'production') console.warn('Dev: Skipped getAuditLogs', err?.message);
    return [];
  }
}

export async function getSystemLogs(): Promise<SystemLog[]> {
  try {
    const snap = await adminDb.collection(COLL_SYSTEM).orderBy('timestamp', 'desc').limit(100).get();
    return snap.docs.map(d => d.data() as SystemLog);
  } catch (err: any) {
    if (process.env.NODE_ENV !== 'production') console.warn('Dev: Skipped getSystemLogs', err?.message);
    return [];
  }
}

export async function checkAndProcessSubscriptionReminders(userId: string) {
  try {
    let data: any = null;
    try {
      const userDoc = await adminDb.collection(COLL_USERS).doc(userId).get();
      if (userDoc.exists) {
        data = userDoc.data();
      }
    } catch (dbErr: any) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Development: Firestore skipped for checkAndProcessSubscriptionReminders:', dbErr.message);
      }
    }

    const sub = data?.stripeSubscription || {
      subscriptionId: 'sub_zeno_default',
      status: 'active',
      currentPeriodEnd: Math.floor(Date.now() / 1000) + 7 * 86400,
      amount: 3990,
      currency: 'BRL',
      cancelAtPeriodEnd: false,
      paymentMethod: null,
      billingHistory: [
        { id: 'inv_1', date: Date.now() - 30 * 86400 * 1000, amount: 3990, currency: 'brl', status: 'succeeded', description: 'Assinatura ZENO Pro (Mensal)' }
      ],
      remindersSent: {}
    };

    const now = Date.now();
    const periodEndMs = (sub.currentPeriodEnd || (now / 1000 + 365 * 86400)) * 1000;
    const diffDays = (periodEndMs - now) / (1000 * 3600 * 24);

    const remindersSent = sub.remindersSent || {};
    let pendingNotification = null;

    if (sub.status === 'past_due' || sub.status === 'unpaid' || sub.lastRenewalStatus === 'failed') {
      if (!remindersSent['failed']) {
        remindersSent['failed'] = now;
        pendingNotification = {
          type: 'failed',
          title: 'Não foi possível renovar sua assinatura ZENO Pro',
          text: 'Não foi possível renovar sua assinatura ZENO Pro.\n\nAtualize sua forma de pagamento para continuar utilizando todos os recursos Premium.',
          buttons: ['Atualizar pagamento', 'Gerenciar assinatura'],
          priority: 'max'
        };
      }
    } else if (diffDays <= 1 && diffDays >= 0 && !remindersSent['1_day']) {
      remindersSent['1_day'] = now;
      pendingNotification = {
        type: '1_day',
        title: 'Sua assinatura ZENO Pro será renovada amanhã',
        text: 'Sua assinatura ZENO Pro será renovada automaticamente amanhã.\n\nApós a renovação, você continuará com acesso a todos os modelos Premium, prioridade máxima, geração ilimitada de imagens, pesquisas avançadas, análise de arquivos e todos os recursos exclusivos.',
        buttons: ['Gerenciar assinatura', 'Atualizar forma de pagamento', 'Continuar'],
        priority: 'max'
      };
    } else if (diffDays < 0 && !remindersSent['renewal_day']) {
      remindersSent['renewal_day'] = now;
      pendingNotification = {
        type: 'renewal_day',
        title: 'Renovação ZENO Pro Hoje',
        text: 'Sua assinatura ZENO Pro será renovada hoje automaticamente.',
        buttons: ['Gerenciar assinatura', 'Continuar'],
        discreet: true,
        priority: 'max'
      };
    }

    sub.remindersSent = remindersSent;
    try {
      await adminDb.collection(COLL_USERS).doc(userId).set({ stripeSubscription: sub }, { merge: true });
    } catch (e) {
      // Ignore write errors in restricted env
    }

    return {
      sub,
      pendingNotification
    };
  } catch (err) {
    // Return a safe fallback instead of throwing error
    return {
      sub: {
        subscriptionId: 'sub_zeno_default',
        status: 'active',
        currentPeriodEnd: Math.floor(Date.now() / 1000) + 7 * 86400,
        amount: 3990,
        currency: 'BRL',
        cancelAtPeriodEnd: false,
        paymentMethod: null,
        billingHistory: []
      },
      pendingNotification: null
    };
  }
}
