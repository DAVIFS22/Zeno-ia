import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from "motion/react";
import { List } from 'react-window';
import { 
  Plus, MessageSquare, Settings, Search, PanelLeftClose, 
  X, Pin, Edit2, Trash2, Sparkles, User, Lock, Check,
  Image, Folder, Cpu, Sliders, Shield, ChevronDown, MoreHorizontal,
  HelpCircle, LogOut
} from 'lucide-react';
import { UserSettings, ChatSession } from '../types';
import { ZenoLogo } from './ZenoLogo';
import { useSubscription } from '../contexts/SubscriptionContext';
import { isAdminUser } from '../config/admin';
import { useTranslation } from '../i18n';
import { useVersion } from '../contexts/VersionContext';
import { GoogleLogo } from './GoogleLogo';
import { HighlightText } from './HighlightText';



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
  searchQuery?: string;
}

const SidebarSessionItem = React.memo<SidebarSessionItemProps>(({
  session,
  isActive,
  isEditing,
  editingTitle,
  searchQuery,
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
  const [showMenu, setShowMenu] = React.useState(false);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [coords, setCoords] = React.useState<{ top: number; right: number } | null>(null);

  const handleToggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!showMenu && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right
      });
    }
    setShowMenu(!showMenu);
  };

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current && 
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('resize', () => setShowMenu(false));
      window.addEventListener('scroll', () => setShowMenu(false), true);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', () => setShowMenu(false));
      window.removeEventListener('scroll', () => setShowMenu(false), true);
    };
  }, [showMenu]);

  const matchingMsg = React.useMemo(() => {
    if (!searchQuery || !searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    return session.messages?.find(m => m.text.toLowerCase().includes(q));
  }, [session, searchQuery]);

  return (
    <div
      onClick={() => onSelectSession(session.id)}
      className={`group relative flex flex-col justify-center px-3 rounded-lg text-xs transition-colors duration-150 cursor-pointer ${
        matchingMsg ? 'py-1.5' : 'h-[36px]'
      } ${
        isActive
          ? `${bgActiveItem} ${textMain} font-medium`
          : `bg-transparent ${textMuted} hover:${textMain} ${hoverItemBg}`
      }`}
    >
      <div className="flex items-center gap-2 w-full">
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
            <HighlightText text={session.title} query={searchQuery} isDark={isDark} />
          </span>
        )}

        {!isEditing && (
          <div className="relative flex items-center">
            <button
              ref={buttonRef}
              onClick={handleToggleMenu}
              className={`p-1 rounded-md transition-colors hover:${isDark ? 'bg-[#2a2a2e]' : 'bg-neutral-200'} ${showMenu ? (isDark ? 'bg-[#2a2a2e] text-white' : 'bg-neutral-200 text-neutral-900') : textMuted} hover:${textMain}`}
              title="Opções"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>

            <AnimatePresence>{showMenu && coords && createPortal(
              <motion.div 
                ref={menuRef}
                initial={{ opacity: 0, scale: 0.95, y: -5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -5 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                style={{
                  position: 'fixed',
                  top: `${coords.top}px`,
                  right: `${coords.right}px`,
                  zIndex: 999999
                }}
                className={`w-36 py-1 rounded-xl shadow-2xl border text-xs   ${
                  isDark ? 'bg-[#1e1e22] border-[#2C2C2E] text-white' : 'bg-white border-neutral-200 text-neutral-900'
                }`} 
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={(e) => {
                    setShowMenu(false);
                    onStartRenameSession(session, e);
                  }}
                  className={`flex items-center gap-2 w-full px-3 py-2 text-left hover:${isDark ? 'bg-[#2a2a2e]' : 'bg-neutral-100'} transition-colors`}
                >
                  <Edit2 className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Renomear</span>
                </button>
                <button
                  onClick={(e) => {
                    setShowMenu(false);
                    onTogglePinSession(session.id, e);
                  }}
                  className={`flex items-center gap-2 w-full px-3 py-2 text-left hover:${isDark ? 'bg-[#2a2a2e]' : 'bg-neutral-100'} transition-colors`}
                >
                  <Pin className={`w-3.5 h-3.5 ${session.isPinned ? 'text-zeno' : 'text-neutral-400'}`} />
                  <span>{session.isPinned ? 'Desafixar' : 'Fixar'}</span>
                </button>
                <button
                  onClick={(e) => {
                    setShowMenu(false);
                    onSetDeletingSessionId(session.id);
                  }}
                  className={`flex items-center gap-2 w-full px-3 py-2 text-left text-red-500 hover:${isDark ? 'bg-[#2a2a2e]' : 'bg-neutral-100'} transition-colors`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Excluir</span>
                </button>
              </motion.div>,
              document.body
            )}</AnimatePresence>
          </div>
        )}
      </div>

      {matchingMsg && (
        <div className={`text-[10px] truncate mt-0.5 ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
          <HighlightText text={matchingMsg.text} query={searchQuery} isDark={isDark} snippetMode={true} />
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
  onOpenEditProfile?: () => void;
  onLogout?: () => void;
  onOpenSupport?: () => void;
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
  onOpenEditProfile,
  onLogout,
  onOpenSupport,
  user,
  session,
  onSwitchAccount
}) => {
  const { t } = useTranslation();
  const { currentVersion } = useVersion();
  const isDark = theme === 'dark';
  const { isPro } = useSubscription();
  const [showAccountSwitcher, setShowAccountSwitcher] = React.useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = React.useState(false);
  const profileMenuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
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
    if (item.type === 'header') return 28;
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchingMsg = item.session.messages?.find(m => m.text.toLowerCase().includes(q));
      if (matchingMsg) return 54;
    }
    return 38;
  }, [flatItems, searchQuery]);

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
          searchQuery={searchQuery}
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
    currentSessionId, editingSessionId, editingTitle, searchQuery, isDark, textMain, textMuted, 
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
          className="flex items-center gap-2.5 px-4 h-[42px] rounded-xl bg-zeno hover:bg-zeno/90 text-white font-medium transition-all duration-150 w-full text-left text-xs sm:text-sm shadow-md shadow-zeno/20 group cursor-pointer"
        >
          <MessageSquare className="w-4 h-4 flex-shrink-0 text-white" />
          <span className="flex-1 truncate">Novo chat</span>
          <Plus className="w-3.5 h-3.5 flex-shrink-0 text-zeno group-hover:text-white" />
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
              <Sparkles className="w-4 h-4 text-zeno" />
              <span className={`text-xs font-semibold ${textMain}`}>ZENO Pro</span>
            </div>
            <p className="text-[11px] text-neutral-400 leading-relaxed mb-2.5">
              Mais capacidade, respostas mais rápidas e recursos avançados.
            </p>
            <button
              onClick={() => onOpenSubscriptionModal()}
              className="w-full py-1.5 px-3 rounded-lg bg-zeno hover:bg-zeno/90 text-white text-xs font-medium transition-colors shadow-xs shadow-zeno/20 cursor-pointer"
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
                ? 'bg-[#151518] text-neutral-400 border-[#2c2c2e] hover:text-white hover:border-zeno/50' 
                : 'bg-neutral-50 text-neutral-600 border-neutral-200 hover:text-neutral-900 hover:border-zeno/50'
            }`}
            title="Ver novidades da versão"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-zeno animate-pulse"></span>
            <span>Zeno IA v{currentVersion} (Semantic)</span>
          </button>
        </div>

        {/* User Card */}
        <div className="relative pt-0.5" ref={profileMenuRef}>
          <div 
            onClick={() => {
              if (!user || user.isAnonymous) {
                onOpenAuthModal();
              } else {
                setIsProfileMenuOpen(!isProfileMenuOpen);
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
                      {user.displayName || 'Usuário ZENO'}
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
                    <p className="text-[10px] text-zeno font-medium truncate">
                      Faça login
                    </p>
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
              </div>
            )}
          </div>

          {/* Profile Dropdown Menu */}
          <AnimatePresence>{isProfileMenuOpen && user && !user.isAnonymous && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 5 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className={`absolute bottom-full left-0 w-full mb-2 p-2 rounded-2xl border shadow-2xl z-50 ${
                isDark ? 'bg-[#18181b] border-[#2C2C2E] text-white' : 'bg-white border-neutral-200 text-neutral-900'
              }`}
            >
              {/* User Info Header */}
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-neutral-50 dark:bg-[#232326]/50 border border-neutral-200/60 dark:border-[#2C2C2E]/60 mb-2">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" referrerPolicy="no-referrer" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-zeno/20 text-zeno flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {(user.displayName || user.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate">{user.displayName || user.email || 'Usuário Zeno'}</p>
                  <p className="text-[11px] text-zeno font-medium mt-0.5">
                    {isPro ? 'Plano Pro' : 'Plano Gratuito'}
                  </p>
                </div>
              </div>

              <div className="space-y-0.5">
                <button
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    onOpenEditProfile?.();
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                    isDark ? 'hover:bg-[#232326] text-neutral-200' : 'hover:bg-neutral-100 text-neutral-800'
                  }`}
                >
                  <User className="w-4 h-4 text-neutral-400" />
                  <span>Perfil</span>
                </button>

                <button
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    onOpenSettings();
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                    isDark ? 'hover:bg-[#232326] text-neutral-200' : 'hover:bg-neutral-100 text-neutral-800'
                  }`}
                >
                  <Settings className="w-4 h-4 text-neutral-400" />
                  <span>Configurações & Aparência</span>
                </button>
              </div>

              <div className="my-1.5 border-t border-neutral-200 dark:border-[#2C2C2E]" />

              <div className="space-y-0.5">
                <button
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    onOpenSupport?.();
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                    isDark ? 'hover:bg-[#232326] text-neutral-200' : 'hover:bg-neutral-100 text-neutral-800'
                  }`}
                >
                  <HelpCircle className="w-4 h-4 text-neutral-400" />
                  <span>Ajuda & Suporte</span>
                </button>

                <button
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    onLogout?.();
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-red-500 transition-colors ${
                    isDark ? 'hover:bg-red-500/10' : 'hover:bg-red-50'
                  }`}
                >
                  <LogOut className="w-4 h-4 text-red-500" />
                  <span>Sair</span>
                </button>
              </div>
            </motion.div>
          )}</AnimatePresence>

          {/* Account switcher if multi accounts exist */}
          <AnimatePresence>{showAccountSwitcher && session?.accounts?.length > 1 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 5 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className={`absolute bottom-full left-0 w-full mb-2 p-2 rounded-xl border shadow-xl z-50   ${
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
                    {acc.uid === session.activeUid && <Check className="w-3 h-3 text-zeno" />}
                  </button>
                ))}
              </div>
            </motion.div>
          )}</AnimatePresence>
        </div>
      </div>
    </aside>
  );
});

SidebarNav.displayName = 'SidebarNav';
