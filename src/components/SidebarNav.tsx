import React from 'react';
import { List } from 'react-window';
import { 
  Plus, MessageSquare, Settings, Search, PanelLeftClose, 
  X, Pin, Edit2, Trash2, Sparkles, User, Lock, Check,
  Image, Folder, Cpu, Sliders, Shield, ChevronDown
} from 'lucide-react';
import { UserSettings, ChatSession } from '../types';
import { ZenoLogo } from './ZenoLogo';
import { useSubscription } from '../contexts/SubscriptionContext';
import { isAdminUser } from '../config/admin';
import { useTranslation } from '../i18n';
import { useVersion } from '../contexts/VersionContext';
import { GoogleLogo } from './GoogleLogo';

type FlatSessionListItem =
  | { type: 'header'; id: string; label: string }
  | { type: 'session'; id: string; session: ChatSession };

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
            className={`p-1 rounded hover:${isDark ? 'bg-[#232326]' : 'bg-neutral-200'} ${session.isPinned ? textMain : textMuted}`}
            title={session.isPinned ? "Desfixar" : "Fixar"}
          >
            <Pin className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => onStartRenameSession(session, e)}
            className={`p-1 rounded hover:${isDark ? 'bg-[#232326]' : 'bg-neutral-200'} ${textMuted}`}
            title="Renomear"
          >
            <Edit2 className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSetDeletingSessionId(session.id);
            }}
            className={`p-1 rounded hover:${isDark ? 'bg-[#232326]' : 'bg-neutral-200'} ${textMuted}`}
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
  onOpenVersionNews?: () => void;
  onOpenAuthModal: () => void;
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
  onOpenVersionNews,
  onOpenAuthModal,
  user,
  session,
  onSwitchAccount
}) => {
  const { t } = useTranslation();
  const { currentVersion } = useVersion();
  const isDark = theme === 'dark';
  const { isPro } = useSubscription();
  const [showAccountSwitcher, setShowAccountSwitcher] = React.useState(false);
  
  const textMain = isDark ? 'text-white' : 'text-neutral-900';
  const textMuted = isDark ? 'text-neutral-400' : 'text-neutral-500';
  const borderMain = isDark ? 'border-[#2C2C2E]' : 'border-neutral-200';
  
  const hoverItemBg = isDark ? 'hover:bg-[#232326]/60' : 'hover:bg-neutral-100';
  const bgActiveItem = isDark ? 'bg-[#232326]/90' : 'bg-neutral-100';

  // Virtualization setup for long chat session histories
  const flatItems = React.useMemo(() => {
    const items: FlatSessionListItem[] = [];
    groupedSessions.forEach((group, gIdx) => {
      if (group.label) {
        items.push({
          type: 'header',
          id: `header-${gIdx}-${group.label}`,
          label: group.label
        });
      }
      group.sessions.forEach((s) => {
        items.push({
          type: 'session',
          id: s.id,
          session: s
        });
      });
    });
    return items;
  }, [groupedSessions]);

  const listContainerRef = React.useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = React.useState(300);

  React.useLayoutEffect(() => {
    if (!listContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.height > 0) {
          setContainerHeight(entry.contentRect.height);
        }
      }
    });
    observer.observe(listContainerRef.current);
    return () => observer.disconnect();
  }, [listContainerRef]);

  const getItemSize = React.useCallback((index: number) => {
    const item = flatItems[index];
    if (!item) return 38;
    return item.type === 'header' ? 28 : 38;
  }, [flatItems]);

  const Row = React.useCallback(({ index, style, items }: { index: number; style: React.CSSProperties; items: FlatSessionListItem[] }) => {
    const item = items[index];
    if (!item) return null;

    if (item.type === 'header') {
      return (
        <div style={style} className={`text-[10px] font-medium ${textMuted} px-2.5 flex items-center`}>
          {item.label}
        </div>
      );
    }

    return (
      <div style={style}>
        <SidebarSessionItem
          session={item.session}
          isActive={item.session.id === currentSessionId}
          isEditing={editingSessionId === item.session.id}
          editingTitle={editingSessionId === item.session.id ? editingTitle : ''}
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
      </div>
    );
  }, [
    currentSessionId, editingSessionId, editingTitle, isDark, textMain, textMuted, 
    hoverItemBg, bgActiveItem, onSelectSession, onTogglePinSession, onStartRenameSession, 
    onSaveRenameSession, onSetEditingSessionId, onSetEditingTitle, onSetDeletingSessionId
  ]);

  return (
    <aside className={`fixed md:relative top-0 left-0 h-full flex-col z-40 flex-shrink-0 transform transition-all duration-200 ease-out border-r gpu-accelerated contain-render ${
      isDark
        ? 'bg-[#0f0f11] border-[#2C2C2E]/80 text-white'
        : 'bg-[#fafafa] border-neutral-200/80 text-neutral-900'
    } ${
      isSidebarOpen ? 'translate-x-0 w-[260px]' : '-translate-x-full md:translate-x-0'
    } ${
      isSidebarCollapsed ? 'md:w-0 md:opacity-0 md:overflow-hidden md:border-r-0' : 'md:w-[260px] md:opacity-100'
    } flex`}>
      
      {/* Top Header & Navigation */}
      <div className="p-3 space-y-2 border-b border-[#2C2C2E]/20 flex-shrink-0">
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
          className="flex items-center gap-2.5 px-4 h-[42px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium transition-all duration-150 w-full text-left text-xs sm:text-sm shadow-md shadow-blue-600/20 group cursor-pointer"
        >
          <MessageSquare className="w-4 h-4 flex-shrink-0 text-white" />
          <span className="flex-1 truncate">Novo chat</span>
          <Plus className="w-3.5 h-3.5 flex-shrink-0 text-blue-200 group-hover:text-white" />
        </button>

        {/* Streamlined Menu Options */}
        <div className="space-y-0.5 pt-1">
          <button 
            onClick={onNewChat}
            className={`flex items-center gap-2.5 px-3 h-[34px] rounded-lg ${hoverItemBg} transition-colors w-full text-left text-xs font-normal ${textMuted} hover:${textMain}`}
          >
            <MessageSquare className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1 truncate">Chat</span>
          </button>

          <button 
            onClick={onToggleSearchVisible}
            className={`flex items-center gap-2.5 px-3 h-[34px] rounded-lg ${hoverItemBg} transition-colors w-full text-left text-xs font-normal ${textMuted} hover:${textMain}`}
          >
            <Search className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1 truncate">Histórico</span>
          </button>

          <button 
            onClick={onOpenImageLibrary}
            className={`flex items-center gap-2.5 px-3 h-[34px] rounded-lg ${hoverItemBg} transition-colors w-full text-left text-xs font-normal ${textMuted} hover:${textMain}`}
          >
            <Image className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1 truncate">Histórico de Imagens</span>
          </button>

          <button 
            onClick={onOpenSettings}
            className={`flex items-center gap-2.5 px-3 h-[34px] rounded-lg ${hoverItemBg} transition-colors w-full text-left text-xs font-normal ${textMuted} hover:${textMain}`}
          >
            <Settings className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1 truncate">{t.settings.title}</span>
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

      {/* Sessions / History - Virtualized with react-window */}
      <div className="flex-1 flex flex-col min-h-0 px-2 py-2">
        <div className="px-2 pt-1 pb-1 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider flex-shrink-0">
          {t.sidebar.history}
        </div>
        <div ref={listContainerRef} className="flex-1 w-full min-h-0">
          {flatItems.length === 0 ? (
            <div className={`flex flex-col items-center justify-center text-center py-8 px-2 text-xs ${textMuted} gap-3`}>
              <span>{t.sidebar.noHistory}</span>
              {(!user || user.isAnonymous) && (
                <button
                  onClick={onOpenAuthModal}
                  className={`px-4 py-1.5 rounded-lg border font-medium transition-all ${
                    isDark
                      ? 'bg-[#1C1C1E] border-[#2C2C2E] hover:bg-[#232326] text-neutral-200'
                      : 'bg-white border-neutral-200 hover:bg-neutral-50 text-neutral-700'
                  }`}
                >
                  Faça login para salvar
                </button>
              )}
            </div>
          ) : (
            <List<{ items: FlatSessionListItem[] }>
              rowCount={flatItems.length}
              rowHeight={getItemSize}
              rowComponent={Row}
              rowProps={{ items: flatItems }}
              style={{ height: containerHeight, width: '100%' }}
              className="scrollbar-custom"
            />
          )}
        </div>
      </div>

      {/* Footer Banner & User Menu */}
      <div className={`p-3 border-t ${borderMain} space-y-2`}>
        {/* ZENO Pro Upgrade Card */}
        {!isPro && (
          <div className={`p-3 rounded-xl border ${
            isDark ? 'bg-[#151518] border-[#2C2C2E]' : 'bg-white border-neutral-200 shadow-2xs'
          }`}>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-blue-500" />
              <span className={`text-xs font-semibold ${textMain}`}>ZENO Pro</span>
            </div>
            <p className="text-[11px] text-neutral-400 leading-relaxed mb-2.5">
              Mais capacidade, respostas mais rápidas e recursos avançados.
            </p>
            <button
              onClick={() => onOpenSubscriptionModal()}
              className="w-full py-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors shadow-xs shadow-blue-600/20 cursor-pointer"
            >
              Ver planos
            </button>
          </div>
        )}

        {/* Version Badge */}
        <div className="flex items-center justify-between px-1 pt-1 pb-1">
          <button
            onClick={onOpenVersionNews}
            className={`text-[10px] font-mono px-2 py-1 rounded-lg border transition-colors flex items-center gap-1.5 w-full justify-center cursor-pointer ${
              isDark 
                ? 'bg-[#151518] text-neutral-400 border-[#2c2c2e] hover:text-white hover:border-indigo-500/50' 
                : 'bg-neutral-50 text-neutral-600 border-neutral-200 hover:text-neutral-900 hover:border-indigo-500/50'
            }`}
            title="Ver novidades da versão"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
            <span>Zeno IA v{currentVersion} (Semantic)</span>
          </button>
        </div>

        {/* User Card */}
        <div className="relative pt-0.5">
          <div 
            onClick={() => {
              if (!user || user.isAnonymous) {
                onOpenAuthModal();
              } else if (session?.accounts?.length > 1) {
                setShowAccountSwitcher(!showAccountSwitcher);
              } else {
                onOpenSettings();
              }
            }}
            className={`flex items-center justify-between p-2 rounded-xl ${hoverItemBg} transition-all cursor-pointer group`}
          >
            {user && !user.isAnonymous ? (
              <div className="flex items-center justify-between w-full min-w-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  {user.photoURL ? (
                    <img 
                      src={user.photoURL} 
                      alt={user.displayName || 'User'} 
                      referrerPolicy="no-referrer"
                      className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-[#232326]' : 'bg-neutral-200'}`}>
                      <User className="w-4 h-4 text-neutral-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold truncate ${textMain}`}>
                      {user.displayName?.split(' ')[0] || 'Usuário ZENO'}
                    </p>
                    <p className="text-[10px] text-neutral-400 truncate">
                      {isPro ? 'Plano Pro' : 'Conta gratuita'}
                    </p>
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-neutral-400 group-hover:text-white transition-transform flex-shrink-0 ml-1" />
              </div>
            ) : (
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-[#232326]' : 'bg-neutral-200'}`}>
                    <User className="w-4 h-4 text-neutral-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold truncate ${textMain}`}>
                      Visitante
                    </p>
                    <p className="text-[10px] text-blue-500 font-medium truncate">
                      Faça login
                    </p>
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
              </div>
            )}
          </div>

          {/* Account switcher if multi accounts exist */}
          {showAccountSwitcher && session?.accounts?.length > 1 && (
            <div className={`absolute bottom-full left-0 w-full mb-2 p-2 rounded-xl border shadow-xl z-50 animate-fadeIn ${
              isDark ? 'bg-[#1e1e22] border-[#2C2C2E]' : 'bg-white border-neutral-200'
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
                        ? (isDark ? 'bg-[#232326] text-white' : 'bg-neutral-100 text-neutral-900')
                        : `hover:${isDark ? 'bg-[#232326]/50' : 'bg-neutral-50'}`
                    }`}
                  >
                    <img src={acc.photoURL} className="w-5 h-5 rounded-full object-cover" referrerPolicy="no-referrer" />
                    <span className="flex-1 truncate">{acc.displayName}</span>
                    {acc.uid === session.activeUid && <Check className="w-3 h-3 text-sky-500" />}
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
