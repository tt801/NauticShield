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
    const customer = await findStripeCustomer(
      stripe,
      auth.userId,
      auth.orgId ?? auth.userId,
      user.primaryEmailAddress?.emailAddress ?? null,
    );

    const customerAddress = customer && !customer.deleted ? customer.address : null;

    return res.json({
      profile: {
        fullName: user.fullName ?? null,
        email: user.primaryEmailAddress?.emailAddress ?? null,
      },
      billing: customer && !customer.deleted ? {
        customerId: customer.id,
        name: customer.name ?? null,
        email: customer.email ?? null,
        phone: customer.phone ?? null,
        taxExempt: customer.tax_exempt ?? null,
        address: customerAddress ? {
          line1: customerAddress.line1 ?? null,
          line2: customerAddress.line2 ?? null,
          city: customerAddress.city ?? null,
          state: customerAddress.state ?? null,
          postalCode: customerAddress.postal_code ?? null,
          country: customerAddress.country ?? null,
        } : null,
      } : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load account information';
    return res.status(500).json({ error: message });
  }
}