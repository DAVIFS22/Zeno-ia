import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserSettings } from '../types';

export interface RealtimeSubscriptionData {
  userId: string;
  subscriptionId: string;
  customerId: string;
  subscriptionStatus: 'active' | 'inactive' | 'trialing' | 'past_due' | 'unpaid' | 'canceled' | string;
  active: boolean;
  planId: string;
  billingPeriod: 'Mensal' | 'Anual' | string;
  currentPeriodStart?: number;
  currentPeriodEnd?: number;
  nextRenewal?: number;
  cancelAt?: number | null;
  cancelAtPeriodEnd?: boolean;
  amount?: number;
  currency?: string;
  paymentMethod?: {
    brand: string;
    last4: string;
  };
  updatedAt?: any;
}

export function useRealtimeSubscription(
  userId: string | undefined,
  onPlanChange?: (newPlan: 'ZENO Pro' | 'ZENO Free') => void,
  onSettingsUpdate?: (newSettings: Partial<UserSettings>) => void
) {
  const [subscription, setSubscription] = useState<RealtimeSubscriptionData | null>(null);
  const [isPro, setIsPro] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!userId) {
      setSubscription(null);
      setIsPro(false);
      setLoading(false);
      return;
    }

    setLoading(true);

    // REAL-TIME FIRESTORE LISTENER USING onSnapshot
    const subDocRef = doc(db, 'subscriptions', userId);

    const unsubscribe = onSnapshot(
      subDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as RealtimeSubscriptionData;
          setSubscription(data);

          const activeStatus = data.active === true || data.subscriptionStatus === 'active' || data.subscriptionStatus === 'trialing';
          const newPlan = activeStatus ? 'ZENO Pro' : 'ZENO Free';

          setIsPro(activeStatus);

          if (onPlanChange) {
            onPlanChange(newPlan);
          }

          if (onSettingsUpdate) {
            onSettingsUpdate({ plan: newPlan });
          }

          console.log(`[REALTIME FIRESTORE LISTENER] Assinatura atualizada instantaneamente para UID ${userId}: status = ${data.subscriptionStatus}, Plano = ${newPlan}`);
        } else {
          setSubscription(null);
          setIsPro(false);
          if (onPlanChange) onPlanChange('ZENO Free');
          if (onSettingsUpdate) onSettingsUpdate({ plan: 'ZENO Free' });
        }
        setLoading(false);
      },
      (error) => {
        console.error('[REALTIME FIRESTORE LISTENER ERROR]:', error);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [userId]);

  return { subscription, isPro, loading };
}
