import { adminDb } from './firebaseAdmin';

export type SubscriptionPlanType = 'Mensal' | 'Anual';
export type SubscriptionStatusType = 'active' | 'trialing' | 'canceled' | 'expired' | 'suspended';

export interface SubscriptionRecord {
  userId: string;
  subscriptionId: string;
  plano: SubscriptionPlanType;
  status: SubscriptionStatusType;
  purchaseDate: number;
  activationDate: number;
  renewDate: number;
  expirationDate: number;
  paymentMethod: {
    brand: string;
    last4: string;
    expMonth?: number;
    expYear?: number;
  };
  gateway: string;
  autoRenew: boolean;
  lastPayment: {
    amount: number;
    currency: string;
    date: number;
    status: 'succeeded' | 'failed' | 'pending';
  };
  nextPayment: {
    amount: number;
    currency: string;
    date: number;
  };
  paymentHistory: Array<{
    id: string;
    date: number;
    amount: number;
    currency: string;
    status: 'succeeded' | 'failed' | 'pending';
    description: string;
  }>;
  remindersSent?: Record<string, number>;
  lastRenewalStatus?: 'success' | 'failed' | 'pending';
}

export type SubscriptionEventName =
  | 'SubscriptionCreated'
  | 'SubscriptionRenewed'
  | 'SubscriptionCanceled'
  | 'SubscriptionExpired'
  | 'SubscriptionPaymentFailed'
  | 'SubscriptionActivated'
  | 'SubscriptionUpdated';

export class SubscriptionService {
  /**
   * Emit an internal event and record to subscription_events collection
   */
  static async emitEvent(userId: string, eventName: SubscriptionEventName, details: any) {
    const eventRecord = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      userId,
      eventName,
      details,
      timestamp: Date.now()
    };
    try {
      await adminDb.collection('subscription_events').doc(eventRecord.id).set(eventRecord);
      // Also log to audit/system logs
      await adminDb.collection('audit_logs').doc(eventRecord.id).set({
        id: eventRecord.id,
        timestamp: Date.now(),
        user: userId,
        action: eventName,
        details: JSON.stringify(details)
      });
    } catch (e) {
      console.warn('SubscriptionService emitEvent error (fallback):', e);
    }
    return eventRecord;
  }

  /**
   * Get subscription data for a user
   */
  static async getSubscription(userId: string): Promise<SubscriptionRecord | null> {
    try {
      const doc = await adminDb.collection('subscriptions').doc(userId).get();
      if (!doc.exists) {
        // Fallback to user doc stripeSubscription if exists
        const userDoc = await adminDb.collection('users').doc(userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data() as any;
          if (userData?.stripeSubscription || userData?.plan === 'ZENO Pro') {
            const stripeSub = userData.stripeSubscription || {};
            const record: SubscriptionRecord = {
              userId,
              subscriptionId: stripeSub.subscriptionId || 'sub_zeno_default',
              plano: userData.billingCycle === 'annual' ? 'Anual' : 'Mensal',
              status: stripeSub.status || 'active',
              purchaseDate: Date.now() - 30 * 86400 * 1000,
              activationDate: Date.now() - 30 * 86400 * 1000,
              renewDate: stripeSub.currentPeriodEnd ? stripeSub.currentPeriodEnd * 1000 : Date.now() + 7 * 86400 * 1000,
              expirationDate: stripeSub.currentPeriodEnd ? stripeSub.currentPeriodEnd * 1000 : Date.now() + 7 * 86400 * 1000,
              paymentMethod: stripeSub.paymentMethod || { brand: 'visa', last4: '4242' },
              gateway: 'Stripe',
              autoRenew: !stripeSub.cancelAtPeriodEnd,
              lastPayment: {
                amount: stripeSub.amount || 3990,
                currency: stripeSub.currency || 'BRL',
                date: Date.now() - 30 * 86400 * 1000,
                status: 'succeeded'
              },
              nextPayment: {
                amount: stripeSub.amount || 3990,
                currency: stripeSub.currency || 'BRL',
                date: stripeSub.currentPeriodEnd ? stripeSub.currentPeriodEnd * 1000 : Date.now() + 7 * 86400 * 1000
              },
              paymentHistory: stripeSub.billingHistory || [
                { id: 'inv_1', date: Date.now() - 30 * 86400 * 1000, amount: 3990, currency: 'brl', status: 'succeeded', description: 'Assinatura ZENO Pro' }
              ],
              remindersSent: stripeSub.remindersSent || {},
              lastRenewalStatus: stripeSub.lastRenewalStatus || 'success'
            };
            await adminDb.collection('subscriptions').doc(userId).set(record);
            return record;
          }
        }
        return null;
      }
      return doc.data() as SubscriptionRecord;
    } catch (e: any) {
      if (
        e?.code === 5 || e?.code === 7 ||
        e?.message?.includes('NOT_FOUND') || e?.message?.includes('PERMISSION_DENIED') ||
        e?.details?.includes('NOT_FOUND') || e?.details?.includes('PERMISSION_DENIED')
      ) {
        return null;
      }
      console.warn('SubscriptionService getSubscription error:', e);
      return null;
    }
  }

  /**
   * Validate access and calculate status metrics for frontend
   */
  static async validateAndGetDetails(userId: string) {
    const sub = await this.getSubscription(userId);
    const now = Date.now();

    if (!sub || sub.status === 'expired' || (sub.status === 'canceled' && sub.expirationDate < now)) {
      return {
        isPro: false,
        subscriptionStatus: 'expired',
        subscriptionPlan: 'Free',
        purchaseDate: null,
        renewDate: null,
        expirationDate: null,
        daysRemaining: 0,
        autoRenew: false,
        paymentStatus: 'none',
        sub: null
      };
    }

    const renewTime = new Date(sub.renewDate).getTime();
    const renewDateIso = new Date(sub.renewDate).toISOString();
    const expirationDateIso = new Date(sub.expirationDate).toISOString();
    const diffMs = renewTime - now;
    const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 3600 * 24)));
    const needsReconciliation = (sub.status === 'active' || sub.status === 'trialing') && renewTime < now;

    return {
      isPro: true,
      subscriptionStatus: sub.status,
      subscriptionPlan: sub.plano,
      purchaseDate: new Date(sub.purchaseDate).toISOString(),
      renewDate: renewDateIso,
      expirationDate: expirationDateIso,
      daysRemaining,
      autoRenew: sub.autoRenew,
      paymentStatus: sub.lastPayment.status,
      needsReconciliation,
      renewalDateOutdated: needsReconciliation,
      sub
    };
  }

  /**
   * Process reminders and notifications using precise ISO / date diff formula
   */
  static async checkAndProcessReminders(userId: string) {
    const sub = await this.getSubscription(userId);
    if (!sub || (sub.status !== 'active' && sub.status !== 'trialing')) {
      return null;
    }

    const now = Date.now();
    const renewalDateObj = new Date(sub.renewDate);
    const diffDays = (renewalDateObj.getTime() - now) / (1000 * 3600 * 24);
    const remindersSent = sub.remindersSent || {};
    let pendingNotification = null;

    // Strict check: Only show warning modal when diffDays <= 1 (penúltimo dia / 1 day or less remaining)
    if (sub.lastRenewalStatus === 'failed' || (sub.status as string) === 'suspended') {
      if (!remindersSent['failed']) {
        remindersSent['failed'] = now;
        pendingNotification = {
          type: 'failed',
          title: 'Não foi possível renovar sua assinatura ZENO Pro',
          text: 'Não foi possível renovar sua assinatura ZENO Pro.\n\nAtualize sua forma de pagamento para continuar utilizando todos os recursos Premium.',
          buttons: ['Atualizar pagamento', 'Gerenciar assinatura'],
          priority: 'max'
        };
      }
    } else if (diffDays <= 1 && diffDays >= 0 && !remindersSent['1_day']) {
      remindersSent['1_day'] = now;
      if (sub.autoRenew) {
        pendingNotification = {
          type: '1_day',
          title: 'Sua assinatura ZENO Pro será renovada amanhã',
          text: 'Sua assinatura será renovada automaticamente amanhã.\n\nApós a renovação você continuará com acesso a:\n• Todos os modelos Premium\n• Prioridade máxima\n• Imagens ilimitadas\n• Pesquisas avançadas\n• Upload e análise de arquivos\n• Todos os recursos exclusivos',
          buttons: ['Gerenciar assinatura', 'Atualizar forma de pagamento', 'Continuar'],
          priority: 'max'
        };
      } else {
        pendingNotification = {
          type: '1_day_norenew',
          title: 'Sua assinatura ZENO Pro expirará amanhã',
          text: 'Sua assinatura expirará amanhã caso não seja renovada.',
          buttons: ['Gerenciar assinatura', 'Atualizar forma de pagamento', 'Continuar'],
          priority: 'max'
        };
      }
    } else if (diffDays < 0 && !remindersSent['renewal_day']) {
      remindersSent['renewal_day'] = now;
      pendingNotification = {
        type: 'renewal_day',
        title: 'Renovação ZENO Pro Hoje',
        text: 'Sua assinatura ZENO Pro será renovada hoje automaticamente.',
        buttons: ['Gerenciar assinatura', 'Continuar'],
        discreet: true,
        priority: 'max'
      };
    }

    sub.remindersSent = remindersSent;
    try {
      await adminDb.collection('subscriptions').doc(userId).set(sub, { merge: true });
      await adminDb.collection('notification_history').add({
        userId,
        notification: pendingNotification,
        timestamp: Date.now()
      });
    } catch (e) {
      // ignore
    }

    return {
      sub,
      pendingNotification
    };
  }
}
