import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { cors } from '../../lib/cors';
import { verifyClerkJWT } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { writeAudit } from '../../lib/audit';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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
