import { AdaptiveLearningProfile, AdaptiveFeedback, KnowledgeLevel } from '../types';

export const DEFAULT_ADAPTIVE_PROFILE: AdaptiveLearningProfile = {
  globalKnowledgeLevel: 'intermediario',
  domainLevels: {
    programacao: 'intermediario',
    negocios: 'intermediario',
    ciencia_tech: 'intermediario',
    historia_geografia: 'intermediario',
    ciencias_naturais: 'intermediario',
    escrita_criativa: 'intermediario',
    geral: 'intermediario'
  },
  communicationStyle: 'equilibrado',
  tonePreference: 'tecnico',
  approachBias: 'equilibrado',
  autoAdapt: true,
  learnedInsights: [
    'Conhecimento encyclopédico expandido em História Mundial, Geografia dos Continentes e Ciências Naturais.',
    'Ajusta a profundidade dos conceitos com base no nível do domínio.',
    'Prefere respostas bem estruturadas com exemplos claros e exatidão factual.'
  ],
  feedbackCount: 0,
  positiveCount: 0,
  negativeCount: 0,
  lastUpdated: Date.now()
};

export const KNOWLEDGE_LEVEL_DESCRIPTIONS: Record<KnowledgeLevel, string> = {
  iniciante: 'Linguagem didática, analogias simples e definições claras de termos técnicos.',
  intermediario: 'Equilíbrio entre termos técnicos e explicações práticas, sem re-explicar o básico.',
  avancado: 'Foco em arquitetura, boas práticas, otimização e caso de uso avançado sem rodeios.',
  especialista: 'Rigor técnico máximo, análise de casos de borda, algoritmos e linguagem especializada de alto nível.'
};

/**
  Formats a system prompt block for Gemini based on the user's adaptive profile.
 */
export function buildAdaptiveSystemPrompt(profile?: AdaptiveLearningProfile): string {
  const p = profile || DEFAULT_ADAPTIVE_PROFILE;

  const insightsFormatted = p.learnedInsights && p.learnedInsights.length > 0
    ? p.learnedInsights.map(i => `  • ${i}`).join('\n')
    : '  • Nenhum histórico prévio específico registrado.';

  return `
[SISTEMA DE APRENDIZADO ADAPTATIVO ZENO - PERFIL ATIVO DO USUÁRIO]:
- Nível Global de Conhecimento: ${p.globalKnowledgeLevel.toUpperCase()}
- Níveis por Área/Domínio:
  * Programação/Dev: ${p.domainLevels?.programacao || 'intermediario'} (${KNOWLEDGE_LEVEL_DESCRIPTIONS[p.domainLevels?.programacao || 'intermediario']})
  * Negócios & Finanças: ${p.domainLevels?.negocios || 'intermediario'}
  * Ciência & Tecnologia: ${p.domainLevels?.ciencia_tech || 'intermediario'}
  * História Mundial & Geografia: ${p.domainLevels?.historia_geografia || 'intermediario'} (Civilizações, eras históricas, mapas, continentes, capitais, relevo e geopolítica)
  * Ciências Naturais: ${p.domainLevels?.ciencias_naturais || 'intermediario'} (Física, Química, Biologia, Astronomia, Ciências da Terra e fenômenos naturais)
  * Escrita & Conteúdo: ${p.domainLevels?.escrita_criativa || 'intermediario'}
  * Conhecimento Geral: ${p.domainLevels?.geral || 'intermediario'}
- Estilo de Comunicação Solicitado: ${p.communicationStyle.toUpperCase()}
  ${p.communicationStyle === 'conciso' ? '(Forneça respostas diretas, sucintas e objetivas. Minimize prefácios e conclusões genéricas.)' : 
    p.communicationStyle === 'detalhado' ? '(Forneça explicações passo a passo completas, aprofundando motivos e justificativas.)' : 
    p.communicationStyle === 'didatico' ? '(Forneça explicações estruturadas pedagogicamente, com analogias e passos claros.)' : 
    '(Mantenha um equilíbrio ideal entre clareza, concisão e profundidade.)'}
- Tom de Voz Preferido: ${p.tonePreference.toUpperCase()} (${p.tonePreference === 'tecnico' ? 'Rigoroso, preciso e profissional' : p.tonePreference === 'amigavel' ? 'Empático, conversacional e incentivador' : p.tonePreference === 'formal' ? 'Executivo e corporativo' : 'Casual e moderno'})
- Viés de Abordagem: ${p.approachBias.toUpperCase()} (${p.approachBias === 'preciso' ? 'Prioridade total na exatidão técnica e eficiência' : p.approachBias === 'criativo' ? 'Incentivar soluções inovadoras, metáforas e caminhos alternativos' : 'Sintonia entre exatidão técnica e visão criativa'})
- Insights de Aprendizado Relevantes:
${insightsFormatted}

[DIRETRIZES OBRIGATÓRIAS DE ADAPTAÇÃO & CONHECIMENTO BASE DE ZENO]:
1. HISTÓRIA MUNDIAL: Você é um profundo conhecedor de marcos históricos, civilizações antigas (Egito, Grécia, Roma, Mesopotâmia, Indochina, Pré-colombianas), Idade Média, Renascimento, Grandes Navegações, Revolução Industrial, I e II Guerras Mundiais, Guerra Fria e transformações geopolíticas e culturais contemporâneas.
2. GEOGRAFIA DOS CONTINENTES & PAÍSES: Domine perfeitamente características físicas, demográficas, climáticas, vegetação, relevo, hidrografia, limites territoriais, capitais e fatos marcantes dos países nos 6 continentes habitados (Américas, Europa, Ásia, África, Oceania, Antártida).
3. CIÊNCIAS NATURAIS & FENÔMENOS: Domine os princípios fundamentais e aplicações de Física (mecânica, eletromagnetismo, termodinâmica, gravidade, relatividade, óptica), Química (estrutura atômica, tabela periódica, reações, estados da matéria), Biologia (ecologia, biologia celular, evolução, genética, fisiologia), Astronomia e Ciências da Terra (placas tectônicas, ciclo da água, clima e fenômenos celestes/terrestres).
4. AJUSTE DINÂMICO DE COMPLEXIDADE: Adapte instantaneamente a terminologia, os exemplos e a abstração ao nível de conhecimento do usuário na área correspondente.
5. EFICIÊNCIA E PRECISÃO: Elimine frases de efeito vazias ou prefácios desnecessários. Entregue valor factual imediato na primeira linha.
`;
}

/**
  Processes feedback (thumbs up/down with tags) and returns an updated adaptive profile.
 */
export function updateProfileWithFeedback(
  currentProfile: AdaptiveLearningProfile,
  feedback: AdaptiveFeedback
): AdaptiveLearningProfile {
  const updated = { ...currentProfile, lastUpdated: Date.now() };
  updated.feedbackCount = (updated.feedbackCount || 0) + 1;

  if (feedback.type === 'up') {
    updated.positiveCount = (updated.positiveCount || 0) + 1;
  } else {
    updated.negativeCount = (updated.negativeCount || 0) + 1;
  }

  if (!updated.learnedInsights) {
    updated.learnedInsights = [];
  }

  // Auto-adapt logic based on feedback tags
  const tags = feedback.tags || [];

  if (tags.includes('muito_complexo')) {
    // Lower complexity bias
    if (updated.globalKnowledgeLevel === 'especialista') updated.globalKnowledgeLevel = 'avancado';
    else if (updated.globalKnowledgeLevel === 'avancado') updated.globalKnowledgeLevel = 'intermediario';
    else if (updated.globalKnowledgeLevel === 'intermediario') updated.globalKnowledgeLevel = 'iniciante';

    const newInsight = 'Ajustado para explicações mais simples e didáticas (usuário indicou que a resposta anterior estava muito complexa).';
    if (!updated.learnedInsights.includes(newInsight)) {
      updated.learnedInsights = [newInsight, ...updated.learnedInsights.slice(0, 5)];
    }
  }

  if (tags.includes('muito_simples')) {
    // Elevate complexity bias
    if (updated.globalKnowledgeLevel === 'iniciante') updated.globalKnowledgeLevel = 'intermediario';
    else if (updated.globalKnowledgeLevel === 'intermediario') updated.globalKnowledgeLevel = 'avancado';
    else if (updated.globalKnowledgeLevel === 'avancado') updated.globalKnowledgeLevel = 'especialista';

    const newInsight = 'Elevada a profundidade técnica (usuário solicitou conteúdo mais avançado/especializado).';
    if (!updated.learnedInsights.includes(newInsight)) {
      updated.learnedInsights = [newInsight, ...updated.learnedInsights.slice(0, 5)];
    }
  }

  if (tags.includes('muito_longo')) {
    updated.communicationStyle = 'conciso';
    const newInsight = 'Ajustado para respostas mais concisas e diretas ao ponto.';
    if (!updated.learnedInsights.includes(newInsight)) {
      updated.learnedInsights = [newInsight, ...updated.learnedInsights.slice(0, 5)];
    }
  }

  if (tags.includes('excelente_codigo') || tags.includes('direto_ao_ponto')) {
    updated.approachBias = 'preciso';
    const newInsight = 'Aprecia snippets de código diretos e objetivos.';
    if (!updated.learnedInsights.includes(newInsight)) {
      updated.learnedInsights = [newInsight, ...updated.learnedInsights.slice(0, 5)];
    }
  }

  if (tags.includes('muito_criativo')) {
    updated.approachBias = 'criativo';
    const newInsight = 'Valoriza abordagens inovadoras e soluções criativas fora da caixa.';
    if (!updated.learnedInsights.includes(newInsight)) {
      updated.learnedInsights = [newInsight, ...updated.learnedInsights.slice(0, 5)];
    }
  }

  return updated;
}
