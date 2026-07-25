import React, { useState } from 'react';
import { X, Check, Lock, Shield, CheckCircle2, Star, Sparkles, Loader2 } from 'lucide-react';
import { UserSettings } from '../types';
import { ZenoLogo } from './ZenoLogo';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onUpdateSettings: (newSettings: Partial<UserSettings>) => void;
  reasonMessage?: string;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  reasonMessage
}) => {
  const [isLoading, setIsLoading] = useState<'monthly' | 'annual' | null>(null);

  React.useEffect(() => {
    if (isOpen && settings.stripeSubscription?.subscriptionId) {
      // Sync subscription status with Stripe whenever the modal opens
      fetch(`/api/subscription/retrieve?subscription_id=${settings.stripeSubscription.subscriptionId}`)
        .then(res => res.json())
        .then(data => {
          if (data.subscriptionId) {
            onUpdateSettings({
              stripeSubscription: {
                ...settings.stripeSubscription!,
                status: data.status,
                trialEnd: data.trialEnd,
                cancelAtPeriodEnd: data.cancelAtPeriodEnd,
                currentPeriodEnd: data.currentPeriodEnd,
              }
            });
            // If trial expired and canceled, downgrade plan
            if (data.status === 'canceled' || data.status === 'past_due' || data.status === 'unpaid') {
              onUpdateSettings({
                plan: 'ZENO Free',
                stripeSubscription: undefined
              });
            }
          }
        })
        .catch(err => console.error("Error syncing subscription", err));
    }
  }, [isOpen, settings.stripeSubscription?.subscriptionId]);

  if (!isOpen) return null;

  const systemTheme = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  const resolvedTheme = settings.theme === 'auto' ? systemTheme : settings.theme;
  const isDark = resolvedTheme === 'dark';
  const isPro = settings.plan === 'ZENO Pro';

  const handleCheckout = async (plan: 'monthly' | 'annual') => {
    try {
      setIsLoading(plan);
      
      // Abre a nova aba imediatamente antes da chamada async para evitar bloqueador de pop-ups
      const newWindow = window.open('about:blank', '_blank');
      
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          plan, 
          email: settings.userEmail, 
          hasUsedFreeTrial: settings.hasUsedFreeTrial 
        })
      });
      const data = await res.json();
      
      if (data.url) {
        if (newWindow) {
          newWindow.location.href = data.url;
        } else {
          window.location.href = data.url;
        }
      } else {
        if (newWindow) newWindow.close();
        alert(data.error || 'Erro ao iniciar o checkout.');
      }
      setIsLoading(null);
    } catch (err) {
      console.error(err);
      alert('Erro ao iniciar o checkout.');
      setIsLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div 
        className={`relative w-full max-w-4xl rounded-3xl border shadow-2xl overflow-hidden my-auto transition-all ${
          isDark 
            ? 'bg-[#121215] border-neutral-800 text-neutral-100' 
            : 'bg-white border-neutral-200 text-neutral-900'
        }`}
      >
        {/* Top Navigation Bar */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${
          isDark ? 'border-neutral-800/80 bg-[#17171c]' : 'border-neutral-200/80 bg-neutral-50/80'
        }`}>
          <div className="flex items-center gap-3">
            <ZenoLogo size={24} variant={settings.logoVariant} theme={resolvedTheme} />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base tracking-tight">ZENO Pro</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  isDark ? 'bg-neutral-800 text-neutral-300 border-neutral-700' : 'bg-neutral-200 text-neutral-700 border-neutral-300'
                }`}>
                  Zeno Inc.
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">Inteligência sem limites para seu dia a dia</p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Fechar"
            className={`p-2 rounded-full transition-colors ${
              isDark ? 'hover:bg-neutral-800 text-neutral-400 hover:text-white' : 'hover:bg-neutral-200 text-neutral-600 hover:text-black'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Reason Banner if triggered by locked model */}
        {reasonMessage && !isPro && (
          <div className={`px-6 py-2.5 text-xs font-medium flex items-center gap-2 border-b ${
            isDark ? 'bg-neutral-900 border-neutral-800 text-neutral-200' : 'bg-neutral-100 border-neutral-200 text-neutral-800'
          }`}>
            <Lock className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
            <span>{reasonMessage}</span>
          </div>
        )}

        {/* Modal Content Body */}
        <div className="p-6 sm:p-8 max-h-[82vh] overflow-y-auto scrollbar-custom space-y-8">
          
          {/* Main Headline */}
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {isPro ? 'Sua Assinatura ZENO Pro está Ativa' : 'Escolha o Plano ZENO Pro'}
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
              Obtenha acesso aos modelos avançados ZENO (Think, Search, Vision), velocidade prioritária de resposta e capacidade ilimitada de mensagens.
            </p>
          </div>

          {/* Active Pro Banner for Pro Users */}
          {isPro && (
            <div className={`p-5 sm:p-6 rounded-2xl border ${
              isDark ? 'bg-[#18181c] border-neutral-800 text-neutral-100' : 'bg-neutral-50 border-neutral-300 text-neutral-900'
            }`}>
              <div className="flex flex-col items-start gap-4">
                <div className="flex items-center gap-3.5 w-full">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base">
                        {settings.stripeSubscription?.status === 'trialing' && !settings.stripeSubscription.cancelAtPeriodEnd
                          ? 'Teste Gratuito'
                          : settings.stripeSubscription?.status === 'trialing' && settings.stripeSubscription.cancelAtPeriodEnd
                          ? 'Cobrança automática cancelada'
                          : 'Assinatura Ativa'}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        ZENO Pro
                      </span>
                    </div>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      {settings.stripeSubscription?.status === 'trialing' && settings.stripeSubscription.cancelAtPeriodEnd
                        ? 'Sua cobrança automática foi cancelada. Você continuará utilizando o ZENO Pro gratuitamente até o fim do período de avaliação. Nenhuma cobrança será realizada quando o teste terminar.'
                        : 'Você possui acesso ilimitado aos modelos avançados, velocidade prioritária e recursos exclusivos.'}
                    </p>
                  </div>
                </div>

                <div className="w-full pt-3 border-t border-neutral-800/60 flex flex-col sm:flex-row items-start sm:items-end justify-between text-xs sm:text-sm gap-4">
                  <div className="flex flex-col gap-1.5">
                    {settings.stripeSubscription?.status === 'trialing' && settings.stripeSubscription.trialEnd && (
                      <div className="text-neutral-400">
                        Dias restantes do teste: <strong className="text-neutral-200">
                          {Math.max(0, Math.ceil((settings.stripeSubscription.trialEnd * 1000 - Date.now()) / (1000 * 60 * 60 * 24)))} dias
                        </strong>
                      </div>
                    )}
                    
                    {settings.stripeSubscription?.status === 'active' && settings.stripeSubscription.currentPeriodEnd && (
                      <div className="text-neutral-400">
                        Data de expiração: <strong className="text-neutral-200">
                          {new Date(settings.stripeSubscription.currentPeriodEnd * 1000).toLocaleDateString('pt-BR')}
                        </strong>
                      </div>
                    )}

                    {!settings.stripeSubscription?.cancelAtPeriodEnd && (
                      <div className="text-neutral-400">
                        {settings.stripeSubscription?.status === 'trialing' ? 'Primeira cobrança' : 'Próxima cobrança'}: <strong className="text-neutral-200">
                          {settings.stripeSubscription?.currentPeriodEnd
                            ? new Date(settings.stripeSubscription.currentPeriodEnd * 1000).toLocaleDateString('pt-BR')
                            : settings.subscriptionRenewalDate || '23/08/2026'}
                          {' — '}
                          {settings.stripeSubscription?.amount ? (settings.stripeSubscription.amount / 100).toLocaleString('pt-BR', { style: 'currency', currency: settings.stripeSubscription.currency?.toUpperCase() || 'BRL' }) : 'R$ 0,00'}
                        </strong>
                      </div>
                    )}
                    
                    <div className="text-neutral-400">
                      Renovação automática: <strong className={settings.stripeSubscription?.cancelAtPeriodEnd ? "text-amber-400" : "text-emerald-400"}>
                        {settings.stripeSubscription?.cancelAtPeriodEnd ? 'Cancelada' : 'Ativada'}
                      </strong>
                    </div>
                  </div>
                  
                  <div className="flex w-full sm:w-auto">
                    {['trialing', 'active'].includes(settings.stripeSubscription?.status || '') && (
                      !settings.stripeSubscription!.cancelAtPeriodEnd ? (
                        <button
                          onClick={async () => {
                            const isTrial = settings.stripeSubscription?.status === 'trialing';
                          const confirmCancel = window.confirm(
                            isTrial 
                              ? "Tem certeza que deseja cancelar a cobrança automática? Você continuará tendo acesso Pro até o fim dos 7 dias, e depois não será cobrado."
                              : "Tem certeza que deseja cancelar a renovação automática? Você continuará tendo acesso Pro até o fim do ciclo atual."
                          );
                          if (!confirmCancel) return;
                          
                          try {
                            const res = await fetch('/api/subscription/cancel', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ subscription_id: settings.stripeSubscription?.subscriptionId })
                            });
                            const data = await res.json();
                            if (data.subscriptionId) {
                              alert(
                                isTrial
                                  ? "Sua cobrança automática foi cancelada. Você continuará utilizando o ZENO Pro gratuitamente até o fim do período de avaliação. Nenhuma cobrança será realizada quando o teste terminar."
                                  : "Sua renovação automática foi cancelada. Seu plano continuará ativo até o fim do período pago."
                              );
                              onUpdateSettings({
                                stripeSubscription: {
                                  ...settings.stripeSubscription!,
                                  cancelAtPeriodEnd: data.cancelAtPeriodEnd,
                                  status: data.status,
                                }
                              });
                            } else {
                              alert("Erro ao cancelar: " + data.error);
                            }
                          } catch (e) {
                            alert("Erro ao cancelar a assinatura.");
                          }
                        }}
                        className="w-full sm:w-auto text-red-400 hover:text-red-300 font-medium bg-red-400/10 hover:bg-red-400/20 px-4 py-2 sm:px-3 sm:py-1.5 rounded-lg transition-colors border border-red-400/20 whitespace-nowrap"
                      >
                        {settings.stripeSubscription?.status === 'trialing' ? 'Cancelar cobrança automática' : 'Cancelar renovação'}
                      </button>
                    ) : (
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch('/api/subscription/reactivate', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ subscription_id: settings.stripeSubscription?.subscriptionId })
                            });
                            const data = await res.json();
                            if (data.subscriptionId) {
                              alert("Sua cobrança automática foi reativada. Você continuará no plano ZENO Pro sem interrupções.");
                              onUpdateSettings({
                                stripeSubscription: {
                                  ...settings.stripeSubscription!,
                                  cancelAtPeriodEnd: data.cancelAtPeriodEnd,
                                  status: data.status,
                                }
                              });
                            } else {
                              alert("Erro ao reativar: " + data.error);
                            }
                          } catch (e) {
                            alert("Erro ao reativar a assinatura.");
                          }
                        }}
                        className="w-full sm:w-auto text-emerald-400 hover:text-emerald-300 font-medium bg-emerald-400/10 hover:bg-emerald-400/20 px-4 py-2 sm:px-3 sm:py-1.5 rounded-lg transition-colors border border-emerald-400/20 whitespace-nowrap"
                      >
                        Reativar cobrança automática
                      </button>
                    )
                  )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Used Trial Warning Banner */}
          {!isPro && settings.hasUsedFreeTrial && (
            <div className={`p-4 rounded-xl border text-sm text-center ${
              isDark ? 'bg-amber-900/20 border-amber-500/30 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}>
              <strong>Você já utilizou o período de avaliação gratuita do ZENO Pro.</strong> Para continuar utilizando os recursos Pro, escolha um dos planos disponíveis.
            </div>
          )}

          {/* Two Plan Cards - Desktop Side by Side, Mobile Stacked */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            
            {/* PLANO 1: ZENO Pro Mensal */}
            <div className={`p-6 sm:p-7 rounded-3xl border flex flex-col justify-between transition-all ${
              isDark 
                ? 'bg-[#1a1a1f] border-neutral-800 hover:border-neutral-700 text-neutral-100' 
                : 'bg-neutral-50 border-neutral-200 hover:border-neutral-300 text-neutral-900'
            }`}>
              <div>
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-extrabold text-xl tracking-tight">Plano Mensal</h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                    isDark ? 'bg-neutral-800 text-neutral-300 border-neutral-700' : 'bg-neutral-200 text-neutral-700 border-neutral-300'
                  }`}>
                    Cobrança Mensal
                  </span>
                </div>

                {/* Price */}
                <div className="mb-3">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-black tracking-tight">R$ 39,90</span>
                    <span className="text-xs text-neutral-400 font-medium">/ mês</span>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-neutral-400 leading-relaxed mb-6">
                  Ideal para quem deseja flexibilidade total com renovação a cada 30 dias.
                </p>

                {/* Features List */}
                <ul className="space-y-3 text-xs border-t border-neutral-800/70 pt-5 text-neutral-300">
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-neutral-300 flex-shrink-0 mt-0.5" />
                    <span>Acesso ilimitado a todos os modelos (ZENO, Think, Search, Vision)</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-neutral-300 flex-shrink-0 mt-0.5" />
                    <span>Respostas prioritárias com velocidade máxima sem filas</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-neutral-300 flex-shrink-0 mt-0.5" />
                    <span>Análise e upload de documentos extensos</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-neutral-300 flex-shrink-0 mt-0.5" />
                    <span>Cobrança mensal com cancelamento simples a qualquer momento</span>
                  </li>
                </ul>
              </div>

              {/* Stripe Buy Button Embed - Monthly */}
              <div className="mt-8 pt-4 border-t border-neutral-800/60 flex justify-center">
                <button
                  onClick={() => handleCheckout('monthly')}
                  disabled={isLoading === 'monthly'}
                  className="w-full bg-[#635BFF] hover:bg-[#5249ea] text-white py-3 px-6 rounded-xl font-semibold text-sm transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70 disabled:active:scale-100"
                >
                  {isLoading === 'monthly' ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <span>{settings.hasUsedFreeTrial ? 'Assinar Mensal' : 'Assinar Mensal (Teste 7 dias)'}</span>
                  )}
                </button>
              </div>
            </div>

            {/* PLANO 2: ZENO Pro Anual (Mais vantajoso) */}
            <div className={`relative p-6 sm:p-7 rounded-3xl border-2 flex flex-col justify-between transition-all shadow-xl ${
              isDark 
                ? 'bg-[#1c1c22] border-neutral-600 text-neutral-100' 
                : 'bg-white border-neutral-900 text-neutral-900'
            }`}>
              {/* Highlight Badge */}
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full bg-neutral-100 text-neutral-950 font-black text-[10px] uppercase tracking-wider shadow-md border border-neutral-300 flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-neutral-950 fill-neutral-950" />
                <span>Mais vantajoso</span>
              </div>

              <div>
                {/* Header */}
                <div className="flex items-center justify-between mb-2 pt-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-xl tracking-tight">Plano Anual</h3>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-neutral-800 text-neutral-200 border border-neutral-700">
                    Recomendado
                  </span>
                </div>

                {/* Price */}
                <div className="mb-3">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-black tracking-tight">R$ 399,90</span>
                    <span className="text-xs text-neutral-400 font-medium">/ ano</span>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-neutral-400 leading-relaxed mb-6">
                  Economize pagando anualmente e obtenha o melhor valor pelo ZENO Pro.
                </p>

                {/* Features List */}
                <ul className="space-y-3 text-xs border-t border-neutral-800/70 pt-5 text-neutral-300">
                  <li className="flex items-start gap-2.5 font-semibold text-neutral-100">
                    <Sparkles className="w-4 h-4 text-neutral-200 flex-shrink-0 mt-0.5" />
                    <span>Economia equivalente a 2 meses gratuitos</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-neutral-300 flex-shrink-0 mt-0.5" />
                    <span>Acesso ilimitado aos modelos avançados de raciocínio</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-neutral-300 flex-shrink-0 mt-0.5" />
                    <span>Prioridade máxima de processamento nos servidores</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-neutral-300 flex-shrink-0 mt-0.5" />
                    <span>Acesso antecipado a novos recursos e atualizações</span>
                  </li>
                </ul>
              </div>

              {/* Stripe Buy Button Embed - Annual */}
              <div className="mt-8 pt-4 border-t border-neutral-800/60 flex justify-center">
                <button
                  onClick={() => handleCheckout('annual')}
                  disabled={isLoading === 'annual'}
                  className="w-full bg-[#635BFF] hover:bg-[#5249ea] text-white py-3 px-6 rounded-xl font-semibold text-sm transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70 disabled:active:scale-100"
                >
                  {isLoading === 'annual' ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <span>{settings.hasUsedFreeTrial ? 'Assinar Anual' : 'Assinar Anual (Teste 7 dias)'}</span>
                  )}
                </button>
              </div>
            </div>

          </div>

          {/* Footer Info */}
          <div className="text-center pt-2 text-xs text-neutral-500 space-y-1">
            <div className="flex items-center justify-center gap-2 font-medium">
              <Shield className="w-4 h-4 text-neutral-400" />
              <span>Pagamento seguro via Stripe com criptografia SSL de 256 bits.</span>
            </div>
            <p className="text-[11px] text-neutral-500">
              Assinaturas renovadas automaticamente. Cancele facilmente quando desejar nas configurações de conta.
            </p>
          </div>

        </div>

        {/* Footer Bar */}
        <div className={`px-6 py-3 border-t text-center text-[10px] text-neutral-500 ${
          isDark ? 'border-neutral-800 bg-[#17171c]' : 'border-neutral-200 bg-neutral-50'
        }`}>
          <span>Zeno Inc. Technologies • Checkout Oficial Stripe • Todos os Direitos Reservados</span>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionModal;
