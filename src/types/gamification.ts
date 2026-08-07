export interface UserGamificationProfile {
  userId: string;
  totalPoints: number;
  currentLevel: string;
  currentStreak: number;
  lastActiveDate: string;
  stats: {
    conversationsCount: number;
    projectsCreated: number;
    imagesGenerated: number;
    searchesPerformed: number;
    codeBlocksProduced: number;
    activeDays: number;
    totalActiveTimeMinutes: number;
  };
  badges: UserBadge[];
  completedQuests: string[];
}

export interface Badge {
  id: string;
  title: string;
  description: string;
  rarity: 'Comum' | 'Raro' | 'Épico' | 'Lendário';
  category: string;
  iconName: string;
}

export interface UserBadge {
  badgeId: string;
  earnedAt: string;
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  type: 'daily' | 'weekly' | 'monthly';
  rewardPoints: number;
  targetCount: number;
  metricKey: keyof UserGamificationProfile['stats'];
}

export const LEVELS = [
  { name: 'Iniciante', minPoints: 0 },
  { name: 'Explorador', minPoints: 100 },
  { name: 'Aprendiz', minPoints: 300 },
  { name: 'Desenvolvedor', minPoints: 600 },
  { name: 'Especialista', minPoints: 1000 },
  { name: 'Mestre', minPoints: 1500 },
  { name: 'Arquiteto', minPoints: 2500 },
  { name: 'Visionário', minPoints: 4000 },
  { name: 'Gênio', minPoints: 6000 },
  { name: 'Lenda ZENO', minPoints: 10000 },
];

export const INITIAL_BADGES: Badge[] = [
  {
    id: 'first_chat',
    title: 'Primeiro Diálogo',
    description: 'Iniciou sua primeira conversa com a ZENO IA.',
    rarity: 'Comum',
    category: 'Geral',
    iconName: 'MessageSquare'
  },
  {
    id: 'python_learner',
    title: 'Estudioso Python',
    description: 'Completou o módulo introdutório de Python.',
    rarity: 'Raro',
    category: 'Aprendizado',
    iconName: 'Code'
  },
  {
    id: 'project_builder',
    title: 'Criador de Projetos',
    description: 'Criou seu primeiro projeto na plataforma.',
    rarity: 'Comum',
    category: 'Produtividade',
    iconName: 'FolderPlus'
  },
  {
    id: 'streak_7',
    title: 'Consistência Semanal',
    description: 'Manteve uma sequência ativa por 7 dias.',
    rarity: 'Raro',
    category: 'Sequência',
    iconName: 'Flame'
  },
  {
    id: 'architect_master',
    title: 'Arquiteto ZENO',
    description: 'Atingiu o nível de Arquiteto na plataforma.',
    rarity: 'Épico',
    category: 'Evolução',
    iconName: 'Award'
  },
  {
    id: 'zeno_legend',
    title: 'Lenda Viva',
    description: 'Alcançou o patamar máximo de Lenda ZENO.',
    rarity: 'Lendário',
    category: 'Especial',
    iconName: 'Zap'
  }
];

export const INITIAL_QUESTS: Quest[] = [
  {
    id: 'daily_chat',
    title: 'Diálogo Diário',
    description: 'Envie pelo menos 3 mensagens no chat hoje.',
    type: 'daily',
    rewardPoints: 15,
    targetCount: 3,
    metricKey: 'conversationsCount'
  },
  {
    id: 'weekly_code',
    title: 'Gerador de Código',
    description: 'Produza ou visualize blocos de código na semana.',
    type: 'weekly',
    rewardPoints: 50,
    targetCount: 5,
    metricKey: 'codeBlocksProduced'
  },
  {
    id: 'monthly_project',
    title: 'Construtor Mensal',
    description: 'Crie pelo menos 3 projetos este mês.',
    type: 'monthly',
    rewardPoints: 120,
    targetCount: 3,
    metricKey: 'projectsCreated'
  }
];
