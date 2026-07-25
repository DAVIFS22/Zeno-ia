import { ModelType } from '../types';

export interface ModelCapabilities {
  memory: boolean;
  search: boolean;
  imageGen: boolean;
  fileUpload: boolean;
  pdf: boolean;
  urls: boolean;
  code: boolean;
  vision: boolean;
  reasoning: boolean;
}

export interface ModelConfig {
  id: ModelType;
  name: string;
  apiModel: string;
  badge?: string;
  description: string;
  category: 'general' | 'think' | 'search' | 'vision';
  color: string;
  systemPrompt: string;
  temperature: number;
  top_p: number;
  top_k: number;
  frequencyPenalty: number;
  presencePenalty: number;
  maxContextTokens: number;
  maxOutputTokens: number;
  priority: number;
  tools: string[];
  blockedTools: string[];
  permissions: string[];
  capabilities: ModelCapabilities;
  dailyLimit: number | null;
  isPro: boolean;
  requiredPlan: 'free' | 'pro';
  speed: string;
  quality: string;
}

export const ZENO_MODELS_CONFIG: Record<ModelType, ModelConfig> = {
  zeno: {
    id: 'zeno',
    name: 'ZENO',
    apiModel: 'gemini-3.6-flash',
    badge: 'Essencial',
    description: 'Especialista em conversas gerais, escrita, explicações, traduções e tarefas do dia a dia.',
    category: 'general',
    color: '#3B82F6',
    systemPrompt: 'Você é ZENO, um assistente de inteligência artificial versátil especializado em conversas gerais, redação, explicações didáticas, traduções e produtividade diária. Responda de forma direta, precisa e amigável. Caso o usuário solicite a criação de uma imagem, foto, arte, logo ou ilustração, gere-a nativamente.',
    temperature: 0.7,
    top_p: 0.9,
    top_k: 40,
    frequencyPenalty: 0.0,
    presencePenalty: 0.0,
    maxContextTokens: 32000,
    maxOutputTokens: 8192,
    priority: 1,
    tools: ['Chat', 'Memória', 'Histórico', 'Gerador de Imagens'],
    blockedTools: [],
    permissions: ['chat:read', 'chat:write', 'memory:read', 'memory:write', 'image:generate'],
    capabilities: {
      memory: true,
      search: false,
      imageGen: true,
      fileUpload: true,
      pdf: true,
      urls: true,
      code: true,
      vision: true,
      reasoning: false
    },
    dailyLimit: 50,
    isPro: false,
    requiredPlan: 'free',
    speed: 'Rápido',
    quality: 'Equilibrada'
  },
  think: {
    id: 'think',
    name: 'ZENO Pense',
    apiModel: 'gemini-3.6-flash',
    badge: 'Raciocínio',
    description: 'Especialista em raciocínio profundo, matemática, física, lógica e problemas complexos.',
    category: 'think',
    color: '#8B5CF6',
    systemPrompt: 'Você é ZENO Pense, um modelo especialista em raciocínio analítico profundo, matemática, física, lógica formal, algoritmos avançados e resolução estruturada de problemas complexos. Analise rigorosamente cada problema passo a passo antes de concluir. Caso solicitado, também gere visualizações e imagens explicativas.',
    temperature: 0.2,
    top_p: 0.95,
    top_k: 50,
    frequencyPenalty: 0.1,
    presencePenalty: 0.1,
    maxContextTokens: 64000,
    maxOutputTokens: 16384,
    priority: 2,
    tools: ['Chat', 'Memória', 'Raciocínio', 'Cálculo Avançado', 'Gerador de Imagens'],
    blockedTools: [],
    permissions: ['chat:read', 'chat:write', 'memory:read', 'reasoning:execute', 'image:generate'],
    capabilities: {
      memory: true,
      search: false,
      imageGen: true,
      fileUpload: true,
      pdf: true,
      urls: true,
      code: true,
      vision: true,
      reasoning: true
    },
    dailyLimit: 20,
    isPro: true,
    requiredPlan: 'pro',
    speed: 'Profundo',
    quality: 'Máxima'
  },
  search: {
    id: 'search',
    name: 'Busca ZENO',
    apiModel: 'gemini-3.6-flash',
    badge: 'Pesquisa Web',
    description: 'Especialista em pesquisa em tempo real, grounding web, notícias, citações e fontes.',
    category: 'search',
    color: '#10B981',
    systemPrompt: 'Você é Busca ZENO, especialista em pesquisa em tempo real, verificação de fatos e Grounding Web. Sempre pesquise fontes atualizadas, forneça links, citações e dados verificados com máxima precisão. Caso o usuário solicite imagens sobre os temas pesquisados, gere-as nativamente.',
    temperature: 0.4,
    top_p: 0.9,
    top_k: 40,
    frequencyPenalty: 0.0,
    presencePenalty: 0.0,
    maxContextTokens: 32000,
    maxOutputTokens: 8192,
    priority: 3,
    tools: ['Pesquisa Web', 'URLs', 'Notícias', 'PDFs', 'Fontes', 'Gerador de Imagens'],
    blockedTools: [],
    permissions: ['web:search', 'url:fetch', 'chat:read', 'chat:write', 'image:generate'],
    capabilities: {
      memory: true,
      search: true,
      imageGen: true,
      fileUpload: true,
      pdf: true,
      urls: true,
      code: true,
      vision: true,
      reasoning: false
    },
    dailyLimit: 15,
    isPro: true,
    requiredPlan: 'pro',
    speed: 'Tempo Real',
    quality: 'Verificada'
  },
  vision: {
    id: 'vision',
    name: 'Estúdio ZENO Vision',
    apiModel: 'gemini-3.6-flash',
    badge: 'Visão & Artes',
    description: 'Especialista em IA visual, geração direta de imagens, edição, variações, OCR e análise visual.',
    category: 'vision',
    color: '#EC4899',
    systemPrompt: 'Você é o Estúdio ZENO Vision, a central de inteligência artificial visual avançada do ZENO. Sua função principal é gerar imagens fotorealistas e artísticas, editar visuais, criar variações, realizar OCR e analisar dados visuais com perfeição técnica. Quando o usuário solicitar uma imagem, crie-a diretamente.',
    temperature: 0.8,
    top_p: 0.95,
    top_k: 50,
    frequencyPenalty: 0.0,
    presencePenalty: 0.0,
    maxContextTokens: 32000,
    maxOutputTokens: 8192,
    priority: 4,
    tools: ['Gerador de imagens', 'Editor', 'OCR', 'Análise Visual'],
    blockedTools: [],
    permissions: ['image:generate', 'image:analyze', 'ocr:read', 'chat:read'],
    capabilities: {
      memory: true,
      search: false,
      imageGen: true,
      fileUpload: true,
      pdf: true,
      urls: false,
      code: false,
      vision: true,
      reasoning: false
    },
    dailyLimit: 10,
    isPro: true,
    requiredPlan: 'pro',
    speed: 'Criativo',
    quality: 'Ultra HD'
  },
  code: {
    id: 'code',
    name: 'ZENO Código',
    apiModel: 'gemini-3.6-flash',
    badge: 'Programação',
    description: 'Especialista em React, Next, TypeScript, Python, Node, SQL, Flutter, Java, C#, HTML, CSS e arquitetura.',
    category: 'think',
    color: '#F59E0B',
    systemPrompt: 'Você é ZENO Código, um engenheiro de software sênior de elite especializado em React, Next.js, TypeScript, Python, Node.js, SQL, Flutter, Java, C#, HTML, CSS, arquitetura de software, refatoração, debug e boas práticas. Forneça código funcional, limpo e seguro. Caso o usuário peça diagramas ou wireframes visuais, gere-os nativamente.',
    temperature: 0.2,
    top_p: 0.95,
    top_k: 40,
    frequencyPenalty: 0.1,
    presencePenalty: 0.1,
    maxContextTokens: 64000,
    maxOutputTokens: 16384,
    priority: 5,
    tools: ['Interpretador', 'Editor de Código', 'Debug', 'Terminal', 'Gerador de Imagens'],
    blockedTools: [],
    permissions: ['code:execute', 'chat:read', 'chat:write', 'image:generate'],
    capabilities: {
      memory: true,
      search: false,
      imageGen: true,
      fileUpload: true,
      pdf: true,
      urls: true,
      code: true,
      vision: true,
      reasoning: true
    },
    dailyLimit: 25,
    isPro: true,
    requiredPlan: 'pro',
    speed: 'Técnico',
    quality: 'Produção'
  },
  pdf: {
    id: 'pdf',
    name: 'PDF',
    apiModel: 'gemini-3.6-flash',
    badge: 'Análise Documental',
    description: 'Especialista em leitura, interpretação, resumo e extração de tabelas de documentos PDF.',
    category: 'search',
    color: '#EF4444',
    systemPrompt: 'Você é um modelo especialista em leitura, análise e interpretação profunda de documentos PDF, artigos, relatórios e contratos. Suas capacidades incluem resumos estratégicos, respostas precisas por página, extração de tabelas e análise crítica dos arquivos fornecidos.',
    temperature: 0.3,
    top_p: 0.9,
    top_k: 40,
    frequencyPenalty: 0.0,
    presencePenalty: 0.0,
    maxContextTokens: 64000,
    maxOutputTokens: 8192,
    priority: 6,
    tools: ['OCR', 'PDF Reader', 'Análise de Documentos', 'Gerador de Imagens'],
    blockedTools: [],
    permissions: ['pdf:read', 'chat:read', 'chat:write', 'image:generate'],
    capabilities: {
      memory: true,
      search: false,
      imageGen: true,
      fileUpload: true,
      pdf: true,
      urls: false,
      code: false,
      vision: true,
      reasoning: false
    },
    dailyLimit: 20,
    isPro: false,
    requiredPlan: 'free',
    speed: 'Profundo',
    quality: 'Documental'
  },
  strategy: {
    id: 'strategy',
    name: 'Plano Estratégico',
    apiModel: 'gemini-3.6-flash',
    badge: 'Planejamento',
    description: 'Especialista em planejamento de negócios, marketing, roadmaps, produtos e cronogramas executivos.',
    category: 'general',
    color: '#6366F1',
    systemPrompt: 'Você é um estrategista corporativo sênior e planejador executivo especialista em plano de negócios, estratégias de marketing, roadmaps de produtos, matrizes de risco, OKRs e cronogramas operacionais. Crie planos altamente acionáveis e estruturados.',
    temperature: 0.4,
    top_p: 0.9,
    top_k: 40,
    frequencyPenalty: 0.0,
    presencePenalty: 0.0,
    maxContextTokens: 32000,
    maxOutputTokens: 8192,
    priority: 7,
    tools: ['Chat', 'Planejador', 'Matriz de Risco', 'Gerador de Imagens'],
    blockedTools: [],
    permissions: ['chat:read', 'chat:write', 'image:generate'],
    capabilities: {
      memory: true,
      search: false,
      imageGen: true,
      fileUpload: true,
      pdf: true,
      urls: false,
      code: false,
      vision: true,
      reasoning: true
    },
    dailyLimit: 30,
    isPro: false,
    requiredPlan: 'free',
    speed: 'Estruturado',
    quality: 'Executiva'
  },
  summary: {
    id: 'summary',
    name: 'Resumo Executivo',
    apiModel: 'gemini-3.6-flash',
    badge: 'Síntese',
    description: 'Especialista em síntese profissional, relatórios executivos, resumos de alto impacto e documentos.',
    category: 'general',
    color: '#14B8A6',
    systemPrompt: 'Você é um especialista em síntese executiva e redação de relatórios de alto nível. Sua missão é transformar textos extensos, atas e documentos em resumos limpos, tópicos acionáveis, diretrizes e relatórios sintéticos.',
    temperature: 0.3,
    top_p: 0.9,
    top_k: 40,
    frequencyPenalty: 0.0,
    presencePenalty: 0.0,
    maxContextTokens: 32000,
    maxOutputTokens: 4096,
    priority: 8,
    tools: ['Chat', 'Sumarizador', 'Gerador de Imagens'],
    blockedTools: [],
    permissions: ['chat:read', 'chat:write', 'image:generate'],
    capabilities: {
      memory: true,
      search: false,
      imageGen: true,
      fileUpload: true,
      pdf: true,
      urls: false,
      code: false,
      vision: true,
      reasoning: false
    },
    dailyLimit: 30,
    isPro: false,
    requiredPlan: 'free',
    speed: 'Rápido',
    quality: 'Concisa'
  },
  smart: {
    id: 'smart',
    name: 'ZENO Smart',
    apiModel: 'gemini-3.6-flash',
    badge: 'Autônomo',
    description: 'Roteamento inteligente automático para o melhor modelo conforme a tarefa.',
    category: 'general',
    color: '#3B82F6',
    systemPrompt: 'Você é ZENO Smart, um assistente inteligente com roteamento dinâmico que seleciona a melhor estratégia cognitiva para cada consulta do usuário.',
    temperature: 0.7,
    top_p: 0.9,
    top_k: 40,
    frequencyPenalty: 0.0,
    presencePenalty: 0.0,
    maxContextTokens: 32000,
    maxOutputTokens: 8192,
    priority: 9,
    tools: ['Router', 'Chat', 'Memória', 'Gerador de Imagens'],
    blockedTools: [],
    permissions: ['chat:read', 'chat:write', 'image:generate'],
    capabilities: {
      memory: true,
      search: true,
      imageGen: true,
      fileUpload: true,
      pdf: true,
      urls: true,
      code: true,
      vision: true,
      reasoning: true
    },
    dailyLimit: 50,
    isPro: false,
    requiredPlan: 'free',
    speed: 'Dinâmico',
    quality: 'Adaptativa'
  },
  fast: {
    id: 'fast',
    name: 'ZENO Fast',
    apiModel: 'gemini-3.6-flash',
    badge: 'Velocidade',
    description: 'Respostas instantâneas de alta velocidade para conversas rápidas.',
    category: 'general',
    color: '#3B82F6',
    systemPrompt: 'Você é ZENO Fast, otimizado para velocidade máxima e respostas instantâneas.',
    temperature: 0.7,
    top_p: 0.9,
    top_k: 40,
    frequencyPenalty: 0.0,
    presencePenalty: 0.0,
    maxContextTokens: 16000,
    maxOutputTokens: 4096,
    priority: 10,
    tools: ['Chat', 'Gerador de Imagens'],
    blockedTools: [],
    permissions: ['chat:read', 'chat:write', 'image:generate'],
    capabilities: {
      memory: true,
      search: false,
      imageGen: true,
      fileUpload: true,
      pdf: true,
      urls: false,
      code: false,
      vision: true,
      reasoning: false
    },
    dailyLimit: 100,
    isPro: false,
    requiredPlan: 'free',
    speed: 'Instantâneo',
    quality: 'Direta'
  },
  mega: {
    id: 'mega',
    name: 'ZENO Mega',
    apiModel: 'gemini-3.6-flash',
    badge: 'Avançado',
    description: 'Potência máxima analítica e criativa.',
    category: 'think',
    color: '#8B5CF6',
    systemPrompt: 'Você é ZENO Mega, o modelo de maior capacidade analítica, criativa e profundidade.',
    temperature: 0.7,
    top_p: 0.95,
    top_k: 50,
    frequencyPenalty: 0.1,
    presencePenalty: 0.1,
    maxContextTokens: 128000,
    maxOutputTokens: 16384,
    priority: 11,
    tools: ['Chat', 'Pesquisa Web', 'Raciocínio', 'Gerador de Imagens'],
    blockedTools: [],
    permissions: ['chat:read', 'chat:write', 'web:search', 'image:generate'],
    capabilities: {
      memory: true,
      search: true,
      imageGen: true,
      fileUpload: true,
      pdf: true,
      urls: true,
      code: true,
      vision: true,
      reasoning: true
    },
    dailyLimit: 10,
    isPro: true,
    requiredPlan: 'pro',
    speed: 'Máxima',
    quality: 'Suprema'
  },
  image: {
    id: 'image',
    name: 'Gerador de Imagens',
    apiModel: 'gemini-3.6-flash',
    badge: 'Visual',
    description: 'Criação especializada de imagens por IA.',
    category: 'vision',
    color: '#EC4899',
    systemPrompt: 'Você é o gerador de imagens oficial do ZENO AI.',
    temperature: 0.8,
    top_p: 0.95,
    top_k: 50,
    frequencyPenalty: 0.0,
    presencePenalty: 0.0,
    maxContextTokens: 16000,
    maxOutputTokens: 2048,
    priority: 12,
    tools: ['Gerador de imagens'],
    blockedTools: [],
    permissions: ['image:generate'],
    capabilities: {
      memory: true,
      search: false,
      imageGen: true,
      fileUpload: true,
      pdf: true,
      urls: false,
      code: false,
      vision: true,
      reasoning: false
    },
    dailyLimit: 10,
    isPro: true,
    requiredPlan: 'pro',
    speed: 'Criativo',
    quality: 'Ultra'
  }
};

export function getModelConfig(model: ModelType | string): ModelConfig {
  const norm = (model || 'zeno') as ModelType;
  return ZENO_MODELS_CONFIG[norm] || ZENO_MODELS_CONFIG['zeno'];
}
