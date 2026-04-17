/**
 * GET  /api/vessels          — list vessels for the authenticated org
 * POST /api/vessels/register — register a vessel and generate its API key
 *
 * Both require a Clerk JWT (the frontend passes its Bearer token).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClerkClient }  from '@clerk/backend';
import { createHash, randomUUID } from 'crypto';
import { supabase }           from '../../lib/supabase';
import { verifyClerkJWT, hashApiKey } from '../../lib/auth';
import { cors }               from '../../lib/cors';
import { writeAudit }         from '../../lib/audit';

function hashBootstrapToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function cloudBaseUrl(req: VercelRequest) {
  const configured = process.env.CLOUD_PUBLIC_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  const host = req.headers.host;
  return host ? `https://${host}` : 'https://nautic-shield.vercel.app';
}

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
  const e = err as { errors?: Array<{ longMessage?: string; message?: string }> };
  const longMessage = e?.errors?.[0]?.longMessage;
  if (typeof longMessage === 'string' && longMessage) return longMessage;
  const message = e?.errors?.[0]?.message;
  if (typeof message === 'string' && message) return message;
  if (err instanceof Error && err.message) return err.message;
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

  if (req.method === 'POST' && typeof req.body?.bootstrapToken === 'string') {
    const bootstrapToken = req.body.bootstrapToken.trim();
    if (!bootstrapToken) return res.status(400).json({ error: 'bootstrapToken is required' });

    const tokenHash = hashBootstrapToken(bootstrapToken);
    const { data } = await supabase
      .from('audit_log')
      .select('org_id, resource, metadata, created_at')
      .eq('action', 'vessel.bootstrap.issued')
      .order('created_at', { ascending: false })
      .limit(200);

    const match = (data ?? []).find((entry) => {
      const metadata = (entry.metadata ?? {}) as Record<string, unknown>;
      return metadata.tokenHash === tokenHash && typeof metadata.expiresAt === 'string' && metadata.expiresAt > new Date().toISOString();
    });

    if (!match?.resource || !match.org_id) {
      return res.status(401).json({ error: 'Invalid or expired bootstrap token' });
    }

    const apiKey = randomUUID();
    const apiKeyHash = hashApiKey(apiKey);
    const { data: vessel, error } = await supabase
      .from('vessels')
      .update({ api_key_hash: apiKeyHash })
      .eq('id', match.resource)
      .eq('org_id', match.org_id)
      .select('id, name')
      .single();

    if (error || !vessel) {
      return res.status(404).json({ error: 'Vessel not found for bootstrap token' });
    }

    await writeAudit({
      org_id: match.org_id,
      actor: 'system',
      action: 'vessel.bootstrap.consumed',
      resource: vessel.id,
      metadata: { issuedAt: match.created_at },
    }, req);

    return res.status(201).json({
      vesselId: vessel.id,
      vesselName: vessel.name,
      cloudSyncUrl: cloudBaseUrl(req),
      cloudApiKey: apiKey,
      relayUrl: process.env.RELAY_URL ?? null,
      relaySecret: process.env.RELAY_SECRET ?? null,
      provisionedAt: new Date().toISOString(),
    });
  }

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

    if (req.body?.issueBootstrapToken) {
      if (typeof vesselId !== 'string' || !vesselId.trim()) {
        return res.status(400).json({ error: 'vesselId is required' });
      }

      const { data: vessel } = await supabase
        .from('vessels')
        .select('id')
        .eq('id', vesselId)
        .eq('org_id', orgId)
        .single();

      if (!vessel) return res.status(404).json({ error: 'Vessel not found' });

      const bootstrapToken = `${randomUUID()}${randomUUID()}`;
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await writeAudit({
        org_id: orgId,
        actor: auth.userId,
        action: 'vessel.bootstrap.issued',
        resource: vesselId,
        metadata: {
          tokenHash: hashBootstrapToken(bootstrapToken),
          expiresAt,
        },
      }, req);

      return res.status(201).json({ vesselId, bootstrapToken, expiresAt });
    }

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
