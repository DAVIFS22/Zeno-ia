import fs from 'fs';
import path from 'path';

const MEMORY_DB_PATH = path.join(process.cwd(), '.data', 'vector_memory.json');

export interface MemoryChunk {
  id: string;
  userId: string;
  content: string;
  timestamp: number;
  metadata?: {
    sessionTitle?: string;
    model?: string;
    type?: 'summary' | 'qa' | 'preference';
  };
  embedding?: number[];
}

interface MemoryStoreData {
  chunks: MemoryChunk[];
}

function ensureDir() {
  const dir = path.dirname(MEMORY_DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function readMemoryStore(): MemoryStoreData {
  try {
    ensureDir();
    if (fs.existsSync(MEMORY_DB_PATH)) {
      const data = fs.readFileSync(MEMORY_DB_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Error reading memory store:', e);
  }
  return { chunks: [] };
}

export function writeMemoryStore(store: MemoryStoreData) {
  try {
    ensureDir();
    fs.writeFileSync(MEMORY_DB_PATH, JSON.stringify(store, null, 2));
  } catch (e) {
    console.error('Error writing memory store:', e);
  }
}

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

export function storeMemory(userId: string, content: string, metadata?: MemoryChunk['metadata']): MemoryChunk {
  const store = readMemoryStore();
  const chunk: MemoryChunk = {
    id: 'mem_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
    userId,
    content,
    timestamp: Date.now(),
    metadata,
    embedding: computeEmbedding(content)
  };
  store.chunks.push(chunk);
  if (store.chunks.length > 500) {
    store.chunks = store.chunks.slice(-500);
  }
  writeMemoryStore(store);
  return chunk;
}

export function retrieveRelevantMemories(userId: string, query: string, limit: number = 3): MemoryChunk[] {
  const store = readMemoryStore();
  const userChunks = store.chunks.filter(c => c.userId === userId);
  if (userChunks.length === 0) return [];

  const queryEmbedding = computeEmbedding(query);
  
  const scored = userChunks.map(chunk => {
    const score = chunk.embedding ? cosineSimilarity(queryEmbedding, chunk.embedding) : 0;
    return { chunk, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).filter(s => s.score > 0.05).map(s => s.chunk);
}
