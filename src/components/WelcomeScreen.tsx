import React from 'react';
import { 
  Sparkles, Terminal, Palette, ArrowRight, Lock, Music
} from 'lucide-react';
import { ZenoLogo } from './ZenoLogo';
import { ModelType } from '../types';
import { motion } from 'motion/react';
import { ZENO_MODELS, getModelDef } from '../lib/subscription';
import { useSubscription } from '../contexts/SubscriptionContext';

interface WelcomeScreenProps {
  speed: ModelType;
  theme: 'dark' | 'light';
  logoVariant: 'monochrome' | 'gradient';
  userName?: string;
  onSelectPrompt: (promptText: string) => void;
  onOpenImageStudio: () => void;
  onOpenMusicStudio?: () => void;
  onSelectSpeed: (speed: ModelType) => void;
  user?: any;
  onLogin?: (remember: boolean) => void;
  authLoading?: boolean;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = React.memo(({
  speed,
  theme,
  logoVariant,
  userName,
  onSelectPrompt,
  onOpenMusicStudio,
  user,
  onLogin,
  authLoading
}) => {
  const isDark = theme === 'dark';
  const displayName = user?.displayName?.split(' ')[0] || userName?.split(' ')[0] || '';
  const { isPro } = useSubscription();

  const currentModelDef = getModelDef(speed);

  // Suggestions for prompt starters
  const getSuggestions = () => {
    if (speed === 'vision' || speed === 'image') {
      return [
        { title: 'Logotipo Minimalista', prompt: 'Crie um conceito de logotipo minimalista e elegante para uma marca de tecnologia.' },
        { title: 'Ilustração Vetorial', prompt: 'Crie uma ilustração vetorial moderna de uma paisagem de montanhas ao pôr do sol.' },
        { title: 'Interface UI/UX', prompt: 'Gere um mockup limpo de interface mobile para um aplicativo de finanças pessoais.' },
      ];
    }
    if (speed === 'code' || speed === 'mega') {
      return [
        { title: 'Componente React', prompt: 'Crie um componente React em TypeScript com Tailwind CSS para uma lista interativa.' },
        { title: 'Otimizar Algoritmo', prompt: 'Como posso otimizar a complexidade de tempo desta função de ordenação?' },
        { title: 'API Express em TypeScript', prompt: 'Escreva uma estrutura básica de servidor Express em TypeScript com validações.' },
      ];
    }
    return [
      { title: 'Resumir Artigo', prompt: 'Como posso resumir textos extensos em tópicos diretos e objetivos?' },
      { title: 'E-mail Profissional', prompt: 'Escreva uma mensagem profissional para alinhar os próximos passos de um projeto.' },
      { title: 'Planejamento Semanal', prompt: 'Crie um cronograma simples de foco e produtividade para a próxima semana.' },
    ];
  };

  const suggestions = getSuggestions();

  return (
    <motion.div 
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="flex flex-col items-center justify-center w-full max-w-xl px-4 py-8 mx-auto my-auto text-center"
    >
      {/* Small Clean Logo & Simple Greeting */}
      <div className="flex flex-col items-center gap-3 mb-6">
        <ZenoLogo size={32} variant={logoVariant} theme={theme} />
        <h1 className={`text-xl sm:text-2xl font-semibold tracking-tight ${isDark ? 'text-white' : 'text-neutral-900'}`}>
          {displayName ? `Olá, ${displayName}` : 'Como posso ajudar você hoje?'}
        </h1>
      </div>

      {/* Model Selector Card (Only shown when starting a new chat) */}
      <div className={`w-full p-4 sm:p-5 rounded-2xl border transition-all mb-6 text-left ${
        isDark 
          ? 'bg-[#151518] border-neutral-800/80 text-white' 
          : 'bg-white border-neutral-200/90 text-neutral-900 shadow-xs'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-neutral-400" />
            <span className="text-sm font-semibold tracking-tight">{currentModelDef.name}</span>
          </div>
          {currentModelDef.isPro && !isPro && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-neutral-800 text-neutral-300 border border-neutral-700">
              <Lock className="w-2.5 h-2.5" /> PRO
            </span>
          )}
        </div>
        <p className={`text-xs leading-relaxed ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
          {currentModelDef.description}
        </p>
      </div>

      {/* Discrete Prompt Suggestions */}
      <div className="w-full space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {suggestions.map((s, idx) => (
            <button
              key={idx}
              onClick={() => onSelectPrompt(s.prompt)}
              className={`group flex items-center justify-between p-3 rounded-xl border text-left transition-all text-xs font-normal ${
                isDark
                  ? 'bg-[#151518] hover:bg-neutral-800/80 border-neutral-800/80 text-neutral-300 hover:text-white'
                  : 'bg-white hover:bg-neutral-50 border-neutral-200/90 text-neutral-700 hover:text-neutral-900 shadow-2xs'
              }`}
            >
              <span className="truncate pr-1">{s.title}</span>
              <ArrowRight className="w-3 h-3 text-neutral-400 group-hover:text-neutral-200 transition-transform group-hover:translate-x-0.5 flex-shrink-0" />
            </button>
          ))}
        </div>

        {onOpenMusicStudio && (
          <button
            onClick={onOpenMusicStudio}
            className={`w-full group flex items-center justify-between p-3 rounded-xl border text-left transition-all text-xs font-normal ${
              isDark
                ? 'bg-[#1C1C1E] hover:bg-[#2C2C2E]/80 border-[#2C2C2E] text-[#F5F5F5]'
                : 'bg-white hover:bg-neutral-50 border-neutral-200/90 text-neutral-700 hover:text-neutral-900 shadow-2xs'
            }`}
          >
            <div className="flex items-center gap-2.5 truncate pr-1">
              <Music className="w-4 h-4 text-[#D4D4D8] shrink-0" />
              <span className="font-medium text-[#F5F5F5]">Criar Música com IA</span>
              <span className="text-[#9A9A9E] truncate">— Letras, acordes e prévia sonora</span>
            </div>
            <ArrowRight className="w-3 h-3 text-[#9A9A9E] group-hover:text-[#F5F5F5] transition-transform group-hover:translate-x-0.5 flex-shrink-0" />
          </button>
        )}
      </div>

      {!user && (
        <div className="mt-8">
          <button
            onClick={() => onLogin?.(true)}
            disabled={authLoading}
            className={`px-4 py-2 rounded-xl text-xs font-medium transition-all border ${
              isDark 
                ? 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-800' 
                : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border-neutral-200'
            }`}
          >
            {authLoading ? 'Conectando...' : 'Entrar com Google para sincronizar histórico'}
          </button>
        </div>
      )}
    </motion.div>
  );
});

WelcomeScreen.displayName = 'WelcomeScreen';
