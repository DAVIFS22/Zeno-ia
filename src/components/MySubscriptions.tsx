import React, { useState } from 'react';
import { UserSettings } from '../types';
import { Sparkles, Calendar, CheckCircle2, AlertCircle } from 'lucide-react';

interface MySubscriptionsProps {
  settings: UserSettings;
  onUpdateSettings: (newSettings: Partial<UserSettings>) => void;
}

export function MySubscriptions({ settings, onUpdateSettings }: MySubscriptionsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const isPro = settings.plan === 'ZENO Pro';
  const sub = settings.stripeSubscription;
  const isTrial = sub?.status === 'trialing';

  const handleCancel = async () => {
    const confirmCancel = window.confirm(
      isTrial
        ? "Deseja cancelar a cobrança automática? Você continuará utilizando o ZENO Pro até o final do período de avaliação."
        : "Deseja cancelar a renovação automática? Você continuará utilizando o ZENO Pro até o final do período contratado."
    );
    if (!confirmCancel) return;

    setIsLoading(true);
    console.log("[MySubscriptions] Enviando request para /api/subscription/cancel com subscription_id:", sub?.subscriptionId);
    try {
      const res = await fetch('/api/subscription/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription_id: sub?.subscriptionId })
      });
      console.log("[MySubscriptions] Resposta de cancelamento recebida, status:", res.status);
      const data = await res.json();
      console.log("[MySubscriptions] Dados parseados (cancel):", data);
      
      if (data.subscriptionId) {
        alert("Sua renovação foi cancelada. Você continuará com acesso até o término da assinatura.");
        onUpdateSettings({
          stripeSubscription: {
            ...sub!,
            cancelAtPeriodEnd: data.cancelAtPeriodEnd,
            status: data.status,
          }
        });
      } else {
        alert("Erro ao cancelar: " + data.error);
      }
    } catch (e) {
      alert("Erro ao cancelar a assinatura.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReactivate = async () => {
    setIsLoading(true);
    console.log("[MySubscriptions] Enviando request para /api/subscription/reactivate com subscription_id:", sub?.subscriptionId);
    try {
      const res = await fetch('/api/subscription/reactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription_id: sub?.subscriptionId })
      });
      console.log("[MySubscriptions] Resposta de reativação recebida, status:", res.status);
      const data = await res.json();
      console.log("[MySubscriptions] Dados parseados (reactivate):", data);
      
      if (data.subscriptionId) {
        alert("Sua cobrança automática foi reativada. Você continuará no plano ZENO Pro sem interrupções.");
        onUpdateSettings({
          stripeSubscription: {
            ...sub!,
            cancelAtPeriodEnd: data.cancelAtPeriodEnd,
            status: data.status,
          }
        });
      } else {
        alert("Erro ao reativar: " + data.error);
      }
    } catch (e) {
      alert("Erro ao reativar a assinatura.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isPro && !isTrial && !sub) {
    return (
      <div className="flex flex-col items-center justify-center text-center space-y-4 py-12">
        <div className="w-16 h-16 rounded-full bg-neutral-800 flex items-center justify-center mb-4">
          <Sparkles className="w-8 h-8 text-neutral-500" />
        </div>
        <h3 className="text-xl font-semibold text-white">Você não possui assinaturas ativas</h3>
        <p className="text-neutral-400 max-w-sm">Assine o ZENO Pro para ter acesso ilimitado a todos os recursos avançados.</p>
      </div>
    );
  }

  const amountStr = sub?.amount ? (sub.amount / 100).toLocaleString('pt-BR', { style: 'currency', currency: sub.currency?.toUpperCase() || 'BRL' }) : 'R$ 0,00';
  const periodEndStr = sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd * 1000).toLocaleDateString('pt-BR') : settings?.subscriptionRenewalDate || '23/08/2026';
  
  // Calculate remaining days
  let remainingDays = null;
  if (sub?.currentPeriodEnd) {
    const end = new Date(sub.currentPeriodEnd * 1000);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    remainingDays = Math.ceil(diff / (1000 * 3600 * 24));
  } else if (isTrial && sub?.trialEnd) {
    const end = new Date(sub.trialEnd * 1000);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    remainingDays = Math.ceil(diff / (1000 * 3600 * 24));
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {sub?.cancelAtPeriodEnd ? (
        <div className="p-4 rounded-xl border bg-amber-900/20 border-amber-500/30 text-amber-200 text-sm flex gap-3 items-start">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-400" />
          <div className="space-y-1">
            <strong className="block text-amber-400 text-base">Renovação cancelada</strong>
            <p>Você continuará utilizando o ZENO Pro até {periodEndStr}.</p>
            <p>Nenhuma cobrança futura será realizada.</p>
          </div>
        </div>
      ) : null}

      <div className="p-6 rounded-2xl bg-[#202020] border border-[#2E2E2E] space-y-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="text-xl font-semibold text-white">
              {isTrial ? 'Teste Gratuito' : (settings?.billingCycle === 'annual' ? 'ZENO Pro Anual' : 'ZENO Pro Mensal')}
            </h3>
            <p className="text-sm text-neutral-400">
              {isTrial ? 'Acesso total durante o período de avaliação.' : 'Acesso ilimitado a todos os recursos.'}
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase border ${sub?.cancelAtPeriodEnd ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
            {sub?.cancelAtPeriodEnd ? 'Cancelada' : 'Ativa'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-[#313131] pt-6">
          <div className="space-y-1">
            <span className="text-xs text-neutral-500 uppercase font-medium">Plano Atual</span>
            <p className="text-sm text-white font-medium">{isTrial ? 'Grátis (7 dias)' : (settings.billingCycle === 'annual' ? 'Pro Anual' : 'Pro Mensal')}</p>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-neutral-500 uppercase font-medium">Status da Assinatura</span>
            <p className="text-sm text-white font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Ativa
            </p>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-neutral-500 uppercase font-medium">Renovação Automática</span>
            <p className="text-sm text-white font-medium">
              {sub?.cancelAtPeriodEnd ? (
                <span className="text-amber-400">Cancelada</span>
              ) : (
                <span className="text-emerald-400">Ativada</span>
              )}
            </p>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-neutral-500 uppercase font-medium">Valor da Assinatura</span>
            <p className="text-sm text-white font-medium">{amountStr} {settings.billingCycle === 'annual' ? '/ano' : '/mês'}</p>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-neutral-500 uppercase font-medium">Data de Vencimento</span>
            <p className="text-sm text-white font-medium flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-neutral-400" />
              {periodEndStr}
            </p>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-neutral-500 uppercase font-medium">
              {!sub?.cancelAtPeriodEnd ? (isTrial ? 'Primeira Cobrança' : 'Próxima Cobrança') : 'Fim do Acesso'}
            </span>
            <p className="text-sm text-white font-medium">
              {periodEndStr}
              {remainingDays !== null && remainingDays >= 0 && (
                <span className="text-neutral-500 text-xs ml-2">({remainingDays} dias restantes)</span>
              )}
            </p>
          </div>
        </div>

        <div className="border-t border-[#313131] pt-6 flex flex-col sm:flex-row gap-3">
          {sub?.cancelAtPeriodEnd ? (
            <button
              onClick={handleReactivate}
              disabled={isLoading}
              className="px-6 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 disabled:opacity-50 text-emerald-400 border border-emerald-500/20 font-medium text-sm transition-colors text-center w-full"
            >
              {isLoading ? 'Aguarde...' : 'Reativar renovação automática'}
            </button>
          ) : (
            <button
              onClick={handleCancel}
              disabled={isLoading}
              className="px-6 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50 text-red-400 border border-red-500/20 font-medium text-sm transition-colors text-center w-full"
            >
              {isLoading ? 'Aguarde...' : (isTrial ? 'Cancelar cobrança automática' : 'Cancelar renovação')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
