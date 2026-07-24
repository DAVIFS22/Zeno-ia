export type FileAttachment = {
  id: string;
  name: string;
  size: number;
  type: string; // 'image' | 'code' | 'document' | 'other'
  url?: string;
  content?: string;
};

export type ModelType = 'zeno' | 'think' | 'search' | 'vision' | 'smart' | 'fast' | 'mega' | 'image';

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
  imageUrl: string;
  prompt: string;
  originalPrompt: string;
  aspectRatio: string;
  style: string;
  timestamp: number;
};

export type UserPlan = 'ZENO Free' | 'ZENO Pro';

export type StripeSubscriptionInfo = {
  subscriptionId: string;
  status: string; // 'trialing', 'active', 'canceled'
  trialEnd: number | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: number;
  amount: number;
  currency: string;
};

export type DailyUsage = {
  date: string; // YYYY-MM-DD
  messagesCount: number;
  imageGenCount: number;
  webSearchCount: number;
  docUploadCount: number;
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
  theme: 'dark' | 'light';
  logoVariant: 'monochrome' | 'gradient';
  fontSize: 'normal' | 'large' | 'compact';
  // IA
  defaultSpeed: ModelType;
  temperature: number;
  systemInstruction: string;
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
  // Personalização & Idioma
  language: 'pt-BR' | 'en-US' | 'es-ES';
  groupByDate?: boolean;
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



