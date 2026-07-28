import { adminDb } from '../lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export interface SubscriptionUpdatePayload {
  userId: string;
  subscriptionId: string;
  customerId: string;
  subscriptionStatus: 'active' | 'inactive' | 'trialing' | 'past_due' | 'unpaid' | 'canceled';
  active: boolean;
  planId: string;
  priceId?: string;
  billingPeriod: 'Mensal' | 'Anual';
  currentPeriodStart: number;
  currentPeriodEnd: number;
  nextRenewal: number;
  cancelAt?: number | null;
  cancelAtPeriodEnd: boolean;
  lastPayment?: {
    amount: number;
    currency: string;
    date: number;
    status: 'succeeded' | 'failed' | 'pending';
  };
  lastInvoice?: string | any;
  paymentStatus: string;
  paymentMethod?: {
    brand: string;
    last4: string;
    expMonth?: number;
    expYear?: number;
  };
  currency: string;
  amount: number;
}

export class SubscriptionManager {
  /**
   * Find userId by Stripe Customer ID or email or metadata
   */
  static async resolveUserId(customerId?: string, email?: string, metadataUserId?: string): Promise<string | null> {
    if (metadataUserId) {
      return metadataUserId;
    }

    try {
      if (customerId) {
        // Query subscriptions by customerId
        const subSnap = await adminDb.collection('subscriptions').where('customerId', '==', customerId).limit(1).get();
        if (!subSnap.empty) {
          return subSnap.docs[0].id; // Doc ID is userId
        }

        // Query users by customerId
        const userSnap = await adminDb.collection('users').where('stripeCustomerId', '==', customerId).limit(1).get();
        if (!userSnap.empty) {
          return userSnap.docs[0].id;
        }
      }

      if (email) {
        const userEmailSnap = await adminDb.collection('users').where('email', '==', email).limit(1).get();
        if (!userEmailSnap.empty) {
          return userEmailSnap.docs[0].id;
        }
      }
    } catch (e: any) {
      console.warn('[SUBSCRIPTION MANAGER] resolveUserId DB error:', e?.message || e);
    }

    return null;
  }

  /**
   * Update Firestore subscription and user profile in real-time with serverTimestamp()
   */
  static async updateSubscriptionRecord(payload: SubscriptionUpdatePayload) {
    const { userId } = payload;
    if (!userId) {
      throw new Error('UserId é obrigatório para atualizar assinatura no Firestore.');
    }

    const now = Date.now();
    const serverTimestamp = FieldValue.serverTimestamp();

    const isPro = payload.subscriptionStatus === 'active' || payload.subscriptionStatus === 'trialing';

    const subscriptionData = {
      userId,
      subscriptionId: payload.subscriptionId || 'sub_default',
      customerId: payload.customerId || '',
      subscriptionStatus: payload.subscriptionStatus,
      status: payload.subscriptionStatus, // legacy compatibility
      active: payload.active,
      planId: payload.planId || 'zeno_pro',
      priceId: payload.priceId || '',
      plano: payload.billingPeriod, // legacy compatibility
      billingPeriod: payload.billingPeriod,
      createdAt: payload.currentPeriodStart || now,
      currentPeriodStart: payload.currentPeriodStart || now,
      currentPeriodEnd: payload.currentPeriodEnd || now + 30 * 86400 * 1000,
      nextRenewal: payload.nextRenewal || payload.currentPeriodEnd || now + 30 * 86400 * 1000,
      renewDate: payload.nextRenewal || payload.currentPeriodEnd || now + 30 * 86400 * 1000, // legacy
      expirationDate: payload.currentPeriodEnd || now + 30 * 86400 * 1000, // legacy
      cancelAt: payload.cancelAt || null,
      cancelAtPeriodEnd: payload.cancelAtPeriodEnd,
      autoRenew: !payload.cancelAtPeriodEnd, // legacy
      lastPayment: payload.lastPayment || {
        amount: payload.amount,
        currency: payload.currency,
        date: now,
        status: payload.paymentStatus === 'succeeded' ? 'succeeded' : 'failed'
      },
      lastInvoice: payload.lastInvoice || '',
      paymentStatus: payload.paymentStatus,
      paymentMethod: payload.paymentMethod || null,
      currency: payload.currency || 'BRL',
      amount: payload.amount || 3990,
      updatedAt: serverTimestamp, // Required server timestamp
    };

    try {
      // Write to subscriptions/{userId} document
      await adminDb.collection('subscriptions').doc(userId).set(subscriptionData, { merge: true });

      // Update user document for quick plan reads
      await adminDb.collection('users').doc(userId).set({
        plan: isPro ? 'ZENO Pro' : 'ZENO Free',
        stripeCustomerId: payload.customerId,
        stripeSubscriptionId: payload.subscriptionId,
        updatedAt: serverTimestamp
      }, { merge: true });

      console.log(`[SUBSCRIPTION MANAGER] Sincronizado no Firestore para UID: ${userId} -> Status: ${payload.subscriptionStatus} (Active: ${isPro})`);
    } catch (e: any) {
      console.warn('[SUBSCRIPTION MANAGER] updateSubscriptionRecord DB write error:', e?.message || e);
    }

    return subscriptionData;
  }
}
