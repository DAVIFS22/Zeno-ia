import { adminDb } from './firebaseAdmin';

export interface MemoryChunk {
  id: string;
  userId: string;
  content: string;
  timestamp: number;
  metadata?: {
    sessionTitle?: string;
    model?: string;
    type?: 'summary' | 'qa' | 'preference' | 'user_message' | 'ai_response';
    speed?: string;
  };
  embedding?: number[];
}

const COLL_MEMORY = 'memory';

export function computeEmbedding(text: string): number[] {
  const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean);
  const vec = new Array(64).fill(0);
  for (const w of words) {
    let hash = 0;
    for (let i = 0; i < w.length; i++) {
      hash = (hash * 31 + w.charCodeAt(i)) % 64;
    }
    vec[hash] += 1;
  }
  const magnitude = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
  if (magnitude === 0) return vec;
  return vec.map(val => val / magnitude);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let mA = 0;
  let mB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    mA += a[i] * a[i];
    mB += b[i] * b[i];
  }
  if (mA === 0 || mB === 0) return 0;
  return dot / (Math.sqrt(mA) * Math.sqrt(mB));
}

export async function storeMemory(userId: string, content: string, metadata?: MemoryChunk['metadata']): Promise<MemoryChunk | null> {
  try {
    const chunk: MemoryChunk = {
      id: 'mem_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      userId,
      content,
      timestamp: Date.now(),
      metadata,
      embedding: computeEmbedding(content)
    };
    
    await adminDb.collection(COLL_MEMORY).doc(chunk.id).set(chunk);
    return chunk;
  } catch (err: any) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Dev: Skipped store memory in Firestore:', err?.message || err);
    }
    return null;
  }
}

export async function retrieveRelevantMemories(userId: string, query: string, limit: number = 3): Promise<MemoryChunk[]> {
  try {
    let snap;
    try {
      snap = await adminDb.collection(COLL_MEMORY).where('userId', '==', userId).orderBy('timestamp', 'desc').limit(100).get();
    } catch (idxErr) {
      try {
        snap = await adminDb.collection(COLL_MEMORY).where('userId', '==', userId).get();
      } catch (fallbackErr) {
        return [];
      }
    }
    const userChunks = snap.docs.map(d => d.data() as MemoryChunk);
    
    if (userChunks.length === 0) return [];

    const queryEmbedding = computeEmbedding(query);
    
    const scored = userChunks.map(chunk => {
      const score = chunk.embedding ? cosineSimilarity(queryEmbedding, chunk.embedding) : 0;
      return { chunk, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.filter(s => s.score > 0.35).slice(0, limit).map(s => s.chunk);
  } catch (err: any) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Dev: Skipped retrieve relevant memories from Firestore:', err?.message || err);
    }
    return [];
  }
}
