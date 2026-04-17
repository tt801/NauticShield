/**
 * POST /api/webhooks/stripe
 *
 * Receives Stripe webhook events and updates vessel subscription status.
 *
 * Setup:
 *  1. Add STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET to Vercel env vars
 *  2. In Stripe dashboard → Webhooks → Add endpoint:
 *       URL:    https://<your-cloud-domain>/api/webhooks/stripe
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

function normalizePlan(plan?: string | null): string | null {
  switch ((plan ?? '').toLowerCase()) {
    case 'starter':
    case 'basic':
    case 'coastal':
      return 'coastal';
    case 'pro':
    case 'superyacht':
      return 'superyacht';
    case 'enterprise':
    case 'fleet':
      return 'fleet';
    default:
      return null;
  }
}

function planFromSubscription(sub: Record<string, unknown>): string | null {
  const metadataPlan = normalizePlan((sub.metadata as Record<string, string> | undefined)?.plan ?? null);
  if (metadataPlan) return metadataPlan;

  const priceIds = Array.isArray((sub.items as { data?: Array<{ price?: { id?: string } }> } | undefined)?.data)
    ? ((sub.items as { data: Array<{ price?: { id?: string } }> }).data.map(item => item.price?.id).filter((value): value is string => Boolean(value)))
    : [];

  const coastalPriceId = process.env.STRIPE_PRICE_COASTAL;
  const superyachtPriceId = process.env.STRIPE_PRICE_SUPERYACHT;

  if (superyachtPriceId && priceIds.includes(superyachtPriceId)) return 'superyacht';
  if (coastalPriceId && priceIds.includes(coastalPriceId)) return 'coastal';
  return null;
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
        const plan       = planFromSubscription(sub);
        const orgId      = typeof (sub.metadata as Record<string, unknown> | undefined)?.orgId === 'string'
          ? (sub.metadata as Record<string, string>).orgId
          : null;
        const periodEnd  = new Date((sub.current_period_end as number) * 1000).toISOString();
        const trialEnd   = (sub.trial_end as number | null)
          ? new Date((sub.trial_end as number) * 1000).toISOString()
          : null;
        const cancelAtPeriodEnd = Boolean(sub.cancel_at_period_end);

        const updatePayload: Record<string, string | null> = {
          stripe_subscription_id: sub.id as string,
          subscription_status: cancelAtPeriodEnd ? 'canceling' : status,
          current_period_end: periodEnd,
          trial_ends_at: trialEnd,
        };
        if (plan) {
          updatePayload.plan = plan;
        }

        const updateQuery = supabase
          .from('vessels')
          .update(updatePayload)
          .eq('stripe_customer_id', customerId);

        const { data: matchedRows } = await supabase
          .from('vessels')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .limit(1);

        if (matchedRows && matchedRows.length > 0) {
          await updateQuery;
        } else if (orgId) {
          await supabase
            .from('vessels')
            .update({ ...updatePayload, stripe_customer_id: customerId })
            .eq('org_id', orgId);
        } else {
          await updateQuery;
        }

        await writeAudit({
          actor:    'stripe',
          action:   `subscription.${event.type === 'customer.subscription.created' ? 'created' : 'updated'}`,
          metadata: { customerId, status, plan, periodEnd, trialEnd, cancelAtPeriodEnd, orgId },
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
