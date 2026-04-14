/**
 * GET  /api/vessels          — list vessels for the authenticated org
 * POST /api/vessels/register — register a vessel and generate its API key
 *
 * Both require a Clerk JWT (the frontend passes its Bearer token).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClerkClient }  from '@clerk/backend';
import { randomUUID }         from 'crypto';
import { supabase }           from '../../lib/supabase';
import { verifyClerkJWT, hashApiKey } from '../../lib/auth';
import { cors }               from '../../lib/cors';
import { writeAudit }         from '../../lib/audit';

function maxVesselsForPlan(plan: string): number {
  switch (plan) {
    case 'pro':
      return 3;
    case 'enterprise':
      return 999;
    default:
      return 1;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  const auth = await verifyClerkJWT(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });

  const orgId = auth.orgId ?? auth.userId;

  // ── GET /api/vessels ─────────────────────────────────────────────
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('vessels')
      .select('id, name, last_synced_at, created_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data ?? []);
  }

  // ── POST /api/vessels ─────────────────────────────────────────────
  // Supports 2 modes:
  // 1) Onboarding mode: { name } -> creates Clerk org and returns orgId
  // 2) Register mode:   { vesselId, name? } -> generates vessel API key
  if (req.method === 'POST') {
    const { vesselId, name } = req.body ?? {};

    // Onboarding mode: create a new Clerk organization for this customer
    if (!vesselId) {
      const vesselName = typeof name === 'string' ? name.trim() : '';
      if (!vesselName) return res.status(400).json({ error: 'Vessel name is required' });

      const secretKey = process.env.CLERK_SECRET_KEY;
      if (!secretKey) return res.status(500).json({ error: 'Clerk not configured' });

      const clerk = createClerkClient({ secretKey });
      const user = await clerk.users.getUser(auth.userId);
      const meta = (user.publicMetadata ?? {}) as Record<string, unknown>;
      const plan = typeof meta.plan === 'string' ? meta.plan : 'basic';
      const maxVessels = typeof meta.maxVessels === 'number' ? meta.maxVessels : maxVesselsForPlan(plan);

      const memberships = await clerk.users.getOrganizationMembershipList({ userId: auth.userId, limit: 100 });
      const currentVessels = memberships.data.length;

      if (currentVessels >= maxVessels) {
        return res.status(402).json({
          error: 'vessel_limit_reached',
          message: `Your ${plan} plan allows ${maxVessels} vessel${maxVessels === 1 ? '' : 's'}. Upgrade your plan to add more.`,
          currentVessels,
          maxVessels,
          plan,
        });
      }

      const org = await clerk.organizations.createOrganization({
        name: vesselName,
        createdBy: auth.userId,
      });

      await writeAudit({
        actor: auth.userId,
        action: 'vessel.create',
        resource: org.id,
        metadata: { vesselName, plan, maxVessels, currentVessels: currentVessels + 1 },
      }, req);

      return res.status(201).json({
        orgId: org.id,
        orgName: org.name,
        currentVessels: currentVessels + 1,
        maxVessels,
        plan,
      });
    }

    // Register mode: API key generation for vessel agent
    if (typeof vesselId !== 'string') {
      return res.status(400).json({ error: 'vesselId is required' });
    }

    // Check if already registered (idempotent — re-register regenerates the key)
    const apiKey     = randomUUID();
    const apiKeyHash = hashApiKey(apiKey);

    const { error } = await supabase
      .from('vessels')
      .upsert({
        id:           vesselId,
        org_id:       orgId,
        name:         name ?? vesselId,
        api_key_hash: apiKeyHash,
      }, { onConflict: 'id' });

    if (error) return res.status(500).json({ error: error.message });

    await writeAudit({
      org_id:   orgId,
      actor:    auth.userId,
      action:   'vessel.register',
      resource: vesselId,
      metadata: { name: name ?? vesselId },
    }, req);

    // The plain API key is returned once — store it in the vessel .env immediately.
    return res.status(201).json({ vesselId, apiKey });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
