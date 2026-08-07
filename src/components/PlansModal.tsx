import React, { useState } from 'react';
import { X, Check, Loader2, Sparkles, ShieldCheck } from 'lucide-react';
import { UserSettings } from '../types';
import { useTranslation } from '../i18n';

interface PlansModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  userId: string;
  onOpenCheckout?: (plan: string) => Promise<void> | void;
}

export const PlansModal: React.FC<PlansModalProps> = ({
  isOpen,
  onClose,
  settings,
  userId,
  onOpenCheckout,
}) => {
  const { t } = useTranslation();
  const [loadingPlan, setLoadingPlan] = useState<'monthly' | 'annual' | null>(null);

  if (!isOpen) return null;

  const handleSubscribe = async (plan: 'monthly' | 'annual') => {
    setLoadingPlan(plan);
    try {
      if (onOpenCheckout) {
        await onOpenCheckout(plan);
      } else {
        const res = await fetch('/api/create-checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            plan: plan === 'annual' ? 'annual' : 'monthly', 
            email: settings?.userEmail || '', 
            hasUsedFreeTrial: settings?.hasUsedFreeTrial,
            userId
          })
        });
        const data = await res.json();
        if (data.url) {
          window.open(data.url, '_blank');
        } else {
          alert(data.error || t.plans.error);
        }
      }
    } catch (err) {
      alert(t.plans.processError);
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn" 
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-4xl bg-[#121215] rounded-t-[32px] sm:rounded-3xl shadow-2xl p-6 sm:p-10 max-h-[92vh] overflow-y-auto border border-[#2C2C2E] animate-slideUp sm:animate-none" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Handle */}
        <div className="w-full flex justify-center pb-4 sm:hidden">
          <div className="w-12 h-1.5 bg-neutral-700 rounded-full"></div>
        </div>

        <div className="flex justify-between items-start mb-8">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-500/10 border border-neutral-500/20 text-neutral-400 text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              <span>ZENO Pro Oficial</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">{t.plans.title}</h2>
            <p className="text-neutral-400 text-sm">{t.plans.subtitle}</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2.5 rounded-full hover:bg-[#232326] text-neutral-400 hover:text-white transition-colors"
            aria-label={t.common.close}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1 - Mensal */}
          <div className="border border-[#2C2C2E] rounded-3xl p-6 sm:p-8 flex flex-col justify-between hover:border-[#2C2C2E] transition-all duration-300 bg-[#121212]/60 shadow-lg relative group">
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-white">{t.plans.monthly}</h3>
                <span className="text-xs px-2.5 py-1 rounded-full bg-[#232326] text-neutral-300 font-medium">{t.plans.flexible}</span>
              </div>
              <div className="text-3xl sm:text-4xl font-bold text-white mb-2 tracking-tight">
                {t.plans.monthlyPrice} <span className="text-sm font-normal text-neutral-400">{t.plans.monthlyPeriod}</span>
              </div>
              <p className="text-neutral-400 text-sm mb-6">{t.plans.monthlyDesc}</p>
              
              <ul className="space-y-3.5 mb-8">
                {[
                  t.plans.features.premiumModels,
                  t.plans.features.priority,
                  t.plans.features.images,
                  t.plans.features.webSearch,
                  t.plans.features.docs,
                  t.plans.features.cancel
                ].map((item, idx) => (
                  <li key={idx} className="flex items-start text-neutral-300 text-sm">
                    <Check className="w-4 h-4 text-white mr-3 flex-shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3 pt-4 border-t border-[#2C2C2E]/80">
              <div className="flex items-center justify-between text-xs text-neutral-400 px-1">
                <span>{t.plans.freeTrial}</span>
                <span className="text-sky-400 font-medium">{t.plans.noCommitment}</span>
              </div>
              <button
                onClick={() => handleSubscribe('monthly')}
                disabled={loadingPlan !== null}
                className="w-full bg-white text-black py-4 rounded-2xl font-semibold hover:bg-neutral-200 active:scale-[0.98] transition-all duration-200 disabled:opacity-70 flex items-center justify-center gap-2 text-sm shadow-sm"
              >
                {loadingPlan === 'monthly' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t.plans.processing}</span>
                  </>
                ) : (
                  <span>{t.plans.subscribeMonthly}</span>
                )}
              </button>
            </div>
          </div>

          {/* Card 2 - Anual */}
          <div className="border border-neutral-600 rounded-3xl p-6 sm:p-8 flex flex-col justify-between relative bg-gradient-to-b from-neutral-900 to-neutral-950 text-white shadow-2xl group ring-1 ring-white/20">
            <div className="absolute -top-3.5 left-6 bg-white text-black text-[11px] uppercase tracking-wider px-3.5 py-1 rounded-full font-bold shadow-md flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-neutral-500 fill-neutral-500" />
              <span>⭐ {t.plans.bestValue}</span>
            </div>

            <div>
              <div className="flex justify-between items-center mb-4 mt-2">
                <h3 className="text-lg font-semibold">{t.plans.annual}</h3>
                <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 text-sky-400 font-medium border border-sky-500/30">{t.plans.savePercent}</span>
              </div>
              <div className="text-3xl sm:text-4xl font-bold mb-2 tracking-tight">
                {t.plans.annualPrice} <span className="text-sm font-normal text-neutral-400">{t.plans.annualPeriod}</span>
              </div>
              <p className="text-neutral-300 text-sm mb-6">{t.plans.annualDesc}</p>
              
              <ul className="space-y-3.5 mb-8">
                {[
                  t.plans.features.unlimited,
                  t.plans.features.latency,
                  t.plans.features.earlyAccess,
                  t.plans.features.support,
                  t.plans.features.economy
                ].map((item, idx) => (
                  <li key={idx} className="flex items-start text-neutral-200 text-sm">
                    <Check className="w-4 h-4 text-sky-400 mr-3 flex-shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3 pt-4 border-t border-[#2C2C2E]">
              <div className="flex items-center justify-between text-xs text-neutral-400 px-1">
                <span>{t.plans.freeTrial}</span>
                <span className="text-sky-400 font-medium">{t.plans.guarantee}</span>
              </div>
              <button
                onClick={() => handleSubscribe('annual')}
                disabled={loadingPlan !== null}
                className="w-full bg-white text-black py-4 rounded-2xl font-semibold hover:bg-neutral-200 active:scale-[0.98] transition-all duration-200 disabled:opacity-70 flex items-center justify-center gap-2 text-sm shadow-xl"
              >
                {loadingPlan === 'annual' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    <span>{t.plans.processingAnnual}</span>
                  </>
                ) : (
                  <span>{t.plans.subscribeAnnual}</span>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-[#2C2C2E]/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-neutral-400 text-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-sky-400 flex-shrink-0" />
            <span>{t.plans.securePayment}</span>
          </div>
          <span>{t.plans.cancelAnytime}</span>
        </div>
      </div>
    </div>
  );
};

