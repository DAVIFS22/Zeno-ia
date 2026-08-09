import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { UserSettings } from '../types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('[REALTIME FIRESTORE LISTENER ERROR]:', JSON.stringify(errInfo));
}

export interface RealtimeSubscriptionData {
  userId: string;
  subscriptionId: string;
  customerId: string;
  subscriptionStatus: 'active' | 'inactive' | 'trialing' | 'past_due' | 'unpaid' | 'canceled' | string;
  active: boolean;
  planId: string;
  billingPeriod: string;
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

    // CRITICAL: Only attach the listener if we have a current authenticated user 
    // AND that user matches the ID we are trying to subscribe to.
    // If we are not logged in yet, Firestore rules will block the read and throw an error.
    if (!auth.currentUser || auth.currentUser.uid !== userId) {
      console.log(`[Subscription] Waiting for auth sync for UID: ${userId}. Current UID: ${auth.currentUser?.uid || 'none'}`);
      setLoading(false);
      return;
    }

    console.log(`[Subscription] Attaching listener for UID: ${userId}`);
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

          console.log(`[REALTIME FIRESTORE LISTENER SUCCESS] Assinatura para UID ${userId}: status = ${data.subscriptionStatus}, Plano = ${newPlan}`);
        } else {
          setSubscription(null);
          setIsPro(false);
          if (onPlanChange) onPlanChange('ZENO Free');
          if (onSettingsUpdate) onSettingsUpdate({ plan: 'ZENO Free' });
        }
        setLoading(false);
      },
      (error) => {
        if (error.code !== 'cancelled') {
          handleFirestoreError(error, OperationType.GET, `subscriptions/${userId}`);
        }
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [userId]);

  return { subscription, isPro, loading };
}
