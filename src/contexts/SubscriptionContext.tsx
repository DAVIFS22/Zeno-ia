import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo } from 'react';
import { useAuth } from './AuthContext';

export interface SubscriptionData {
  status: string;
  subscriptionId: string;
  plan: string;
  isPro: boolean;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  daysRemaining?: number;
  renewDate?: string | null;
  expirationDate?: string | null;
  autoRenew?: boolean;
  paymentStatus?: string;
  sub?: any;
}

interface SubscriptionContextType {
  subscription: SubscriptionData;
  isPro: boolean;
  loading: boolean;
  error: string | null;
  refreshSubscription: () => Promise<SubscriptionData>;
}

const defaultSubscription: SubscriptionData = {
  status: 'free',
  subscriptionId: '',
  plan: 'ZENO Free',
  isPro: false,
  cancelAtPeriodEnd: false,
  currentPeriodEnd: null,
};

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider: React.FC<{
  userId?: string;
  userEmail?: string;
  children: ReactNode;
}> = ({ userId, userEmail, children }) => {
  const [subscription, setSubscription] = useState<SubscriptionData>(defaultSubscription);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuth();

  const refreshSubscription = useCallback(async (): Promise<SubscriptionData> => {
    if (!userId) {
      setSubscription(defaultSubscription);
      setLoading(false);
      return defaultSubscription;
    }

    setLoading(true);
    setError(null);

    try {
      const cacheBuster = Date.now();
      const emailQuery = userEmail ? `&email=${encodeURIComponent(userEmail)}` : '';
      const token = user ? await user.getIdToken() : null;
      
      const headers: Record<string, string> = {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        ...(userEmail ? { 'x-user-email': userEmail } : {}),
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`/api/subscription/status?userId=${userId}${emailQuery}&_t=${cacheBuster}`, {
        headers,
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();

      const newSub: SubscriptionData = {
        status: data.status || data.subscriptionStatus || (data.isPro ? 'active' : 'free'),
        subscriptionId: data.subscriptionId || data.sub?.subscriptionId || '',
        plan: data.plan || data.subscriptionPlan || (data.isPro ? 'ZENO Pro' : 'ZENO Free'),
        isPro: Boolean(data.isPro),
        cancelAtPeriodEnd: Boolean(data.cancelAtPeriodEnd || data.cancel_at_period_end),
        currentPeriodEnd: data.currentPeriodEnd || data.expirationDate || data.renewDate || null,
        daysRemaining: data.daysRemaining,
        renewDate: data.renewDate,
        expirationDate: data.expirationDate,
        autoRenew: data.autoRenew,
        paymentStatus: data.paymentStatus,
        sub: data.sub,
      };

      setSubscription(newSub);
      setLoading(false);

      return newSub;
    } catch (err: any) {
      console.warn('[SubscriptionContext] Erro ao sincronizar assinatura:', err?.message || err);
      setError(err?.message || 'Erro de sincronização');
      setLoading(false);
      return defaultSubscription;
    }
  }, [userId, userEmail]);

  useEffect(() => {
    refreshSubscription();

    const handleFocus = () => {
      refreshSubscription();
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [refreshSubscription]);

  const contextValue = useMemo(() => ({
    subscription,
    isPro: subscription.isPro,
    loading,
    error,
    refreshSubscription,
  }), [subscription, loading, error, refreshSubscription]);

  return (
    <SubscriptionContext.Provider value={contextValue}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription deve ser usado dentro de um SubscriptionProvider');
  }
  return context;
};
