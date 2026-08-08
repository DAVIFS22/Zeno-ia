import React from 'react';
import { 
  Sparkles, Terminal, Palette, ArrowRight, Lock, Music,
  FileText, Mail, Calendar, Code, Cpu, Server, Layout
} from 'lucide-react';
import { ZenoLogo } from './ZenoLogo';
import { ModelType } from '../types';
import { motion } from 'motion/react';
import { getModelDef } from '../lib/subscription';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useTranslation } from '../i18n';
import { GoogleLogo } from './GoogleLogo';

interface WelcomeScreenProps {
  speed: ModelType;
  theme: 'dark' | 'light';
  logoVariant: 'monochrome' | 'gradient';
  userName?: string;
  onSelectPrompt: (promptText: string) => void;
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
  const { t } = useTranslation();
  const isDark = theme === 'dark';
  const displayName = user?.displayName?.split(' ')[0] || userName?.split(' ')[0] || '';
  const { isPro } = useSubscription();

  const currentModelDef = getModelDef(speed);

  // Suggestions for prompt starters with outline icons
  const getSuggestions = () => {
    if (speed === 'vision' || speed === 'image') {
      return [
        { title: (t.welcome as any).suggestions?.vision1?.title || 'Logotipo Minimalista', prompt: (t.welcome as any).suggestions?.vision1?.prompt || 'Crie um conceito de logotipo minimalista e elegante para uma marca de tecnologia.', icon: Palette },
        { title: (t.welcome as any).suggestions?.vision2?.title || 'Ilustração Vetorial', prompt: (t.welcome as any).suggestions?.vision2?.prompt || 'Crie uma ilustração vetorial moderna de uma paisagem de montanhas ao pôr do sol.', icon: Sparkles },
        { title: (t.welcome as any).suggestions?.vision3?.title || 'Interface UI/UX', prompt: (t.welcome as any).suggestions?.vision3?.prompt || 'Gere um mockup limpo de interface mobile para um aplicativo de finanças pessoais.', icon: Layout },
      ];
    }
    if (speed === 'code' || speed === 'mega') {
      return [
        { title: (t.welcome as any).suggestions?.code1?.title || 'Componente React', prompt: (t.welcome as any).suggestions?.code1?.prompt || 'Crie um componente React em TypeScript com Tailwind CSS para uma lista interativa.', icon: Code },
        { title: (t.welcome as any).suggestions?.code2?.title || 'Otimizar Algoritmo', prompt: (t.welcome as any).suggestions?.code2?.prompt || 'Como posso otimizar a complexidade de tempo desta função de ordenação?', icon: Cpu },
        { title: (t.welcome as any).suggestions?.code3?.title || 'API Express em TypeScript', prompt: (t.welcome as any).suggestions?.code3?.prompt || 'Escreva uma estrutura básica de servidor Express em TypeScript com validações.', icon: Server },
      ];
    }
    return [
      { title: (t.welcome as any).suggestions?.general1?.title || 'Resumir Artigo', prompt: (t.welcome as any).suggestions?.general1?.prompt || 'Como posso resumir textos extensos em tópicos diretos e objetivos?', icon: FileText },
      { title: (t.welcome as any).suggestions?.general2?.title || 'E-mail Profissional', prompt: (t.welcome as any).suggestions?.general2?.prompt || 'Escreva uma mensagem profissional para alinhar os próximos passos de um projeto.', icon: Mail },
      { title: (t.welcome as any).suggestions?.general3?.title || 'Planejamento Semanal', prompt: (t.welcome as any).suggestions?.general3?.prompt || 'Crie um cronograma simples de foco e produtividade para a próxima semana.', icon: Calendar },
    ];
  };

  const suggestions = getSuggestions();
  
  const modelDescription = (t.welcome as any).modelDescriptions?.[speed] || currentModelDef.description;

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
        <ZenoLogo size={36} variant={logoVariant} theme={theme} />
        <h1 className={`text-xl sm:text-2xl font-semibold tracking-tight ${isDark ? 'text-white' : 'text-neutral-900'}`}>
          {displayName ? `${t.welcome.title.split(',')[0]}, ${displayName}` : t.welcome.subtitle}
        </h1>
        <p className={`text-xs sm:text-sm ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
          Como posso te ajudar hoje?
        </p>
      </div>

      {/* Model Selector Card (ZENO Smart) */}
      <div className={`w-full p-4 sm:p-5 rounded-2xl border transition-all mb-4 text-left ${
        isDark 
          ? 'bg-[#151518] border-[#2C2C2E]/80 text-white' 
          : 'bg-white border-neutral-200/90 text-neutral-900 shadow-xs'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold tracking-tight">{currentModelDef.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
              isDark 
                ? 'bg-blue-500/15 text-blue-400 border-blue-500/20' 
                : 'bg-blue-50 text-blue-600 border-blue-200'
            }`}>
              Padrão
            </span>
            {currentModelDef.isPro && !isPro && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-[#232326] text-neutral-300 border border-[#2C2C2E]">
                <Lock className="w-2.5 h-2.5" /> PRO
              </span>
            )}
          </div>
        </div>
        <p className={`text-xs leading-relaxed ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
          {modelDescription}
        </p>
      </div>

      {/* Discrete Prompt Suggestions with Outline Icons */}
      <div className="w-full space-y-2.5">
        <div className="flex flex-col gap-2.5 w-full">
          {suggestions.map((s, idx) => {
            const IconComp = s.icon;
            return (
              <button
                key={idx}
                onClick={() => onSelectPrompt(s.prompt)}
                className={`group flex items-center justify-between p-3.5 rounded-xl border text-left transition-all text-xs sm:text-sm font-normal cursor-pointer ${
                  isDark
                    ? 'bg-[#151518] hover:bg-[#232326] border-[#2C2C2E]/80 text-neutral-200 hover:text-white'
                    : 'bg-white hover:bg-neutral-50 border-neutral-200/90 text-neutral-700 hover:text-neutral-900 shadow-2xs'
                }`}
              >
                <div className="flex items-center gap-3 truncate pr-2">
                  <IconComp className="w-4 h-4 text-neutral-400 group-hover:text-neutral-200 flex-shrink-0" />
                  <span className="truncate font-medium">{s.title}</span>
                </div>
                <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-neutral-200 transition-transform group-hover:translate-x-0.5 flex-shrink-0" />
              </button>
            );
          })}

          {onOpenMusicStudio && (
            <button
              onClick={onOpenMusicStudio}
              className={`group flex items-center justify-between p-3.5 rounded-xl border text-left transition-all text-xs sm:text-sm font-normal cursor-pointer ${
                isDark
                  ? 'bg-[#151518] hover:bg-[#232326] border-[#2C2C2E]/80 text-neutral-200 hover:text-white'
                  : 'bg-white hover:bg-neutral-50 border-neutral-200/90 text-neutral-700 hover:text-neutral-900 shadow-2xs'
              }`}
            >
              <div className="flex items-center gap-3 truncate pr-2">
                <Music className="w-4 h-4 text-neutral-400 group-hover:text-neutral-200 flex-shrink-0" />
                <span className="truncate font-medium">{t.composer.musicStudio || 'Estúdio de Música'}</span>
              </div>
              <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-neutral-200 transition-transform group-hover:translate-x-0.5 flex-shrink-0" />
            </button>
          )}
        </div>
      </div>

      {!user && (
        <div className="mt-6">
          <button
            onClick={() => onLogin?.(true)}
            disabled={authLoading}
            className={`px-4 py-2.5 rounded-xl text-xs font-medium transition-all border cursor-pointer flex items-center gap-2.5 ${
              isDark 
                ? 'bg-[#1C1C1E] hover:bg-[#232326] text-neutral-200 border-[#2C2C2E]' 
                : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border-neutral-200'
            }`}
          >
            <GoogleLogo className="w-4 h-4 flex-shrink-0" />
            {authLoading ? t.common.loading : t.welcome.getStarted}
          </button>
        </div>
      )}
    </motion.div>
  );
});

WelcomeScreen.displayName = 'WelcomeScreen';
