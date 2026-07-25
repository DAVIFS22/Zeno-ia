import React from 'react';
import { 
  Plus, MessageSquare, Settings, Search, PanelLeftClose, 
  X, Pin, Edit2, Trash2, Sparkles, User, Lock
} from 'lucide-react';
import { UserSettings, ChatSession } from '../types';
import { ZenoLogo } from './ZenoLogo';

interface SidebarNavProps {
  isSidebarOpen: boolean;
  isSidebarCollapsed: boolean;
  theme: 'dark' | 'light';
  logoVariant: 'monochrome' | 'gradient';
  userSettings: UserSettings;
  groupedSessions: { label?: string; sessions: ChatSession[] }[];
  currentSessionId: string | null;
  editingSessionId: string | null;
  editingTitle: string;
  searchQuery: string;
  isSearchVisible: boolean;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
  onTogglePinSession: (id: string, e: React.MouseEvent) => void;
  onStartRenameSession: (session: ChatSession, e: React.MouseEvent) => void;
  onSaveRenameSession: (id: string) => void;
  onSetEditingSessionId: (id: string | null) => void;
  onSetEditingTitle: (title: string) => void;
  onSetDeletingSessionId: (id: string | null) => void;
  onToggleSearchVisible: () => void;
  onSearchQueryChange: (query: string) => void;
  onCloseSidebar: () => void;
  onOpenImageLibrary: () => void;
  onOpenProjects: () => void;
  onOpenPlugins: () => void;
  onOpenMore: () => void;
  onOpenSettings: () => void;
  onOpenSubscriptionModal: (reason?: string) => void;
  user?: any;
  session?: any;
  onSwitchAccount?: (uid: string) => void;
}

export const SidebarNav: React.FC<SidebarNavProps> = React.memo(({
  isSidebarOpen,
  isSidebarCollapsed,
  theme,
  logoVariant,
  userSettings,
  groupedSessions,
  currentSessionId,
  editingSessionId,
  editingTitle,
  searchQuery,
  isSearchVisible,
  onNewChat,
  onSelectSession,
  onTogglePinSession,
  onStartRenameSession,
  onSaveRenameSession,
  onSetEditingSessionId,
  onSetEditingTitle,
  onSetDeletingSessionId,
  onToggleSearchVisible,
  onSearchQueryChange,
  onCloseSidebar,
  onOpenImageLibrary,
  onOpenProjects,
  onOpenPlugins,
  onOpenMore,
  onOpenSettings,
  onOpenSubscriptionModal,
  user,
  session,
  onSwitchAccount
}) => {
  const isDark = theme === 'dark';
  const [showAccountSwitcher, setShowAccountSwitcher] = React.useState(false);
  
  const bgMain = isDark ? 'bg-[#171717]' : 'bg-[#F7F7F8]';
  const borderMain = isDark ? 'border-[#303030]' : 'border-neutral-200';
  const textMain = isDark ? 'text-white' : 'text-neutral-900';
  const textMuted = isDark ? 'text-[#A8A8A8]' : 'text-neutral-500';
  
  const bgButton = isDark ? 'bg-[#242424]' : 'bg-neutral-200/50';
  const borderButton = isDark ? 'border-[#303030]' : 'border-neutral-200';
  const hoverButtonBg = isDark ? 'hover:bg-[#2F2F2F]' : 'hover:bg-neutral-200';
  
  const hoverItemBg = isDark ? 'hover:bg-[#242424]' : 'hover:bg-neutral-200/50';
  const bgActiveItem = isDark ? 'bg-[#2F2F2F]' : 'bg-neutral-200/80';

  return (
    <aside className={`fixed md:relative top-0 left-0 h-full flex-col z-40 flex-shrink-0 transform transition-all duration-150 ease-out border-r ${
      isDark
        ? 'bg-[#171717] border-[#303030] text-white'
        : 'bg-[#F7F7F8] border-neutral-200 text-neutral-900'
    } ${
      isSidebarOpen ? 'translate-x-0 w-[280px]' : '-translate-x-full md:translate-x-0'
    } ${
      isSidebarCollapsed ? 'md:w-0 md:opacity-0 md:overflow-hidden md:border-r-0' : 'md:w-[280px] md:opacity-100'
    } flex`}>
      
      {/* Top Header & Nova Conversa */}
      <div className={`p-3.5 space-y-2.5 border-b ${isDark ? 'border-[#303030]/60' : 'border-neutral-200'}`}>
        {/* Top Bar: Logo + Circular Search + Settings + Close */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={onNewChat}>
            <ZenoLogo size={22} variant={logoVariant} theme={theme} />
            <span className={`font-semibold text-sm tracking-tight ${textMain}`}>ZENO</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={onToggleSearchVisible}
              className={`p-2 rounded-full transition-colors ${
                isSearchVisible 
                  ? `${bgActiveItem} ${textMain}` 
                  : `${hoverItemBg} ${textMuted} hover:${textMain}`
              }`}
              title="Pesquisar conversas"
            >
              <Search className="w-4 h-4" />
            </button>

            <button
              onClick={onOpenSettings}
              className={`p-2 rounded-full ${hoverItemBg} ${textMuted} hover:${textMain} transition-colors`}
              title="Configurações"
            >
              <Settings className="w-4 h-4" />
            </button>

            <button
              onClick={onCloseSidebar}
              className={`p-2 rounded-full ${hoverItemBg} ${textMuted} hover:${textMain} transition-colors md:flex hidden`}
              title="Fechar barra lateral"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Botão Nova Conversa */}
        <button 
          onClick={onNewChat}
          className={`flex items-center gap-3 px-3.5 h-[42px] rounded-xl bg-transparent ${hoverItemBg} ${textMain} border ${borderMain} transition-colors duration-150 w-full text-left text-sm font-medium`}
        >
          <Plus className={`w-4 h-4 ${textMain} flex-shrink-0`} />
          <span className={`flex-1 truncate font-medium ${textMain}`}>Nova conversa</span>
          <span className={`text-[10px] ${textMuted} font-mono`}>⌘K</span>
        </button>

        {/* Simple Items List */}
        <div className="space-y-0.5 pt-1">
          <button 
            onClick={onOpenImageLibrary}
            className={`flex items-center gap-3 px-3 h-[38px] rounded-xl ${hoverItemBg} transition-colors duration-150 w-full text-left text-xs font-normal ${textMain}`}
          >
            <span className="text-base leading-none">🖼️</span>
            <span className="flex-1 truncate">Biblioteca</span>
          </button>

          <button 
            onClick={onOpenProjects}
            className={`flex items-center gap-3 px-3 h-[38px] rounded-xl ${hoverItemBg} transition-colors duration-150 w-full text-left text-xs font-normal ${textMain}`}
          >
            <span className="text-base leading-none">📁</span>
            <span className="flex-1 truncate">Projetos</span>
          </button>

          <button 
            onClick={onOpenPlugins}
            className={`flex items-center gap-3 px-3 h-[38px] rounded-xl ${hoverItemBg} transition-colors duration-150 w-full text-left text-xs font-normal ${textMain}`}
          >
            <span className="text-base leading-none">🔌</span>
            <span className="flex-1 truncate">Plugins</span>
          </button>

          <button 
            onClick={onOpenMore}
            className={`flex items-center gap-3 px-3 h-[38px] rounded-xl ${hoverItemBg} transition-colors duration-150 w-full text-left text-xs font-normal ${textMuted} hover:${textMain}`}
          >
            <span className="text-base leading-none">⋯</span>
            <span className="flex-1 truncate">Mais</span>
          </button>
        </div>

        {/* Expandable Simple Search Bar */}
        {isSearchVisible && (
          <div className={`flex items-center gap-2 px-3 h-[38px] rounded-xl text-sm ${bgActiveItem} border ${borderMain} ${textMain} animate-fadeIn`}>
            <Search className={`w-4 h-4 ${textMain} flex-shrink-0`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder="Pesquisar histórico..."
              className={`bg-transparent border-none focus:outline-none w-full text-xs ${textMain} placeholder-neutral-500`}
              autoFocus
            />
            {searchQuery && (
              <button onClick={() => onSearchQueryChange('')} className={`p-0.5 ${textMuted} hover:${textMain}`}>
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Sessions Group List */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3 scrollbar-custom">
        {groupedSessions.length === 0 ? (
          <div className={`text-center py-6 px-3 text-xs ${textMuted}`}>
            Nenhuma conversa encontrada.
          </div>
        ) : (
          groupedSessions.map(group => (
            <div key={group.label || 'all'} className="space-y-0.5">
              {group.label && (
                <div className={`text-[11px] font-medium ${textMuted} px-3 py-1`}>
                  {group.label}
                </div>
              )}
              {group.sessions.map(session => {
                const isActive = session.id === currentSessionId;
                const isEditing = editingSessionId === session.id;

                return (
                  <div
                    key={session.id}
                    onClick={() => onSelectSession(session.id)}
                    className={`group relative flex items-center gap-2.5 px-3 h-[38px] rounded-xl text-xs transition-colors duration-150 cursor-pointer ${
                      isActive
                        ? `${bgActiveItem} ${textMain} font-medium`
                        : `bg-transparent ${textMuted} hover:${textMain} ${hoverItemBg}`
                    }`}
                  >
                    <MessageSquare className={`w-4 h-4 flex-shrink-0 ${isActive ? textMain : `${textMuted} group-hover:${textMain}`}`} />
                    
                    {isEditing ? (
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => onSetEditingTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') onSaveRenameSession(session.id);
                          if (e.key === 'Escape') onSetEditingSessionId(null);
                        }}
                        onBlur={() => onSaveRenameSession(session.id)}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        className={`w-full bg-transparent border-b ${textMuted} focus:outline-none text-xs ${textMain} px-1`}
                      />
                    ) : (
                      <span className="truncate flex-1 font-normal">
                        {session.title}
                      </span>
                    )}

                    {/* Quick Action Icons */}
                    {!isEditing && (
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => onTogglePinSession(session.id, e)}
                          className={`p-1 rounded-md hover:${isDark ? 'bg-[#303030]' : 'bg-neutral-200'} ${session.isPinned ? textMain : `${textMuted} hover:${textMain}`}`}
                          title={session.isPinned ? "Desfixar" : "Fixar"}
                        >
                          <Pin className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => onStartRenameSession(session, e)}
                          className={`p-1 rounded-md hover:${isDark ? 'bg-[#303030]' : 'bg-neutral-200'} ${textMuted} hover:${textMain}`}
                          title="Renomear"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSetDeletingSessionId(session.id);
                          }}
                          className={`p-1 rounded-md hover:${isDark ? 'bg-[#303030]' : 'bg-neutral-200'} ${textMuted} hover:${textMain}`}
                          title="Excluir"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Sidebar Footer */}
      <div className={`p-3 border-t ${borderMain} ${bgMain} space-y-1`}>
        <button 
          onClick={() => onOpenSubscriptionModal()} 
          className={`flex items-center justify-between px-3 h-[38px] rounded-xl ${hoverItemBg} transition-colors duration-150 w-full text-left text-xs font-normal ${textMain}`}
        >
          <div className="flex items-center gap-2.5">
            <Sparkles className={`w-4 h-4 ${isDark ? 'text-white' : 'text-amber-500'}`} />
            <span>Atualizações / Pro</span>
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded ${bgButton} ${textMuted} border ${borderMain}`}>
            {userSettings.plan === 'ZENO Pro' ? 'Ativo' : 'Upgrade'}
          </span>
        </button>

        <button 
          onClick={onOpenSettings} 
          className={`flex items-center gap-2.5 px-3 h-[38px] rounded-xl ${hoverItemBg} transition-colors duration-150 w-full text-left text-xs font-normal ${textMuted} hover:${textMain}`}
        >
          <Settings className="w-4 h-4" />
          <span>Configurações</span>
        </button>

        <div className="relative">
          <div 
            onClick={() => {
              if (session?.accounts?.length > 1) {
                setShowAccountSwitcher(!showAccountSwitcher);
              } else {
                onOpenSettings();
              }
            }}
            className={`flex items-center gap-2.5 px-2 py-1.5 rounded-xl ${hoverItemBg} transition-all duration-200 cursor-pointer group mt-2 border ${isDark ? 'border-transparent' : 'border-neutral-100/50'}`}
          >
            {user ? (
              <div className="flex items-center gap-2.5 w-full overflow-hidden">
                {user.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt={user.displayName || 'User'} 
                    referrerPolicy="no-referrer"
                    className="w-7 h-7 rounded-lg object-cover border border-neutral-700/50"
                  />
                ) : (
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center border ${isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-neutral-100 border-neutral-200'}`}>
                    <User className={`w-4 h-4 ${textMuted}`} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-[11px] font-bold truncate ${textMain}`}>
                    {user.displayName || 'Usuário ZENO'}
                  </p>
                  <p className={`text-[10px] truncate ${textMuted}`}>
                    {user.email}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 w-full">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center border ${isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-neutral-100 border-neutral-200'}`}>
                  <Lock className={`w-4 h-4 ${textMuted}`} />
                </div>
                <span className={`text-[11px] font-bold ${textMuted} group-hover:${textMain} transition-colors`}>
                  Entrar com Google
                </span>
              </div>
            )}
          </div>

          {/* Account Switcher Popover */}
          {showAccountSwitcher && session?.accounts?.length > 1 && (
            <div className={`absolute bottom-full left-0 w-full mb-2 p-2 rounded-2xl border shadow-2xl z-50 animate-fadeIn ${
              isDark ? 'bg-[#1e1e24] border-neutral-800' : 'bg-white border-neutral-100'
            }`}>
              <p className="text-[10px] font-bold text-neutral-500 px-2 py-1 uppercase tracking-wider">Mudar Conta</p>
              <div className="space-y-1 max-h-[200px] overflow-y-auto scrollbar-thin">
                {session.accounts.map((acc: any) => (
                  <button
                    key={acc.uid}
                    onClick={() => {
                      onSwitchAccount?.(acc.uid);
                      setShowAccountSwitcher(false);
                    }}
                    className={`flex items-center gap-2.5 px-2 py-2 rounded-xl w-full text-left transition-all ${
                      acc.uid === session.activeUid
                        ? (isDark ? 'bg-white/5' : 'bg-neutral-100')
                        : `hover:${isDark ? 'bg-white/5' : 'bg-neutral-50'}`
                    }`}
                  >
                    <img src={acc.photoURL} className="w-6 h-6 rounded-lg object-cover" referrerPolicy="no-referrer" />
                    <div className="flex-1 min-w-0">
                      <p className={`text-[10px] font-bold truncate ${textMain}`}>{acc.displayName}</p>
                      <p className="text-[9px] text-neutral-500 truncate">{acc.email}</p>
                    </div>
                    {acc.uid === session.activeUid && (
                      <Check className="w-3 h-3 text-blue-500" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={`flex items-center justify-end px-3 pt-1 text-[10px] ${textMuted} opacity-40 hover:opacity-100 transition-opacity`}>
          <span>v3.6.0</span>
        </div>
      </div>
    </aside>
  );
});

SidebarNav.displayName = 'SidebarNav';
