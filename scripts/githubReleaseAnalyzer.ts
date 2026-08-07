import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { ZENO_VERSION_HISTORY, CURRENT_ZENO_VERSION, VersionEntry } from '../src/lib/versionSystem';

interface CommitChange {
  category: 'feature' | 'fix' | 'performance' | 'security' | 'architecture';
  message: string;
  type: 'MAJOR' | 'MINOR' | 'PATCH';
}

function parseSemVer(version: string): [number, number, number] {
  const parts = version.split('.').map(Number);
  return [parts[0] || 1, parts[1] || 0, parts[2] || 0];
}

function formatSemVer(major: number, minor: number, patch: number): string {
  return `${major}.${minor}.${patch}`;
}

function getGitCommitsSinceLastTag(): string[] {
  try {
    let lastTag = '';
    try {
      lastTag = execSync('git describe --tags --abbrev=0', { encoding: 'utf-8' }).trim();
    } catch (e) {
      // If no tag found, get all commits
      lastTag = '';
    }

    const gitLogCmd = lastTag 
      ? `git log ${lastTag}..HEAD --pretty=format:"%s"`
      : `git log --pretty=format:"%s" -n 50`;

    const output = execSync(gitLogCmd, { encoding: 'utf-8' }).trim();
    if (!output) return [];
    return output.split('\n').map(l => l.trim()).filter(Boolean);
  } catch (e) {
    console.warn('[ZENO GITHUB ANALYZER] Aviso: Não foi possível ler o histórico git local. Usando fallback de pending-release.json');
    return [];
  }
}

function analyzeCommits(commits: string[]): { bumpType: 'MAJOR' | 'MINOR' | 'PATCH'; changes: CommitChange[] } {
  let bumpType: 'MAJOR' | 'MINOR' | 'PATCH' = 'PATCH';
  const news: string[] = [];
  const fixes: string[] = [];
  const performance: string[] = [];
  const security: string[] = [];
  const architecture: string[] = [];

  const allChanges: CommitChange[] = [];

  if (commits.length === 0) {
    // Fallback if no commits or git not initialized in test env
    return {
      bumpType: 'PATCH',
      changes: [{ category: 'fix', message: 'Correções gerais e melhorias de estabilidade', type: 'PATCH' }]
    };
  }

  for (const msg of commits) {
    // parse conventional commits
    const lower = msg.toLowerCase();
    if (lower.includes('breaking') || lower.includes('major!') || lower.includes('feat!:')) {
      bumpType = 'MAJOR';
      news.push(msg);
      allChanges.push({ category: 'feature', message: msg, type: 'MAJOR' });
    } else if (lower.startsWith('feat') || lower.startsWith('feature') || lower.includes('add') || lower.includes('novo')) {
      if (bumpType !== 'MAJOR') bumpType = 'MINOR';
      news.push(msg);
      allChanges.push({ category: 'feature', message: msg, type: 'MINOR' });
    } else if (lower.startsWith('fix') || lower.startsWith('bug') || lower.startsWith('corrige')) {
      fixes.push(msg);
      allChanges.push({ category: 'fix', message: msg, type: 'PATCH' });
    } else if (lower.startsWith('perf') || lower.startsWith('speed') || lower.startsWith('cache')) {
      performance.push(msg);
      allChanges.push({ category: 'performance', message: msg, type: 'PATCH' });
    } else if (lower.startsWith('sec') || lower.startsWith('auth') || lower.startsWith('security')) {
      security.push(msg);
      allChanges.push({ category: 'security', message: msg, type: 'PATCH' });
    } else if (lower.startsWith('arch') || lower.startsWith('refactor') || lower.startsWith('struct')) {
      architecture.push(msg);
      allChanges.push({ category: 'architecture', message: msg, type: 'PATCH' });
    } else {
      fixes.push(msg);
      allChanges.push({ category: 'fix', message: msg, type: 'PATCH' });
    }
  }

  return { bumpType, changes: allChanges };
}

function runGitHubReleaseWorkflow() {
  console.log('[ZENO RELEASE] Analisando commits do GitHub para nova release...');

  const commits = getGitCommitsSinceLastTag();
  console.log(`[ZENO RELEASE] Total de commits analisados: ${commits.length}`);

  let bumpType: 'MAJOR' | 'MINOR' | 'PATCH' = 'PATCH';
  const news: string[] = [];
  const fixes: string[] = [];
  const performance: string[] = [];
  const security: string[] = [];
  const architecture: string[] = [];

  // Check also pending-release.json if exists
  const pendingPath = path.join(process.cwd(), 'pending-release.json');
  let pendingData: any = null;
  if (fs.existsSync(pendingPath)) {
    try {
      pendingData = JSON.parse(fs.readFileSync(pendingPath, 'utf-8'));
      if (pendingData.bumpType) bumpType = pendingData.bumpType;
      if (pendingData.news) news.push(...pendingData.news);
      if (pendingData.fixes) fixes.push(...pendingData.fixes);
      if (pendingData.performance) performance.push(...pendingData.performance);
      if (pendingData.security) security.push(...pendingData.security);
      if (pendingData.architecture) architecture.push(...pendingData.architecture);
    } catch (e) {}
  }

  const analysis = analyzeCommits(commits);
  if (commits.length > 0 && !pendingData?.bumpType) {
    bumpType = analysis.bumpType;
  }

  // Populate categorized lists from commits if empty
  if (news.length === 0) {
    commits.filter(c => c.toLowerCase().startsWith('feat')).forEach(c => news.push(c));
  }
  if (fixes.length === 0) {
    commits.filter(c => c.toLowerCase().startsWith('fix')).forEach(c => fixes.push(c));
  }
  if (news.length === 0 && fixes.length === 0 && performance.length === 0 && security.length === 0 && architecture.length === 0) {
    news.push("Atualização geral do sistema e melhorias de usabilidade");
    fixes.push("Correção de pequenos bugs e refinamento de interface");
  }

  const [major, minor, patch] = parseSemVer(CURRENT_ZENO_VERSION);
  let nextMajor = major;
  let nextMinor = minor;
  let nextPatch = patch;

  if (bumpType === 'MAJOR') {
    nextMajor += 1;
    nextMinor = 0;
    nextPatch = 0;
  } else if (bumpType === 'MINOR') {
    nextMinor += 1;
    nextPatch = 0;
  } else {
    nextPatch += 1;
  }

  const nextVersion = formatSemVer(nextMajor, nextMinor, nextPatch);
  const today = new Date().toISOString().split('T')[0];

  const newEntry: VersionEntry = {
    version: nextVersion,
    major: nextMajor,
    minor: nextMinor,
    patch: nextPatch,
    date: today,
    type: bumpType,
    news,
    fixes,
    performance,
    security,
    architecture
  };

  const updatedHistory = [newEntry, ...ZENO_VERSION_HISTORY];

  // Update src/lib/versionSystem.ts
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

export const CURRENT_ZENO_VERSION = "${nextVersion}";

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
  console.log(`[ZENO GITHUB RELEASE] Versão atualizada para v${nextVersion} (${bumpType})`);

  // Generate public/changelog.json
  const outputDir = path.join(process.cwd(), 'public');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const changelogData = {
    version: nextVersion,
    tag: `v${nextVersion}`,
    releaseDate: today,
    type: bumpType,
    changes: analysis.changes,
    history: updatedHistory
  };

  const changelogPath = path.join(outputDir, 'changelog.json');
  fs.writeFileSync(changelogPath, JSON.stringify(changelogData, null, 2), 'utf-8');
  console.log(`[ZENO GITHUB RELEASE] changelog.json gerado com sucesso.`);

  // Reset pending release
  if (fs.existsSync(pendingPath)) {
    fs.writeFileSync(pendingPath, JSON.stringify({ bumpType: 'MINOR', news: [], fixes: [], performance: [], security: [], architecture: [] }, null, 2), 'utf-8');
  }
}

runGitHubReleaseWorkflow();
