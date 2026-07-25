import React, { useState } from 'react';
import { 
  MessageSquare, Code, ImageIcon, FileText, Globe, Compass, ArrowRight, Wand2
} from 'lucide-react';
import { ZenoLogo } from './ZenoLogo';

interface WelcomeScreenProps {
  theme: 'dark' | 'light';
  logoVariant: 'monochrome' | 'gradient';
  userName?: string;
  onSelectPrompt: (promptText: string) => void;
  onOpenImageStudio: () => void;
  onSelectSpeed: (speed: 'smart' | 'fast' | 'mega' | 'image') => void;
  user?: any;
  onLogin?: (remember: boolean) => void;
  authLoading?: boolean;
}

export const WelcomeScreen = React.memo<WelcomeScreenProps>(({
  theme,
  logoVariant,
  onSelectPrompt,
  onOpenImageStudio,
  user,
  onLogin,
  authLoading
}) => {
  const [activeCategory, setActiveCategory] = useState<'all' | 'chat' | 'code' | 'image' | 'doc' | 'search'>('all');
  const [rememberMe, setRememberMe] = useState(true);

  const categories = [
    { id: 'all', label: 'Todos', icon: Compass },
    { id: 'chat', label: 'Chat & Ideias', icon: MessageSquare },
    { id: 'code', label: 'Código & Dev', icon: Code },
    { id: 'image', label: 'Imagens & Arte', icon: ImageIcon },
    { id: 'doc', label: 'Documentos', icon: FileText },
    { id: 'search', label: 'Pesquisa Web', icon: Globe },
  ] as const;

  const suggestions = [
    {
      category: 'image',
      title: 'Estúdio ZENO Vision',
      description: 'Crie artes, ilustrações digitais e imagens conceituais.',
      prompt: '',
      isAction: true,
      action: onOpenImageStudio,
      badge: 'ZENO Vision',
    },
    {
      category: 'code',
      title: 'Componente React / TypeScript',
      description: 'Escreva um componente modular responsivo com Tailwind e React Hooks.',
      prompt: 'Crie um componente React em TypeScript com Tailwind CSS para um dashboard moderno com gráficos e cartões métricos.',
      badge: 'Código',
    },
    {
      category: 'chat',
      title: 'Plano Estratégico',
      description: 'Estruture um plano passo a passo para lançar um novo produto digital.',
      prompt: 'Crie um plano estratégico passo a passo para lançar um produto SaaS no mercado, incluindo marketing e suporte.',
      badge: 'Estratégia',
    },
    {
      category: 'doc',
      title: 'Resumo Executivo',
      description: 'Sintetize um relatório extenso apontando dados, conclusões e métricas.',
      prompt: 'Explique como criar um resumo executivo eficiente para relatórios de diretoria, com modelo prático.',
      badge: 'Síntese',
    },
    {
      category: 'search',
      title: 'Pesquisa Web Atualizada',
      description: 'Análise profunda conectada aos acontecimentos mais recentes.',
      prompt: 'Quais são as principais inovações tecnológicas mais recentes em Inteligência Artificial e seus impactos?',
      badge: 'ZENO Search',
    },
    {
      category: 'code',
      title: 'Refatoração e Otimização',
      description: 'Otimize algoritmos, corrija erros e melhore a performance de código.',
      prompt: 'Como identificar e corrigir memory leaks e re-renderizações desnecessárias em aplicações React modernas?',
      badge: 'Dev Pro',
    }
  ];

  const filteredSuggestions = suggestions.filter(
    s => activeCategory === 'all' || s.category === activeCategory
  );

  const isDark = theme === 'dark';

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-4xl px-4 py-12 mx-auto animate-fadeIn">
      {/* Header Greeting */}
      <div className="flex flex-col items-center text-center mb-8">
        <ZenoLogo size={48} variant={logoVariant} theme={theme} className="mb-4 shadow-xs" />
        <h1 className={`text-2xl sm:text-3xl font-extrabold tracking-tight mb-2 ${
          isDark ? 'text-neutral-100' : 'text-neutral-900'
        }`}>
          {user ? `Olá, ${user.displayName?.split(' ')[0] || 'Zeno User'}!` : 'Como posso ajudar você hoje?'}
        </h1>
        <p className="text-xs sm:text-sm text-neutral-400 max-w-md">
          {user ? 'Selecione uma sugestão ou digite sua mensagem para iniciar uma conversa.' : 'Faça login para salvar seu histórico e acessar recursos Pro.'}
        </p>

        {!user && (
          <div className="mt-6 flex flex-col items-center gap-3 w-full max-w-xs">
            <button
              onClick={() => onLogin?.(rememberMe)}
              disabled={authLoading}
              className={`w-full flex items-center justify-center gap-3 h-12 rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95 ${
                isDark
                  ? 'bg-white text-black hover:bg-neutral-200'
                  : 'bg-neutral-900 text-white hover:bg-neutral-800'
              }`}
            >
              {authLoading ? (
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  <span>Continuar com Google</span>
                </>
              )}
            </button>
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                id="remember_me_welcome"
                className="w-4 h-4 rounded border-neutral-300 dark:border-neutral-700 bg-transparent text-emerald-500 focus:ring-emerald-500/20"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <label htmlFor="remember_me_welcome" className="text-[11px] text-neutral-500 cursor-pointer">
                Lembrar este dispositivo
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto w-full justify-start sm:justify-center pb-2 mb-6 scrollbar-custom">
        {categories.map(cat => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id as any)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all flex-shrink-0 ${
                isActive
                  ? isDark
                    ? 'bg-neutral-800 text-neutral-100 border border-neutral-700'
                    : 'bg-neutral-200 text-neutral-900 border border-neutral-300'
                  : isDark
                    ? 'bg-neutral-900/60 text-neutral-400 hover:text-neutral-200 border border-neutral-800/80'
                    : 'bg-neutral-100/80 text-neutral-600 hover:text-neutral-900 border border-neutral-200'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? (isDark ? 'text-neutral-200' : 'text-neutral-800') : 'text-neutral-500'}`} />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Suggestion Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 w-full">
        {filteredSuggestions.map((item, idx) => (
          <button
            key={idx}
            onClick={() => {
              if (item.isAction && item.action) {
                item.action();
              } else {
                onSelectPrompt(item.prompt);
              }
            }}
            className={`group flex flex-col justify-between p-4 rounded-2xl border text-left transition-all relative overflow-hidden h-32 ${
              isDark
                ? 'bg-[#18181c] hover:bg-[#202026] border-neutral-800 hover:border-neutral-700'
                : 'bg-neutral-50 hover:bg-neutral-100/80 border-neutral-200 hover:border-neutral-300'
            }`}
          >
            <div>
              <div className="flex items-center justify-between w-full mb-1.5">
                <span className={`text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-md ${
                  isDark 
                    ? 'bg-neutral-800 text-neutral-300 border border-neutral-700'
                    : 'bg-neutral-200/80 text-neutral-700 border border-neutral-300'
                }`}>
                  {item.badge}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-neutral-500 group-hover:text-neutral-300 transition-colors transform group-hover:translate-x-0.5" />
              </div>

              <h3 className={`font-semibold text-xs mb-1 line-clamp-1 ${
                isDark ? 'text-neutral-200' : 'text-neutral-800'
              }`}>
                {item.title}
              </h3>
            </div>

            <p className="text-[11px] text-neutral-400 line-clamp-2 leading-relaxed">
              {item.description}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
});

WelcomeScreen.displayName = 'WelcomeScreen';
