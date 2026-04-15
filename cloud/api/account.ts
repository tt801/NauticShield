import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClerkClient } from '@clerk/backend';
import Stripe from 'stripe';
import { cors } from '../lib/cors';
import { verifyClerkJWT } from '../lib/auth';
import { supabase } from '../lib/supabase';

function createStripeClient(secretKey: string) {
  return new Stripe(secretKey, { apiVersion: '2026-03-25.dahlia' });
}

type StripeClient = ReturnType<typeof createStripeClient>;
type StripeCustomerLookup = Awaited<ReturnType<StripeClient['customers']['retrieve']>>;
type StripeCustomerListItem = Awaited<ReturnType<StripeClient['customers']['list']>>['data'][number];
type StripeCustomer = StripeCustomerLookup | StripeCustomerListItem;
type StripeSubscription = Awaited<ReturnType<StripeClient['subscriptions']['retrieve']>>;

function isDeletedCustomer(customer: StripeCustomer | null): customer is Extract<StripeCustomerLookup, { deleted: true }> {
  return Boolean(customer && 'deleted' in customer && customer.deleted);
}

type VesselBillingRow = {
  id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
};

async function getClerkUser(userId: string) {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error('Clerk not configured');
  }

  const clerk = createClerkClient({ secretKey });
  return clerk.users.getUser(userId);
}

async function findStripeCustomer(stripe: StripeClient, userId: string, orgId: string, email?: string | null) {
  const { data: vessel } = await supabase
    .from('vessels')
    .select('stripe_customer_id')
    .eq('org_id', orgId)
    .not('stripe_customer_id', 'is', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (vessel?.stripe_customer_id) {
    return stripe.customers.retrieve(vessel.stripe_customer_id) as Promise<StripeCustomerLookup>;
  }

  const searchResult = await stripe.customers.search({
    query: `metadata['userId']:'${userId}'`,
    limit: 1,
  });

  if (searchResult.data[0]) {
    return searchResult.data[0];
  }

  if (!email) {
    return null;
  }

  const emailMatches = await stripe.customers.list({ email, limit: 1 });
  return emailMatches.data[0] ?? null;
}

async function getPrimaryVessel(orgId: string) {
  const { data: vessel } = await supabase
    .from('vessels')
    .select('id, stripe_customer_id, stripe_subscription_id, plan, subscription_status, current_period_end, trial_ends_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  return (vessel ?? null) as VesselBillingRow | null;
}

async function getDefaultPaymentMethod(
  stripe: StripeClient,
  customer: StripeCustomer | null,
  subscription: StripeSubscription | null,
) {
  let paymentMethodId: string | null = null;

  if (subscription?.default_payment_method) {
    paymentMethodId = typeof subscription.default_payment_method === 'string'
      ? subscription.default_payment_method
      : subscription.default_payment_method.id;
  }

  if (!paymentMethodId && customer && !customer.deleted && customer.invoice_settings.default_payment_method) {
    paymentMethodId = typeof customer.invoice_settings.default_payment_method === 'string'
      ? customer.invoice_settings.default_payment_method
      : customer.invoice_settings.default_payment_method.id;
  }

  if (!paymentMethodId) {
    return null;
  }

  const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
  if (paymentMethod.type !== 'card' || !paymentMethod.card) {
    return {
      brand: paymentMethod.type,
      last4: null,
      expMonth: null,
      expYear: null,
    };
  }

  return {
    brand: paymentMethod.card.brand ?? null,
    last4: paymentMethod.card.last4 ?? null,
    expMonth: paymentMethod.card.exp_month ?? null,
    expYear: paymentMethod.card.exp_year ?? null,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await verifyClerkJWT(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return res.status(500).json({ error: 'Stripe not configured' });

  try {
    const stripe = createStripeClient(stripeKey);
    const user = await getClerkUser(auth.userId);
    const orgId = auth.orgId ?? auth.userId;
    const vessel = await getPrimaryVessel(orgId);
    const customer = await findStripeCustomer(
      stripe,
      auth.userId,
      orgId,
      user.primaryEmailAddress?.emailAddress ?? null,
    );
    const subscription = vessel?.stripe_subscription_id
      ? await stripe.subscriptions.retrieve(vessel.stripe_subscription_id)
      : null;
    const paymentMethod = await getDefaultPaymentMethod(stripe, customer, subscription);
    const activeCustomer = customer && !isDeletedCustomer(customer) ? customer : null;
    const customerAddress = activeCustomer?.address ?? null;

    return res.json({
      profile: {
        fullName: user.fullName ?? null,
        email: user.primaryEmailAddress?.emailAddress ?? null,
      },
      billing: activeCustomer ? {
        customerId: activeCustomer.id,
        name: activeCustomer.name ?? null,
        email: activeCustomer.email ?? null,
        phone: activeCustomer.phone ?? null,
        taxExempt: activeCustomer.tax_exempt ?? null,
        address: customerAddress ? {
          line1: customerAddress.line1 ?? null,
          line2: customerAddress.line2 ?? null,
          city: customerAddress.city ?? null,
          state: customerAddress.state ?? null,
          postalCode: customerAddress.postal_code ?? null,
          country: customerAddress.country ?? null,
        } : null,
      } : null,
      subscription: {
        plan: vessel?.plan ?? null,
        status: vessel?.subscription_status ?? subscription?.status ?? null,
        currentPeriodEnd: vessel?.current_period_end ?? null,
        trialEnd: vessel?.trial_ends_at
          ?? (subscription?.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null),
        cancelAtPeriodEnd: subscription?.cancel_at_period_end ?? false,
        paymentMethod,
        customerPortalAvailable: Boolean(activeCustomer),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load account information';
    return res.status(500).json({ error: message });
  }
}