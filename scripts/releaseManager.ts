import fs from 'fs';
import path from 'path';
import { ZENO_VERSION_HISTORY, CURRENT_ZENO_VERSION, VersionEntry } from '../src/lib/versionSystem';

interface PendingRelease {
  bumpType?: 'MAJOR' | 'MINOR' | 'PATCH';
  news: string[];
  fixes: string[];
  performance: string[];
  security: string[];
  architecture: string[];
}

function parseSemVer(version: string): [number, number, number] {
  const parts = version.split('.').map(Number);
  return [parts[0] || 1, parts[1] || 0, parts[2] || 0];
}

function formatSemVer(major: number, minor: number, patch: number): string {
  return `${major}.${minor}.${patch}`;
}

function calculateNextVersion(currentVersion: string, bumpType: 'MAJOR' | 'MINOR' | 'PATCH'): [string, number, number, number] {
  let [major, minor, patch] = parseSemVer(currentVersion);

  if (bumpType === 'MAJOR') {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (bumpType === 'MINOR') {
    minor += 1;
    patch = 0;
  } else {
    patch += 1;
  }

  return [formatSemVer(major, minor, patch), major, minor, patch];
}

function runReleaseManager() {
  const pendingPath = path.join(process.cwd(), 'pending-release.json');
  let pending: PendingRelease = {
    bumpType: 'MINOR',
    news: [],
    fixes: [],
    performance: [],
    security: [],
    architecture: []
  };

  if (fs.existsSync(pendingPath)) {
    try {
      const content = fs.readFileSync(pendingPath, 'utf-8');
      pending = JSON.parse(content);
    } catch (e) {
      console.warn('[ZENO RELEASE] Erro ao ler pending-release.json, usando padrão.');
    }
  }

  const hasChanges = 
    (pending.news && pending.news.length > 0) ||
    (pending.fixes && pending.fixes.length > 0) ||
    (pending.performance && pending.performance.length > 0) ||
    (pending.security && pending.security.length > 0) ||
    (pending.architecture && pending.architecture.length > 0);

  let updatedHistory = [...ZENO_VERSION_HISTORY];
  let currentVersion = CURRENT_ZENO_VERSION;

  if (hasChanges) {
    const bumpType = pending.bumpType || (pending.news && pending.news.length > 0 ? 'MINOR' : 'PATCH');
    const [nextVer, major, minor, patch] = calculateNextVersion(CURRENT_ZENO_VERSION, bumpType);
    currentVersion = nextVer;

    const today = new Date().toISOString().split('T')[0];

    const newEntry: VersionEntry = {
      version: nextVer,
      major,
      minor,
      patch,
      date: today,
      type: bumpType,
      news: pending.news || [],
      fixes: pending.fixes || [],
      performance: pending.performance || [],
      security: pending.security || [],
      architecture: pending.architecture || []
    };

    // Prepend to history if not already present
    if (!updatedHistory.some(v => v.version === nextVer)) {
      updatedHistory = [newEntry, ...updatedHistory];
      console.log(`[ZENO RELEASE] Nova release gerada: v${nextVer} (${bumpType})`);
    }

    // Reset pending release file with empty changes for next cycle
    const emptyPending: PendingRelease = {
      bumpType: 'MINOR',
      news: [],
      fixes: [],
      performance: [],
      security: [],
      architecture: []
    };
    fs.writeFileSync(pendingPath, JSON.stringify(emptyPending, null, 2), 'utf-8');
  } else {
    console.log(`[ZENO RELEASE] Nenhuma mudança pendente. Mantendo versão atual: v${CURRENT_ZENO_VERSION}`);
  }

  // Update src/lib/versionSystem.ts automatically
  const versionSystemPath = path.join(process.cwd(), 'src/lib/versionSystem.ts');
  const fileContent = `export interface VersionEntry {
  version: string;
  major: number;
  minor: number;
  patch: number;
  date: string;
  type: 'MAJOR' | 'MINOR' | 'PATCH';
  news: string[];
  fixes: string[];
  performance: string[];
  security: string[];
  architecture: string[];
}

export const CURRENT_ZENO_VERSION = "${currentVersion}";

export const ZENO_VERSION_HISTORY: VersionEntry[] = ${JSON.stringify(updatedHistory, null, 2)};

export function getLatestVersion(): VersionEntry {
  return ZENO_VERSION_HISTORY[0];
}

export function checkAndGetNewVersion(): { isNew: boolean; version: VersionEntry } {
  const latest = getLatestVersion();
  const lastSeen = localStorage.getItem('zeno_last_seen_version');
  const isNew = lastSeen !== latest.version;
  return { isNew, version: latest };
}

export function markVersionAsSeen(versionStr: string) {
  localStorage.setItem('zeno_last_seen_version', versionStr);
}
`;

  fs.writeFileSync(versionSystemPath, fileContent, 'utf-8');
  console.log(`[ZENO RELEASE] versionSystem.ts atualizado com v${currentVersion}`);

  // Generate public/changelog.json
  const outputDir = path.join(process.cwd(), 'public');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const changelogData = {
    currentVersion,
    generatedAt: new Date().toISOString(),
    history: updatedHistory
  };

  const changelogPath = path.join(outputDir, 'changelog.json');
  fs.writeFileSync(changelogPath, JSON.stringify(changelogData, null, 2), 'utf-8');
  console.log(`[ZENO RELEASE] changelog.json gerado em ${changelogPath}`);
}

runReleaseManager();
