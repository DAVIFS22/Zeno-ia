// IndexedDB storage utility for ZENO AI chat sessions & messages using 'idb'
// Provides robust persistence, zero memory bloat, and ultra-fast history loading.

import { openDB, DBSchema } from 'idb';
import { ChatSession } from '../types';

interface ZenoDBSchema extends DBSchema {
  sessions: {
    key: string;
    value: {
      userId: string;
      sessions: ChatSession[];
      updatedAt: number;
    };
    indexes: { 'updatedAt': number };
  };
}

const DB_NAME = 'ZenoAIDB';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';

let dbPromise: ReturnType<typeof openDB<ZenoDBSchema>> | null = null;

export function getZenoDB() {
  if (!dbPromise) {
    dbPromise = openDB<ZenoDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'userId' });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      },
    });
  }
  return dbPromise;
}

export async function loadSessionsFromIndexedDB(userId: string): Promise<ChatSession[] | null> {
  try {
    const db = await getZenoDB();
    const record = await db.get(STORE_NAME, userId);
    if (record && Array.isArray(record.sessions)) {
      return record.sessions;
    }
    return null;
  } catch (err) {
    console.warn('[IndexedDB] Failed to load sessions with idb:', err);
    return null;
  }
}

export async function saveSessionsToIndexedDB(userId: string, sessions: ChatSession[]): Promise<void> {
  try {
    const db = await getZenoDB();
    
    // Optimize attachments for storage while keeping full session & chat context
    const optimizedSessions = sessions.map(s => ({
      ...s,
      messages: s.messages?.map(m => ({
        ...m,
        attachments: m.attachments?.map(att => ({
          ...att,
          url: att.url && att.url.startsWith('data:') && att.url.length > 500000 ? '[omitted_large_data]' : att.url,
          content: att.content && att.content.length > 500000 ? '[omitted_large_content]' : att.content,
        }))
      }))
    }));

    await db.put(STORE_NAME, {
      userId,
      sessions: optimizedSessions,
      updatedAt: Date.now(),
    });
  } catch (err) {
    console.warn('[IndexedDB] Failed to save sessions with idb:', err);
  }
}

export async function clearSessionsFromIndexedDB(userId: string): Promise<void> {
  try {
    const db = await getZenoDB();
    await db.delete(STORE_NAME, userId);
  } catch (err) {
    console.warn('[IndexedDB] Failed to clear sessions with idb:', err);
  }
}
