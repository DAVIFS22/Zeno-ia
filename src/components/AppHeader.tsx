import React from 'react';
import { PanelLeftOpen, Sparkles, Sun, Moon, Settings, Plus, User } from 'lucide-react';
import { UserSettings } from '../types';
import { ZenoLogo } from './ZenoLogo';

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
  const bgMain = isDark ? 'bg-[#0D0D0D]/95 text-white border-[#303030]' : 'bg-white/95 text-neutral-900 border-neutral-200';
  const hoverBtn = isDark ? 'hover:bg-[#242424] hover:text-white' : 'hover:bg-neutral-100 hover:text-neutral-900';
  const textBtn = isDark ? 'text-[#A8A8A8]' : 'text-neutral-500';
  const bgBadge = isDark ? 'bg-[#242424] border-[#303030] text-white hover:bg-[#2F2F2F]' : 'bg-neutral-100 border-neutral-200 text-neutral-800 hover:bg-neutral-200/60';

  return (
    <header className={`h-12 flex items-center justify-between px-3 sm:px-4 border-b flex-shrink-0 z-20 backdrop-blur-md transition-colors duration-150 ${bgMain}`}>
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button 
          className={`p-1.5 ${hoverBtn} rounded-lg transition-colors ${textBtn} ${
            isSidebarCollapsed ? 'block' : 'md:hidden'
          }`}
          onClick={onOpenSidebar}
          title="Abrir barra lateral"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </button>

        {/* Header Title */}
        <div className="flex items-center gap-2">
          <ZenoLogo size={20} variant={logoVariant} theme={theme} />
          <span className={`font-semibold text-xs sm:text-sm tracking-tight ${isDark ? 'text-white' : 'text-neutral-900'}`}>ZENO AI</span>
        </div>
      </div>

      {/* Right Header Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <button
          onClick={() => onOpenSubscriptionModal()}
          className={`px-2.5 py-1 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 border ${bgBadge}`}
        >
          <Sparkles className={`w-3.5 h-3.5 ${isDark ? 'text-white' : 'text-amber-500'}`} />
          <span>{userSettings.plan === 'ZENO Pro' ? 'ZENO Pro' : 'Upgrade Pro'}</span>
        </button>

        <button
          onClick={onToggleTheme}
          className={`p-1.5 rounded-lg transition-colors ${hoverBtn} ${textBtn}`}
          title="Alternar Tema"
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <button
          onClick={onOpenSettings}
          className={`p-0.5 rounded-lg transition-colors ${hoverBtn} ${textBtn} flex items-center`}
          title="Configurações"
        >
          {user ? (
            <div className="w-7 h-7 rounded-lg overflow-hidden border border-neutral-700/30">
              {user.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt={user.displayName || 'User'} 
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className={`w-full h-full flex items-center justify-center ${isDark ? 'bg-neutral-800' : 'bg-neutral-100'}`}>
                  <User className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          ) : (
            <div className="p-1">
              <Settings className="w-4 h-4" />
            </div>
          )}
        </button>

        <button
          onClick={onNewChat}
          className={`p-1.5 rounded-lg transition-colors ${hoverBtn} ${textBtn}`}
          title="Nova conversa"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
});

AppHeader.displayName = 'AppHeader';
