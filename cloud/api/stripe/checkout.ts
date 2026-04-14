/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout Session for a given plan and returns the
 * hosted checkout URL. The browser redirects to that URL.
 *
 * Body: { plan: 'coastal' | 'superyacht', successUrl?: string, cancelUrl?: string }
 *
 * Required env vars (set in Vercel → Settings → Environment Variables):
 *   STRIPE_SECRET_KEY          — sk_live_... or sk_test_...
 *   STRIPE_PRICE_COASTAL       — price_... from Stripe Dashboard
 *   STRIPE_PRICE_SUPERYACHT    — price_... from Stripe Dashboard
 *
 * After payment succeeds the webhook at /api/webhooks/stripe fires and
 * creates/updates the vessel subscription record in Supabase.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { cors } from '../../lib/cors';

const PLAN_PRICE_ENV: Record<string, string> = {
  coastal:    'STRIPE_PRICE_COASTAL',
  superyacht: 'STRIPE_PRICE_SUPERYACHT',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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

  const defaultSuccess = 'https://app.nauticshield.io/?checkout=success';
  const defaultCancel  = 'https://nauticshield.io/#pricing';

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl ?? defaultSuccess,
      cancel_url:  cancelUrl  ?? defaultCancel,
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
