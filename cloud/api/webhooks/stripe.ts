/**
 * POST /api/webhooks/stripe
 *
 * Receives Stripe webhook events and updates vessel subscription status.
 *
 * Setup:
 *  1. Add STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET to Vercel env vars
 *  2. In Stripe dashboard → Webhooks → Add endpoint:
 *       URL:    https://api.nauticshield.io/api/webhooks/stripe
 *       Events: customer.subscription.created
 *               customer.subscription.updated
 *               customer.subscription.deleted
 *               invoice.payment_failed
 *               invoice.payment_succeeded
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac }   from 'crypto';
import { supabase }     from '../../lib/supabase';
import { writeAudit }   from '../../lib/audit';

// ── Stripe signature verification ────────────────────────────────────────────
function verifyStripeSignature(payload: string, header: string, secret: string): boolean {
  try {
    const parts      = Object.fromEntries(header.split(',').map(p => p.split('=')));
    const timestamp  = parts['t'];
    const signature  = parts['v1'];
    if (!timestamp || !signature) return false;

    // Reject webhooks older than 5 minutes
    if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

    const expected = createHmac('sha256', secret)
      .update(`${timestamp}.${payload}`)
      .digest('hex');

    // Constant-time comparison
    const sigBuf  = Buffer.from(signature, 'hex');
    const expBuf  = Buffer.from(expected,  'hex');
    if (sigBuf.length !== expBuf.length) return false;
    let diff = 0;
    for (let i = 0; i < sigBuf.length; i++) diff |= sigBuf[i] ^ expBuf[i];
    return diff === 0;
  } catch {
    return false;
  }
}

// ── Subscription status → plan mapping ──────────────────────────────────────
function planFromMetadata(metadata: Record<string, string>): string {
  return metadata?.plan ?? 'starter';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[stripe webhook] STRIPE_WEBHOOK_SECRET not set');
    return res.status(500).json({ error: 'Webhook not configured' });
  }

  const signature = req.headers['stripe-signature'] as string | undefined;
  if (!signature) return res.status(400).json({ error: 'Missing stripe-signature header' });

  // Vercel parses the body — we need the raw string for signature verification
  const rawBody = JSON.stringify(req.body);
  if (!verifyStripeSignature(rawBody, signature, webhookSecret)) {
    return res.status(400).json({ error: 'Invalid signature' });
  }

  const event = req.body as { type: string; data: { object: Record<string, unknown> } };

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub        = event.data.object;
        const customerId = sub.customer as string;
        const status     = sub.status   as string;
        const plan       = planFromMetadata(sub.metadata as Record<string, string>);
        const periodEnd  = new Date((sub.current_period_end as number) * 1000).toISOString();

        await supabase
          .from('vessels')
          .update({
            stripe_subscription_id: sub.id,
            subscription_status:    status,
            plan,
            current_period_end:     periodEnd,
          })
          .eq('stripe_customer_id', customerId);

        await writeAudit({
          actor:    'stripe',
          action:   `subscription.${event.type === 'customer.subscription.created' ? 'created' : 'updated'}`,
          metadata: { customerId, status, plan, periodEnd },
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const sub        = event.data.object;
        const customerId = sub.customer as string;

        await supabase
          .from('vessels')
          .update({ subscription_status: 'canceled', stripe_subscription_id: null })
          .eq('stripe_customer_id', customerId);

        await writeAudit({
          actor:    'stripe',
          action:   'subscription.canceled',
          metadata: { customerId },
        });
        break;
      }

      case 'invoice.payment_failed': {
        const invoice    = event.data.object;
        const customerId = invoice.customer as string;

        await supabase
          .from('vessels')
          .update({ subscription_status: 'past_due' })
          .eq('stripe_customer_id', customerId);

        await writeAudit({
          actor:    'stripe',
          action:   'invoice.payment_failed',
          metadata: { customerId, invoiceId: invoice.id },
        });
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice    = event.data.object;
        const customerId = invoice.customer as string;

        await supabase
          .from('vessels')
          .update({ subscription_status: 'active' })
          .eq('stripe_customer_id', customerId);

        await writeAudit({
          actor:    'stripe',
          action:   'invoice.payment_succeeded',
          metadata: { customerId, invoiceId: invoice.id },
        });
        break;
      }

      default:
        // Unknown event — acknowledge receipt and ignore
        break;
    }
  } catch (err) {
    console.error('[stripe webhook] handler error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }

  return res.json({ received: true });
}
