export interface VersionEntry {
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
    news?: string[];
    fixes?: string[];
    performance?: string[];
    architecture?: string[];
  };
  // Fallbacks for older entries if necessary, though it seems we can migrate them
  novidades?: string[];
  correcoes?: string[];
  desempenho?: string[];
  arquitetura?: string[];
  security?: string[];
  news?: string[];
  fixes?: string[];
  performance?: string[];
  architecture?: string[];
}

export const CURRENT_ZENO_VERSION = "2.24.4";
export const RELEASE_DATE = "2026-08-09";
export const GIT_TAG = "v2.24.4";

export const ZENO_VERSION_HISTORY: VersionEntry[] = [
  {
    "version": "2.24.4",
    "major": 2,
    "minor": 24,
    "patch": 4,
    "date": "2026-08-09",
    "type": "PATCH",
    "changes": {
      "security": [
        "Atualização de segurança e validação de tokens"
      ]
    }
  },
  {
    "version": "2.24.3",
    "major": 2,
    "minor": 24,
    "patch": 3,
    "date": "2026-08-08",
    "type": "PATCH",
    "changes": {
      "security": [
        "Atualização de segurança e validação de tokens"
      ]
    }
  },
  {
    "version": "2.24.2",
    "major": 2,
    "minor": 24,
    "patch": 2,
    "date": "2026-08-08",
    "type": "PATCH",
    "changes": {
      "security": [
        "Atualização de segurança e validação de tokens"
      ]
    }
  },
  {
    "version": "2.24.1",
    "major": 2,
    "minor": 24,
    "patch": 1,
    "date": "2026-08-08",
    "type": "PATCH",
    "changes": {
      "correcoes": [
        "teste de validação do pipeline de release"
      ],
      "security": [
        "Atualização de segurança e validação de tokens"
      ]
    }
  },
  {
    "version": "2.24.0",
    "major": 2,
    "minor": 24,
    "patch": 0,
    "date": "2026-08-07",
    "type": "MINOR",
    "changes": {
      "novidades": [
        "Adicionado histórico de imagens geradas no menu lateral para acesso rápido",
        "Implementado suporte a novos modelos de visão e processamento de imagem"
      ],
      "correcoes": [
        "Corrigido erro de loop infinito no processamento de áudio/microfone",
        "Ajustada a exibição de avatares no modo escuro"
      ],
      "desempenho": [
        "Otimizado o carregamento da lista de mensagens com virtualização",
        "Redução no tempo de resposta inicial do chat"
      ],
      "security": [
        "Atualização de segurança e validação de tokens de autenticação"
      ]
    }
  },
  {
    "version": "2.4.1",
    "major": 2,
    "minor": 4,
    "patch": 1,
    "date": "2026-08-07",
    "type": "PATCH",
    "novidades": [
      "Unificação do sistema de versionamento em fonte única (versionConfig.ts)",
      "Refinamentos no sistema de chat e interface"
    ],
    "correcoes": [
      "Correção de divergência de versão entre Sidebar, Configurações e Modal de Novidades"
    ],
    "desempenho": [
      "Otimização no carregamento de componentes de UI e cache local"
    ],
    "security": [
      "Atualização de segurança e validação de tokens"
    ],
    "arquitetura": [
      "Centralização de metadados de versão em src/config/versionConfig.ts"
    ]
  },
  {
    "version": "2.4.0",
    "major": 2,
    "minor": 4,
    "patch": 0,
    "date": "2026-08-07",
    "type": "MINOR",
    "novidades": [
      "Novo Sistema de Versionamento Automático Semantic Versioning",
      "Tela interativa 'Novidades da Versão' com histórico completo de changelogs",
      "Novo Estúdio de Imagens ZENO Vision com suporte a Flux AI e renderização avançada"
    ],
    "correcoes": [
      "Corrigido erro de quota e fallback automático de chaves de API",
      "Corrigido carregamento e exibição de imagens geradas no histórico e no chat"
    ],
    "desempenho": [
      "Otimização no carregamento de sessões e cache local/nuvem"
    ],
    "security": [
      "Reforço na validação de tokens de autenticação e permissões de administrador"
    ],
    "arquitetura": [
      "Centralização do motor de versionamento em módulo único compartilhado"
    ]
  },
  {
    "version": "2.3.0",
    "major": 2,
    "minor": 3,
    "patch": 0,
    "date": "2026-07-20",
    "type": "MINOR",
    "novidades": [
      "Integração com Deep Research para pesquisas profundas na web",
      "Agentes persistentes com memória de longo prazo vetorial"
    ],
    "correcoes": [
      "Corrigido problema de sincronização offline em conexões instáveis"
    ],
    "desempenho": [
      "Melhoria no uso de cache para consultas repetidas"
    ],
    "security": [
      "Atualização de chaves de segurança e políticas CORS"
    ],
    "arquitetura": [
      "Reestruturação do backend para suporte a múltiplos provedores"
    ]
  },
  {
    "version": "2.0.0",
    "major": 2,
    "minor": 0,
    "patch": 0,
    "date": "2026-04-01",
    "type": "MAJOR",
    "novidades": [
      "Segunda Geração da Zeno IA (Zeno 2.0)",
      "Nova interface inspirada em design limpo"
    ],
    "correcoes": [
      "Correções gerais de bugs da versão 1.x"
    ],
    "desempenho": [
      "Reescrita completa do motor front-end"
    ],
    "security": [
      "Autenticação Firebase segura"
    ],
    "arquitetura": [
      "Arquitetura modular em React e TypeScript"
    ]
  }
];

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

export function hasRelevantContent(version: VersionEntry): boolean {
  if (!version) return false;
  
  const c = version.changes;
  if (c) {
    if (c.novidades && c.novidades.length > 0) return true;
    if (c.correcoes && c.correcoes.length > 0) return true;
    if (c.desempenho && c.desempenho.length > 0) return true;
    if (c.arquitetura && c.arquitetura.length > 0) return true;
    if (c.news && c.news.length > 0) return true;
    if (c.fixes && c.fixes.length > 0) return true;
    if (c.performance && c.performance.length > 0) return true;
    if (c.architecture && c.architecture.length > 0) return true;
  }

  // Check direct properties (fallbacks/older format)
  if (version.novidades && version.novidades.length > 0) return true;
  if (version.correcoes && version.correcoes.length > 0) return true;
  if (version.desempenho && version.desempenho.length > 0) return true;
  if (version.arquitetura && version.arquitetura.length > 0) return true;
  if (version.news && version.news.length > 0) return true;
  if (version.fixes && version.fixes.length > 0) return true;
  if (version.performance && version.performance.length > 0) return true;
  if (version.architecture && version.architecture.length > 0) return true;

  return false;
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
