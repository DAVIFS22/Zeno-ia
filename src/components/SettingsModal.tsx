import React, { useState } from 'react';
import { 
  X, User, Moon, Sun, Brain, Shield,
  Download, Trash2, Check, Sparkles,
  Lock, Zap, Wand2, Globe
} from 'lucide-react';
import { UserSettings } from '../types';
import { ZenoLogo } from './ZenoLogo';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onUpdateSettings: (newSettings: Partial<UserSettings>) => void;
  onClearHistory: () => void;
  onExportAllData: () => void;
  onOpenSubscriptionModal?: () => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onClearHistory,
  onExportAllData,
  onOpenSubscriptionModal
}: SettingsModalProps) {
  const [activeCategory, setActiveCategory] = useState<'account' | 'customization' | 'ai' | 'privacy'>('account');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  if (!isOpen) return null;

  const isDark = settings.theme === 'dark';
  const isPro = settings.plan === 'ZENO Pro';

  const categories = [
    { id: 'account', label: 'Conta', icon: User },
    { id: 'customization', label: 'Personalização', icon: isDark ? Moon : Sun },
    { id: 'ai', label: 'IA', icon: Brain },
    { id: 'privacy', label: 'Privacidade', icon: Shield },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md transition-opacity duration-200 animate-fadeIn">
      <div className="w-full max-w-3xl h-[88vh] max-h-[720px] rounded-[28px] border border-[#2B2B2B] bg-[#171717] text-white shadow-2xl shadow-black/80 flex flex-col overflow-hidden transition-all duration-200">
        
        {/* Sticky Top Bar & Tab Navigation */}
        <div className="sticky top-0 z-20 bg-[#171717]/95 backdrop-blur-md border-b border-[#2B2B2B] px-6 pt-5 pb-3 flex flex-col gap-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ZenoLogo size={24} variant={settings.logoVariant} theme="dark" />
              <h2 className="text-[28px] font-semibold tracking-tight text-white leading-none">
                Configurações
              </h2>
            </div>

            {/* Circular Close Button */}
            <button
              type="button"
              onClick={onClose}
              title="Fechar configurações"
              className="w-10 h-10 rounded-full bg-[#202020] hover:bg-[#2C2C2C] border border-[#313131] text-neutral-400 hover:text-white flex items-center justify-center transition-all duration-180 active:scale-95"
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
                      ? 'bg-[#2B2B2B] text-white shadow-sm font-semibold'
                      : 'text-neutral-400 hover:text-neutral-200 hover:bg-[#202020]'
                  }`}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-neutral-500'}`} />
                  <span>{cat.label}</span>
                  {isActive && (
                    <span className="absolute bottom-0 left-4 right-4 h-[2px] bg-blue-500 rounded-full transition-all duration-200" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Category Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-7 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">

          {/* CATEGORY 1: CONTA */}
          {activeCategory === 'account' && (
            <div className="space-y-7 animate-fadeIn">
              
              {/* Profile Card */}
              <div className="space-y-3">
                <span className="text-sm font-medium text-neutral-400 uppercase tracking-wider block">
                  Perfil de Usuário
                </span>
                <div className="p-5 sm:p-6 rounded-2xl bg-[#202020] border border-[#2E2E2E] flex flex-col sm:flex-row items-start sm:items-center gap-5 transition-all">
                  <div className="w-16 h-16 rounded-2xl bg-[#2A2A2A] border border-[#3A3A3A] flex items-center justify-center text-white font-bold text-2xl shadow-inner flex-shrink-0">
                    {settings.userName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-lg font-semibold text-white truncate">{settings.userName}</h3>
                      <span className="bg-[#F3F4F6] text-black font-semibold text-xs px-2.5 py-1 rounded-md tracking-wider uppercase shadow-xs">
                        {isPro ? 'ZENO PRO' : 'ZENO FREE'}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-400 truncate">{settings.userEmail}</p>
                  </div>
                </div>

                {/* Profile Edit Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-neutral-300">Nome Completo</label>
                    <input
                      type="text"
                      value={settings.userName}
                      onChange={(e) => onUpdateSettings({ userName: e.target.value })}
                      placeholder="Seu nome completo"
                      className="w-full h-[52px] px-4 rounded-xl bg-[#202020] border border-[#313131] text-white text-sm placeholder-[#9CA3AF] focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] transition-all duration-[180ms]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-neutral-300">Endereço de E-mail</label>
                    <input
                      type="email"
                      value={settings.userEmail}
                      onChange={(e) => onUpdateSettings({ userEmail: e.target.value })}
                      placeholder="seuemail@exemplo.com"
                      className="w-full h-[52px] px-4 rounded-xl bg-[#202020] border border-[#313131] text-white text-sm placeholder-[#9CA3AF] focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] transition-all duration-[180ms]"
                    />
                  </div>
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

                  {onOpenSubscriptionModal && (
                    <div className="pt-2">
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
                    </div>
                  )}
                </div>
              </div>

              {/* Security Section */}
              <div className="space-y-3">
                <span className="text-sm font-medium text-neutral-400 uppercase tracking-wider block">
                  Segurança
                </span>
                <div className="p-5 rounded-2xl bg-[#202020] border border-[#2E2E2E] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Lock className="w-5 h-5 text-neutral-400" />
                    <div>
                      <h4 className="text-sm font-medium text-white">Autenticação Criptografada</h4>
                      <p className="text-sm text-neutral-400">Suas credenciais e mensagens utilizam criptografia de ponta a ponta.</p>
                    </div>
                  </div>
                  <span className="text-xs font-medium px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Ativo
                  </span>
                </div>
              </div>

            </div>
          )}

          {/* CATEGORY 2: PERSONALIZAÇÃO */}
          {activeCategory === 'customization' && (
            <div className="space-y-7 animate-fadeIn">
              
              {/* Theme Selection */}
              <div className="space-y-3">
                <span className="text-sm font-medium text-neutral-400 uppercase tracking-wider block">
                  Aparência e Tema
                </span>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ theme: 'dark' })}
                    className={`h-[52px] rounded-xl border flex items-center justify-center gap-3 text-sm font-medium transition-all duration-180 ${
                      isDark
                        ? 'bg-[#2B2B2B] border-[#3B82F6] text-white shadow-sm'
                        : 'bg-[#202020] border-[#313131] text-neutral-400 hover:text-white'
                    }`}
                  >
                    <Moon className="w-5 h-5" />
                    <span>Modo Escuro</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ theme: 'light' })}
                    className={`h-[52px] rounded-xl border flex items-center justify-center gap-3 text-sm font-medium transition-all duration-180 ${
                      !isDark
                        ? 'bg-[#2B2B2B] border-[#3B82F6] text-white shadow-sm'
                        : 'bg-[#202020] border-[#313131] text-neutral-400 hover:text-white'
                    }`}
                  >
                    <Sun className="w-5 h-5" />
                    <span>Modo Claro</span>
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
                        settings.language === lang.code
                          ? 'bg-[#2B2B2B] border-[#3B82F6] text-white font-medium'
                          : 'bg-[#202020] border-[#313131] text-neutral-300 hover:text-white'
                      }`}
                    >
                      <span>{lang.name}</span>
                      {settings.language === lang.code && <Check className="w-5 h-5 text-blue-400" />}
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
                      value={settings.logoVariant}
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
                      value={settings.fontSize}
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
                      checked={settings.groupByDate !== false}
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
                        settings.defaultSpeed === model.id
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
                  value={settings.customInstructions}
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
                    {settings.temperature}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={settings.temperature}
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

          {/* CATEGORY 4: PRIVACIDADE */}
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
                    checked={settings.saveHistory}
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
                    checked={settings.anonymousMode}
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

