import React from 'react';
import { PanelLeftOpen, Sparkles, Sun, Moon, Settings, Plus, User, Shield } from 'lucide-react';
import { UserSettings } from '../types';
import { ZenoLogo } from './ZenoLogo';
import { useSubscription } from '../contexts/SubscriptionContext';
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
    <header className={`h-13 flex items-center justify-between px-4 sm:px-8 border-b flex-shrink-0 z-20 backdrop-blur-md transition-colors duration-200 ${
      isDark ? 'bg-[#0f0f11]/90 text-white border-[#2C2C2E]/80' : 'bg-white/90 text-neutral-900 border-neutral-200/80'
    }`}>
      <div className="flex items-center gap-3 min-w-0">
        <button 
          className={`p-1.5 rounded-lg transition-all active:scale-95 cursor-pointer ${
            isDark 
              ? 'hover:bg-[#232326] text-neutral-400 hover:text-white' 
              : 'hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900'
          } ${isSidebarCollapsed ? 'block' : 'md:hidden'}`}
          onClick={onOpenSidebar}
          title="Abrir barra lateral"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </button>

        {/* Minimal Header Brand Logo */}
        <div className="flex items-center gap-2 cursor-pointer active:scale-95 transition-all" onClick={onNewChat}>
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
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 active:scale-95 cursor-pointer flex items-center gap-1.5 border ${
              isDark 
                ? 'bg-[#1C1C1E] hover:bg-[#232326] text-neutral-200 border-[#2C2C2E] hover:border-[#2C2C2E]' 
                : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-800 border-neutral-200 hover:border-neutral-300'
            }`}
          >
            <Sparkles className={`w-3.5 h-3.5 ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`} />
            <span>Upgrade Pro</span>
          </button>
        )}

        <button
          onClick={onToggleTheme}
          className={`p-2 rounded-lg transition-all active:scale-95 cursor-pointer ${
            isDark 
              ? 'hover:bg-[#232326] text-neutral-400 hover:text-white' 
              : 'hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900'
          }`}
          title="Alternar Tema"
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <button
          onClick={onOpenSettings}
          className={`p-1 rounded-lg transition-all active:scale-95 cursor-pointer relative ${
            isDark 
              ? 'hover:bg-[#232326] text-neutral-400 hover:text-white' 
              : 'hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900'
          }`}
          title="Configurações (Admin)"
        >
          {user?.photoURL ? (
            <div className="w-6 h-6 rounded-full overflow-hidden border border-sky-500/40 relative">
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
          {isAdminUser(user?.email) && (
            <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[8px] shadow" title="Admin">
              <Shield className="w-2.5 h-2.5 text-white" />
            </span>
          )}
        </button>

        <button
          onClick={onNewChat}
          className={`p-2 rounded-lg transition-all active:scale-95 cursor-pointer ${
            isDark 
              ? 'hover:bg-[#232326] text-neutral-400 hover:text-white' 
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
