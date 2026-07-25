import Stripe from 'stripe';
import { adminDb } from '../lib/firebaseAdmin';
import { StripeService } from '../services/stripeService';
import { SubscriptionManager, SubscriptionUpdatePayload } from '../services/subscriptionManager';
import { logStripeWebhook, recordFailedWebhook } from '../utils/stripeLogger';

export class StripeWebhookHandler {
  /**
   * Main Router for Stripe Events
   */
  static async handleWebhookEvent(event: Stripe.Event): Promise<{ success: boolean; duplicate?: boolean }> {
    const startTime = Date.now();
    const eventId = event.id;
    const eventType = event.type;

    console.log(`[STRIPE WEBHOOK] Recebido evento: ${eventType} (ID: ${eventId})`);

    // 1. Idempotency Check using Firestore
    const processedDocRef = adminDb.collection('processed_events').doc(eventId);
    try {
      const processedDoc = await processedDocRef.get();

      if (processedDoc.exists) {
        console.log(`[STRIPE WEBHOOK] Evento já processado previamente (Idempotência ID: ${eventId}). Ignorando.`);
        await logStripeWebhook({
          eventId,
          eventType,
          status: 'ignored_duplicate',
          timestamp: startTime
        });
        return { success: true, duplicate: true };
      }
    } catch (e: any) {
      console.warn('[STRIPE WEBHOOK] Idempotency check DB skip:', e?.message || e);
    }

    // Record processing start
    await logStripeWebhook({
      eventId,
      eventType,
      status: 'processing',
      timestamp: startTime
    });

    try {
      let handled = false;

      switch (eventType) {
        case 'checkout.session.completed':
          await this.handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
          handled = true;
          break;

        case 'customer.subscription.created':
          await this.handleCustomerSubscriptionCreated(event.data.object as Stripe.Subscription);
          handled = true;
          break;

        case 'customer.subscription.updated':
          await this.handleCustomerSubscriptionUpdated(event.data.object as Stripe.Subscription);
          handled = true;
          break;

        case 'customer.subscription.deleted':
          await this.handleCustomerSubscriptionDeleted(event.data.object as Stripe.Subscription);
          handled = true;
          break;

        case 'invoice.paid':
        case 'invoice.payment_succeeded':
          await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
          handled = true;
          break;

        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
          handled = true;
          break;

        case 'invoice.finalized':
          await this.handleInvoiceFinalized(event.data.object as Stripe.Invoice);
          handled = true;
          break;

        case 'invoice.payment_action_required':
          await this.handleInvoicePaymentActionRequired(event.data.object as Stripe.Invoice);
          handled = true;
          break;

        case 'payment_intent.succeeded':
          await this.handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
          handled = true;
          break;

        case 'payment_intent.payment_failed':
          await this.handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
          handled = true;
          break;

        default:
          console.log(`[STRIPE WEBHOOK] Evento não mapeado diretamente (${eventType}), registrado no log.`);
          handled = true;
          break;
      }

      // Mark event as successfully processed for idempotency
      try {
        await processedDocRef.set({
          eventId,
          eventType,
          processedAt: Date.now(),
          durationMs: Date.now() - startTime
        });
      } catch (e: any) {
        console.warn('[STRIPE WEBHOOK] processedDocRef.set DB skip:', e?.message || e);
      }

      await logStripeWebhook({
        eventId,
        eventType,
        status: 'processed',
        processingTimeMs: Date.now() - startTime,
        timestamp: startTime
      });

      return { success: true };
    } catch (err: any) {
      const errorMsg = err.message || 'Erro desconhecido ao processar webhook';
      console.error(`[STRIPE WEBHOOK ERROR] Erro no evento ${eventType} (${eventId}):`, err);

      await recordFailedWebhook(eventId, eventType, event, errorMsg);

      await logStripeWebhook({
        eventId,
        eventType,
        status: 'failed',
        error: errorMsg,
        processingTimeMs: Date.now() - startTime,
        timestamp: startTime
      });

      // Re-throw so endpoint knows, or handle smoothly depending on requirement
      throw err;
    }
  }

  /**
   * 1. Handlers for checkout.session.completed
   */
  private static async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
    const customerId = session.customer as string;
    const subscriptionId = session.subscription as string;
    const metadataUserId = session.metadata?.userId || session.client_reference_id;
    const email = session.customer_details?.email || session.customer_email || undefined;

    const userId = await SubscriptionManager.resolveUserId(customerId, email, metadataUserId);
    if (!userId) {
      console.warn('[WEBHOOK checkout.session.completed] Usuário não encontrado para o cliente:', customerId);
      return;
    }

    let subObj: Stripe.Subscription | null = null;
    if (subscriptionId) {
      subObj = await StripeService.getSubscription(subscriptionId);
    }

    const subAny = subObj as any;
    const isAnnual = session.metadata?.billingCycle === 'annual' || subObj?.items?.data[0]?.plan?.interval === 'year';

    const payload: SubscriptionUpdatePayload = {
      userId,
      subscriptionId: subscriptionId || 'sub_session_' + session.id,
      customerId: customerId || '',
      subscriptionStatus: 'active',
      active: true,
      planId: 'zeno_pro',
      priceId: subObj?.items?.data[0]?.price?.id || '',
      billingPeriod: isAnnual ? 'Anual' : 'Mensal',
      currentPeriodStart: (subAny?.current_period_start || Date.now() / 1000) * 1000,
      currentPeriodEnd: (subAny?.current_period_end || (Date.now() / 1000 + (isAnnual ? 365 : 30) * 86400)) * 1000,
      nextRenewal: (subAny?.current_period_end || (Date.now() / 1000 + (isAnnual ? 365 : 30) * 86400)) * 1000,
      cancelAt: subAny?.cancel_at ? subAny.cancel_at * 1000 : null,
      cancelAtPeriodEnd: subAny?.cancel_at_period_end || false,
      lastPayment: {
        amount: session.amount_total ? session.amount_total / 100 : 39.90,
        currency: (session.currency || 'brl').toUpperCase(),
        date: Date.now(),
        status: 'succeeded'
      },
      lastInvoice: typeof subAny?.latest_invoice === 'string' ? subAny.latest_invoice : subAny?.latest_invoice?.id || '',
      paymentStatus: 'succeeded',
      currency: (session.currency || 'brl').toUpperCase(),
      amount: session.amount_total ? session.amount_total / 100 : 39.90
    };

    await SubscriptionManager.updateSubscriptionRecord(payload);
  }

  /**
   * 2. Handlers for customer.subscription.created
   */
  private static async handleCustomerSubscriptionCreated(subscription: Stripe.Subscription) {
    await this.processSubscriptionStateChange(subscription, 'created');
  }

  /**
   * 3. Handlers for customer.subscription.updated
   */
  private static async handleCustomerSubscriptionUpdated(subscription: Stripe.Subscription) {
    await this.processSubscriptionStateChange(subscription, 'updated');
  }

  /**
   * 4. Handlers for customer.subscription.deleted
   */
  private static async handleCustomerSubscriptionDeleted(subscription: Stripe.Subscription) {
    const subAny = subscription as any;
    const customerId = subscription.customer as string;
    const userId = await SubscriptionManager.resolveUserId(customerId, undefined, subscription.metadata?.userId);

    if (!userId) {
      console.warn('[WEBHOOK subscription.deleted] Usuário não encontrado:', customerId);
      return;
    }

    const startSec = subAny.current_period_start || Math.floor(Date.now() / 1000);
    const endSec = subAny.current_period_end || Math.floor(Date.now() / 1000);

    const payload: SubscriptionUpdatePayload = {
      userId,
      subscriptionId: subscription.id,
      customerId,
      subscriptionStatus: 'canceled',
      active: false,
      planId: 'zeno_free',
      billingPeriod: 'Mensal',
      currentPeriodStart: startSec * 1000,
      currentPeriodEnd: endSec * 1000,
      nextRenewal: endSec * 1000,
      cancelAt: Date.now(),
      cancelAtPeriodEnd: true,
      paymentStatus: 'canceled',
      currency: (subAny.currency || 'brl').toUpperCase(),
      amount: 0
    };

    await SubscriptionManager.updateSubscriptionRecord(payload);
  }

  /**
   * Helper to map Stripe.Subscription to SubscriptionUpdatePayload
   */
  private static async processSubscriptionStateChange(subscription: Stripe.Subscription, action: string) {
    const subAny = subscription as any;
    const customerId = subscription.customer as string;
    const userId = await SubscriptionManager.resolveUserId(customerId, undefined, subscription.metadata?.userId);

    if (!userId) {
      console.warn(`[WEBHOOK subscription.${action}] Usuário não encontrado para cliente:`, customerId);
      return;
    }

    const statusMap: Record<string, SubscriptionUpdatePayload['subscriptionStatus']> = {
      active: 'active',
      trialing: 'trialing',
      past_due: 'past_due',
      unpaid: 'unpaid',
      canceled: 'canceled',
      incomplete: 'inactive',
      incomplete_expired: 'canceled'
    };

    const status = statusMap[subscription.status] || 'inactive';
    const isActive = status === 'active' || status === 'trialing';
    const interval = subscription.items?.data[0]?.plan?.interval;
    const isAnnual = interval === 'year';

    const priceAmount = subscription.items?.data[0]?.price?.unit_amount;
    const amount = priceAmount ? priceAmount / 100 : (isAnnual ? 399.00 : 39.90);

    const startSec = subAny.current_period_start || Math.floor(Date.now() / 1000);
    const endSec = subAny.current_period_end || (startSec + 30 * 86400);

    const payload: SubscriptionUpdatePayload = {
      userId,
      subscriptionId: subscription.id,
      customerId,
      subscriptionStatus: status,
      active: isActive,
      planId: isActive ? 'zeno_pro' : 'zeno_free',
      priceId: subscription.items?.data[0]?.price?.id || '',
      billingPeriod: isAnnual ? 'Anual' : 'Mensal',
      currentPeriodStart: startSec * 1000,
      currentPeriodEnd: endSec * 1000,
      nextRenewal: endSec * 1000,
      cancelAt: subAny.cancel_at ? subAny.cancel_at * 1000 : null,
      cancelAtPeriodEnd: subAny.cancel_at_period_end || false,
      lastInvoice: typeof subAny.latest_invoice === 'string' ? subAny.latest_invoice : subAny.latest_invoice?.id || '',
      paymentStatus: isActive ? 'succeeded' : 'failed',
      currency: (subAny.currency || 'brl').toUpperCase(),
      amount
    };

    await SubscriptionManager.updateSubscriptionRecord(payload);
  }

  /**
   * 5. Handlers for invoice.paid & invoice.payment_succeeded
   */
  private static async handleInvoicePaid(invoice: Stripe.Invoice) {
    const invAny = invoice as any;
    const customerId = invoice.customer as string;
    const userId = await SubscriptionManager.resolveUserId(customerId, invAny.customer_email || undefined);

    if (!userId) {
      console.warn('[WEBHOOK invoice.paid] Usuário não encontrado:', customerId);
      return;
    }

    const subId = typeof invAny.subscription === 'string' ? invAny.subscription : invAny.subscription?.id || 'sub_default';
    const interval = invAny.lines?.data?.[0]?.plan?.interval || invAny.lines?.data?.[0]?.price?.recurring?.interval;

    const payload: SubscriptionUpdatePayload = {
      userId,
      subscriptionId: subId,
      customerId,
      subscriptionStatus: 'active',
      active: true,
      planId: 'zeno_pro',
      billingPeriod: interval === 'year' ? 'Anual' : 'Mensal',
      currentPeriodStart: (invAny.period_start || Math.floor(Date.now() / 1000)) * 1000,
      currentPeriodEnd: (invAny.period_end || Math.floor(Date.now() / 1000) + 30 * 86400) * 1000,
      nextRenewal: (invAny.period_end || Math.floor(Date.now() / 1000) + 30 * 86400) * 1000,
      cancelAtPeriodEnd: false,
      lastPayment: {
        amount: invAny.amount_paid ? invAny.amount_paid / 100 : 39.90,
        currency: (invAny.currency || 'brl').toUpperCase(),
        date: Date.now(),
        status: 'succeeded'
      },
      lastInvoice: invoice.id,
      paymentStatus: 'succeeded',
      currency: (invAny.currency || 'brl').toUpperCase(),
      amount: invAny.amount_paid ? invAny.amount_paid / 100 : 39.90
    };

    await SubscriptionManager.updateSubscriptionRecord(payload);
  }

  /**
   * 6. Handlers for invoice.payment_failed
   */
  private static async handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
    const invAny = invoice as any;
    const customerId = invoice.customer as string;
    const userId = await SubscriptionManager.resolveUserId(customerId, invAny.customer_email || undefined);

    if (!userId) {
      console.warn('[WEBHOOK invoice.payment_failed] Usuário não encontrado:', customerId);
      return;
    }

    const subId = typeof invAny.subscription === 'string' ? invAny.subscription : invAny.subscription?.id || 'sub_default';

    const payload: SubscriptionUpdatePayload = {
      userId,
      subscriptionId: subId,
      customerId,
      subscriptionStatus: 'past_due',
      active: false,
      planId: 'zeno_free',
      billingPeriod: 'Mensal',
      currentPeriodStart: (invAny.period_start || Math.floor(Date.now() / 1000)) * 1000,
      currentPeriodEnd: (invAny.period_end || Math.floor(Date.now() / 1000)) * 1000,
      nextRenewal: (invAny.period_end || Math.floor(Date.now() / 1000)) * 1000,
      cancelAtPeriodEnd: true,
      lastPayment: {
        amount: invAny.amount_due ? invAny.amount_due / 100 : 39.90,
        currency: (invAny.currency || 'brl').toUpperCase(),
        date: Date.now(),
        status: 'failed'
      },
      lastInvoice: invoice.id,
      paymentStatus: 'failed',
      currency: (invAny.currency || 'brl').toUpperCase(),
      amount: invAny.amount_due ? invAny.amount_due / 100 : 39.90
    };

    await SubscriptionManager.updateSubscriptionRecord(payload);
  }

  /**
   * 7. Handlers for invoice.finalized
   */
  private static async handleInvoiceFinalized(invoice: Stripe.Invoice) {
    console.log(`[WEBHOOK invoice.finalized] Fatura gerada: ${invoice.id} para cliente ${invoice.customer}`);
  }

  /**
   * 8. Handlers for invoice.payment_action_required
   */
  private static async handleInvoicePaymentActionRequired(invoice: Stripe.Invoice) {
    const invAny = invoice as any;
    const customerId = invoice.customer as string;
    const userId = await SubscriptionManager.resolveUserId(customerId, invAny.customer_email || undefined);

    if (!userId) return;

    const subId = typeof invAny.subscription === 'string' ? invAny.subscription : invAny.subscription?.id || 'sub_default';

    const payload: SubscriptionUpdatePayload = {
      userId,
      subscriptionId: subId,
      customerId,
      subscriptionStatus: 'past_due',
      active: false,
      planId: 'zeno_free',
      billingPeriod: 'Mensal',
      currentPeriodStart: Date.now(),
      currentPeriodEnd: Date.now(),
      nextRenewal: Date.now(),
      cancelAtPeriodEnd: false,
      lastInvoice: invoice.id,
      paymentStatus: 'action_required',
      currency: (invoice.currency || 'brl').toUpperCase(),
      amount: invoice.amount_due ? invoice.amount_due / 100 : 39.90
    };

    await SubscriptionManager.updateSubscriptionRecord(payload);
  }

  /**
   * 9. Handlers for payment_intent.succeeded
   */
  private static async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
    console.log(`[WEBHOOK payment_intent.succeeded] Pagamento confirmado: ${paymentIntent.id}`);
  }

  /**
   * 10. Handlers for payment_intent.payment_failed
   */
  private static async handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
    console.log(`[WEBHOOK payment_intent.payment_failed] Pagamento falhou: ${paymentIntent.id}`);
  }
}
