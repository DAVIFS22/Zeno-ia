import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { GoogleGenAI } from '@google/genai';
import { ZENO_VERSION_HISTORY, CURRENT_ZENO_VERSION, VersionEntry } from '../src/lib/versionSystem';

function parseSemVer(version: string): [number, number, number] {
  const parts = version.split('.').map(Number);
  return [parts[0] || 2, parts[1] || 4, parts[2] || 0];
}

function formatSemVer(major: number, minor: number, patch: number): string {
  return `${major}.${minor}.${patch}`;
}

function getGitChangesSinceLastTag(): { commits: string[]; files: string[] } {
  try {
    let lastTag = '';
    try {
      lastTag = execSync('git describe --tags --abbrev=0', { encoding: 'utf-8' }).trim();
    } catch (e) {
      try {
        const lastCommitWithTag = execSync('git rev-list --tags --max-count=1', { encoding: 'utf-8' }).trim();
        if (lastCommitWithTag) {
          lastTag = execSync(`git describe --tags ${lastCommitWithTag}`, { encoding: 'utf-8' }).trim();
        }
      } catch (innerE) {
        lastTag = '';
      }
    }

    console.log(`[ZENO RELEASE REVIEW] Última tag detectada: ${lastTag || 'Nenhuma'}`);

    const logCmd = lastTag 
      ? `git log ${lastTag}..HEAD --pretty=format:"%s"`
      : `git log --pretty=format:"%s" -n 15`; // Reduzido para evitar repetições massivas

    const diffCmd = lastTag
      ? `git diff --name-only ${lastTag} HEAD`
      : `git status --porcelain`;

    const commitsOutput = execSync(logCmd, { encoding: 'utf-8' }).trim();
    const filesOutput = execSync(diffCmd, { encoding: 'utf-8' }).trim();

    const commits = commitsOutput ? commitsOutput.split('\n').map(l => l.trim()).filter(Boolean) : [];
    
    // Filtragem crítica: Remove commits que mencionam a versão atual ou são apenas chores de release
    const filteredCommits = commits.filter(c => {
      const lower = c.toLowerCase();
      return !lower.includes('chore(release)') && 
             !lower.includes(`v${CURRENT_ZENO_VERSION}`) &&
             !lower.includes(CURRENT_ZENO_VERSION);
    });

    const files = filesOutput ? filesOutput.split('\n').map(l => l.trim()).filter(Boolean) : [];

    return { commits: filteredCommits, files };
  } catch (e) {
    console.warn('[ZENO RELEASE REVIEW] Aviso: Histórico Git não disponível. Usando modo vazio.');
    return { commits: [], files: [] };
  }
}

function calculateBumpType(commits: string[]): 'MAJOR' | 'MINOR' | 'PATCH' {
  let hasMinor = false;
  
  for (const commit of commits) {
    const lower = commit.toLowerCase();
    
    // 1. MUDANÇA GRANDE (breaking change)
    if (/^[a-z]+(\([^)]+\))?!:/i.test(commit) || lower.includes('breaking change')) {
      return 'MAJOR';
    }
    
    // 2. NOVO RECURSO
    if (lower.startsWith('feat:') || lower.startsWith('feat(') || lower.startsWith('feature:') || lower.startsWith('feature(')) {
      hasMinor = true;
    }
  }
  
  return hasMinor ? 'MINOR' : 'PATCH';
}

async function evaluateReleaseImpact(commits: string[], files: string[]): Promise<{ bumpType: 'MAJOR' | 'MINOR' | 'PATCH' | 'NONE'; novidades: string[]; correcoes: string[]; desempenho: string[]; arquitetura: string[] }> {
  if (commits.length === 0) {
    return {
      bumpType: 'NONE',
      novidades: [],
      correcoes: [],
      desempenho: [],
      arquitetura: []
    };
  }

  const bumpType = calculateBumpType(commits);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[ZENO RELEASE REVIEW] API Key não encontrada. Usando fallback heurístico.');
    return fallbackEvaluateReleaseImpact(commits, files);
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
    
    // Filtro inicial básico no nível do script para ajudar a IA:
    const validCommits = commits.filter(commit => {
      const lower = commit.toLowerCase();
      if (lower.startsWith('ci') || lower.startsWith('test') || lower.startsWith('lint') || lower.startsWith('chore') || lower.startsWith('build') || lower.startsWith('docs')) {
        // Se for um 'chore' relacionado à release ou refatoração, podemos manter, senão drop.
        if (lower.startsWith('chore') && (lower.includes('release') || lower.includes('deps'))) return true;
        return false;
      }
      
      // Keep only specific prefixes: feat, fix, perf, refactor, style(maybe?), or generic things that don't match the bad list.
      // Explicitly keeping the requested ones:
      if (/^(feat|fix|perf|refactor)/i.test(lower)) {
        return true;
      }
      
      // If it has no conventional commit prefix, we might want to keep it to let Claude decide,
      // but to be safe and strict, let's keep it unless it matches the dropped ones above.
      return true;
    });

    const prompt = `Você vai receber uma lista de commits técnicos de uma atualização do app ZENO AI. Gere um changelog para o usuário final em português, com bullets curtos, específicos e concretos — cada bullet deve dizer exatamente o que mudou ou foi corrigido.

REGRAS DE REVISÃO E FILTRAGEM:
- Mudanças que afetam a experiência do usuário (bugs visíveis corrigidos, novos recursos, melhorias de performance perceptíveis) → INCLUIR.
- Mudanças puramente internas (refatoração sem efeito visível, ajuste de lint, comentários, testes, CI) → EXCLUIR do changelog do usuário, mesmo que contem para a versão semver.

REGRAS DE FORMATAÇÃO:
- Reescreva cada mudança em português correto, formal, com primeira letra maiúscula.
- Use sempre o particípio passado (ex: Adicionado, Corrigido, Otimizado, Melhorado, Removido, Atualizado).
- NUNCA copie a mensagem de commit crua. Exemplo de erro: "adiciona historico de imagens". Exemplo correto: "Adicionado histórico de imagens no menu lateral".

Categorize as mudanças válidas em: novidades (feat), correcoes (fix), desempenho (perf), arquitetura (refactor/chore relevante ao usuário).

Responda estritamente em JSON válido: 
{ 
  "changes": {
    "novidades": [...], 
    "correcoes": [...], 
    "desempenho": [...], 
    "arquitetura": [...] 
  }
}
Se, depois de filtrar as mudanças, uma categoria ficar vazia, omita a chave correspondente no JSON.

Commits:
${validCommits.join('\\n')}

Arquivos modificados:
${files.join('\\n')}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text?.replace(/```json/g, '').replace(/```/g, '').trim();
    if (text) {
      const parsed = JSON.parse(text);
      const changes = parsed.changes || parsed || {};
      return {
        bumpType,
        novidades: changes.novidades || [],
        correcoes: changes.correcoes || [],
        desempenho: changes.desempenho || [],
        arquitetura: changes.arquitetura || []
      };
    }
  } catch (error) {
    console.error('[ZENO RELEASE REVIEW] Erro na API da IA, usando fallback:', error);
  }

  return fallbackEvaluateReleaseImpact(commits, files);
}

function fallbackEvaluateReleaseImpact(commits: string[], files: string[]): { bumpType: 'MAJOR' | 'MINOR' | 'PATCH' | 'NONE'; novidades: string[]; correcoes: string[]; desempenho: string[]; arquitetura: string[] } {
  if (commits.length === 0) {
    return { bumpType: 'NONE', novidades: [], correcoes: [], desempenho: [], arquitetura: [] };
  }
  const bumpType = calculateBumpType(commits);
  const novidadesSet = new Set<string>();
  const correcoesSet = new Set<string>();
  const desempenhoSet = new Set<string>();
  const arquiteturaSet = new Set<string>();

  const validCommits = commits.filter(commit => {
    const lower = commit.toLowerCase();
    if (lower.startsWith('ci') || lower.startsWith('test') || lower.startsWith('lint') || lower.startsWith('chore') || lower.startsWith('build') || lower.startsWith('docs')) {
      if (lower.startsWith('chore') && (lower.includes('release') || lower.includes('deps'))) return true;
      return false;
    }
    return true;
  });

  for (const commit of validCommits) {
    const lower = commit.toLowerCase();
    if (lower.includes('breaking') || lower.includes('major!') || lower.includes('feat!:')) {
      arquiteturaSet.add('Atualização estrutural significativa e mudanças em APIs');
    } else if (lower.startsWith('feat') || lower.startsWith('feature') || lower.includes('add') || lower.includes('novo')) {
      novidadesSet.add(commit.replace(/^(feat|feature)(\(.+\))?:\s*/i, ''));
    } else if (lower.startsWith('perf') || lower.includes('speed') || lower.includes('cache')) {
      desempenhoSet.add(commit.replace(/^perf(\(.+\))?:\s*/i, ''));
    } else if (lower.startsWith('fix') || lower.startsWith('bug') || lower.includes('corrige')) {
      correcoesSet.add(commit.replace(/^fix(\(.+\))?:\s*/i, ''));
    } else if (lower.startsWith('refactor') || lower.startsWith('arch') || lower.includes('server')) {
      arquiteturaSet.add(commit.replace(/^(refactor|arch)(\(.+\))?:\s*/i, ''));
    }
  }

  return { 
    bumpType, 
    novidades: Array.from(novidadesSet), 
    correcoes: Array.from(correcoesSet), 
    desempenho: Array.from(desempenhoSet), 
    arquitetura: Array.from(arquiteturaSet) 
  };
}

async function runAutomaticReleaseReview() {
  console.log('[ZENO RELEASE REVIEW] Iniciando revisão automática para nova release...');

  const { commits, files } = getGitChangesSinceLastTag();
  console.log(`[ZENO RELEASE REVIEW] Commits detectados: ${commits.length} | Arquivos modificados: ${files.length}`);

  if (commits.length === 0) {
    console.log('[ZENO RELEASE REVIEW] Nenhuma mudança detectada desde a última tag. Pulando atualização de versão.');
    return;
  }

  const { bumpType, novidades, correcoes, desempenho, arquitetura } = await evaluateReleaseImpact(commits, files);

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
    type: bumpType as 'MAJOR' | 'MINOR' | 'PATCH',
    changes: {
      ...(novidades.length > 0 ? { novidades } : {}),
      ...(correcoes.length > 0 ? { correcoes } : {}),
      ...(desempenho.length > 0 ? { desempenho } : {}),
      ...(arquitetura.length > 0 ? { arquitetura } : {}),
      security: ['Atualização de segurança e validação de tokens']
    }
  };

  const updatedHistory = [newEntry, ...ZENO_VERSION_HISTORY];

  // 1. Update src/config/versionConfig.ts
  const versionConfigPath = path.join(process.cwd(), 'src/config/versionConfig.ts');
  const fileContent = `export interface VersionEntry {
  version: string;
  major: number;
  minor: number;
  patch: number;
  date: string;
  type: 'MAJOR' | 'MINOR' | 'PATCH';
  changes?: {
    novidades?: string[];
    correcoes?: string[];
    desempenho?: string[];
    arquitetura?: string[];
    security?: string[];
  };
  // Fallbacks for older entries if necessary, though it seems we can migrate them
  novidades?: string[];
  correcoes?: string[];
  desempenho?: string[];
  arquitetura?: string[];
  security?: string[];
}

export const CURRENT_ZENO_VERSION = "${nextVersion}";
export const RELEASE_DATE = "${today}";
export const GIT_TAG = "v${nextVersion}";

export const ZENO_VERSION_HISTORY: VersionEntry[] = ${JSON.stringify(updatedHistory, null, 2)};

export function getLatestVersion(): VersionEntry {
  return ZENO_VERSION_HISTORY[0];
}

export async function fetchRemoteChangelog(): Promise<VersionEntry | null> {
  try {
    const res = await fetch('/changelog.json');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data[0];
      }
      if (data && data.version) {
        return data;
      }
    }
  } catch (e) {
    // fallback
  }
  return null;
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

  fs.writeFileSync(versionConfigPath, fileContent, 'utf-8');
  console.log(`[ZENO RELEASE REVIEW] Versão atualizada para v${nextVersion} (${bumpType})`);

  // 2. Generate summarized changelog.json in public/
  const outputDir = path.join(process.cwd(), 'public');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const changelogPath = path.join(outputDir, 'changelog.json');
  fs.writeFileSync(changelogPath, JSON.stringify(updatedHistory, null, 2), 'utf-8');
  console.log(`[ZENO RELEASE REVIEW] changelog.json gerado com sucesso (agora como array).`);

  // 3. Generate GitHub Release Markdown Body
  const releaseMarkdown = `## Zeno IA v${nextVersion}

Novidades:
${novidades.map(p => `- ${p}`).join('\n') || '- N/A'}

Correções:
${correcoes.map(p => `- ${p}`).join('\n') || '- N/A'}

Desempenho:
${desempenho.map(p => `- ${p}`).join('\n') || '- N/A'}

- Data de Publicação: ${today}
- Tipo de Release: ${bumpType}
`;

  const releaseMdPath = path.join(outputDir, 'release_notes.md');
  fs.writeFileSync(releaseMdPath, releaseMarkdown, 'utf-8');
  console.log(`[ZENO RELEASE REVIEW] release_notes.md gerado para o GitHub Release.`);
}

runAutomaticReleaseReview();
