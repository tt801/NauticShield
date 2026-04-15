import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClerkClient } from '@clerk/backend';
import Stripe from 'stripe';
import { cors } from '../../lib/cors';
import { verifyClerkJWT } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { writeAudit } from '../../lib/audit';

const PLAN_PRICE_ENV: Record<string, string> = {
  coastal: 'STRIPE_PRICE_COASTAL',
  superyacht: 'STRIPE_PRICE_SUPERYACHT',
};

function createStripeClient(secretKey: string) {
  return new Stripe(secretKey, { apiVersion: '2026-03-25.dahlia' });
}

type StripeClient = ReturnType<typeof createStripeClient>;

async function getCheckoutUser(userId: string) {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error('Clerk not configured');
  }

  const clerk = createClerkClient({ secretKey });
  const user = await clerk.users.getUser(userId);
  const fallbackName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();

  return {
    email: user.primaryEmailAddress?.emailAddress ?? undefined,
    name: (user.fullName ?? fallbackName) || undefined,
  };
}

async function findExistingCustomerForUser(stripe: StripeClient, userId: string, email?: string) {
  const result = await stripe.customers.search({
    query: `metadata['userId']:'${userId}'`,
    limit: 1,
  });

  if (result.data[0]) {
    return result.data[0];
  }

  if (!email) {
    return null;
  }

  const emailMatches = await stripe.customers.list({ email, limit: 1 });
  return emailMatches.data[0] ?? null;
}

async function findExistingCustomerForOrg(stripe: StripeClient, orgId: string, userId: string, email?: string) {
  const { data: vessel } = await supabase
    .from('vessels')
    .select('stripe_customer_id')
    .eq('org_id', orgId)
    .not('stripe_customer_id', 'is', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (vessel?.stripe_customer_id) {
    return stripe.customers.retrieve(vessel.stripe_customer_id);
  }

  return findExistingCustomerForUser(stripe, userId, email);
}

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

  const stripe = createStripeClient(stripeKey);

  const defaultSuccess = 'https://app.nauticshield.io/onboarding?checkout=success';
  const defaultCancel = 'https://nauticshield.io/#pricing';
  const auth = await verifyClerkJWT(req);

  try {
    let customer: Awaited<ReturnType<typeof findExistingCustomerForUser>> = null;
    let customerEmail: string | undefined;
    let customerName: string | undefined;

    if (auth) {
      const checkoutUser = await getCheckoutUser(auth.userId);
      customerEmail = checkoutUser.email;
      customerName = checkoutUser.name;

      customer = await findExistingCustomerForUser(stripe, auth.userId, customerEmail);
      if (!customer) {
        customer = await stripe.customers.create({
          email: customerEmail,
          name: customerName,
          metadata: {
            userId: auth.userId,
            plan,
          },
        });
      } else if (customer.metadata.userId !== auth.userId || customer.name !== customerName || customer.email !== customerEmail) {
        customer = await stripe.customers.update(customer.id, {
          email: customerEmail,
          name: customerName,
          metadata: {
            ...customer.metadata,
            userId: auth.userId,
            plan,
          },
        });
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl ?? defaultSuccess,
      cancel_url: cancelUrl ?? defaultCancel,
      customer: customer?.id,
      customer_creation: customer ? undefined : 'always',
      customer_email: customer ? undefined : customerEmail,
      client_reference_id: auth?.userId,
      billing_address_collection: 'required',
      tax_id_collection: { enabled: true },
      customer_update: customer ? { address: 'auto', name: 'auto' } : undefined,
      subscription_data: {
        metadata: {
          plan,
          userId: auth?.userId ?? '',
        },
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
    const stripe = createStripeClient(stripeKey);
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

async function handlePortal(req: VercelRequest, res: VercelResponse) {
  const auth = await verifyClerkJWT(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return res.status(500).json({ error: 'Stripe not configured' });

  const orgId = auth.orgId ?? auth.userId;
  const { returnUrl } = (req.body ?? {}) as { returnUrl?: string };

  try {
    const stripe = createStripeClient(stripeKey);
    const checkoutUser = await getCheckoutUser(auth.userId);
    const customer = await findExistingCustomerForOrg(
      stripe,
      orgId,
      auth.userId,
      checkoutUser.email,
    );

    if (!customer || ('deleted' in customer && customer.deleted)) {
      return res.status(404).json({ error: 'No Stripe customer found for this account' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: returnUrl || 'https://app.nauticshield.io/settings',
    });

    await writeAudit({
      org_id: orgId,
      actor: auth.userId,
      action: 'subscription.portal.opened',
      metadata: { customerId: customer.id },
    }, req);

    return res.json({ url: session.url });
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
  if (action === 'portal') return handlePortal(req, res);

  return res.status(404).json({ error: 'Unknown Stripe action' });
}