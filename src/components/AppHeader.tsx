import React, { useState, useRef, useEffect } from 'react';
import { Menu, Sparkles, ChevronDown, Lock, Check, MoreHorizontal, Share2, Folder, Pin, Archive, Flag, Trash2 } from 'lucide-react';
import { UserSettings, ModelType } from '../types';
import { useSubscription } from '../contexts/SubscriptionContext';
import { ZENO_MODELS, getModelDef } from '../lib/subscription';
import { useTranslation } from '../i18n';
import { isAdminUser } from '../config/admin';

interface AppHeaderProps {
  theme: 'dark' | 'light';
  logoVariant: 'monochrome' | 'gradient';
  userSettings: UserSettings;
  isSidebarCollapsed: boolean;
  onOpenSidebar: () => void;
  onOpenSubscriptionModal: (reason?: string) => void;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onOpenAuthModal: () => void;
  onNewChat: () => void;
  user?: any;
  speed: ModelType;
  onSelectSpeed: (speed: ModelType) => void;
  onShareChat?: () => void;
  onViewFiles?: () => void;
  onTogglePinChat?: () => void;
  onArchiveChat?: () => void;
  onReportChat?: () => void;
  onDeleteChat?: () => void;
  isPinned?: boolean;
}

export const AppHeader = React.memo<AppHeaderProps>(({
  theme,
  logoVariant,
  userSettings,
  isSidebarCollapsed,
  onOpenSidebar,
  onOpenSubscriptionModal,
  onToggleTheme,
  onOpenSettings,
  onOpenAuthModal,
  onNewChat,
  user,
  speed,
  onSelectSpeed,
  onShareChat,
  onViewFiles,
  onTogglePinChat,
  onArchiveChat,
  onReportChat,
  onDeleteChat,
  isPinned
}) => {
  const { t } = useTranslation('AppHeader');
  const isDark = theme === 'dark';
  const { isPro } = useSubscription();

  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [isChatMenuOpen, setIsChatMenuOpen] = useState(false);

  const modelMenuRef = useRef<HTMLDivElement>(null);
  const chatMenuRef = useRef<HTMLDivElement>(null);

  const currentModel = getModelDef(speed);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setIsModelMenuOpen(false);
      }
      if (chatMenuRef.current && !chatMenuRef.current.contains(e.target as Node)) {
        setIsChatMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const isAdmin = user?.isAdmin || isAdminUser(user?.email);

  const handleModelClick = (modelId: ModelType, isModelPro?: boolean) => {
    if (isModelPro && !isPro && !isAdmin) {
      setIsModelMenuOpen(false);
      onOpenSubscriptionModal('feature_locked');
      return;
    }
    onSelectSpeed(modelId);
    setIsModelMenuOpen(false);
  };

  return (
    <header className="absolute top-0 w-full flex items-center justify-between px-4 sm:px-8 py-4 z-35 bg-transparent border-0 shadow-none pointer-events-none">
      <div className="flex items-center gap-4 min-w-0 pointer-events-auto">
        <button 
          className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all active:scale-95 cursor-pointer ${
            isDark 
              ? 'bg-[#1a1a1a]/60 backdrop-blur-md text-neutral-200 hover:bg-[#1a1a1a]/70' 
              : 'bg-white/60 backdrop-blur-md text-neutral-700 hover:bg-white/70'
          } ${isSidebarCollapsed ? 'block' : 'md:hidden'}`}
          onClick={onOpenSidebar}
          title={t.sidebar?.openSidebar || 'Abrir barra lateral'}
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Top Header Model Selector (Pill 1) */}
        <div className="relative" ref={modelMenuRef}>
          <button
            onClick={() => setIsModelMenuOpen(!isModelMenuOpen)}
            className={`flex items-center gap-2 px-4 h-10 rounded-xl transition-all cursor-pointer font-semibold ${
              isDark 
                ? 'bg-[#1a1a1a]/60 backdrop-blur-md text-white hover:bg-[#1a1a1a]/70' 
                : 'bg-white/60 backdrop-blur-md text-neutral-900 hover:bg-white/70'
            }`}
          >
            <span className="text-sm">{currentModel.name}</span>
            <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform duration-200 ${isModelMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {isModelMenuOpen && (
            <div className={`absolute top-full left-0 mt-2 w-72 p-2 rounded-2xl border shadow-2xl z-50 ${
              isDark ? 'bg-[#18181b] border-[#2C2C2E] text-white' : 'bg-white border-neutral-200 text-neutral-900'
            }`}>
              <div className="px-2 py-1.5 mb-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400 border-b border-neutral-200 dark:border-[#2C2C2E]">
                Selecionar Modelo
              </div>
              <div className="space-y-1 max-h-[320px] overflow-y-auto scrollbar-custom">
                {ZENO_MODELS.map(m => {
                  const isSelected = speed === m.id;
                  const isLocked = m.isPro && !isPro && !isAdmin;
                  const showProTag = m.isPro && !isAdmin;

                  return (
                    <button
                      key={m.id}
                      onClick={() => handleModelClick(m.id, m.isPro)}
                      className={`w-full text-left p-2.5 rounded-xl transition-all flex items-center justify-between group cursor-pointer ${
                        isSelected
                          ? isDark ? 'bg-zeno/15 text-zeno font-medium border border-zeno/30' : 'bg-blue-50 text-zeno font-medium border border-zeno/30'
                          : isDark ? 'hover:bg-[#232326] text-neutral-300' : 'hover:bg-neutral-50 text-neutral-700'
                      }`}
                    >
                      <div className="flex-1 pr-2">
                        <div className="text-xs font-semibold flex items-center gap-1.5">
                          <span>{m.name}</span>
                          {showProTag && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#232326] text-neutral-300 border border-[#2C2C2E]">
                              {isLocked && <Lock className="w-2.5 h-2.5" />} PRO
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-neutral-400 mt-0.5 line-clamp-1">{m.description}</p>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-zeno flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Upgrade Badge Pill (Conditional: never for admin or pro) */}
        {!user?.isAdmin && !isPro && (
          <button
            onClick={() => onOpenSubscriptionModal()}
            className={`hidden sm:flex items-center gap-1.5 px-4 h-10 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-95 cursor-pointer ${
              isDark 
                ? 'bg-[#1a1a1a]/60 backdrop-blur-md text-zeno hover:bg-[#1a1a1a]/70' 
                : 'bg-white/60 backdrop-blur-md text-zeno hover:bg-white/70'
            }`}
          >
            <Sparkles className="w-4 h-4 text-zeno" />
            <span>Upgrade</span>
          </button>
        )}
      </div>

      {/* Header Actions */}
      <div className="flex items-center gap-2 pointer-events-auto">
        {(!user || user.isAnonymous) && (
          <button
            onClick={onOpenAuthModal}
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all border cursor-pointer ${
              isDark 
                ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20' 
                : 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100'
            }`}
          >
            Faça login para salvar
          </button>
        )}

        {/* Mobile Upgrade Pill */}
        {!user?.isAdmin && !isPro && (
          <button
            onClick={() => onOpenSubscriptionModal()}
            className={`sm:hidden flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-all ${
              isDark 
                ? 'bg-[#1a1a1a]/60 backdrop-blur-md text-zeno' 
                : 'bg-white/60 backdrop-blur-md text-zeno'
            }`}
          >
            <Sparkles className="w-3 h-3 text-zeno" />
            <span>Upgrade</span>
          </button>
        )}

        {/* Chat More Options Dropdown (⋯) (Pill 3) */}
        <div className="relative" ref={chatMenuRef}>
          <button
            onClick={() => setIsChatMenuOpen(!isChatMenuOpen)}
            className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all active:scale-95 cursor-pointer ${
              isDark 
                ? 'bg-[#1a1a1a]/60 backdrop-blur-md text-neutral-200 hover:bg-[#1a1a1a]/70' 
                : 'bg-white/60 backdrop-blur-md text-neutral-700 hover:bg-white/70'
            }`}
            title="Opções da conversa"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>

          {isChatMenuOpen && (
            <div className={`absolute top-full right-0 mt-2 w-52 p-1.5 rounded-2xl border shadow-2xl z-50 text-xs ${
              isDark ? 'bg-[#18181b] border-[#2C2C2E] text-white' : 'bg-white border-neutral-200 text-neutral-900'
            }`}>
              <button
                onClick={() => {
                  setIsChatMenuOpen(false);
                  onShareChat?.();
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl font-medium transition-colors ${
                  isDark ? 'hover:bg-[#232326] text-neutral-200' : 'hover:bg-neutral-100 text-neutral-800'
                }`}
              >
                <Share2 className="w-4 h-4 text-neutral-400" />
                <span>Compartilhar</span>
              </button>

              <button
                onClick={() => {
                  setIsChatMenuOpen(false);
                  onViewFiles?.();
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl font-medium transition-colors ${
                  isDark ? 'hover:bg-[#232326] text-neutral-200' : 'hover:bg-neutral-100 text-neutral-800'
                }`}
              >
                <Folder className="w-4 h-4 text-neutral-400" />
                <span>Exibir arquivos no chat</span>
              </button>

              <button
                onClick={() => {
                  setIsChatMenuOpen(false);
                  onTogglePinChat?.();
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl font-medium transition-colors ${
                  isDark ? 'hover:bg-[#232326] text-neutral-200' : 'hover:bg-neutral-100 text-neutral-800'
                }`}
              >
                <Pin className={`w-4 h-4 ${isPinned ? 'text-zeno' : 'text-neutral-400'}`} />
                <span>{isPinned ? 'Desafixar chat' : 'Fixar chat'}</span>
              </button>

              <button
                onClick={() => {
                  setIsChatMenuOpen(false);
                  onArchiveChat?.();
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl font-medium transition-colors ${
                  isDark ? 'hover:bg-[#232326] text-neutral-200' : 'hover:bg-neutral-100 text-neutral-800'
                }`}
              >
                <Archive className="w-4 h-4 text-neutral-400" />
                <span>Arquivar</span>
              </button>

              <button
                onClick={() => {
                  setIsChatMenuOpen(false);
                  onReportChat?.();
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl font-medium transition-colors ${
                  isDark ? 'hover:bg-[#232326] text-neutral-200' : 'hover:bg-neutral-100 text-neutral-800'
                }`}
              >
                <Flag className="w-4 h-4 text-neutral-400" />
                <span>Denunciar</span>
              </button>

              <div className="my-1 border-t border-neutral-200 dark:border-[#2C2C2E]" />

              <button
                onClick={() => {
                  setIsChatMenuOpen(false);
                  onDeleteChat?.();
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl font-medium text-red-500 transition-colors ${
                  isDark ? 'hover:bg-red-500/10' : 'hover:bg-red-50'
                }`}
              >
                <Trash2 className="w-4 h-4 text-red-500" />
                <span>Excluir</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
});

AppHeader.displayName = 'AppHeader';
