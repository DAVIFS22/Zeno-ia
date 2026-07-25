import { adminDb } from '../lib/firebaseAdmin';

export interface StripeLogEntry {
  eventId: string;
  eventType: string;
  userId?: string;
  customerId?: string;
  subscriptionId?: string;
  invoiceId?: string;
  status: 'processing' | 'processed' | 'failed' | 'ignored_duplicate';
  processingTimeMs?: number;
  error?: string;
  details?: any;
  timestamp: number;
}

export async function logStripeWebhook(entry: StripeLogEntry) {
  try {
    const docId = `log_${entry.eventId}_${Date.now()}`;
    await adminDb.collection('stripe_webhook_logs').doc(docId).set({
      ...entry,
      createdAt: new Date().toISOString()
    });

    // Also write to audit_logs for system visibility
    await adminDb.collection('audit_logs').doc(docId).set({
      id: docId,
      timestamp: entry.timestamp,
      user: entry.userId || entry.customerId || 'stripe_system',
      action: `StripeWebhook:${entry.eventType}`,
      details: JSON.stringify({
        status: entry.status,
        duration: entry.processingTimeMs,
        subId: entry.subscriptionId,
        err: entry.error
      })
    });
  } catch (err) {
    console.error('Failed to record Stripe webhook log:', err);
  }
}

export async function recordFailedWebhook(eventId: string, eventType: string, payload: any, errorMsg: string) {
  try {
    await adminDb.collection('failed_webhooks').doc(eventId).set({
      eventId,
      eventType,
      payload,
      errorMsg,
      failedAt: Date.now(),
      attempts: 1,
      status: 'pending_retry'
    }, { merge: true });
  } catch (err) {
    console.error('Failed to store failed webhook for queue:', err);
  }
}
