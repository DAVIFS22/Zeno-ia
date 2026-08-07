export interface VersionEntry {
  version: string;
  major: number;
  minor: number;
  patch: number;
  date: string;
  type: 'MAJOR' | 'MINOR' | 'PATCH';
  news?: string[];
  novidades?: string[];
  fixes?: string[];
  correcoes?: string[];
  performance?: string[];
  desempenho?: string[];
  security?: string[];
  architecture?: string[];
  arquitetura?: string[];
}

export const CURRENT_ZENO_VERSION = "2.12.0";
export const RELEASE_DATE = "2026-08-07";
export const GIT_TAG = "v2.12.0";

export const ZENO_VERSION_HISTORY: VersionEntry[] = [
  {
    "version": "2.12.0",
    "major": 2,
    "minor": 12,
    "patch": 0,
    "date": "2026-08-07",
    "type": "MINOR",
    "novidades": [
      "adiciona historico de imagens no menu lateral"
    ],
    "correcoes": [
      "corrige loop infinito no microfone que travava a interface"
    ],
    "desempenho": [
      "otimiza o carregamento da lista de mensagens renderizando apenas itens visiveis"
    ],
    "security": [
      "Atualização de segurança e validação de tokens"
    ]
  },
  {
    "version": "2.11.0",
    "major": 2,
    "minor": 11,
    "patch": 0,
    "date": "2026-08-07",
    "type": "MINOR",
    "novidades": [
      "adiciona historico de imagens no menu lateral"
    ],
    "correcoes": [
      "corrige loop infinito no microfone que travava a interface"
    ],
    "desempenho": [
      "otimiza o carregamento da lista de mensagens renderizando apenas itens visiveis"
    ],
    "security": [
      "Atualização de segurança e validação de tokens"
    ]
  },
  {
    "version": "2.10.0",
    "major": 2,
    "minor": 10,
    "patch": 0,
    "date": "2026-08-07",
    "type": "MINOR",
    "novidades": [
      "adiciona historico de imagens no menu lateral"
    ],
    "correcoes": [
      "corrige loop infinito no microfone que travava a interface"
    ],
    "desempenho": [
      "otimiza o carregamento da lista de mensagens renderizando apenas itens visiveis"
    ],
    "security": [
      "Atualização de segurança e validação de tokens"
    ]
  },
  {
    "version": "2.9.0",
    "major": 2,
    "minor": 9,
    "patch": 0,
    "date": "2026-08-07",
    "type": "MINOR",
    "novidades": [
      "adiciona historico de imagens no menu lateral"
    ],
    "correcoes": [
      "corrige loop infinito no microfone que travava a interface"
    ],
    "desempenho": [
      "otimiza o carregamento da lista de mensagens renderizando apenas itens visiveis"
    ],
    "security": [
      "Atualização de segurança e validação de tokens"
    ]
  },
  {
    "version": "2.8.0",
    "major": 2,
    "minor": 8,
    "patch": 0,
    "date": "2026-08-07",
    "type": "MINOR",
    "novidades": [
      "adiciona historico de imagens no menu lateral"
    ],
    "correcoes": [
      "corrige loop infinito no microfone que travava a interface"
    ],
    "desempenho": [
      "otimiza o carregamento da lista de mensagens renderizando apenas itens visiveis"
    ],
    "security": [
      "Atualização de segurança e validação de tokens"
    ]
  },
  {
    "version": "2.7.0",
    "major": 2,
    "minor": 7,
    "patch": 0,
    "date": "2026-08-07",
    "type": "MINOR",
    "novidades": [
      "adiciona historico de imagens no menu lateral"
    ],
    "correcoes": [
      "corrige loop infinito no microfone que travava a interface"
    ],
    "desempenho": [
      "otimiza o carregamento da lista de mensagens renderizando apenas itens visiveis"
    ],
    "security": [
      "Atualização de segurança e validação de tokens"
    ]
  },
  {
    "version": "2.6.0",
    "major": 2,
    "minor": 6,
    "patch": 0,
    "date": "2026-08-07",
    "type": "MINOR",
    "novidades": [
      "adiciona historico de imagens no menu lateral"
    ],
    "correcoes": [
      "corrige loop infinito no microfone que travava a interface"
    ],
    "desempenho": [
      "otimiza o carregamento da lista de mensagens renderizando apenas itens visiveis"
    ],
    "security": [
      "Atualização de segurança e validação de tokens"
    ]
  },
  {
    "version": "2.5.0",
    "major": 2,
    "minor": 5,
    "patch": 0,
    "date": "2026-08-07",
    "type": "MINOR",
    "novidades": [
      "adiciona historico de imagens no menu lateral"
    ],
    "correcoes": [
      "corrige loop infinito no microfone que travava a interface"
    ],
    "desempenho": [
      "otimiza o carregamento da lista de mensagens renderizando apenas itens visiveis"
    ],
    "security": [
      "Atualização de segurança e validação de tokens"
    ]
  },
  {
    "version": "2.4.19",
    "major": 2,
    "minor": 4,
    "patch": 19,
    "date": "2026-08-07",
    "type": "PATCH",
    "novidades": [
      "Refinamentos no sistema de chat e interface"
    ],
    "correcoes": [
      "Correções de estabilidade"
    ],
    "desempenho": [
      "Melhorias gerais de desempenho"
    ],
    "arquitetura": [
      "Atualizações de rotas e metadados"
    ],
    "security": [
      "Atualização de segurança e validação de tokens"
    ]
  },
  {
    "version": "2.4.18",
    "major": 2,
    "minor": 4,
    "patch": 18,
    "date": "2026-08-07",
    "type": "PATCH",
    "novidades": [
      "Refinamentos no sistema de chat e interface"
    ],
    "correcoes": [
      "Correções de estabilidade"
    ],
    "desempenho": [
      "Melhorias gerais de desempenho"
    ],
    "arquitetura": [
      "Atualizações de rotas e metadados"
    ],
    "security": [
      "Atualização de segurança e validação de tokens"
    ]
  },
  {
    "version": "2.4.17",
    "major": 2,
    "minor": 4,
    "patch": 17,
    "date": "2026-08-07",
    "type": "PATCH",
    "novidades": [
      "Refinamentos no sistema de chat e interface"
    ],
    "correcoes": [
      "Correções de estabilidade"
    ],
    "desempenho": [
      "Melhorias gerais de desempenho"
    ],
    "arquitetura": [
      "Atualizações de rotas e metadados"
    ],
    "security": [
      "Atualização de segurança e validação de tokens"
    ]
  },
  {
    "version": "2.4.16",
    "major": 2,
    "minor": 4,
    "patch": 16,
    "date": "2026-08-07",
    "type": "PATCH",
    "novidades": [
      "Refinamentos no sistema de chat e interface"
    ],
    "correcoes": [
      "Correções de estabilidade"
    ],
    "desempenho": [
      "Melhorias gerais de desempenho"
    ],
    "arquitetura": [
      "Atualizações de rotas e metadados"
    ],
    "security": [
      "Atualização de segurança e validação de tokens"
    ]
  },
  {
    "version": "2.4.15",
    "major": 2,
    "minor": 4,
    "patch": 15,
    "date": "2026-08-07",
    "type": "PATCH",
    "novidades": [
      "Refinamentos no sistema de chat e interface"
    ],
    "correcoes": [
      "Correções de estabilidade"
    ],
    "desempenho": [
      "Melhorias gerais de desempenho"
    ],
    "arquitetura": [
      "Atualizações de rotas e metadados"
    ],
    "security": [
      "Atualização de segurança e validação de tokens"
    ]
  },
  {
    "version": "2.4.14",
    "major": 2,
    "minor": 4,
    "patch": 14,
    "date": "2026-08-07",
    "type": "PATCH",
    "novidades": [
      "Refinamentos no sistema de chat e interface"
    ],
    "correcoes": [
      "Correções de estabilidade"
    ],
    "desempenho": [
      "Melhorias gerais de desempenho"
    ],
    "arquitetura": [
      "Atualizações de rotas e metadados"
    ],
    "security": [
      "Atualização de segurança e validação de tokens"
    ]
  },
  {
    "version": "2.4.13",
    "major": 2,
    "minor": 4,
    "patch": 13,
    "date": "2026-08-07",
    "type": "PATCH",
    "novidades": [
      "Refinamentos no sistema de chat e interface"
    ],
    "correcoes": [
      "Correções de estabilidade"
    ],
    "desempenho": [
      "Melhorias gerais de desempenho"
    ],
    "arquitetura": [
      "Atualizações de rotas e metadados"
    ],
    "security": [
      "Atualização de segurança e validação de tokens"
    ]
  },
  {
    "version": "2.4.12",
    "major": 2,
    "minor": 4,
    "patch": 12,
    "date": "2026-08-07",
    "type": "PATCH",
    "novidades": [
      "Refinamentos no sistema de chat e interface"
    ],
    "correcoes": [
      "Correções de estabilidade"
    ],
    "desempenho": [
      "Melhorias gerais de desempenho"
    ],
    "arquitetura": [
      "Atualizações de rotas e metadados"
    ],
    "security": [
      "Atualização de segurança e validação de tokens"
    ]
  },
  {
    "version": "2.4.11",
    "major": 2,
    "minor": 4,
    "patch": 11,
    "date": "2026-08-07",
    "type": "PATCH",
    "novidades": [
      "Refinamentos no sistema de chat e interface"
    ],
    "correcoes": [
      "Correções de estabilidade"
    ],
    "desempenho": [
      "Melhorias gerais de desempenho"
    ],
    "arquitetura": [
      "Atualizações de rotas e metadados"
    ],
    "security": [
      "Atualização de segurança e validação de tokens"
    ]
  },
  {
    "version": "2.4.10",
    "major": 2,
    "minor": 4,
    "patch": 10,
    "date": "2026-08-07",
    "type": "PATCH",
    "novidades": [
      "Refinamentos no sistema de chat e interface"
    ],
    "correcoes": [
      "Correções de estabilidade"
    ],
    "desempenho": [
      "Melhorias gerais de desempenho"
    ],
    "arquitetura": [
      "Atualizações de rotas e metadados"
    ],
    "security": [
      "Atualização de segurança e validação de tokens"
    ]
  },
  {
    "version": "2.4.9",
    "major": 2,
    "minor": 4,
    "patch": 9,
    "date": "2026-08-07",
    "type": "PATCH",
    "novidades": [
      "Refinamentos no sistema de chat e interface"
    ],
    "correcoes": [
      "Correções de estabilidade"
    ],
    "desempenho": [
      "Melhorias gerais de desempenho"
    ],
    "arquitetura": [
      "Atualizações de rotas e metadados"
    ],
    "security": [
      "Atualização de segurança e validação de tokens"
    ]
  },
  {
    "version": "2.4.8",
    "major": 2,
    "minor": 4,
    "patch": 8,
    "date": "2026-08-07",
    "type": "PATCH",
    "novidades": [
      "Refinamentos no sistema de chat e interface"
    ],
    "correcoes": [
      "Correções de estabilidade"
    ],
    "desempenho": [
      "Melhorias gerais de desempenho"
    ],
    "arquitetura": [
      "Atualizações de rotas e metadados"
    ],
    "security": [
      "Atualização de segurança e validação de tokens"
    ]
  },
  {
    "version": "2.4.7",
    "major": 2,
    "minor": 4,
    "patch": 7,
    "date": "2026-08-07",
    "type": "PATCH",
    "novidades": [
      "Refinamentos no sistema de chat e interface"
    ],
    "correcoes": [
      "Correções de estabilidade"
    ],
    "desempenho": [
      "Melhorias gerais de desempenho"
    ],
    "arquitetura": [
      "Atualizações de rotas e metadados"
    ],
    "security": [
      "Atualização de segurança e validação de tokens"
    ]
  },
  {
    "version": "2.4.6",
    "major": 2,
    "minor": 4,
    "patch": 6,
    "date": "2026-08-07",
    "type": "PATCH",
    "novidades": [
      "Refinamentos no sistema de chat e interface"
    ],
    "correcoes": [
      "Correções de estabilidade"
    ],
    "desempenho": [
      "Melhorias gerais de desempenho"
    ],
    "arquitetura": [
      "Atualizações de rotas e metadados"
    ],
    "security": [
      "Atualização de segurança e validação de tokens"
    ]
  },
  {
    "version": "2.4.5",
    "major": 2,
    "minor": 4,
    "patch": 5,
    "date": "2026-08-07",
    "type": "PATCH",
    "novidades": [
      "Refinamentos no sistema de chat e interface"
    ],
    "correcoes": [
      "Correções de estabilidade"
    ],
    "desempenho": [
      "Melhorias gerais de desempenho"
    ],
    "arquitetura": [
      "Atualizações de rotas e metadados"
    ],
    "security": [
      "Atualização de segurança e validação de tokens"
    ]
  },
  {
    "version": "2.4.4",
    "major": 2,
    "minor": 4,
    "patch": 4,
    "date": "2026-08-07",
    "type": "PATCH",
    "novidades": [
      "Refinamentos no sistema de chat e interface"
    ],
    "correcoes": [
      "Correções de estabilidade"
    ],
    "desempenho": [
      "Melhorias gerais de desempenho"
    ],
    "arquitetura": [
      "Atualizações de rotas e metadados"
    ],
    "security": [
      "Atualização de segurança e validação de tokens"
    ]
  },
  {
    "version": "2.4.3",
    "major": 2,
    "minor": 4,
    "patch": 3,
    "date": "2026-08-07",
    "type": "PATCH",
    "novidades": [
      "Refinamentos no sistema de chat e interface"
    ],
    "correcoes": [
      "Correções de estabilidade"
    ],
    "desempenho": [
      "Melhorias gerais de desempenho"
    ],
    "arquitetura": [
      "Atualizações de rotas e metadados"
    ],
    "security": [
      "Atualização de segurança e validação de tokens"
    ]
  },
  {
    "version": "2.4.2",
    "major": 2,
    "minor": 4,
    "patch": 2,
    "date": "2026-08-07",
    "type": "PATCH",
    "novidades": [
      "Refinamentos no sistema de chat e interface"
    ],
    "correcoes": [
      "Correções de estabilidade"
    ],
    "desempenho": [
      "Melhorias gerais de desempenho"
    ],
    "arquitetura": [
      "Atualizações de rotas e metadados"
    ],
    "security": [
      "Atualização de segurança e validação de tokens"
    ]
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
    "version": "2.2.0",
    "major": 2,
    "minor": 2,
    "patch": 0,
    "date": "2026-06-15",
    "type": "MINOR",
    "novidades": [
      "Estúdio de Música e Síntese de Áudio com IA",
      "Suporte a upload e processamento de vídeos e PDFs"
    ],
    "correcoes": [
      "Correção de crash ao carregar anexos grandes no chat"
    ],
    "desempenho": [
      "Aceleração de renderização com React.memo"
    ],
    "security": [
      "Proteção contra injeção de parâmetros em rotas de API"
    ],
    "arquitetura": [
      "Migração para arquitetura full-stack integrada com Firestore"
    ]
  },
  {
    "version": "2.1.0",
    "major": 2,
    "minor": 1,
    "patch": 0,
    "date": "2026-05-10",
    "type": "MINOR",
    "novidades": [
      "Lançamento do painel administrativo e controle de planos Pro"
    ],
    "correcoes": [
      "Correção de pequenos bugs no login com Google Auth"
    ],
    "desempenho": [
      "Melhoria no tempo de resposta das rotas de estatísticas"
    ],
    "security": [
      "Validação estrita de papéis administrativos"
    ],
    "arquitetura": [
      "Implementação de adaptadores de banco de dados híbridos"
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
  },
  {
    "version": "1.0.0",
    "major": 1,
    "minor": 0,
    "patch": 0,
    "date": "2026-01-10",
    "type": "MAJOR",
    "novidades": [
      "Lançamento inicial da Zeno IA"
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

export function checkAndGetNewVersion(): { isNew: boolean; version: VersionEntry } {
  const latest = getLatestVersion();
  const lastSeen = localStorage.getItem('zeno_last_seen_version');
  const isNew = lastSeen !== latest.version;
  return { isNew, version: latest };
}

export function markVersionAsSeen(versionStr: string) {
  localStorage.setItem('zeno_last_seen_version', versionStr);
}
