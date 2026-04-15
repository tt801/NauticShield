import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { cors } from '../../lib/cors';
import { verifyClerkJWT } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { writeAudit } from '../../lib/audit';

const PLAN_PRICE_ENV: Record<string, string> = {
  coastal: 'STRIPE_PRICE_COASTAL',
  superyacht: 'STRIPE_PRICE_SUPERYACHT',
};

async function handleCheckout(req: VercelRequest, res: VercelResponse) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return res.status(500).json({ error: 'Stripe not configured' });

  const { plan, successUrl, cancelUrl } = req.body as {
    plan?: string;
    successUrl?: string;
    cancelUrl?: string;
  };

  if (!plan || !PLAN_PRICE_ENV[plan]) {
    return res.status(400).json({ error: `Invalid plan. Must be one of: ${Object.keys(PLAN_PRICE_ENV).join(', ')}` });
  }

  const priceId = process.env[PLAN_PRICE_ENV[plan]];
  if (!priceId) {
    return res.status(500).json({ error: `${PLAN_PRICE_ENV[plan]} env var not set` });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2026-03-25.dahlia' });

  const defaultSuccess = 'https://app.nauticshield.io/onboarding?checkout=success';
  const defaultCancel = 'https://nauticshield.io/#pricing';

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl ?? defaultSuccess,
      cancel_url: cancelUrl ?? defaultCancel,
      subscription_data: {
        metadata: { plan },
        trial_period_days: 14,
      },
      allow_promotion_codes: true,
    });

    return res.json({ url: session.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Stripe error';
    console.error('[stripe/checkout]', msg);
    return res.status(500).json({ error: msg });
  }
}

async function handleCancel(req: VercelRequest, res: VercelResponse) {
  const auth = await verifyClerkJWT(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return res.status(500).json({ error: 'Stripe not configured' });

  const orgId = auth.orgId ?? auth.userId;
  const { data: vessel, error: vesselErr } = await supabase
    .from('vessels')
    .select('id, stripe_subscription_id, stripe_customer_id, subscription_status')
    .eq('org_id', orgId)
    .not('stripe_subscription_id', 'is', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (vesselErr) return res.status(500).json({ error: vesselErr.message });
  if (!vessel?.stripe_subscription_id) return res.status(404).json({ error: 'No active subscription found' });

  try {
    const stripe = new Stripe(stripeKey, { apiVersion: '2026-03-25.dahlia' });
    const updated = await stripe.subscriptions.update(vessel.stripe_subscription_id, {
      cancel_at_period_end: true,
    });

    const periodEndIso = updated.cancel_at
      ? new Date(updated.cancel_at * 1000).toISOString()
      : null;
    const trialEndIso = updated.trial_end
      ? new Date(updated.trial_end * 1000).toISOString()
      : null;

    await supabase
      .from('vessels')
      .update({
        subscription_status: updated.cancel_at_period_end ? 'canceling' : updated.status,
        current_period_end: periodEndIso,
        trial_ends_at: trialEndIso,
      })
      .eq('id', vessel.id);

    await writeAudit({
      org_id: orgId,
      actor: auth.userId,
      action: 'subscription.cancel_at_period_end',
      resource: vessel.id,
      metadata: {
        stripeSubscriptionId: updated.id,
        status: updated.status,
        cancelAtPeriodEnd: updated.cancel_at_period_end,
        currentPeriodEnd: periodEndIso,
        trialEnd: trialEndIso,
      },
    }, req);

    const inTrial = updated.status === 'trialing' && !!updated.trial_end;
    return res.json({
      ok: true,
      inTrial,
      cancelAtPeriodEnd: updated.cancel_at_period_end,
      currentPeriodEnd: periodEndIso,
      trialEnd: trialEndIso,
      message: inTrial
        ? 'Subscription will cancel before the end of trial with no charge.'
        : 'Subscription will cancel at period end. Access remains active until then.',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Stripe error';
    return res.status(500).json({ error: msg });
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const action = String(req.query.action ?? '').toLowerCase();
  if (action === 'checkout') return handleCheckout(req, res);
  if (action === 'cancel') return handleCancel(req, res);

  return res.status(404).json({ error: 'Unknown Stripe action' });
}