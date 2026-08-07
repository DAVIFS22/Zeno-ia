import React, { useState, useEffect } from 'react';
import { UserSettings } from '../types';
import { 
  Sparkles, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  CreditCard, 
  RefreshCw, 
  FileText, 
  Download, 
  ExternalLink, 
  ShieldCheck, 
  XCircle, 
  ArrowRight,
  Loader2
} from 'lucide-react';
import { getOrCreateUserId } from '../lib/userId';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useTranslation } from '../i18n';

export interface SubscriptionManagerProps {
  userId: string;
  settings: UserSettings;
  onUpdateSettings?: (newSettings: Partial<UserSettings>) => void;
  onOpenCheckout?: (plan?: 'monthly' | 'annual') => void;
}

interface InvoiceItem {
  id: string;
  number?: string;
  amount: number;
  currency: string;
  status: string;
  date: number;
  description?: string;
  pdfUrl?: string | null;
  hostedUrl?: string | null;
}

export const SubscriptionManager: React.FC<SubscriptionManagerProps> = ({
  userId,
  settings,
  onUpdateSettings,
  onOpenCheckout
}) => {
  const { t, language } = useTranslation();
  const [isLoadingStatus, setIsLoadingStatus] = useState<boolean>(true);
  const [statusData, setStatusData] = useState<any>(null);
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState<boolean>(false);
  
  // Action loading states
  const [actionType, setActionType] = useState<'cancel' | 'reactivate' | 'portal' | 'update_card' | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  
  // Confirmation modal state for cancellation
  const [showCancelConfirmModal, setShowCancelConfirmModal] = useState<boolean>(false);

  // Modal for fallback card edit
  const [showCardModal, setShowCardModal] = useState(false);
  const [cardForm, setCardForm] = useState({ brand: 'visa', last4: '4242', expMonth: '12', expYear: '2028' });

  const userEmail = settings.userEmail || '';
  const { isPro, refreshSubscription } = useSubscription();

  const localeMap: Record<string, string> = {
    pt: 'pt-BR',
    es: 'es-ES',
    fr: 'fr-FR',
    zh: 'zh-CN'
  };

  const currentLocale = localeMap[language] || 'pt-BR';

  // 1. Initial & API Status Fetch from /api/subscription/status (Stripe single source of truth)
  const fetchSubscriptionStatus = async () => {
    if (!userId) return;
    setIsLoadingStatus(true);
    try {
      const cacheBuster = Date.now();
      const res = await fetch(`/api/subscription/status?userId=${userId}&email=${encodeURIComponent(userEmail)}&_t=${cacheBuster}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      const data = await res.json();
      if (data) {
        setStatusData(data);
      }
    } catch (err) {
      console.warn("Erro ao carregar status da assinatura:", err);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  // 2. Fetch Invoices / Payment History
  const fetchInvoices = async () => {
    if (!userId) return;
    setIsLoadingInvoices(true);
    try {
      const res = await fetch(`/api/subscription/invoices?userId=${userId}&email=${encodeURIComponent(userEmail)}`);
      const data = await res.json();
      if (data && Array.isArray(data.invoices)) {
        setInvoices(data.invoices);
      }
    } catch (err) {
      console.warn("Erro ao buscar histórico de faturas:", err);
    } finally {
      setIsLoadingInvoices(false);
    }
  };

  useEffect(() => {
    fetchSubscriptionStatus();
    fetchInvoices();
  }, [userId, userEmail]);

  // 3. Realtime Firestore Sync
  useEffect(() => {
    if (!userId) return;
    const subDocRef = doc(db, 'subscriptions', userId);
    const unsubscribe = onSnapshot(subDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const firestoreData = snapshot.data();
        setStatusData((prev: any) => ({
          ...prev,
          sub: firestoreData,
          autoRenew: firestoreData.autoRenew ?? prev?.autoRenew,
          cancelAtPeriodEnd: firestoreData.cancelAtPeriodEnd ?? prev?.cancelAtPeriodEnd,
          subscriptionStatus: firestoreData.status || prev?.subscriptionStatus
        }));
      }
    }, (err) => {
      console.warn("Realtime Firestore listener warning:", err?.message || err);
    });

    return () => unsubscribe();
  }, [userId]);

  // Derived Values - Strictly sourced from Stripe status data
  const effectiveSub = statusData?.sub || settings.stripeSubscription;
  
  // Use statusData if available, otherwise fallback to effectiveSub
  const currentStatus = statusData?.subscriptionStatus || effectiveSub?.status || 'free';
  const isTrialing = currentStatus === 'trialing';
  
  // isCancelled means it's set to NOT renew at the end of the period
  const isCancelled = statusData?.autoRenew === false || 
                     statusData?.cancelAtPeriodEnd === true || 
                     statusData?.cancel_at_period_end === true || 
                     currentStatus === 'cancel_at_period_end';

  // isExpired should ONLY be true if the user is truly not Pro and the status reflects expiration
  const isExpired = !isPro && (currentStatus === 'expired' || currentStatus === 'canceled' || currentStatus === 'past_due' || currentStatus === 'unpaid');

  const trialEndTimestamp = statusData?.trialEnd || statusData?.trial_end || effectiveSub?.trialEnd || effectiveSub?.trial_end;
  const formattedTrialEnd = trialEndTimestamp ? new Date(trialEndTimestamp * 1000).toLocaleDateString(currentLocale) : null;

  const periodEndIso = statusData?.currentPeriodEnd || statusData?.current_period_end || statusData?.renewDate || statusData?.expirationDate || effectiveSub?.renewDate || effectiveSub?.currentPeriodEnd;
  const formattedDate = (isPro && periodEndIso) ? new Date(periodEndIso).toLocaleDateString(currentLocale) : t.subscriptionManager.activeUntil;
  
  const planName = statusData?.plan || statusData?.subscriptionPlan || (settings.billingCycle === 'annual' ? t.plans.annual : t.plans.monthly);
  const priceVal = statusData?.price !== undefined ? statusData.price : (settings.billingCycle === 'annual' ? 399.90 : 39.90);
  const amountFormatted = priceVal.toLocaleString(currentLocale, { style: 'currency', currency: statusData?.currency?.toUpperCase() || 'BRL' });

  // Payment Method
  const paymentMethod = statusData?.paymentMethod || statusData?.payment_method || effectiveSub?.paymentMethod || null;

  // Trigger Cancel Confirmation Modal
  const handleOpenCancelConfirmation = () => {
    setShowCancelConfirmModal(true);
  };

  // Status mapping for better UX
  const getStatusLabel = () => {
    if (isTrialing) return 'Teste Grátis Ativo';
    if (isExpired) return 'Assinatura Expirada';
    if (isCancelled && isPro) return 'Ativa (Não renova)';
    if (isPro) return 'Assinatura Ativa';
    return 'Plano Gratuito';
  };

  const getStatusBadgeLabel = () => {
    if (isExpired) return t.subscriptionManager.expired;
    if (isTrialing) return t.subscriptionManager.trial30;
    if (isCancelled) return t.subscription.off;
    if (isPro) return t.subscriptionManager.activeSub;
    return t.subscriptionManager.free;
  };

  // Execute Cancel Auto-Renew
  const executeCancelAutoRenew = async () => {
    setShowCancelConfirmModal(false);
    setActionType('cancel');
    setFeedback(null);

    try {
      const res = await fetch('/api/subscription/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId, 
          subscription_id: statusData?.subscriptionId || statusData?.id || effectiveSub?.subscriptionId,
          email: userEmail
        })
      });
      const data = await res.json();

      if (data.success) {
        await fetchSubscriptionStatus();
        await refreshSubscription();

        const cancelDate = data.formattedDate || (data.current_period_end ? new Date(data.current_period_end).toLocaleDateString(currentLocale) : formattedDate);
        setFeedback({ 
          type: 'info', 
          message: t.subscriptionManager.cancelSuccess.replace('{date}', cancelDate)
        });

        if (onUpdateSettings) {
          onUpdateSettings({
            stripeSubscription: {
              ...effectiveSub,
              autoRenew: false,
              cancelAtPeriodEnd: true,
              status: 'active'
            }
          });
        }
      } else {
        setFeedback({ type: 'error', message: data.error || "Não foi possível cancelar a renovação no Stripe. Tente novamente." });
      }
    } catch (e: any) {
      setFeedback({ type: 'error', message: e.message || "Falha na conexão ao tentar cancelar a renovação." });
    } finally {
      setActionType(null);
    }
  };

  // Action: Reactivate Auto-Renew
  const handleReactivateAutoRenew = async () => {
    setActionType('reactivate');
    setFeedback(null);

    try {
      const res = await fetch('/api/subscription/reactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId, 
          subscription_id: statusData?.subscriptionId || statusData?.id || effectiveSub?.subscriptionId,
          email: userEmail
        })
      });
      const data = await res.json();

      if (data.success) {
        await fetchSubscriptionStatus();
        await refreshSubscription();

        setFeedback({ 
          type: 'success', 
          message: t.subscriptionManager.reactivateSuccess 
        });

        if (onUpdateSettings) {
          onUpdateSettings({
            stripeSubscription: {
              ...effectiveSub,
              autoRenew: true,
              cancelAtPeriodEnd: false,
              status: 'active'
            }
          });
        }
      } else {
        setFeedback({ type: 'error', message: data.error || "Não foi possível reativar a renovação no Stripe." });
      }
    } catch (e: any) {
      setFeedback({ type: 'error', message: e.message || "Erro de conexão ao reativar a renovação." });
    } finally {
      setActionType(null);
    }
  };

  // Action: Stripe Customer Portal / Update Payment Method
  const handleOpenStripePortal = async () => {
    setActionType('portal');
    try {
      const res = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, email: userEmail })
      });
      const data = await res.json();

      if (data.url) {
        window.open(data.url, '_blank');
      } else {
        // Fallback to in-app card update modal if portal unavailable
        setShowCardModal(true);
      }
    } catch (e) {
      setShowCardModal(true);
    } finally {
      setActionType(null);
    }
  };

  // Save Card Fallback
  const handleSaveCardMethod = async () => {
    setActionType('update_card');
    try {
      const res = await fetch('/api/subscription/update-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          paymentMethod: {
            brand: cardForm.brand,
            last4: cardForm.last4,
            expMonth: Number(cardForm.expMonth),
            expYear: Number(cardForm.expYear)
          }
        })
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({ type: 'success', message: t.subscriptionManager.saveCard });
        setShowCardModal(false);
        setStatusData((prev: any) => ({
          ...prev,
          paymentMethod: data.paymentMethod
        }));
      } else {
        setFeedback({ type: 'error', message: "Erro ao atualizar a forma de pagamento." });
      }
    } catch (e) {
      setFeedback({ type: 'error', message: "Erro na comunicação com o servidor." });
    } finally {
      setActionType(null);
    }
  };

  if (isLoadingStatus) {
    return (
      <div className="p-12 text-center text-xs text-neutral-400 space-y-3 animate-pulse">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-neutral-400" />
        <p className="font-medium">{t.subscriptionManager.loading}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-neutral-100 max-w-4xl mx-auto">
      
      {/* Component Title & Scope */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2C2C2E] pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-neutral-400" />
            <span>{t.subscriptionManager.manageTitle}</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            {t.subscriptionManager.manageDesc}
          </p>
        </div>

        {onOpenCheckout && !isPro && (
          <button
            onClick={() => onOpenCheckout()}
            className="px-4 py-2 rounded-xl bg-white text-black hover:bg-neutral-200 font-semibold text-xs transition-colors flex items-center gap-1.5 self-start sm:self-auto"
          >
            <span>{t.subscriptionManager.upgradePro}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Dynamic Feedback Banner */}
      {feedback && (
        <div className={`p-4 rounded-2xl border text-xs sm:text-sm flex items-start gap-3 animate-fadeIn ${
          feedback.type === 'success' 
            ? 'bg-sky-500/10 border-sky-500/30 text-sky-200'
            : feedback.type === 'error'
            ? 'bg-neutral-500/10 border-neutral-500/30 text-neutral-200'
            : 'bg-sky-500/10 border-sky-500/30 text-sky-200'
        }`}>
          {feedback.type === 'success' && <CheckCircle2 className="w-5 h-5 text-sky-400 flex-shrink-0 mt-0.5" />}
          {feedback.type === 'error' && <XCircle className="w-5 h-5 text-neutral-400 flex-shrink-0 mt-0.5" />}
          {feedback.type === 'info' && <AlertTriangle className="w-5 h-5 text-sky-400 flex-shrink-0 mt-0.5" />}
          <div className="leading-relaxed font-medium">{feedback.message}</div>
        </div>
      )}

      {/* Expired Plan Banner */}
      {isExpired && !isTrialing && (
        <div className="p-5 rounded-2xl bg-neutral-500/10 border border-neutral-500/30 text-neutral-200 text-xs sm:text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
          <div className="flex items-center gap-3">
            <XCircle className="w-6 h-6 text-neutral-400 flex-shrink-0" />
            <div>
              <strong className="block text-neutral-300 font-bold text-base">{t.subscriptionManager.statusExpired}</strong>
              <p className="text-neutral-200/80 text-xs">{t.subscriptionManager.statusExpiredDesc}</p>
            </div>
          </div>
          {onOpenCheckout && (
            <button
              onClick={() => onOpenCheckout('monthly')}
              className="px-5 py-2.5 rounded-xl bg-neutral-600 hover:bg-neutral-500 text-white font-bold text-xs transition-all shadow-md whitespace-nowrap self-stretch sm:self-auto text-center"
            >
              {t.subscriptionManager.renewBtn}
            </button>
          )}
        </div>
      )}

      {/* Trial Banner */}
      {isTrialing && (
        <div className="p-5 rounded-2xl bg-neutral-500/10 border border-neutral-500/30 text-neutral-200 text-xs sm:text-sm flex items-center gap-3 shadow-lg">
          <Sparkles className="w-6 h-6 text-neutral-400 flex-shrink-0" />
          <div>
            <strong className="block text-neutral-300 font-bold text-base">{t.subscriptionManager.statusTrial}</strong>
            <p className="text-neutral-200/80 text-xs mt-0.5">
              {t.subscriptionManager.statusTrialDesc.replace('{date}', formattedTrialEnd || '30 days')}
            </p>
          </div>
        </div>
      )}

      {/* Main Subscription Overview Box */}
      <div className="p-6 rounded-2xl bg-[#161619] border border-[#27272a] space-y-6 shadow-xl relative overflow-hidden">
        
        {/* Top Header Card */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h3 className="text-xl font-black tracking-tight text-white">
                {isPro ? planName : t.subscriptionManager.freePlan}
              </h3>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                isExpired 
                  ? 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20'
                  : isTrialing
                  ? 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20'
                  : isCancelled 
                  ? 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20' 
                  : isPro 
                  ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                  : 'bg-[#232326] text-neutral-400 border-[#2C2C2E]'
              }`}>
                {isExpired ? t.subscriptionManager.expired : getStatusBadgeLabel()}
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              {isPro
                ? t.subscriptionManager.proPlanDesc
                : t.subscriptionManager.freePlanDesc}
            </p>
          </div>

          <div className="text-left sm:text-right">
            <div className="text-2xl font-black text-white">{isPro ? amountFormatted : 'R$ 0,00'}</div>
            <span className="text-[11px] text-neutral-500 font-medium">
              {isPro ? (isTrialing ? t.subscriptionManager.afterTrial : t.subscriptionManager.recurrent) : t.subscriptionManager.noCost}
            </span>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-[#27272a] pt-5 text-xs">
          
          <div className="space-y-1 p-3.5 rounded-xl bg-[#1c1c20] border border-[#2d2d32]">
            <span className="text-[10px] text-neutral-400 uppercase font-bold tracking-wider">{t.subscriptionManager.statusLabel}</span>
            <p className="text-sm font-semibold flex items-center gap-1.5">
              {isTrialing ? (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                  <span className="text-sky-400 font-bold">{t.subscriptionManager.trial30}</span>
                </>
              ) : isCancelled && isPro ? (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-neutral-400" />
                  <span className="text-neutral-400 font-bold">{t.subscriptionManager.renewalDisabled}</span>
                </>
              ) : isPro ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
                  <span className="text-sky-400 font-bold">{t.subscriptionManager.activeSub}</span>
                </>
              ) : isExpired ? (
                <>
                  <XCircle className="w-3.5 h-3.5 text-neutral-400" />
                  <span className="text-neutral-400 font-bold">{t.subscriptionManager.expired}</span>
                </>
              ) : (
                <span className="text-neutral-400">{t.subscriptionManager.free}</span>
              )}
            </p>
          </div>

          <div className="space-y-1 p-3.5 rounded-xl bg-[#1c1c20] border border-[#2d2d32]">
            <span className="text-[10px] text-neutral-400 uppercase font-bold tracking-wider">{t.subscriptionManager.activeUntil}</span>
            <p className="text-sm text-white font-semibold flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-neutral-400" />
              <span>{isPro ? formattedDate : t.subscriptionManager.notApplicable}</span>
            </p>
          </div>

          <div className="space-y-1 p-3.5 rounded-xl bg-[#1c1c20] border border-[#2d2d32]">
            <span className="text-[10px] text-neutral-400 uppercase font-bold tracking-wider">{t.subscriptionManager.nextBilling}</span>
            <p className="text-sm font-semibold flex items-center gap-1.5">
              {isCancelled ? (
                <span className="text-neutral-400">{t.subscriptionManager.noneCancelled}</span>
              ) : isPro ? (
                <span className="text-white">{formattedDate}</span>
              ) : (
                <span className="text-neutral-400">{t.subscriptionManager.none}</span>
              )}
            </p>
          </div>

        </div>

        {/* Payment Method Details */}
        {isPro && (
          <div className="space-y-2 border-t border-[#27272a] pt-5">
            <span className="text-[10px] text-neutral-400 uppercase font-bold tracking-wider">{t.subscriptionManager.paymentMethod}</span>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 rounded-xl bg-[#1c1c20] border border-[#2d2d32] gap-3">
              {paymentMethod && paymentMethod.last4 ? (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 flex-shrink-0">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white capitalize">
                      {paymentMethod.brand || t.subscriptionManager.card} •••• {paymentMethod.last4}
                    </p>
                    <p className="text-[11px] text-neutral-400">
                      {t.subscriptionManager.expiration} {paymentMethod.expMonth || '12'}/{paymentMethod.expYear || '2028'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#232326] border border-[#2C2C2E] flex items-center justify-center text-neutral-400 flex-shrink-0">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {t.subscriptionManager.noPaymentMethod}
                    </p>
                    <p className="text-[11px] text-neutral-400">
                      {t.subscriptionManager.manageStripeTip}
                    </p>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleOpenStripePortal}
                disabled={actionType === 'portal'}
                className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-[#28282e] hover:bg-[#32323a] text-white font-semibold text-xs border border-[#2C2C2E]/60 transition-colors flex items-center justify-center gap-1.5"
              >
                {actionType === 'portal' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                <span>{actionType === 'portal' ? t.subscriptionManager.opening : t.subscriptionManager.updatePaymentBtn}</span>
              </button>
            </div>
          </div>
        )}

        {/* Primary Renewal Action Buttons */}
        {isPro && (
          <div className="border-t border-[#27272a] pt-5 flex flex-col sm:flex-row items-center gap-3">
            {isCancelled ? (
              <button
                type="button"
                onClick={handleReactivateAutoRenew}
                disabled={actionType === 'reactivate'}
                className="w-full py-3 px-5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs sm:text-sm transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {actionType === 'reactivate' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                <span>{actionType === 'reactivate' ? t.subscriptionManager.reactivating : t.subscriptionManager.reactivateBtn}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleOpenCancelConfirmation}
                disabled={actionType === 'cancel'}
                className="w-full py-3 px-5 rounded-xl bg-neutral-600/90 hover:bg-neutral-600 text-white font-bold text-xs sm:text-sm transition-all shadow-lg flex items-center justify-center gap-2 border border-neutral-500/40 disabled:opacity-50"
              >
                {actionType === 'cancel' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                <span>{actionType === 'cancel' ? t.subscriptionManager.cancelling : t.subscriptionManager.cancelBtn}</span>
              </button>
            )}
          </div>
        )}

      </div>

      {/* Payment History & Receipts */}
      <div className="p-6 rounded-2xl bg-[#161619] border border-[#27272a] space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-[#2C2C2E] pb-3">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-neutral-400" />
            <span>{t.subscriptionManager.paymentHistory}</span>
          </h3>

          <button
            type="button"
            onClick={handleOpenStripePortal}
            disabled={actionType === 'portal'}
            className="text-xs text-neutral-400 hover:text-white transition-colors flex items-center gap-1 font-medium"
          >
            <span>{t.subscriptionManager.viewStripe}</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>

        {isLoadingInvoices ? (
          <div className="p-6 text-center text-xs text-neutral-500 animate-pulse flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />
            <span>{t.subscriptionManager.loadingInvoices}</span>
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-6 text-center text-xs text-neutral-400 rounded-xl bg-[#1c1c20] border border-[#2d2d32]">
            {t.subscriptionManager.noInvoices}
          </div>
        ) : (
          <div className="space-y-2">
            {invoices.map((inv) => {
              const invAmountStr = (inv.amount / 100).toLocaleString(currentLocale, { style: 'currency', currency: inv.currency?.toUpperCase() || 'BRL' });
              const invDateStr = new Date(inv.date).toLocaleDateString(currentLocale);

              return (
                <div key={inv.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-[#1c1c20] border border-[#2d2d32] text-xs gap-3">
                  <div className="space-y-0.5">
                    <p className="font-semibold text-white flex items-center gap-2">
                      <span>{inv.description || t.subscriptionManager.subscriptionZeno}</span>
                      <span className="text-[10px] text-neutral-400 font-mono">({inv.number || inv.id})</span>
                    </p>
                    <p className="text-neutral-400 text-[11px]">{invDateStr}</p>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4">
                    <div className="text-right">
                      <p className="font-bold text-white text-sm">{invAmountStr}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        inv.status === 'succeeded' || inv.status === 'paid' 
                          ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' 
                          : 'bg-neutral-500/10 text-neutral-400'
                      }`}>
                        {inv.status === 'succeeded' || inv.status === 'paid' ? t.subscriptionManager.paid : t.subscriptionManager.pending}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {inv.hostedUrl && (
                        <a
                          href={inv.hostedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-lg bg-[#28282e] hover:bg-[#32323a] text-neutral-300 hover:text-white transition-colors border border-[#2C2C2E]/60 flex items-center gap-1 text-[11px]"
                          title={t.subscriptionManager.receipt}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">{t.subscriptionManager.receipt}</span>
                        </a>
                      )}

                      {inv.pdfUrl ? (
                        <a
                          href={inv.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-lg bg-[#28282e] hover:bg-[#32323a] text-neutral-300 hover:text-white transition-colors border border-[#2C2C2E]/60 flex items-center gap-1 text-[11px]"
                          title={t.subscriptionManager.invoicePdf}
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">{t.subscriptionManager.invoicePdf}</span>
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => alert(`Comprovante ${inv.number || inv.id}: Pagamento de ${invAmountStr} efetuado com sucesso em ${invDateStr}.`)}
                          className="p-2 rounded-lg bg-[#28282e] hover:bg-[#32323a] text-neutral-300 hover:text-white transition-colors border border-[#2C2C2E]/60 flex items-center gap-1 text-[11px]"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>{t.subscriptionManager.viewReceipt}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Credit Card Modal Fallback */}
      {showCardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md p-6 rounded-2xl bg-[#1c1c20] border border-[#2d2d32] shadow-2xl space-y-4 text-left">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-sky-400" />
              <span>{t.subscriptionManager.updateCardTitle}</span>
            </h3>
            <p className="text-xs text-neutral-400">
              {t.subscriptionManager.updateCardDesc}
            </p>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-neutral-400 mb-1 uppercase">{t.subscriptionManager.brand}</label>
                <select
                  value={cardForm.brand}
                  onChange={e => setCardForm({ ...cardForm, brand: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-[#121215] border border-[#2C2C2E] text-white text-xs font-medium"
                >
                  <option value="visa">Visa</option>
                  <option value="mastercard">Mastercard</option>
                  <option value="elo">Elo</option>
                  <option value="amex">American Express</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 mb-1 uppercase">{t.subscriptionManager.last4}</label>
                <input
                  type="text"
                  maxLength={4}
                  value={cardForm.last4}
                  onChange={e => setCardForm({ ...cardForm, last4: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-[#121215] border border-[#2C2C2E] text-white text-xs font-medium"
                  placeholder="4242"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 mb-1 uppercase">{t.subscriptionManager.expMonth}</label>
                  <input
                    type="text"
                    maxLength={2}
                    value={cardForm.expMonth}
                    onChange={e => setCardForm({ ...cardForm, expMonth: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-[#121215] border border-[#2C2C2E] text-white text-xs font-medium"
                    placeholder="12"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 mb-1 uppercase">{t.subscriptionManager.expYear}</label>
                  <input
                    type="text"
                    maxLength={4}
                    value={cardForm.expYear}
                    onChange={e => setCardForm({ ...cardForm, expYear: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-[#121215] border border-[#2C2C2E] text-white text-xs font-medium"
                    placeholder="2028"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <button
                type="button"
                onClick={() => setShowCardModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-[#2d2d32] hover:bg-[#38383e] text-white font-semibold text-xs transition-colors"
              >
                {t.subscriptionManager.back}
              </button>
              <button
                type="button"
                onClick={handleSaveCardMethod}
                disabled={actionType === 'update_card'}
                className="flex-1 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                {actionType === 'update_card' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : null}
                <span>{actionType === 'update_card' ? t.subscriptionManager.saving : t.subscriptionManager.saveCard}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Auto-Renew Cancellation */}
      {showCancelConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md rounded-2xl bg-[#18181b] border border-[#2C2C2E]/80 p-6 shadow-2xl text-neutral-100 space-y-5">
            <div className="flex items-center gap-3 text-neutral-400">
              <div className="w-10 h-10 rounded-xl bg-neutral-500/10 border border-neutral-500/20 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-neutral-400" />
              </div>
              <h3 className="text-base font-bold text-white">{t.subscriptionManager.cancelAutoRenewTitle}</h3>
            </div>

            <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed font-medium">
              {t.subscriptionManager.cancelAutoRenewConfirm}
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#2C2C2E]">
              <button
                type="button"
                onClick={() => setShowCancelConfirmModal(false)}
                className="px-4 py-2.5 rounded-xl bg-[#232326] hover:bg-neutral-700 text-neutral-200 font-semibold text-xs sm:text-sm transition-colors"
              >
                {t.subscriptionManager.back}
              </button>
              <button
                type="button"
                onClick={executeCancelAutoRenew}
                className="px-4 py-2.5 rounded-xl bg-neutral-600 hover:bg-neutral-500 text-white font-bold text-xs sm:text-sm transition-colors shadow-md"
              >
                {t.subscriptionManager.confirmCancel}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default SubscriptionManager;
