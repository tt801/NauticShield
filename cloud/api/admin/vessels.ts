/**
 * GET  /api/admin/vessels          — list all vessels across all orgs
 * POST /api/admin/vessels          — manually create a vessel (trial/test)
 * PATCH /api/admin/vessels/:id     — update subscription fields
 *
 * Requires admin Clerk JWT (publicMetadata.role === "admin").
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase }         from '../../lib/supabase';
import { verifyAdminJWT }   from '../../lib/adminAuth';
import { cors }             from '../../lib/cors';
import { writeAudit }       from '../../lib/audit';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  const admin = await verifyAdminJWT(req);
  if (!admin) return res.status(401).json({ error: 'Admin access required' });

  // ── GET /api/admin/vessels ────────────────────────────────────────
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('vessels')
      .select('id, org_id, name, last_synced_at, plan, subscription_status, stripe_customer_id, stripe_subscription_id, trial_ends_at, current_period_end, created_at')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data ?? []);
  }

  // ── POST /api/admin/vessels ───────────────────────────────────────
  if (req.method === 'POST') {
    const { org_id, name, plan, subscription_status, trial_ends_at } = req.body as {
      org_id?: string;
      name?: string;
      plan?: string;
      subscription_status?: string;
      trial_ends_at?: string;
    };

    if (!org_id || !name) return res.status(400).json({ error: 'org_id and name are required' });

    const { data, error } = await supabase
      .from('vessels')
      .insert({
        org_id,
        name,
        plan:                plan                ?? 'trial',
        subscription_status: subscription_status ?? 'trialing',
        trial_ends_at:       trial_ends_at       ?? new Date(Date.now() + 14 * 86400_000).toISOString(),
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    await writeAudit({ actor: admin.userId, action: 'admin.vessel.create', resource: data.id, metadata: { org_id, name, plan } }, req);
    return res.status(201).json(data);
  }

  // ── PATCH /api/admin/vessels/:id ──────────────────────────────────
  if (req.method === 'PATCH') {
    const vesselId = req.query.id as string;
    if (!vesselId) return res.status(400).json({ error: 'Missing vessel id' });

    const allowed = ['plan', 'subscription_status', 'stripe_customer_id', 'stripe_subscription_id', 'trial_ends_at', 'current_period_end'];
    const patch: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in (req.body ?? {})) patch[key] = req.body[key];
    }

    if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'No valid fields to update' });

    const { error } = await supabase.from('vessels').update(patch).eq('id', vesselId);
    if (error) return res.status(500).json({ error: error.message });

    await writeAudit({ actor: admin.userId, action: 'admin.vessel.update', resource: vesselId, metadata: patch }, req);
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
