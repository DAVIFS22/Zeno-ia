import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, User, Moon, Sun, Brain, Shield,
  Download, Trash2, Check, Sparkles, Plus, RefreshCw,
  Lock, Zap, Wand2, Globe, ArrowLeft, ChevronRight, CheckCircle2, AlertCircle, Laptop,
  LogOut, LogIn, ExternalLink, Settings as SettingsIcon, Fingerprint
} from 'lucide-react';
import { UserSettings } from '../types';
import { ZenoLogo } from './ZenoLogo';
import { MySubscriptions } from './MySubscriptions';
import { getUserRole, isAdminUser, ADMIN_EMAIL } from '../config/admin';
import { AdminPanel, ProtectedAdminPanel } from './AdminPanel';
import { UserProfile } from '../hooks/useAuth';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onUpdateSettings: (newSettings: Partial<UserSettings>) => void;
  onClearHistory: () => void;
  onExportAllData: () => void;
  onOpenSubscriptionModal?: () => void;
  backendLimits?: any;
  adminConfig?: any;
  user?: UserProfile | null;
  session?: any; // MultiAccountSession
  onLogout?: (uid?: string) => void;
  onLogin?: (remember: boolean) => void;
  onSwitchAccount?: (uid: string) => void;
  authLoading?: boolean;
}

export function SettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onClearHistory,
  onExportAllData,
  onOpenSubscriptionModal,
  backendLimits,
  adminConfig,
  user,
  session,
  onLogout,
  onLogin,
  onSwitchAccount,
  authLoading
}: SettingsModalProps) {
  const [timeLeft, setTimeLeft] = React.useState<{hours: number, minutes: number}>({hours:0, minutes:0});
  const [rememberMe, setRememberMe] = useState(true);
  React.useEffect(() => { const calcTime = () => { const now = new Date(); const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999); const diff = endOfDay.getTime() - now.getTime(); setTimeLeft({ hours: Math.floor(diff / (1000 * 60 * 60)), minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)) }); }; calcTime(); const interval = setInterval(calcTime, 60000); return () => clearInterval(interval); }, []);
  const [activeCategory, setActiveCategory] = useState<'account' | 'customization' | 'ai' | 'privacy' | 'admin'>('account');
  const [subView, setSubView] = useState<'main' | 'subscriptions'>('main');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [adminLimitsForm, setAdminLimitsForm] = React.useState(adminConfig || {
    messages: 50, search: 20, image: 10, doc: 5, vision: 10
  });

  React.useEffect(() => {
    if (adminConfig) {
      setAdminLimitsForm(adminConfig);
    }
  }, [adminConfig]);

  const safeSettings: UserSettings = settings || {
    userName: user?.displayName || 'Usuário ZENO',
    userEmail: user?.email || '',
    userAvatar: user?.photoURL || '',
    plan: 'ZENO Free',
    theme: 'dark',
    logoVariant: 'monochrome',
    fontSize: 'normal',
    defaultSpeed: 'zeno',
    temperature: 0.7,
    systemInstruction: '',
    autoRead: false,
    voiceSpeed: 1.0,
    speechLanguage: 'pt-BR',
    customInstructions: '',
    memoryEnabled: true,
    saveHistory: true,
    anonymousMode: false,
    rememberDevice: true,
    language: 'pt-BR',
    soundEnabled: true,
    notificationsEnabled: true,
  };

  const userName = safeSettings.userName || user?.displayName || 'Usuário ZENO';
  const userEmail = safeSettings.userEmail || user?.email || '';
  const theme = safeSettings.theme || 'dark';
  const plan = safeSettings.plan || 'ZENO Free';
  const isPro = plan === 'ZENO Pro';

  const [systemTheme, setSystemTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const activeTheme = useMemo(() => {
    if (theme === 'auto') {
      return systemTheme;
    }
    return theme;
  }, [theme, systemTheme]);

  const isDark = activeTheme === 'dark';

  // CSS class helper variables for responsive light/dark mode
  const clMainBg = isDark ? 'bg-[#171717]' : 'bg-white';
  const clMainBg95 = isDark ? 'bg-[#171717]/95' : 'bg-white/95';
  const clMainBorder = isDark ? 'border-[#2B2B2B]' : 'border-neutral-200';
  const clText = isDark ? 'text-white' : 'text-neutral-900';
  const clTextMuted = isDark ? 'text-neutral-400' : 'text-neutral-500';
  const clTextLabel = isDark ? 'text-neutral-300' : 'text-neutral-700';
  const clCardBg = isDark ? 'bg-[#202020]' : 'bg-neutral-50';
  const clCardBorder = isDark ? 'border-[#2E2E2E]' : 'border-neutral-200';
  const clInputBg = isDark ? 'bg-[#202020]' : 'bg-neutral-50';
  const clInputBorder = isDark ? 'border-[#313131]' : 'border-neutral-300';
  const clInputText = isDark ? 'text-white' : 'text-neutral-900';
  const clButtonBg = isDark ? 'bg-[#202020]' : 'bg-neutral-50';
  const clButtonBorder = isDark ? 'border-[#313131]' : 'border-neutral-200';
  const clButtonHover = isDark ? 'hover:bg-[#2C2C2C]' : 'hover:bg-neutral-150';
  const clNavTabActive = isDark ? 'bg-[#2B2B2B] text-white' : 'bg-neutral-100 text-neutral-900';

  const safeAdminLimits = {
    messages: adminLimitsForm?.messages ?? 50,
    search: adminLimitsForm?.search ?? 20,
    image: adminLimitsForm?.image ?? 10,
    doc: adminLimitsForm?.doc ?? 5,
    vision: adminLimitsForm?.vision ?? 10,
  };

  const handleSaveAdminConfig = async () => {
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: { limits: safeAdminLimits } })
      });
      if (res.ok) alert('Configurações do Admin salvas com sucesso!');
    } catch (e) {
      console.error('[SettingsModal] Erro ao salvar configurações do Admin:', e);
      alert('Erro ao salvar configurações do Admin.');
    }
  };

  const userRole = user?.role || 'user';
  const isAdmin = user?.isAdmin || false;

  if (!isOpen) return null;

  console.log('[SettingsModal] Renderizando modal de configurações com activeCategory:', activeCategory, 'subView:', subView);
  const categories: Array<{ id: 'account' | 'customization' | 'ai' | 'privacy' | 'admin'; label: string; icon: any }> = [
    { id: 'account', label: 'Conta', icon: User },
    { id: 'customization', label: 'Personalização', icon: isDark ? Moon : Sun },
    { id: 'ai', label: 'IA', icon: Brain },
    { id: 'privacy', label: 'Privacidade', icon: Shield },
    ...(isAdmin ? [{ id: 'admin' as const, label: 'Admin', icon: Lock }] : [])
  ];

  // CSS tab hover state
  const clNavTabHover = isDark ? 'hover:text-neutral-200 hover:bg-[#202020]' : 'hover:text-neutral-800 hover:bg-neutral-100';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md transition-opacity duration-200 animate-fadeIn">
      <div className={`w-full max-w-3xl h-[88vh] max-h-[720px] rounded-[28px] border ${clMainBorder} ${clMainBg} ${clText} shadow-2xl shadow-black/80 flex flex-col overflow-hidden transition-all duration-200`}>
        
        {/* Sticky Top Bar & Tab Navigation */}
        {subView === 'main' ? (
          <div className={`sticky top-0 z-20 ${clMainBg95} backdrop-blur-md border-b ${clMainBorder} px-6 pt-5 pb-3 flex flex-col gap-4 flex-shrink-0`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ZenoLogo size={24} variant={settings.logoVariant} theme={isDark ? "dark" : "light"} />
                <h2 className={`text-[28px] font-semibold tracking-tight ${clText} leading-none`}>
                  Configurações
                </h2>
              </div>

              {/* Circular Close Button */}
              <button
                type="button"
                onClick={onClose}
                title="Fechar configurações"
                className={`w-10 h-10 rounded-full ${clButtonBg} ${clButtonHover} border ${clButtonBorder} ${clTextMuted} hover:text-white flex items-center justify-center transition-all duration-180 active:scale-95`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Tabs Bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 pt-1 -mx-2 px-2">
              {categories.map(cat => {
                const Icon = cat.icon;
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategory(cat.id)}
                    className={`relative flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-180 whitespace-nowrap flex-shrink-0 ${
                      isActive
                        ? `${clNavTabActive} shadow-sm font-semibold`
                        : `${clTextMuted} ${clNavTabHover}`
                    }`}
                  >
                    <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? (isDark ? 'text-white' : 'text-neutral-900') : 'text-neutral-500'}`} />
                    <span>{cat.label}</span>
                    {isActive && (
                      <span className="absolute bottom-0 left-4 right-4 h-[2px] bg-blue-500 rounded-full transition-all duration-200" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className={`sticky top-0 z-20 ${clMainBg95} backdrop-blur-md border-b ${clMainBorder} px-6 pt-5 pb-5 flex items-center justify-between flex-shrink-0`}>
            <div className="flex items-center gap-3">
              <button onClick={() => setSubView('main')} className={`p-2 -ml-2 rounded-lg hover:${clCardBg} ${clTextMuted} hover:${clText} transition-colors`}>
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h2 className={`text-xl font-semibold ${clText}`}>Minhas Assinaturas</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className={`w-10 h-10 rounded-full ${clButtonBg} ${clButtonHover} border ${clButtonBorder} ${clTextMuted} hover:text-white flex items-center justify-center transition-all duration-180 active:scale-95`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Category Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-7 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
          {subView === 'main' ? (
            <>
              {/* CATEGORY 1: CONTA */}
              {activeCategory === 'account' && (
            <div className="space-y-7 animate-fadeIn">
              
              {/* Multi-Account Profile Section */}
              <div className="space-y-3">
                <span className="text-sm font-medium text-neutral-400 uppercase tracking-wider block">
                  Contas Conectadas
                </span>
                
                <div className="space-y-3">
                  {session?.accounts?.length > 0 ? (
                    session.accounts.map((acc: any) => (
                      <div key={acc.uid} className={`p-4 rounded-3xl border transition-all duration-300 flex items-center gap-4 ${
                        acc.uid === session.activeUid
                          ? (activeTheme === 'dark' ? 'bg-blue-500/5 border-blue-500/30 shadow-lg shadow-blue-500/5' : 'bg-blue-50 border-blue-100 shadow-xl shadow-blue-100/40')
                          : (activeTheme === 'dark' ? 'bg-[#1e1e24] border-neutral-800' : 'bg-white border-neutral-100 shadow-sm')
                      }`}>
                        <div className="relative">
                          {acc.photoURL ? (
                            <img 
                              src={acc.photoURL} 
                              alt={acc.displayName} 
                              referrerPolicy="no-referrer"
                              className="w-12 h-12 rounded-2xl object-cover border-2 border-neutral-700/30"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-2xl bg-neutral-800 flex items-center justify-center border-2 border-neutral-700/30">
                              <User className="w-6 h-6 text-neutral-500" />
                            </div>
                          )}
                          {acc.uid === session.activeUid && (
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-blue-500 border-2 border-[#1e1e24] flex items-center justify-center">
                              <Check className="w-2.5 h-2.5 text-white" />
                            </div>
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h3 className={`text-sm font-bold truncate ${activeTheme === 'dark' ? 'text-white' : 'text-neutral-900'}`}>
                            {acc.displayName || 'Usuário ZENO'}
                          </h3>
                          <p className="text-[11px] text-neutral-500 truncate">{acc.email}</p>
                        </div>

                        <div className="flex items-center gap-2">
                          {acc.uid !== session.activeUid && (
                            <button
                              onClick={() => onSwitchAccount?.(acc.uid)}
                              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                                activeTheme === 'dark'
                                  ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                                  : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-600'
                              }`}
                            >
                              Alternar
                            </button>
                          )}
                          <button
                            onClick={() => onLogout?.(acc.uid)}
                            className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/10 transition-all"
                            title="Remover conta"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className={`p-8 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center text-center space-y-3 ${
                      activeTheme === 'dark' ? 'border-neutral-800 bg-[#1e1e24]/30' : 'border-neutral-100 bg-neutral-50/50'
                    }`}>
                      <div className="w-12 h-12 rounded-2xl bg-neutral-800/50 flex items-center justify-center">
                        <Lock className="w-6 h-6 text-neutral-600" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-neutral-400">Nenhuma conta conectada</h3>
                        <p className="text-xs text-neutral-500">Faça login para salvar seu histórico e acessar recursos Pro.</p>
                      </div>
                    </div>
                  )}

                  <button 
                    onClick={() => onLogin?.(true)}
                    disabled={authLoading}
                    className={`w-full flex items-center justify-center gap-2 p-4 rounded-3xl border-2 border-dashed transition-all active:scale-95 ${
                      activeTheme === 'dark' 
                        ? 'border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-600 hover:bg-white/5' 
                        : 'border-neutral-100 text-neutral-500 hover:text-neutral-800 hover:border-neutral-300 hover:bg-neutral-50'
                    }`}
                  >
                    {authLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    <span className="text-sm font-bold">Adicionar outra conta Google</span>
                  </button>
                </div>
              </div>

              {user && (
                  <button
                    type="button"
                    onClick={() => window.open('https://myaccount.google.com/', '_blank')}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-medium transition-all ${
                      activeTheme === 'dark'
                        ? 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50'
                        : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100'
                    }`}
                  >
                    <SettingsIcon className="w-3.5 h-3.5" />
                    <span>Gerenciar suas Contas Google</span>
                    <ExternalLink className="w-3 h-3 opacity-50" />
                  </button>
                )}

                <div className={`pt-4 border-t ${activeTheme === 'dark' ? 'border-neutral-800' : 'border-neutral-100'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Fingerprint className="w-5 h-5 text-neutral-500" />
                      <div>
                        <h4 className={`text-sm font-medium ${activeTheme === 'dark' ? 'text-neutral-200' : 'text-neutral-800'}`}>
                          Lembrar este dispositivo
                        </h4>
                        <p className="text-[11px] text-neutral-500">Mantenha sua sessão ativa automaticamente.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onUpdateSettings({ rememberDevice: !settings.rememberDevice })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                        settings.rememberDevice ? 'bg-emerald-500' : 'bg-neutral-700'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        settings.rememberDevice ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                </div>

                {/* Premium Subscription Card */}
              <div className="space-y-3">
                <span className="text-sm font-medium text-neutral-400 uppercase tracking-wider block">
                  Detalhes do Plano
                </span>
                <div className="p-6 rounded-2xl bg-[#202020] border border-[#2E2E2E] space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Sparkles className="w-5 h-5 text-amber-400" />
                      <h3 className="text-base font-semibold text-white">
                        {isPro ? 'ZENO Pro Ativo' : 'Plano Gratuito ZENO Free'}
                      </h3>
                    </div>
                    <span className="text-xs text-neutral-400 font-mono">Zeno Inc.</span>
                  </div>

                  <p className="text-sm text-neutral-300 leading-relaxed">
                    {isPro
                      ? 'Acesso ilimitado aos modelos avançados, respostas rápidas e recursos exclusivos.'
                      : 'Acesso limitado ao modelo padrão. Faça o upgrade para velocidade máxima sem limites.'}
                  </p>

                  <div className="border-t border-[#313131] pt-4 space-y-2.5 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-400">Plano Atual:</span>
                      <span className="text-white font-medium">
                        {isPro ? (settings.billingCycle === 'annual' ? 'Plano Anual' : 'Plano Mensal') : 'ZENO Free'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-400">Próxima Renovação:</span>
                      <span className="text-white font-medium">
                        {isPro ? (settings.subscriptionRenewalDate || '23/08/2026') : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-400">Status da Assinatura:</span>
                      <span className={`font-medium ${isPro ? 'text-emerald-400' : 'text-neutral-400'}`}>
                        {isPro ? 'Assinatura Ativa' : 'Gratuito'}
                      </span>
                    </div>
                  </div>

                  
                  {!isPro && adminConfig && backendLimits && (() => {
                    const messagesLeft = Math.max(0, adminConfig.messages - backendLimits.messages);
                    if (messagesLeft > 10) return null;
                    return (
                      <div className="mt-6 border border-[#313131] rounded-xl p-4 bg-[#232323]">
                        <h4 className="text-white font-medium mb-4">Uso Diário (Plano Gratuito)</h4>
                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between items-center">
                            <span className="text-neutral-400">Mensagens</span>
                            <span className="text-white">{backendLimits.messages} / {adminConfig.messages}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-neutral-400">Pesquisa Web</span>
                            <span className="text-white">{backendLimits.search} / {adminConfig.search}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-neutral-400">Imagens</span>
                            <span className="text-white">{backendLimits.image} / {adminConfig.image}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-neutral-400">Análise de PDF</span>
                            <span className="text-white">{backendLimits.doc} / {adminConfig.doc}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-neutral-400">Análise Visual</span>
                            <span className="text-white">{backendLimits.vision} / {adminConfig.vision}</span>
                          </div>
                          <div className="pt-3 mt-3 border-t border-[#313131] flex justify-between items-center">
                            <span className="text-neutral-400">Próxima renovação:</span>
                            <span className="text-white font-medium">{String(timeLeft.hours).padStart(2, '0')}h {String(timeLeft.minutes).padStart(2, '0')}m</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {onOpenSubscriptionModal && (
                    <div className="pt-2 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenSubscriptionModal();
                        }}
                        className="w-full h-[52px] rounded-xl bg-[#2A2A2A] hover:bg-[#333333] border border-[#3A3A3A] text-white font-medium text-sm transition-all duration-180 flex items-center justify-center gap-2 active:scale-[0.99]"
                      >
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        <span>{isPro ? 'Ver Planos & Benefícios' : 'Fazer Upgrade para ZENO Pro'}</span>
                      </button>
                      {(isPro || settings.stripeSubscription?.status === 'trialing') && (
                        <button
                          type="button"
                          onClick={() => setSubView('subscriptions')}
                          className="w-full h-[52px] rounded-xl bg-transparent hover:bg-[#2A2A2A] border border-[#3A3A3A] text-white font-medium text-sm transition-all duration-180 flex items-center justify-between px-5 active:scale-[0.99]"
                        >
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-amber-400" />
                            <span>Gerenciar Assinatura</span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-neutral-400" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Permanent Deletion Button */}
                  {user && (
                    <div className="pt-8 mt-8 border-t border-[#313131] space-y-4">
                      <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-red-500 uppercase tracking-wider">Zona de Perigo</h4>
                        <p className="text-xs text-neutral-400 leading-relaxed">
                          Ao excluir sua conta permanentemente, todas as suas conversas, memória da IA, biblioteca de imagens e configurações serão apagados da nuvem de forma irreversível.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          if (window.confirm("ATENÇÃO: Você tem certeza que deseja excluir sua conta permanentemente? Esta ação é IRREVERSÍVEL e apagará todos os seus dados da nuvem.")) {
                            try {
                              const res = await fetch(`/api/sync/account?userId=${user.uid}`, { method: 'DELETE' });
                              if (res.ok) {
                                alert("Sua conta e todos os seus dados foram excluídos com sucesso.");
                                onLogout();
                                onClose();
                              } else {
                                throw new Error("Erro ao excluir conta.");
                              }
                            } catch (err) {
                              alert("Falha ao excluir conta. Tente novamente mais tarde.");
                            }
                          }
                        }}
                        className="w-full h-[52px] rounded-xl border border-red-500/30 hover:border-red-500 bg-red-500/5 hover:bg-red-500/10 text-red-500 font-medium text-sm transition-all duration-180 flex items-center justify-center gap-2"
                      >
                        <Trash2 className="w-4.5 h-4.5" />
                        <span>Excluir Conta Permanentemente</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Security Section (Handled above in Account Section) */}

            </div>
          )}

          {/* CATEGORY 2: PERSONALIZAÇÃO */}
          {activeCategory === 'customization' && (
            <div className="space-y-7 animate-fadeIn">
              
              {/* Theme Selection */}
              <div className="space-y-3">
                <span className={`text-sm font-medium ${clTextMuted} uppercase tracking-wider block`}>
                  Aparência e Tema
                </span>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ theme: 'dark' })}
                    className={`h-[52px] rounded-xl border flex items-center justify-center gap-2 text-xs sm:text-sm font-medium transition-all duration-180 ${
                      safeSettings.theme === 'dark'
                        ? 'bg-blue-500/10 border-blue-500 text-blue-400 font-semibold shadow-xs'
                        : `${clButtonBg} ${clInputBorder} ${clTextMuted} hover:${clText} ${clButtonHover}`
                    }`}
                  >
                    <Moon className="w-4.5 h-4.5 flex-shrink-0" />
                    <span className="truncate">Escuro</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ theme: 'light' })}
                    className={`h-[52px] rounded-xl border flex items-center justify-center gap-2 text-xs sm:text-sm font-medium transition-all duration-180 ${
                      safeSettings.theme === 'light'
                        ? 'bg-blue-500/10 border-blue-500 text-blue-400 font-semibold shadow-xs'
                        : `${clButtonBg} ${clInputBorder} ${clTextMuted} hover:${clText} ${clButtonHover}`
                    }`}
                  >
                    <Sun className="w-4.5 h-4.5 flex-shrink-0" />
                    <span className="truncate">Claro</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ theme: 'auto' })}
                    className={`h-[52px] rounded-xl border flex items-center justify-center gap-2 text-xs sm:text-sm font-medium transition-all duration-180 ${
                      safeSettings.theme === 'auto'
                        ? 'bg-blue-500/10 border-blue-500 text-blue-400 font-semibold shadow-xs'
                        : `${clButtonBg} ${clInputBorder} ${clTextMuted} hover:${clText} ${clButtonHover}`
                    }`}
                  >
                    <Laptop className="w-4.5 h-4.5 flex-shrink-0" />
                    <span className="truncate">Automático</span>
                  </button>
                </div>
              </div>

              {/* Language Selection */}
              <div className="space-y-3">
                <span className="text-sm font-medium text-neutral-400 uppercase tracking-wider block">
                  Idioma da Interface
                </span>
                <div className="space-y-2">
                  {[
                    { code: 'pt-BR', name: 'Português (Brasil)' },
                    { code: 'en-US', name: 'English (United States)' },
                    { code: 'es-ES', name: 'Español (España)' },
                  ].map(lang => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => onUpdateSettings({ language: lang.code as any })}
                      className={`w-full h-[52px] px-5 rounded-xl border flex items-center justify-between text-sm transition-all duration-180 ${
                        (safeSettings.language || 'pt-BR') === lang.code
                          ? 'bg-[#2B2B2B] border-[#3B82F6] text-white font-medium'
                          : 'bg-[#202020] border-[#313131] text-neutral-300 hover:text-white'
                      }`}
                    >
                      <span>{lang.name}</span>
                      {(safeSettings.language || 'pt-BR') === lang.code && <Check className="w-5 h-5 text-blue-400" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Additional Customizations */}
              <div className="space-y-3">
                <span className="text-sm font-medium text-neutral-400 uppercase tracking-wider block">
                  Preferências Visuais
                </span>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-neutral-300">Estilo da Marca ZENO</label>
                    <select
                      value={safeSettings.logoVariant || 'monochrome'}
                      onChange={(e) => onUpdateSettings({ logoVariant: e.target.value as any })}
                      className="w-full h-[52px] px-4 rounded-xl bg-[#202020] border border-[#313131] text-white text-sm focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] transition-all duration-[180ms]"
                    >
                      <option value="monochrome">Logotipo Tradicional</option>
                      <option value="gradient">Ícone Z Minimalista</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-neutral-300">Tamanho da Fonte da Conversa</label>
                    <select
                      value={safeSettings.fontSize || 'normal'}
                      onChange={(e) => onUpdateSettings({ fontSize: e.target.value as any })}
                      className="w-full h-[52px] px-4 rounded-xl bg-[#202020] border border-[#313131] text-white text-sm focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] transition-all duration-[180ms]"
                    >
                      <option value="normal">Padrão (16px)</option>
                      <option value="large">Grande (18px)</option>
                      <option value="compact">Compacto (14px)</option>
                    </select>
                  </div>

                  <div className="p-4 rounded-xl bg-[#202020] border border-[#2E2E2E] flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-white">Agrupar conversas por data</h4>
                      <p className="text-xs text-neutral-400 mt-0.5">Organiza a barra lateral em Hoje, Ontem, etc.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={safeSettings.groupByDate !== false}
                      onChange={(e) => onUpdateSettings({ groupByDate: e.target.checked })}
                      className="w-5 h-5 accent-blue-500 cursor-pointer rounded"
                    />
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* CATEGORY 3: IA */}
          {activeCategory === 'ai' && (
            <div className="space-y-7 animate-fadeIn">
              
              {/* Default Model */}
              <div className="space-y-3">
                <span className="text-sm font-medium text-neutral-400 uppercase tracking-wider block">
                  Modelo de Inteligência Padrão
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { id: 'smart', title: 'ZENO Inteligente', desc: 'Raciocínio lógico e síntese profunda.', icon: Brain },
                    { id: 'fast', title: 'ZENO Rápido', desc: 'Respostas velozes para dúvidas diárias.', icon: Zap },
                    { id: 'mega', title: 'ZENO Mega Sábio', desc: 'Pesquisa web em tempo real.', icon: Globe },
                    { id: 'image', title: 'ZENO Vision', desc: 'Estúdio de geração visual de imagens.', icon: Wand2 },
                  ].map(model => (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => onUpdateSettings({ defaultSpeed: model.id as any })}
                      className={`p-4 rounded-2xl border text-left transition-all duration-180 space-y-1 ${
                        (safeSettings.defaultSpeed || 'zeno') === model.id
                          ? 'bg-[#2B2B2B] border-[#3B82F6] text-white shadow-sm'
                          : 'bg-[#202020] border-[#313131] text-neutral-300 hover:text-white'
                      }`}
                    >
                      <div className="font-semibold text-sm flex items-center gap-2">
                        <model.icon className="w-4 h-4 text-neutral-400" />
                        <span>{model.title}</span>
                      </div>
                      <p className="text-xs text-neutral-400 leading-snug">{model.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Memory & Instructions */}
              <div className="space-y-3">
                <span className="text-sm font-medium text-neutral-400 uppercase tracking-wider block">
                  Instruções Personalizadas
                </span>
                <p className="text-sm text-neutral-400 leading-normal">
                  Direcione o comportamento e tom de resposta das IAs ZENO para o seu perfil.
                </p>
                <textarea
                  rows={4}
                  value={safeSettings.customInstructions || ''}
                  onChange={(e) => onUpdateSettings({ customInstructions: e.target.value })}
                  placeholder="Exemplo: Sou programador, prefiro respostas diretas com snippets de código limpos..."
                  className="w-full p-4 rounded-xl bg-[#202020] border border-[#313131] text-white text-sm placeholder-[#9CA3AF] focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] transition-all duration-[180ms] resize-none"
                />
              </div>

              {/* Temperature Slider */}
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm font-medium">
                  <span className="text-neutral-300">Temperatura de Criatividade</span>
                  <span className="text-white font-mono bg-[#202020] px-2.5 py-1 rounded-md border border-[#313131]">
                    {safeSettings.temperature ?? 0.7}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={safeSettings.temperature ?? 0.7}
                  onChange={(e) => onUpdateSettings({ temperature: parseFloat(e.target.value) })}
                  className="w-full accent-blue-500 cursor-pointer h-2 bg-[#202020] rounded-lg border border-[#313131]"
                />
                <div className="flex justify-between text-xs text-neutral-400">
                  <span>Preciso e Factual (0.0)</span>
                  <span>Criativo e Inovador (1.0)</span>
                </div>
              </div>

            </div>
          )}

          {/* CATEGORY 4: ADMIN / PRIVACIDADE */}
          
            {activeCategory === 'admin' && (
              <ProtectedAdminPanel
                userEmail={userEmail}
                theme={isDark ? 'dark' : 'light'}
              />
            )}

            {activeCategory === 'privacy' && (
            <div className="space-y-7 animate-fadeIn">
              
              {/* Privacy Toggles */}
              <div className="space-y-3">
                <span className="text-sm font-medium text-neutral-400 uppercase tracking-wider block">
                  Gerenciamento de Dados Local
                </span>

                <div className="p-5 rounded-2xl bg-[#202020] border border-[#2E2E2E] flex items-center justify-between">
                  <div className="pr-4">
                    <h4 className="text-sm font-medium text-white">Salvar Histórico Localmente</h4>
                    <p className="text-sm text-neutral-400">Armazena suas conversas com segurança no navegador.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={safeSettings.saveHistory !== false}
                    onChange={(e) => onUpdateSettings({ saveHistory: e.target.checked })}
                    className="w-5 h-5 accent-blue-500 cursor-pointer rounded"
                  />
                </div>

                <div className="p-5 rounded-2xl bg-[#202020] border border-[#2E2E2E] flex items-center justify-between">
                  <div className="pr-4">
                    <h4 className="text-sm font-medium text-white">Navegação Anônima</h4>
                    <p className="text-sm text-neutral-400">Não vincula buscas e diálogos ao seu perfil durante o uso.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={safeSettings.anonymousMode === true}
                    onChange={(e) => onUpdateSettings({ anonymousMode: e.target.checked })}
                    className="w-5 h-5 accent-blue-500 cursor-pointer rounded"
                  />
                </div>
              </div>

              {/* Data Export */}
              <div className="space-y-3">
                <span className="text-sm font-medium text-neutral-400 uppercase tracking-wider block">
                  Exportar Dados
                </span>
                <div className="p-5 rounded-2xl bg-[#202020] border border-[#2E2E2E] space-y-3">
                  <p className="text-sm text-neutral-300">Faça o download de todas as suas conversas em arquivo Markdown (.md).</p>
                  <button
                    type="button"
                    onClick={onExportAllData}
                    className="h-[48px] px-5 rounded-xl bg-[#2A2A2A] hover:bg-[#333333] border border-[#3A3A3A] text-white font-medium text-sm transition-all duration-180 flex items-center gap-2 active:scale-95"
                  >
                    <Download className="w-4 h-4 text-neutral-300" />
                    <span>Exportar Histórico Completo</span>
                  </button>
                </div>
              </div>

              {/* Data Erasure */}
              <div className="space-y-3">
                <span className="text-sm font-medium text-neutral-400 uppercase tracking-wider block">
                  Exclusão Definitiva
                </span>
                <div className="p-5 rounded-2xl bg-[#202020] border border-[#2E2E2E] space-y-3">
                  <p className="text-sm text-neutral-300">Apague permanentemente todo o histórico de mensagens salvas no seu dispositivo.</p>
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(true)}
                    className="h-[48px] px-5 rounded-xl bg-rose-600/10 hover:bg-rose-600/20 border border-rose-500/30 text-rose-400 font-medium text-sm transition-all duration-180 flex items-center gap-2 active:scale-95"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Apagar Todo o Histórico</span>
                  </button>
                </div>
              </div>

            </div>
          )}
            </>
          ) : (
            <MySubscriptions 
              settings={settings}
              onUpdateSettings={onUpdateSettings}
            />
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-[#2B2B2B] bg-[#171717] flex flex-col sm:flex-row items-center justify-between gap-4 flex-shrink-0">
          <div className="text-center sm:text-left">
            <p className="text-sm font-normal text-neutral-400">Zeno Inc. © 2026</p>
            <p className="text-xs text-neutral-500">Versão 3.6.0</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="h-[48px] px-8 rounded-full bg-white hover:bg-neutral-200 text-black font-medium text-sm transition-all duration-180 active:scale-95 shadow-md"
          >
            Concluído
          </button>
        </div>

      </div>

      {/* Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/80 z-60 flex items-center justify-center p-4 animate-fadeIn">
          <div className="p-6 rounded-2xl max-w-sm w-full border border-[#2E2E2E] bg-[#1C1C1C] text-white shadow-2xl space-y-4">
            <h3 className="font-semibold text-base text-white">Apagar Todo o Histórico?</h3>
            <p className="text-sm text-neutral-400 leading-relaxed">
              Esta ação removerá permanentemente todas as suas conversas gravadas neste dispositivo.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[#2A2A2A] text-neutral-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowClearConfirm(false);
                  onClearHistory();
                }}
                className="px-5 py-2.5 rounded-xl text-sm font-medium bg-rose-600 hover:bg-rose-700 text-white transition-all active:scale-95 shadow-sm"
              >
                Sim, Apagar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

