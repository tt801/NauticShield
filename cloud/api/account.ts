import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClerkClient } from '@clerk/backend';
import Stripe from 'stripe';
import { cors } from '../lib/cors';
import { resolvePreferredOrgId, verifyClerkJWT } from '../lib/auth';
import { supabase } from '../lib/supabase';

function createStripeClient(secretKey: string) {
  return new Stripe(secretKey, { apiVersion: '2026-03-25.dahlia' });
}

type StripeClient = ReturnType<typeof createStripeClient>;
type StripeCustomerLookup = Awaited<ReturnType<StripeClient['customers']['retrieve']>>;
type StripeCustomerListItem = Awaited<ReturnType<StripeClient['customers']['list']>>['data'][number];
type StripeCustomer = StripeCustomerLookup | StripeCustomerListItem;
type StripeSubscription = Awaited<ReturnType<StripeClient['subscriptions']['list']>>['data'][number];

const MANAGED_SUBSCRIPTION_STATUSES = new Set(['trialing', 'active', 'past_due', 'unpaid']);

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

function planFromSubscription(subscription: StripeSubscription | null): string | null {
  if (!subscription) return null;

  const metadataPlan = normalizePlan(subscription.metadata?.plan ?? null);
  if (metadataPlan) return metadataPlan;

  const priceIds = subscription.items.data
    .map(item => item.price?.id)
    .filter((value): value is string => Boolean(value));

  const coastalPriceId = process.env.STRIPE_PRICE_COASTAL;
  const superyachtPriceId = process.env.STRIPE_PRICE_SUPERYACHT;

  if (superyachtPriceId && priceIds.includes(superyachtPriceId)) return 'superyacht';
  if (coastalPriceId && priceIds.includes(coastalPriceId)) return 'coastal';
  return null;
}

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

async function findManagedSubscription(
  stripe: StripeClient,
  customer: StripeCustomer | null,
  orgId: string,
  userId: string,
  knownSubscriptionId?: string | null,
) {
  if (knownSubscriptionId) {
    return stripe.subscriptions.retrieve(knownSubscriptionId);
  }

  if (!customer || isDeletedCustomer(customer)) {
    return null;
  }

  const subscriptions = await stripe.subscriptions.list({
    customer: customer.id,
    status: 'all',
    limit: 10,
  });

  const matched = subscriptions.data.find(subscription =>
    subscription.cancel_at_period_end || MANAGED_SUBSCRIPTION_STATUSES.has(subscription.status),
  ) ?? subscriptions.data[0] ?? null;

  if (matched) {
    return matched;
  }

  const subscriptionSearch = stripe.subscriptions as typeof stripe.subscriptions & {
    search?: (params: { query: string; limit?: number }) => Promise<{ data: StripeSubscription[] }>;
  };

  if (!subscriptionSearch.search) {
    return null;
  }

  const queries = [
    `metadata['orgId']:'${orgId}'`,
    `metadata['userId']:'${userId}'`,
  ];

  for (const query of queries) {
    const result = await subscriptionSearch.search({ query, limit: 10 });
    const subscription = result.data.find(entry =>
      entry.cancel_at_period_end || MANAGED_SUBSCRIPTION_STATUSES.has(entry.status),
    ) ?? result.data[0] ?? null;

    if (subscription) {
      return subscription;
    }
  }

  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  if (!['GET', 'PATCH'].includes(req.method ?? '')) return res.status(405).json({ error: 'Method not allowed' });

  const auth = await verifyClerkJWT(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'PATCH') {
    const organizationName = typeof req.body?.organizationName === 'string' ? req.body.organizationName.trim() : '';
    if (!organizationName) {
      return res.status(400).json({ error: 'organizationName is required' });
    }

    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) return res.status(500).json({ error: 'Clerk not configured' });

    try {
      const clerk = createClerkClient({ secretKey });
      const orgId = await resolvePreferredOrgId(req, auth);
      const org = await clerk.organizations.updateOrganization(orgId, { name: organizationName });
      return res.json({ orgId: org.id, name: org.name });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update organisation name';
      return res.status(500).json({ error: message });
    }
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return res.status(500).json({ error: 'Stripe not configured' });

  try {
    const stripe = createStripeClient(stripeKey);
    const user = await getClerkUser(auth.userId);
    const orgId = await resolvePreferredOrgId(req, auth);
    const vessel = await getPrimaryVessel(orgId);
    const customer = await findStripeCustomer(
      stripe,
      auth.userId,
      orgId,
      user.primaryEmailAddress?.emailAddress ?? null,
    );
    let activeCustomer = customer && !isDeletedCustomer(customer) ? customer : null;
    const subscription = await findManagedSubscription(stripe, activeCustomer, orgId, auth.userId, vessel?.stripe_subscription_id ?? null);

    if (!activeCustomer && subscription?.customer && typeof subscription.customer === 'string') {
      const fetchedCustomer = await stripe.customers.retrieve(subscription.customer);
      activeCustomer = !('deleted' in fetchedCustomer && fetchedCustomer.deleted) ? fetchedCustomer : null;
    }

    const paymentMethod = await getDefaultPaymentMethod(stripe, activeCustomer, subscription);
    const customerAddress = activeCustomer?.address ?? null;
    const derivedPlan = planFromSubscription(subscription) ?? vessel?.plan ?? null;
    const subscriptionWithPeriod = subscription as unknown as { current_period_end?: number } | null;
    const subscriptionPeriodEnd = typeof subscriptionWithPeriod?.current_period_end === 'number'
      ? subscriptionWithPeriod.current_period_end
      : null;
    const derivedPeriodEnd = subscriptionPeriodEnd ? new Date(subscriptionPeriodEnd * 1000).toISOString() : vessel?.current_period_end ?? null;
    const derivedTrialEnd = subscription?.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : vessel?.trial_ends_at ?? null;
    const derivedStatus = subscription
      ? (subscription.cancel_at_period_end ? 'canceling' : subscription.status)
      : (vessel?.subscription_status ?? null);

    if (vessel) {
      const nextState: Partial<VesselBillingRow> = {};
      if (derivedPlan && derivedPlan !== vessel.plan) nextState.plan = derivedPlan;
      if (subscription?.id && subscription.id !== vessel.stripe_subscription_id) nextState.stripe_subscription_id = subscription.id;
      if (activeCustomer?.id && activeCustomer.id !== vessel.stripe_customer_id) nextState.stripe_customer_id = activeCustomer.id;
      if (derivedStatus && derivedStatus !== vessel.subscription_status) nextState.subscription_status = derivedStatus;
      if (derivedPeriodEnd !== vessel.current_period_end) nextState.current_period_end = derivedPeriodEnd;
      if (derivedTrialEnd !== vessel.trial_ends_at) nextState.trial_ends_at = derivedTrialEnd;

      if (Object.keys(nextState).length > 0) {
        await supabase.from('vessels').update(nextState).eq('id', vessel.id);
      }
    }

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
        plan: derivedPlan,
        status: derivedStatus,
        currentPeriodEnd: derivedPeriodEnd,
        trialEnd: derivedTrialEnd,
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