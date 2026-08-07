export type FileAttachment = {
  id: string;
  name: string;
  size: number;
  type: string; // 'image' | 'code' | 'document' | 'other'
  url?: string;
  content?: string;
};

export type ModelType = 'zeno' | 'think' | 'search' | 'vision' | 'smart' | 'fast' | 'mega' | 'image' | 'code' | 'strategy' | 'summary' | 'pdf';

export type SearchSource = {
  title: string;
  url: string;
  domain?: string;
  publishedDate?: string;
  updatedDate?: string;
  snippet?: string;
};

export type Message = {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp?: number;
  modelSpeed?: ModelType;
  attachments?: FileAttachment[];
  hasError?: boolean;
  errorMessage?: string;
  rawErrorDetails?: string;
  isLimitWarning?: boolean;
  youtubeUrl?: string;
  isSearch?: boolean;
  searchSources?: SearchSource[];
  isSearching?: boolean;
  isToolCalling?: boolean;
  toolName?: string;
};

export type ChatSession = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
  speed?: ModelType;
  isPinned?: boolean;
  isFavorite?: boolean;
};

export type GeneratedImage = {
  id: string;
  userId?: string;
  conversationId?: string;
  conversationTitle?: string;
  imageUrl: string;
  thumbnailUrl?: string;
  prompt: string;
  originalPrompt?: string;
  optimizedPrompt?: string;
  model?: string;
  provider?: string;
  width?: number;
  height?: number;
  aspectRatio: string;
  style: string;
  seed?: number;
  isFavorite?: boolean;
  collection?: string;
  timestamp: number;
};

export type ImageCollection = {
  id: string;
  name: string;
  icon?: string;
  color?: string;
};

export type UserPlan = 'ZENO Free' | 'ZENO Pro';

export interface ConnectedAccount {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // Timestamp em ms
  role: 'user' | 'admin' | 'owner';
  isAdmin: boolean;
  isPro?: boolean;
  unlimited?: boolean;
  bypassStripe?: boolean;
  subscriptionStatus?: string;
}

export interface MultiAccountSession {
  accounts: ConnectedAccount[];
  activeUid: string | null;
}

export type BillingHistoryItem = {
  id: string;
  date: number; // timestamp
  amount: number;
  currency: string;
  status: 'succeeded' | 'failed' | 'pending';
  description: string;
  invoiceUrl?: string;
};

export type PaymentMethodInfo = {
  brand: string; // e.g. 'visa', 'mastercard', 'stripe'
  last4: string;
  expMonth?: number;
  expYear?: number;
};

export type StripeSubscriptionInfo = {
  subscriptionId: string;
  status: string; // 'trialing', 'active', 'canceled', 'past_due', 'unpaid'
  trialEnd: number | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: number;
  amount: number;
  currency: string;
  paymentMethod?: PaymentMethodInfo;
  billingHistory?: BillingHistoryItem[];
  remindersSent?: Record<string, number>;
  lastRenewalStatus?: 'success' | 'failed' | 'pending';
};

export type KnowledgeLevel = 'iniciante' | 'intermediario' | 'avancado' | 'especialista';
export type CommunicationStyle = 'conciso' | 'equilibrado' | 'detalhado' | 'didatico';
export type TonePreference = 'tecnico' | 'amigavel' | 'formal' | 'descontraido';
export type ApproachBias = 'preciso' | 'equilibrado' | 'criativo';

export interface AdaptiveFeedback {
  id: string;
  msgId: string;
  type: 'up' | 'down';
  tags: string[];
  comment?: string;
  timestamp: number;
  topic?: string;
  adjustedComplexity?: 'aumentar' | 'manter' | 'diminuir';
}

export interface AdaptiveLearningProfile {
  globalKnowledgeLevel: KnowledgeLevel;
  domainLevels: {
    programacao: KnowledgeLevel;
    negocios: KnowledgeLevel;
    ciencia_tech: KnowledgeLevel;
    historia_geografia?: KnowledgeLevel;
    ciencias_naturais?: KnowledgeLevel;
    escrita_criativa: KnowledgeLevel;
    geral: KnowledgeLevel;
  };
  communicationStyle: CommunicationStyle;
  tonePreference: TonePreference;
  approachBias: ApproachBias;
  autoAdapt: boolean;
  learnedInsights: string[];
  feedbackCount: number;
  positiveCount: number;
  negativeCount: number;
  lastUpdated: number;
}

export type DailyUsage = {
  date: string; // YYYY-MM-DD
  messagesCount: number;
  imageGenCount: number;
  webSearchCount: number;
  docUploadCount: number;
  musicGenCount: number;
  voiceTranscriptionsCount?: number;
};

export type UserSettings = {
  // Conta & Assinatura
  userName: string;
  userEmail: string;
  userAvatar: string;
  plan: UserPlan;
  stripeSubscription?: StripeSubscriptionInfo;
  hasUsedFreeTrial?: boolean;
  billingCycle?: 'monthly' | 'annual';
  subscriptionRenewalDate?: string;
  paymentMethod?: 'stripe' | 'google_play' | 'apple_pay';
  // Aparência
  theme: 'dark' | 'light' | 'auto';
  showHomeSuggestions?: boolean;
  logoVariant: 'monochrome' | 'gradient';
  fontSize: 'normal' | 'large' | 'compact';
  // IA & Aprendizado Adaptativo
  defaultSpeed: ModelType;
  temperature: number;
  systemInstruction: string;
  adaptiveProfile?: AdaptiveLearningProfile;
  // Voz
  autoRead: boolean;
  voiceSpeed: number;
  speechLanguage: string;
  // Memória
  customInstructions: string;
  memoryEnabled: boolean;
  // Privacidade
  saveHistory: boolean;
  anonymousMode: boolean;
  rememberDevice: boolean;
  // Personalização & Idioma
  language: 'pt-BR' | 'en-US' | 'es-ES' | 'fr-FR' | 'zh-CN' | 'auto';
  groupByDate?: boolean;
  isSmartMode: boolean;
  // Notificações
  soundEnabled: boolean;
  notificationsEnabled: boolean;
};

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'stripe-buy-button': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          'buy-button-id'?: string;
          'publishable-key'?: string;
        },
        HTMLElement
      >;
    }
  }
}



