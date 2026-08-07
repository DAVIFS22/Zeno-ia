import React, { useState, useMemo } from 'react';
import { 
  X, User, Moon, Sun, Brain, Shield,
  Download, Trash2, Check, Sparkles, Plus, RefreshCw,
  Lock, Zap, Wand2, Globe, ArrowLeft, ChevronRight, Laptop,
  Volume2, Bell, Code, Fingerprint, ExternalLink
} from 'lucide-react';
import { UserSettings } from '../types';
import { SupportChatTab } from "./SupportChatTab";
import { LifeBuoy } from "lucide-react";
import { ZenoLogo } from './ZenoLogo';
import { MySubscriptions } from './MySubscriptions';
import { isAdminUser, hasPremiumAccess, maskEmail } from '../config/admin';
import { ProtectedAdminPanel } from './AdminPanel';
import { AuthProfile } from '../contexts/AuthContext';
import { useTranslation } from '../i18n';
import { UserGamificationSnippet, UserGamificationSkeleton } from './UserGamificationSnippet';
import { useVersion } from '../contexts/VersionContext';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onUpdateSettings: (newSettings: Partial<UserSettings>) => void;
  onClearHistory: () => void;
  onExportAllData: () => void;
  onOpenSubscriptionModal?: () => void;
  onOpenAdaptiveModal?: () => void;
  backendLimits?: any;
  adminConfig?: any;
  user?: AuthProfile | null;
  userId: string;
  session?: any;
  onLogout?: (uid?: string) => void;
  onLogin?: (remember: boolean) => void;
  onSwitchAccount?: (uid: string) => void;
  authLoading?: boolean;
}

export type SettingsCategory = 
  | 'account' 
  | 'subscription' 
  | 'appearance' 
  | 'ai' 
  | 'voice' 
  | 'privacy' 
  | 'notifications' 
  | 'developer' | 'support';

export function SettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onClearHistory,
  onExportAllData,
  onOpenSubscriptionModal,
  onOpenAdaptiveModal,
  backendLimits,
  adminConfig,
  user,
  userId,
  session,
  onLogout,
  onLogin,
  onSwitchAccount,
  authLoading
}: SettingsModalProps) {
  const { t } = useTranslation();
  const { currentVersion } = useVersion();
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('account');
  const [subView, setSubView] = useState<'main' | 'subscriptions'>('main');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const safeSettings: UserSettings = {
    userName: settings?.userName || user?.displayName || 'Usuário ZENO',
    userEmail: settings?.userEmail || user?.email || '',
    userAvatar: settings?.userAvatar || user?.photoURL || '',
    plan: settings?.plan || 'ZENO Free',
    theme: settings?.theme || 'dark',
    logoVariant: settings?.logoVariant || 'monochrome',
    fontSize: settings?.fontSize || 'normal',
    defaultSpeed: settings?.defaultSpeed || 'zeno',
    temperature: settings?.temperature ?? 0.7,
    systemInstruction: settings?.systemInstruction || '',
    autoRead: settings?.autoRead ?? false,
    voiceSpeed: settings?.voiceSpeed ?? 1.0,
    speechLanguage: settings?.speechLanguage || 'pt-BR',
    customInstructions: settings?.customInstructions || '',
    memoryEnabled: settings?.memoryEnabled ?? true,
    saveHistory: settings?.saveHistory ?? true,
    anonymousMode: settings?.anonymousMode ?? false,
    rememberDevice: settings?.rememberDevice ?? true,
    language: settings?.language || 'pt-BR',
    isSmartMode: settings?.isSmartMode ?? true,
    soundEnabled: settings?.soundEnabled ?? true,
    notificationsEnabled: settings?.notificationsEnabled ?? true,
    showHomeSuggestions: settings?.showHomeSuggestions ?? false
  };

  const userEmail = safeSettings.userEmail || user?.email || '';
  const theme = safeSettings.theme || 'dark';
  const isPro = hasPremiumAccess(safeSettings) || hasPremiumAccess(user) || hasPremiumAccess(userEmail);
  const isOwner = userEmail ? isAdminUser(userEmail) : false;

  const isDark = theme === 'dark';
  const isAuthenticated = !!(user?.uid || (session?.accounts?.length > 0 && session?.activeUid));

  if (!isOpen) return null;

  const categories: Array<{ id: SettingsCategory; label: string; icon: any }> = [
    { id: 'account', label: t.common.profile, icon: User },
    { id: 'subscription', label: t.settings.subscription, icon: Sparkles },
    { id: 'appearance', label: t.settings.appearance, icon: isDark ? Moon : Sun },
    { id: 'ai', label: t.settings.aiModel, icon: Brain },
    { id: 'voice', label: t.settings.voice, icon: Volume2 },
    { id: 'privacy', label: t.settings.privacy, icon: Shield },
    { id: 'notifications', label: t.settings.notifications, icon: Bell },
    { id: 'support', label: 'Ajuda e Suporte', icon: LifeBuoy },
    ...(isAdminUser(user?.email) || isAdminUser(userEmail) ? [{ id: 'developer' as const, label: 'Admin', icon: Code }] : [])
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className={`w-full max-w-3xl h-[85vh] max-h-[700px] rounded-2xl border ${
        isDark ? 'bg-[#121214] border-[#2C2C2E] text-white' : 'bg-white border-neutral-200 text-neutral-900 shadow-xl'
      } flex flex-col overflow-hidden transition-all duration-150`}>
        
        {/* Header & Categories Navigation */}
          <div className={`border-b ${isDark ? 'border-[#2C2C2E]/80 bg-[#121214]' : 'border-neutral-200 bg-white'} px-6 pt-5 pb-3 flex flex-col gap-4 flex-shrink-0`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ZenoLogo size={22} variant={settings.logoVariant} theme={isDark ? "dark" : "light"} />
                <h2 className="text-lg font-semibold tracking-tight">
                  {t.settings.title}
                </h2>
              </div>

              <button
                type="button"
                onClick={onClose}
                className={`p-2 rounded-lg transition-colors ${
                  isDark ? 'hover:bg-[#232326] text-neutral-400 hover:text-white' : 'hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Category Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-1 -mx-2 px-2">
              {categories.map(cat => {
                const Icon = cat.icon;
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      if (cat.id === 'subscription') {
                        onClose();
                        if (onOpenSubscriptionModal) {
                          onOpenSubscriptionModal();
                        }
                      } else {
                        setActiveCategory(cat.id);
                      }
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                      isActive
                        ? isDark ? 'bg-[#232326] text-white' : 'bg-neutral-100 text-neutral-900'
                        : isDark ? 'text-neutral-400 hover:text-white hover:bg-[#232326]/40' : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

        {/* Modal Main Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-custom">
              {/* 1. CONTA */}
              {activeCategory === 'account' && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">{t.settings.profileAccounts}</h3>
                    {session?.accounts?.length > 0 ? (
                      session.accounts.map((acc: any) => (
                        <div key={acc.uid} className={`p-4 rounded-xl border flex items-center justify-between ${
                          acc.uid === session.activeUid
                            ? isDark ? 'bg-[#232326]/60 border-[#2C2C2E]' : 'bg-neutral-50 border-neutral-200'
                            : isDark ? 'bg-[#17171a] border-[#2C2C2E]' : 'bg-white border-neutral-200'
                        }`}>
                          <div className="flex items-center gap-3 min-w-0">
                            {acc.photoURL ? (
                              <img src={acc.photoURL} alt={acc.displayName} className="w-9 h-9 rounded-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-[#232326] flex items-center justify-center">
                                <User className="w-4 h-4 text-neutral-400" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-semibold truncate">{acc.displayName || 'Usuário ZENO'}</p>
                              <p className="text-xs text-neutral-400 truncate">{maskEmail(acc.email)}</p>
                            </div>
                          </div>
                          {acc.uid !== session.activeUid && (
                            <button
                              onClick={() => onSwitchAccount?.(acc.uid)}
                              className="px-3 py-1 rounded-lg text-xs font-medium bg-[#232326] hover:bg-neutral-700 text-neutral-200 transition-colors"
                            >
                              Alternar
                            </button>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className={`p-5 rounded-xl border text-center ${isDark ? 'border-[#2C2C2E] bg-[#17171a]' : 'border-neutral-200 bg-neutral-50'}`}>
                        <p className="text-xs text-neutral-400 mb-3">{t.settings.connectGoogle}</p>
                        <button
                          onClick={() => onLogin?.(true)}
                          disabled={authLoading}
                          className="px-4 py-2 rounded-xl text-xs font-semibold bg-white text-black hover:bg-neutral-200 transition-all inline-flex items-center gap-2 justify-center"
                        >
                          <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" xmlns="http://www.w3.org/2000/svg">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                          </svg>
                          {authLoading ? 'Conectando...' : 'Entrar com Google'}
                        </button>
                      </div>
                    )}
                  </div>

                  {authLoading ? (
                    <UserGamificationSkeleton isDark={isDark} />
                  ) : (
                    isAuthenticated && userId && !userId.startsWith('anon_') && <UserGamificationSnippet userId={userId} isDark={isDark} />
                  )}

                  <div className="pt-4 border-t border-[#2C2C2E]/60 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{t.settings.rememberDevice}</p>
                      <p className="text-xs text-neutral-400">{t.settings.keepSessionActive}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onUpdateSettings({ rememberDevice: !settings.rememberDevice })}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        settings.rememberDevice ? 'bg-neutral-200' : 'bg-[#232326]'
                      }`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-black transition-transform ${
                        settings.rememberDevice ? 'translate-x-4' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>

                  <div className="pt-6 border-t border-[#2C2C2E]/60 text-center">
                    <p className="text-[11px] text-neutral-500 font-medium tracking-wide">
                      Zeno IA — by ZENO Enterprise
                    </p>
                  </div>
                </div>
              )}

              {/* 2. ASSINATURA */}
              {activeCategory === 'subscription' && (
                <div className="space-y-6 animate-fadeIn">
                  <MySubscriptions
                    userId={userId}
                    settings={safeSettings}
                    onUpdateSettings={onUpdateSettings}
                    onOpenCheckout={() => {
                      onClose();
                      if (onOpenSubscriptionModal) onOpenSubscriptionModal();
                    }}
                  />
                </div>
              )}

              {/* 3. APARÊNCIA */}
              {activeCategory === 'appearance' && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">{t.settings.appearance}</h3>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => onUpdateSettings({ theme: 'dark' })}
                        className={`py-2.5 rounded-xl border text-xs font-medium transition-all ${
                          safeSettings.theme === 'dark'
                            ? 'bg-[#232326] border-neutral-600 text-white font-semibold'
                            : 'bg-transparent border-[#2C2C2E] text-neutral-400 hover:text-white'
                        }`}
                      >
                        {t.settings.themeDark}
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateSettings({ theme: 'light' })}
                        className={`py-2.5 rounded-xl border text-xs font-medium transition-all ${
                          safeSettings.theme === 'light'
                            ? 'bg-neutral-200 border-neutral-400 text-neutral-900 font-semibold'
                            : 'bg-transparent border-[#2C2C2E] text-neutral-400 hover:text-white'
                        }`}
                      >
                        {t.settings.themeLight}
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateSettings({ theme: 'auto' })}
                        className={`py-2.5 rounded-xl border text-xs font-medium transition-all ${
                          safeSettings.theme === 'auto'
                            ? 'bg-[#232326] border-neutral-600 text-white font-semibold'
                            : 'bg-transparent border-[#2C2C2E] text-neutral-400 hover:text-white'
                        }`}
                      >
                        {t.settings.themeAuto}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-[#2C2C2E]/60">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">{t.settings.language}</h3>
                    <select
                      value={safeSettings.language || 'auto'}
                      onChange={(e) => onUpdateSettings({ language: e.target.value as any })}
                      className={`w-full p-2.5 rounded-xl text-xs border focus:outline-none ${
                        isDark ? 'bg-[#17171a] border-[#2C2C2E] text-white' : 'bg-neutral-50 border-neutral-200 text-neutral-900'
                      }`}
                    >
                      <option value="auto">Automático (Sistema)</option>
                      <option value="pt-BR">{t.settings.voiceLangPt}</option>
                      <option value="en-US">{t.settings.voiceLangEn.replace(" (US)", "")}</option>
                      <option value="es-ES">{t.settings.voiceLangEs}</option>
                      <option value="fr-FR">Français</option>
                      <option value="zh-CN">中文 (Mandarin)</option>
                    </select>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-[#2C2C2E]/60">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">{t.settings.fontSize}</h3>
                    <select
                      value={safeSettings.fontSize || 'normal'}
                      onChange={(e) => onUpdateSettings({ fontSize: e.target.value as any })}
                      className={`w-full p-2.5 rounded-xl text-xs border focus:outline-none ${
                        isDark ? 'bg-[#17171a] border-[#2C2C2E] text-white' : 'bg-neutral-50 border-neutral-200 text-neutral-900'
                      }`}
                    >
                      <option value="compact">{t.settings.fontSizeCompact}</option>
                      <option value="normal">{t.settings.fontSizeStandard}</option>
                      <option value="large">{t.settings.fontSizeLarge}</option>
                    </select>
                  </div>
                </div>
              )}

              {/* 4. IA */}
              {activeCategory === 'ai' && (
                <div className="space-y-6 animate-fadeIn">
                  {/* Adaptive Learning Highlight Banner */}
                  <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
                    isDark ? 'bg-sky-500/10 border-sky-500/30' : 'bg-sky-50 border-sky-200'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-lg bg-sky-500/20 text-sky-400">
                        <Brain className="w-5 h-5 animate-pulse" />
                      </div>
                      <div>
                        <div className="font-bold text-sm text-neutral-100 flex items-center gap-2">
                          <span>{t.settings.adaptiveLearning}</span>
                          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-sky-500/20 text-sky-400 border border-sky-500/30">
                            ATIVO
                          </span>
                        </div>
                        <div className="text-xs text-neutral-400">
                          ZENO adapta a complexidade das explicações e sugestões ao seu perfil.
                        </div>
                      </div>
                    </div>
                    {onOpenAdaptiveModal && (
                      <button
                        type="button"
                        onClick={onOpenAdaptiveModal}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold bg-sky-500 text-neutral-950 hover:bg-sky-400 transition-colors whitespace-nowrap shadow-md shadow-sky-500/10"
                      >
                        Configurar Perfil
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">{t.settings.aiModel}</h3>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm font-medium">{t.settings.smartMode}</p>
                        <p className="text-[10px] text-neutral-400">{t.settings.smartModeDesc}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onUpdateSettings({ isSmartMode: !safeSettings.isSmartMode })}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          safeSettings.isSmartMode ? 'bg-sky-600' : 'bg-[#232326]'
                        }`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          safeSettings.isSmartMode ? 'translate-x-4' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'smart', title: 'ZENO Inteligente' },
                        { id: 'fast', title: 'ZENO Rápido' },
                        { id: 'mega', title: 'ZENO Mega' },
                        { id: 'image', title: 'ZENO Vision' },
                      ].map(model => (
                        <button
                          key={model.id}
                          type="button"
                          onClick={() => onUpdateSettings({ defaultSpeed: model.id as any })}
                          className={`p-3 rounded-xl border text-left text-xs font-medium transition-all ${
                            (safeSettings.defaultSpeed || 'zeno') === model.id
                              ? isDark ? 'bg-[#232326] border-neutral-600 text-white' : 'bg-neutral-100 border-neutral-300 text-neutral-900'
                              : isDark ? 'bg-transparent border-[#2C2C2E] text-neutral-400 hover:text-white' : 'bg-transparent border-neutral-200 text-neutral-600'
                          }`}
                        >
                          {model.title}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 pt-4 border-t border-[#2C2C2E]/60">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">{t.composer.uploadDoc}</h3>
                    <textarea
                      rows={3}
                      value={safeSettings.customInstructions || ''}
                      onChange={(e) => onUpdateSettings({ customInstructions: e.target.value })}
                      placeholder="Direcione o comportamento da IA (ex: 'Responda de forma direta e concisa')..."
                      className={`w-full p-3 rounded-xl text-xs border focus:outline-none resize-none ${
                        isDark ? 'bg-[#17171a] border-[#2C2C2E] text-white placeholder-neutral-500' : 'bg-neutral-50 border-neutral-200 text-neutral-900 placeholder-neutral-400'
                      }`}
                    />
                  </div>

                  <div className="space-y-2 pt-4 border-t border-[#2C2C2E]/60">
                    <div className="flex justify-between items-center text-xs font-medium">
                      <span className="text-neutral-400">{t.settings.temperature}</span>
                      <span className="font-mono">{safeSettings.temperature ?? 0.7}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={safeSettings.temperature ?? 0.7}
                      onChange={(e) => onUpdateSettings({ temperature: parseFloat(e.target.value) })}
                      className="w-full accent-neutral-200 cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* 5. VOZ */}
              {activeCategory === 'voice' && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{t.settings.autoReadText}</p>
                      <p className="text-xs text-neutral-400">{t.settings.autoReadDesc}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onUpdateSettings({ autoRead: !safeSettings.autoRead })}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        safeSettings.autoRead ? 'bg-neutral-200' : 'bg-[#232326]'
                      }`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-black transition-transform ${
                        safeSettings.autoRead ? 'translate-x-4' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>

                  <div className="space-y-2 pt-4 border-t border-[#2C2C2E]/60">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">{t.settings.voice}</h3>
                    <select
                      value={safeSettings.speechLanguage || 'pt-BR'}
                      onChange={(e) => onUpdateSettings({ speechLanguage: e.target.value })}
                      className={`w-full p-2.5 rounded-xl text-xs border focus:outline-none ${
                        isDark ? 'bg-[#17171a] border-[#2C2C2E] text-white' : 'bg-neutral-50 border-neutral-200 text-neutral-900'
                      }`}
                    >
                      <option value="pt-BR">{t.settings.voiceLangPt}</option>
                      <option value="en-US">{t.settings.voiceLangEn}</option>
                      <option value="es-ES">{t.settings.voiceLangEs}</option>
                    </select>
                  </div>
                </div>
              )}

              {/* 6. PRIVACIDADE */}
              {activeCategory === 'privacy' && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{t.settings.saveHistory}</p>
                      <p className="text-xs text-neutral-400">{t.settings.saveHistoryDesc}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onUpdateSettings({ saveHistory: safeSettings.saveHistory === false ? true : false })}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        safeSettings.saveHistory !== false ? 'bg-neutral-200' : 'bg-[#232326]'
                      }`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-black transition-transform ${
                        safeSettings.saveHistory !== false ? 'translate-x-4' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-[#2C2C2E]/60">
                    <button
                      type="button"
                      onClick={onExportAllData}
                      className="w-full py-2.5 rounded-xl border border-[#2C2C2E] hover:border-[#2C2C2E] text-xs font-medium transition-all flex items-center justify-center gap-2"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{t.settings.exportHistory}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowClearConfirm(true)}
                      className="w-full py-2.5 rounded-xl border border-neutral-500/30 text-neutral-400 hover:bg-neutral-500/10 text-xs font-medium transition-all flex items-center justify-center gap-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{t.settings.clearHistory}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 7. NOTIFICAÇÕES */}
              {activeCategory === 'notifications' && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Notificações da Aplicação</p>
                      <p className="text-xs text-neutral-400">{t.settings.notificationsDesc}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onUpdateSettings({ notificationsEnabled: !safeSettings.notificationsEnabled })}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        safeSettings.notificationsEnabled ? 'bg-neutral-200' : 'bg-[#232326]'
                      }`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-black transition-transform ${
                        safeSettings.notificationsEnabled ? 'translate-x-4' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                </div>
              )}

              {/* 8. DESENVOLVEDOR */}
              
              {activeCategory === 'support' && (
                <SupportChatTab />
              )}
{activeCategory === 'developer' && (
                <ProtectedAdminPanel
                  userEmail={userEmail}
                  theme={isDark ? 'dark' : 'light'}
                />
              )}
        </div>

        {/* Modal Footer */}
        <div className={`p-4 border-t ${isDark ? 'border-[#2C2C2E] bg-[#121214]' : 'border-neutral-200 bg-white'} flex items-center justify-between flex-shrink-0`}>
          <span className="text-xs text-neutral-500">ZENO AI v{currentVersion}</span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white text-black hover:bg-neutral-200 font-semibold text-xs transition-all"
          >
            {t.common.finish}
          </button>
        </div>

      </div>

      {/* Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/80 z-60 flex items-center justify-center p-4 animate-fadeIn">
          <div className={`p-5 rounded-xl max-w-sm w-full border ${isDark ? 'border-[#2C2C2E] bg-[#17171a] text-white' : 'border-neutral-200 bg-white text-neutral-900'} space-y-3`}>
            <h3 className="font-semibold text-sm">{t.settings.deleteHistoryConfirm}</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Esta ação apagar suas conversas de forma definitiva.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowClearConfirm(false);
                  onClearHistory();
                }}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-neutral-600 hover:bg-neutral-700 text-white"
              >
                Apagar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
