import React, { useState, useEffect } from 'react';
import { X, Check, Loader2, AlertCircle, Star } from 'lucide-react';
import { UserSettings } from '../types';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useTranslation } from '../i18n';

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
  const { t, language } = useTranslation();
  const [isLoading, setIsLoading] = useState<'monthly' | 'annual' | null>(null);
  const { isPro, refreshSubscription, subscription, loading } = useSubscription();

  const handleOpenPortal = async () => {
    try {
      const response = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: settings.userEmail }),
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(t.subscription.portalError);
      }
    } catch (err) {
      console.error(err);
      alert(t.subscription.portalError);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshSubscription();
    }
  }, [isOpen, refreshSubscription]);

  if (!isOpen) return null;

  // Render loading state if fetching subscription
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/50 backdrop-blur-sm">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-900" />
      </div>
    );
  }

  const localeMap: Record<string, string> = {
    pt: 'pt-BR',
    es: 'es-ES',
    fr: 'fr-FR',
    zh: 'zh-CN'
  };

  const formattedRenewDate = subscription.currentPeriodEnd 
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString(localeMap[language] || 'pt-BR')
    : 'N/A';

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/buy-button.js';
    script.async = true;
    document.head.appendChild(script);
    return () => {
      if (document.head.contains(script)) document.head.removeChild(script);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/50 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-4xl bg-white border border-neutral-100 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 md:p-8">
          <h2 className="text-xl font-medium text-neutral-900 tracking-tight">ZENO Pro</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-neutral-100 text-neutral-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 md:px-10 md:pb-10">
          
          {subscription.isPro && subscription.status === 'active' ? (
            <div className="max-w-xl mx-auto border border-neutral-100 rounded-3xl p-8 bg-neutral-50/50">
              <div className="flex items-center justify-between mb-8">
                <span className="bg-[#1C1C1E] text-white text-xs font-medium px-3 py-1 rounded-full uppercase tracking-wider">{t.subscription.currentPlan}</span>
                <span className="text-sm text-neutral-500 font-medium">{subscription.plan}</span>
              </div>
              <div className="space-y-4 text-sm text-neutral-700">
                <div className="flex justify-between">
                  <span>{t.subscription.status}</span>
                  <span className="font-medium text-neutral-900 capitalize">{t.subscription.active}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t.subscription.autoRenewal}</span>
                  <span className="font-medium text-neutral-900">{subscription.cancelAtPeriodEnd ? t.subscription.off : t.subscription.on}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t.subscription.nextRenewal}</span>
                  <span className="font-medium text-neutral-900">{formattedRenewDate}</span>
                </div>
              </div>
              <button 
                onClick={handleOpenPortal}
                className="w-full mt-10 py-4 bg-[#1C1C1E] text-white rounded-2xl hover:bg-[#232326] transition-all font-medium text-sm"
              >
                {t.subscription.manageBtn}
              </button>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <h1 className="text-3xl font-medium text-neutral-900 mb-3 tracking-tight">{t.plans.title}</h1>
                <p className="text-neutral-500 text-sm">{t.subscription.unlockFeatures}</p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Monthly */}
                <div className="border border-neutral-100 rounded-3xl p-8 flex flex-col hover:border-neutral-200 transition-all shadow-sm hover:shadow-md">
                  <h3 className="text-lg font-medium text-neutral-900 mb-1">{t.plans.monthly}</h3>
                  <p className="text-neutral-500 text-xs mb-4">{t.subscription.monthlyBilling}</p>
                  <div className="text-3xl font-medium text-neutral-900 mb-2">{t.plans.monthlyPrice} <span className="text-base text-neutral-400 font-normal">{t.plans.monthlyPeriod}</span></div>
                  <p className="text-neutral-600 text-sm mb-6">{t.plans.monthlyDesc}</p>
                  <ul className="space-y-4 mb-8 flex-1">
                    {[
                      t.plans.features.premiumModels,
                      t.plans.features.priority,
                      t.plans.features.images,
                      t.plans.features.webSearch,
                      t.plans.features.docs,
                      t.plans.features.cancel
                    ].map(item => (
                      <li key={item} className="flex items-center text-neutral-600 text-sm">
                        <Check className="w-4 h-4 text-neutral-900 mr-3" /> {item}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-neutral-500 mb-4 font-medium">{t.plans.freeTrial}</p>
                  <stripe-buy-button
                    buy-button-id="buy_btn_1Twayr15V1MLn6Z9YMSXbfKb"
                    publishable-key={import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY}
                    customer-email={settings.userEmail}
                  ></stripe-buy-button>
                </div>

                {/* Annual */}
                <div className="border border-neutral-900 rounded-3xl p-8 flex flex-col relative bg-[#1C1C1E] text-white">
                  <div className="absolute -top-3 left-6 bg-white text-neutral-900 text-[10px] uppercase tracking-wider px-3 py-1 rounded-full font-bold">{t.subscription.bestValue}</div>
                  <h3 className="text-lg font-medium mb-1">{t.plans.annual}</h3>
                  <p className="text-neutral-400 text-xs mb-4">{t.subscription.annualBilling}</p>
                  <div className="text-3xl font-medium mb-2">{t.plans.annualPrice} <span className="text-base text-neutral-400 font-normal">{t.plans.annualPeriod}</span></div>
                  <p className="text-neutral-300 text-sm mb-6">{t.subscription.saveAnnual}</p>
                  <ul className="space-y-4 mb-8 flex-1">
                    {[
                      t.plans.features.unlimited,
                      t.plans.features.latency,
                      t.plans.features.earlyAccess,
                      t.plans.features.support,
                      t.plans.features.economy
                    ].map(item => (
                      <li key={item} className="flex items-center text-neutral-300 text-sm">
                        <Check className="w-4 h-4 text-white mr-3" /> {item}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-neutral-400 mb-4 font-medium">{t.plans.freeTrial}</p>
                  <stripe-buy-button
                    buy-button-id="buy_btn_1Twayn15V1MLn6Z9FwljdejD"
                    publishable-key={import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY}
                    customer-email={settings.userEmail}
                  ></stripe-buy-button>
                </div>
              </div>
              <p className="text-center text-xs text-neutral-400 mt-10">{t.subscription.secureStripe}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubscriptionModal;
