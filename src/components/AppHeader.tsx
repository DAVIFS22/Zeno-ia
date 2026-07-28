import React from 'react';
import { PanelLeftOpen, Sparkles, Sun, Moon, Settings, Plus, User } from 'lucide-react';
import { UserSettings } from '../types';
import { ZenoLogo } from './ZenoLogo';
import { useSubscription } from '../contexts/SubscriptionContext';

interface AppHeaderProps {
  theme: 'dark' | 'light';
  logoVariant: 'monochrome' | 'gradient';
  userSettings: UserSettings;
  isSidebarCollapsed: boolean;
  onOpenSidebar: () => void;
  onOpenSubscriptionModal: (reason?: string) => void;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onNewChat: () => void;
  user?: any;
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
  onNewChat,
  user
}) => {
  const isDark = theme === 'dark';
  const { isPro } = useSubscription();

  return (
    <header className={`h-13 flex items-center justify-between px-4 sm:px-6 border-b flex-shrink-0 z-20 backdrop-blur-md transition-colors duration-200 ${
      isDark ? 'bg-[#0f0f11]/90 text-white border-neutral-800/80' : 'bg-white/90 text-neutral-900 border-neutral-200/80'
    }`}>
      <div className="flex items-center gap-3 min-w-0">
        <button 
          className={`p-1.5 rounded-lg transition-colors ${
            isDark 
              ? 'hover:bg-neutral-800 text-neutral-400 hover:text-white' 
              : 'hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900'
          } ${isSidebarCollapsed ? 'block' : 'md:hidden'}`}
          onClick={onOpenSidebar}
          title="Abrir barra lateral"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </button>

        {/* Minimal Header Brand Logo */}
        <div className="flex items-center gap-2 cursor-pointer" onClick={onNewChat}>
          <ZenoLogo size={20} variant={logoVariant} theme={theme} />
          <span className={`font-semibold text-xs sm:text-sm tracking-tight ${isDark ? 'text-neutral-200' : 'text-neutral-900'}`}>
            ZENO AI
          </span>
        </div>
      </div>

      {/* Header Actions */}
      <div className="flex items-center gap-2">
        {!isPro && (
          <button
            onClick={() => onOpenSubscriptionModal()}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 border ${
              isDark 
                ? 'bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border-neutral-800 hover:border-neutral-700' 
                : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-800 border-neutral-200 hover:border-neutral-300'
            }`}
          >
            <Sparkles className={`w-3.5 h-3.5 ${isDark ? 'text-amber-400' : 'text-amber-500'}`} />
            <span>Upgrade Pro</span>
          </button>
        )}

        <button
          onClick={onToggleTheme}
          className={`p-2 rounded-lg transition-colors ${
            isDark 
              ? 'hover:bg-neutral-800 text-neutral-400 hover:text-white' 
              : 'hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900'
          }`}
          title="Alternar Tema"
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <button
          onClick={onOpenSettings}
          className={`p-1 rounded-lg transition-colors ${
            isDark 
              ? 'hover:bg-neutral-800 text-neutral-400 hover:text-white' 
              : 'hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900'
          }`}
          title="Configurações"
        >
          {user?.photoURL ? (
            <div className="w-6 h-6 rounded-full overflow-hidden border border-neutral-700/40">
              <img 
                src={user.photoURL} 
                alt={user.displayName || 'User'} 
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <Settings className="w-4 h-4" />
          )}
        </button>

        <button
          onClick={onNewChat}
          className={`p-2 rounded-lg transition-colors ${
            isDark 
              ? 'hover:bg-neutral-800 text-neutral-400 hover:text-white' 
              : 'hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900'
          }`}
          title="Nova conversa"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
});

AppHeader.displayName = 'AppHeader';
