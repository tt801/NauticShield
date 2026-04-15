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

function errorStatus(err: unknown): number {
  const e = err as {
    status?: number;
    statusCode?: number;
    errors?: Array<{ code?: string }>;
  };

  const status = e?.statusCode ?? e?.status;
  if (typeof status === 'number' && status >= 400 && status <= 599) {
    return status;
  }

  return 500;
}

function errorCode(err: unknown): string | null {
  const e = err as { code?: string; errors?: Array<{ code?: string }> };
  if (typeof e?.code === 'string' && e.code) return e.code;
  const nested = e?.errors?.[0]?.code;
  return typeof nested === 'string' && nested ? nested : null;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  const e = err as { errors?: Array<{ longMessage?: string; message?: string }> };
  const longMessage = e?.errors?.[0]?.longMessage;
  if (typeof longMessage === 'string' && longMessage) return longMessage;
  const message = e?.errors?.[0]?.message;
  if (typeof message === 'string' && message) return message;
  return 'Unexpected server error while creating vessel organization.';
}

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
      let plan = 'basic';
      let maxVessels = maxVesselsForPlan(plan);
      let membershipsData: Array<{ organization: { id: string; name: string | null } }> = [];

      try {
        const user = await clerk.users.getUser(auth.userId);
        const meta = (user.publicMetadata ?? {}) as Record<string, unknown>;
        plan = typeof meta.plan === 'string' ? meta.plan : 'basic';
        maxVessels = typeof meta.maxVessels === 'number' ? meta.maxVessels : maxVesselsForPlan(plan);
      } catch (err) {
        // Keep onboarding available even if metadata read fails.
        console.error('[vessels] failed reading user metadata', err);
      }

      try {
        const memberships = await clerk.users.getOrganizationMembershipList({ userId: auth.userId, limit: 100 });
        membershipsData = memberships.data.map(membership => ({
          organization: {
            id: membership.organization.id,
            name: membership.organization.name ?? null,
          },
        }));
      } catch (err) {
        console.error('[vessels] failed reading memberships', err);
      }

      const currentVessels = membershipsData.length;

      if (currentVessels >= maxVessels) {
        return res.status(402).json({
          error: 'vessel_limit_reached',
          message: `Your ${plan} plan allows ${maxVessels} vessel${maxVessels === 1 ? '' : 's'}. Upgrade your plan to add more.`,
          currentVessels,
          maxVessels,
          plan,
        });
      }

      try {
        const org = await clerk.organizations.createOrganization({
          name: vesselName,
          createdBy: auth.userId,
        });

        try {
          await writeAudit({
            actor: auth.userId,
            action: 'vessel.create',
            resource: org.id,
            metadata: { vesselName, plan, maxVessels, currentVessels: currentVessels + 1 },
          }, req);
        } catch (auditErr) {
          console.error('[vessels] audit write failed', auditErr);
        }

        return res.status(201).json({
          orgId: org.id,
          orgName: org.name,
          currentVessels: currentVessels + 1,
          maxVessels,
          plan,
        });
      } catch (err) {
        console.error('[vessels] organization creation failed', err);

        // If org creation fails but a membership exists, reuse it instead of hard failing.
        const fallbackMembership = membershipsData[membershipsData.length - 1];
        if (fallbackMembership) {
          return res.status(200).json({
            orgId: fallbackMembership.organization.id,
            orgName: fallbackMembership.organization.name,
            reusedExisting: true,
            currentVessels,
            maxVessels,
            plan,
          });
        }

        const status = errorStatus(err);
        const code = errorCode(err);
        const message = errorMessage(err);
        return res.status(status >= 500 ? 502 : status).json({
          error: code ?? 'organization_create_failed',
          message,
        });
      }
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
