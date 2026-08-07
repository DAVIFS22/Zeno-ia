export interface VersionEntry {
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

export const CURRENT_ZENO_VERSION = "2.4.0";

export const ZENO_VERSION_HISTORY: VersionEntry[] = [
  {
    version: "2.4.0",
    major: 2,
    minor: 4,
    patch: 0,
    date: "2026-08-07",
    type: "MINOR",
    news: [
      "Novo Sistema de Versionamento Automático Semantic Versioning",
      "Tela interativa 'Novidades da Versão' com histórico completo de changelogs",
      "Novo Estúdio de Imagens ZENO Vision com suporte a Flux AI e renderização avançada"
    ],
    fixes: [
      "Corrigido erro de quota e fallback automático de chaves de API",
      "Corrigido carregamento e exibição de imagens geradas no histórico e no chat",
      "Corrigido sanitizador de respostas para preservar URLs de mídia autorizadas"
    ],
    performance: [
      "Otimização no carregamento de sessões e cache local/nuvem",
      "Redução da latência na inicialização do roteador de modelos"
    ],
    security: [
      "Reforço na validação de tokens de autenticação e permissões de administrador",
      "Criptografia aprimorada para armazenamento de estado local"
    ],
    architecture: [
      "Centralização do motor de versionamento em módulo único compartilhado",
      "Desacoplamento de rotas de IA no backend Express"
    ]
  },
  {
    version: "2.3.0",
    major: 2,
    minor: 3,
    patch: 0,
    date: "2026-07-20",
    type: "MINOR",
    news: [
      "Integração com Deep Research para pesquisas profundas na web",
      "Agentes persistentes com memória de longo prazo vetorial",
      "Módulo de Aprendizado Adaptativo com perfis personalizados"
    ],
    fixes: [
      "Corrigido problema de sincronização offline em conexões instáveis",
      "Correções em renderizadores Markdown de código complexo"
    ],
    performance: [
      "Melhoria no uso de cache para consultas repetidas",
      "Compactação de payload em requisições de chat"
    ],
    security: [
      "Atualização de chaves de segurança e políticas CORS",
      "Auditoria de logs automáticos"
    ],
    architecture: [
      "Reestruturação do backend para suporte a múltiplos provedores (Groq, OpenRouter, Gemini)",
      "Modularização de componentes React na árvore de UI"
    ]
  },
  {
    version: "2.2.0",
    major: 2,
    minor: 2,
    patch: 0,
    date: "2026-06-15",
    type: "MINOR",
    news: [
      "Estúdio de Música e Síntese de Áudio com IA",
      "Suporte a upload e processamento de vídeos e PDFs"
    ],
    fixes: [
      "Correção de crash ao carregar anexos grandes no chat",
      "Correção de alinhamento em telas mobile"
    ],
    performance: [
      "Aceleração de renderização com React.memo e virtualização de lista"
    ],
    security: [
      "Proteção contra injeção de parâmetros em rotas de API"
    ],
    architecture: [
      "Migração para arquitetura full-stack integrada com Firestore"
    ]
  },
  {
    version: "2.1.0",
    major: 2,
    minor: 1,
    patch: 0,
    date: "2026-05-10",
    type: "MINOR",
    news: [
      "Lançamento do painel administrativo e controle de planos Pro",
      "Gerenciamento de subscrições com Stripe"
    ],
    fixes: [
      "Correção de pequenos bugs no login com Google Auth"
    ],
    performance: [
      "Melhoria no tempo de resposta das rotas de estatísticas"
    ],
    security: [
      "Validação estrita de papéis administrativos"
    ],
    architecture: [
      "Implementação de adaptadores de banco de dados híbridos"
    ]
  },
  {
    version: "2.0.0",
    major: 2,
    minor: 0,
    patch: 0,
    date: "2026-04-01",
    type: "MAJOR",
    news: [
      "Segunda Geração da Zeno IA (Zeno 2.0)",
      "Nova interface inspirada em design limpo com suporte a temas dinâmicos",
      "Motor multimodelo unificado"
    ],
    fixes: [
      "Substituição completa do sistema legado de chat"
    ],
    performance: [
      "Reescrita completa do frontend para máxima fluidez"
    ],
    security: [
      "Novo sistema de autenticação segura baseada em sessão e tokens"
    ],
    architecture: [
      "Nova arquitetura de microsserviços internos no servidor Node/Express"
    ]
  },
  {
    version: "1.0.0",
    major: 1,
    minor: 0,
    patch: 0,
    date: "2026-01-15",
    type: "MAJOR",
    news: [
      "Lançamento inicial da Zeno IA",
      "Assistente de texto básico com suporte a modelos Gemini"
    ],
    fixes: [],
    performance: [
      "Versão inicial estável"
    ],
    security: [
      "Segurança básica com variáveis de ambiente"
    ],
    architecture: [
      "Arquitetura monolítica inicial"
    ]
  }
];

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
