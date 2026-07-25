import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      console.warn('STRIPE_SECRET_KEY não está configurada no ambiente.');
      return null;
    }
    stripeClient = new Stripe(key, {
      apiVersion: '2025-02-24.acacia' as any
    });
  }
  return stripeClient;
}

export class StripeService {
  /**
   * Retrieve Customer object from Stripe
   */
  static async getCustomer(customerId: string): Promise<Stripe.Customer | Stripe.DeletedCustomer | null> {
    const stripe = getStripe();
    if (!stripe) return null;
    try {
      return await stripe.customers.retrieve(customerId);
    } catch (e) {
      console.error(`Erro ao buscar cliente no Stripe (${customerId}):`, e);
      return null;
    }
  }

  /**
   * Retrieve Subscription object from Stripe
   */
  static async getSubscription(subscriptionId: string): Promise<Stripe.Subscription | null> {
    const stripe = getStripe();
    if (!stripe) return null;
    try {
      return await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['default_payment_method', 'latest_invoice']
      });
    } catch (e) {
      console.error(`Erro ao buscar assinatura no Stripe (${subscriptionId}):`, e);
      return null;
    }
  }

  /**
   * Retrieve Invoice object from Stripe
   */
  static async getInvoice(invoiceId: string): Promise<Stripe.Invoice | null> {
    const stripe = getStripe();
    if (!stripe) return null;
    try {
      return await stripe.invoices.retrieve(invoiceId, {
        expand: ['payment_intent']
      });
    } catch (e) {
      console.error(`Erro ao buscar fatura no Stripe (${invoiceId}):`, e);
      return null;
    }
  }

  /**
   * Retrieve Payment Intent from Stripe
   */
  static async getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent | null> {
    const stripe = getStripe();
    if (!stripe) return null;
    try {
      return await stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (e) {
      console.error(`Erro ao buscar PaymentIntent no Stripe (${paymentIntentId}):`, e);
      return null;
    }
  }
}
