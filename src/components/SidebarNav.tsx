import React from 'react';
import { 
  Plus, MessageSquare, Settings, Search, PanelLeftClose, 
  X, Pin, Edit2, Trash2, Sparkles, User, Lock, Check,
  Image, Folder, Cpu, Sliders
} from 'lucide-react';
import { UserSettings, ChatSession } from '../types';
import { ZenoLogo } from './ZenoLogo';
import { useSubscription } from '../contexts/SubscriptionContext';

interface SidebarSessionItemProps {
  session: ChatSession;
  isActive: boolean;
  isEditing: boolean;
  editingTitle: string;
  isDark: boolean;
  textMain: string;
  textMuted: string;
  hoverItemBg: string;
  bgActiveItem: string;
  onSelectSession: (id: string) => void;
  onTogglePinSession: (id: string, e: React.MouseEvent) => void;
  onStartRenameSession: (session: ChatSession, e: React.MouseEvent) => void;
  onSaveRenameSession: (id: string) => void;
  onSetEditingSessionId: (id: string | null) => void;
  onSetEditingTitle: (title: string) => void;
  onSetDeletingSessionId: (id: string | null) => void;
}

const SidebarSessionItem = React.memo<SidebarSessionItemProps>(({
  session,
  isActive,
  isEditing,
  editingTitle,
  isDark,
  textMain,
  textMuted,
  hoverItemBg,
  bgActiveItem,
  onSelectSession,
  onTogglePinSession,
  onStartRenameSession,
  onSaveRenameSession,
  onSetEditingSessionId,
  onSetEditingTitle,
  onSetDeletingSessionId
}) => {
  return (
    <div
      onClick={() => onSelectSession(session.id)}
      className={`group relative flex items-center gap-2.5 px-3 h-[36px] rounded-lg text-xs transition-colors duration-150 cursor-pointer ${
        isActive
          ? `${bgActiveItem} ${textMain} font-medium`
          : `bg-transparent ${textMuted} hover:${textMain} ${hoverItemBg}`
      }`}
    >
      <MessageSquare className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? textMain : textMuted}`} />
      
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

      {!isEditing && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => onTogglePinSession(session.id, e)}
            className={`p-1 rounded hover:${isDark ? 'bg-neutral-800' : 'bg-neutral-200'} ${session.isPinned ? textMain : textMuted}`}
            title={session.isPinned ? "Desfixar" : "Fixar"}
          >
            <Pin className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => onStartRenameSession(session, e)}
            className={`p-1 rounded hover:${isDark ? 'bg-neutral-800' : 'bg-neutral-200'} ${textMuted}`}
            title="Renomear"
          >
            <Edit2 className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSetDeletingSessionId(session.id);
            }}
            className={`p-1 rounded hover:${isDark ? 'bg-neutral-800' : 'bg-neutral-200'} ${textMuted}`}
            title="Excluir"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
});

SidebarSessionItem.displayName = 'SidebarSessionItem';

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
  onOpenSettings,
  onOpenSubscriptionModal,
  user,
  session,
  onSwitchAccount
}) => {
  const isDark = theme === 'dark';
  const { isPro } = useSubscription();
  const [showAccountSwitcher, setShowAccountSwitcher] = React.useState(false);
  
  const textMain = isDark ? 'text-white' : 'text-neutral-900';
  const textMuted = isDark ? 'text-neutral-400' : 'text-neutral-500';
  const borderMain = isDark ? 'border-neutral-800' : 'border-neutral-200';
  
  const hoverItemBg = isDark ? 'hover:bg-neutral-800/60' : 'hover:bg-neutral-100';
  const bgActiveItem = isDark ? 'bg-neutral-800/90' : 'bg-neutral-100';

  return (
    <aside className={`fixed md:relative top-0 left-0 h-full flex-col z-40 flex-shrink-0 transform transition-all duration-200 ease-out border-r ${
      isDark
        ? 'bg-[#0f0f11] border-neutral-800/80 text-white'
        : 'bg-[#fafafa] border-neutral-200/80 text-neutral-900'
    } ${
      isSidebarOpen ? 'translate-x-0 w-[260px]' : '-translate-x-full md:translate-x-0'
    } ${
      isSidebarCollapsed ? 'md:w-0 md:opacity-0 md:overflow-hidden md:border-r-0' : 'md:w-[260px] md:opacity-100'
    } flex`}>
      
      {/* Top Header & Navigation */}
      <div className="p-3 space-y-2 border-b border-neutral-800/20">
        <div className="flex items-center justify-between px-1 py-1">
          <div className="flex items-center gap-2 cursor-pointer" onClick={onNewChat}>
            <ZenoLogo size={20} variant={logoVariant} theme={theme} />
            <span className={`font-semibold text-sm tracking-tight ${textMain}`}>ZENO</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={onToggleSearchVisible}
              className={`p-1.5 rounded-md transition-colors ${
                isSearchVisible 
                  ? `${bgActiveItem} ${textMain}` 
                  : `${hoverItemBg} ${textMuted} hover:${textMain}`
              }`}
              title="Pesquisar histórico"
            >
              <Search className="w-4 h-4" />
            </button>

            <button
              onClick={onCloseSidebar}
              className={`p-1.5 rounded-md ${hoverItemBg} ${textMuted} hover:${textMain} transition-colors md:flex hidden`}
              title="Fechar barra lateral"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Novo Chat Button */}
        <button 
          onClick={onNewChat}
          className={`flex items-center gap-2.5 px-3 h-[38px] rounded-xl border ${borderMain} transition-all duration-150 w-full text-left text-xs font-medium ${
            isDark ? 'bg-neutral-900 hover:bg-neutral-800 text-white' : 'bg-white hover:bg-neutral-50 text-neutral-900'
          }`}
        >
          <Plus className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1 truncate">Novo Chat</span>
        </button>

        {/* Streamlined Menu Options */}
        <div className="space-y-0.5 pt-1">
          <button 
            onClick={onOpenPlugins}
            className={`flex items-center gap-2.5 px-3 h-[34px] rounded-lg ${hoverItemBg} transition-colors w-full text-left text-xs font-normal ${textMuted} hover:${textMain}`}
          >
            <Cpu className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1 truncate">Modelos</span>
          </button>

          <button 
            onClick={onOpenImageLibrary}
            className={`flex items-center gap-2.5 px-3 h-[34px] rounded-lg ${hoverItemBg} transition-colors w-full text-left text-xs font-normal ${textMuted} hover:${textMain}`}
          >
            <Image className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1 truncate">Imagens</span>
          </button>

          <button 
            onClick={onOpenProjects}
            className={`flex items-center gap-2.5 px-3 h-[34px] rounded-lg ${hoverItemBg} transition-colors w-full text-left text-xs font-normal ${textMuted} hover:${textMain}`}
          >
            <Folder className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1 truncate">Arquivos</span>
          </button>

          <button 
            onClick={onOpenSettings}
            className={`flex items-center gap-2.5 px-3 h-[34px] rounded-lg ${hoverItemBg} transition-colors w-full text-left text-xs font-normal ${textMuted} hover:${textMain}`}
          >
            <Sliders className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1 truncate">Configurações</span>
          </button>
        </div>

        {/* Search input if active */}
        {isSearchVisible && (
          <div className={`flex items-center gap-2 px-3 h-[34px] rounded-lg text-xs ${bgActiveItem} border ${borderMain} ${textMain} mt-1`}>
            <Search className="w-3.5 h-3.5 flex-shrink-0 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder="Buscar no histórico..."
              className="bg-transparent border-none focus:outline-none w-full text-xs placeholder-neutral-500"
              autoFocus
            />
            {searchQuery && (
              <button onClick={() => onSearchQueryChange('')} className="p-0.5 text-neutral-400 hover:text-white">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Sessions / History */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2 scrollbar-custom">
        <div className="px-2 pt-1 pb-0.5 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
          Histórico
        </div>
        {groupedSessions.length === 0 ? (
          <div className={`text-center py-4 px-2 text-xs ${textMuted}`}>
            Nenhuma conversa
          </div>
        ) : (
          groupedSessions.map(group => (
            <div key={group.label || 'all'} className="space-y-0.5">
              {group.label && (
                <div className={`text-[10px] font-medium ${textMuted} px-2.5 py-1`}>
                  {group.label}
                </div>
              )}
              {group.sessions.map(session => (
                <SidebarSessionItem
                  key={session.id}
                  session={session}
                  isActive={session.id === currentSessionId}
                  isEditing={editingSessionId === session.id}
                  editingTitle={editingSessionId === session.id ? editingTitle : ''}
                  isDark={isDark}
                  textMain={textMain}
                  textMuted={textMuted}
                  hoverItemBg={hoverItemBg}
                  bgActiveItem={bgActiveItem}
                  onSelectSession={onSelectSession}
                  onTogglePinSession={onTogglePinSession}
                  onStartRenameSession={onStartRenameSession}
                  onSaveRenameSession={onSaveRenameSession}
                  onSetEditingSessionId={onSetEditingSessionId}
                  onSetEditingTitle={onSetEditingTitle}
                  onSetDeletingSessionId={onSetDeletingSessionId}
                />
              ))}
            </div>
          ))
        )}
      </div>

      {/* Minimal Footer */}
      <div className={`p-3 border-t ${borderMain} space-y-1.5`}>
        <button 
          onClick={() => onOpenSubscriptionModal()} 
          className={`flex items-center justify-between px-3 h-[36px] rounded-lg ${hoverItemBg} transition-colors w-full text-left text-xs ${textMain}`}
        >
          <div className="flex items-center gap-2">
            <Sparkles className={`w-3.5 h-3.5 ${isDark ? 'text-amber-400' : 'text-amber-500'}`} />
            <span>ZENO Pro</span>
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${isDark ? 'bg-neutral-800 text-neutral-300' : 'bg-neutral-200 text-neutral-700'}`}>
            {isPro ? 'Gerenciar Assinatura' : 'Upgrade Pro'}
          </span>
        </button>

        {/* User Card */}
        <div className="relative pt-1">
          <div 
            onClick={() => {
              if (session?.accounts?.length > 1) {
                setShowAccountSwitcher(!showAccountSwitcher);
              } else {
                onOpenSettings();
              }
            }}
            className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg ${hoverItemBg} transition-all cursor-pointer group`}
          >
            {user ? (
              <div className="flex items-center gap-2.5 w-full min-w-0">
                {user.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt={user.displayName || 'User'} 
                    referrerPolicy="no-referrer"
                    className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-neutral-800' : 'bg-neutral-200'}`}>
                    <User className="w-3.5 h-3.5 text-neutral-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium truncate ${textMain}`}>
                    {user.displayName || 'Usuário ZENO'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 w-full">
                <Lock className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                <span className={`text-xs font-medium ${textMuted}`}>
                  Entrar com Google
                </span>
              </div>
            )}
          </div>

          {/* Account switcher if multi accounts exist */}
          {showAccountSwitcher && session?.accounts?.length > 1 && (
            <div className={`absolute bottom-full left-0 w-full mb-2 p-2 rounded-xl border shadow-xl z-50 animate-fadeIn ${
              isDark ? 'bg-[#1e1e22] border-neutral-800' : 'bg-white border-neutral-200'
            }`}>
              <p className="text-[10px] font-bold text-neutral-400 px-2 py-1 uppercase">Mudar Conta</p>
              <div className="space-y-1 max-h-[180px] overflow-y-auto">
                {session.accounts.map((acc: any) => (
                  <button
                    key={acc.uid}
                    onClick={() => {
                      onSwitchAccount?.(acc.uid);
                      setShowAccountSwitcher(false);
                    }}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg w-full text-left transition-all text-xs ${
                      acc.uid === session.activeUid
                        ? (isDark ? 'bg-neutral-800 text-white' : 'bg-neutral-100 text-neutral-900')
                        : `hover:${isDark ? 'bg-neutral-800/50' : 'bg-neutral-50'}`
                    }`}
                  >
                    <img src={acc.photoURL} className="w-5 h-5 rounded-full object-cover" referrerPolicy="no-referrer" />
                    <span className="flex-1 truncate">{acc.displayName}</span>
                    {acc.uid === session.activeUid && <Check className="w-3 h-3 text-blue-500" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
});

SidebarNav.displayName = 'SidebarNav';
