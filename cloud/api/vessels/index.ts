/**
 * GET  /api/vessels          — list vessels for the authenticated org
 * POST /api/vessels/register — register a vessel and generate its API key
 *
 * Both require a Clerk JWT (the frontend passes its Bearer token).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID }         from 'crypto';
import { supabase }           from '../../lib/supabase';
import { verifyClerkJWT, hashApiKey } from '../../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

  // ── POST /api/vessels/register ────────────────────────────────────
  if (req.method === 'POST') {
    const { vesselId, name } = req.body ?? {};
    if (!vesselId || typeof vesselId !== 'string') {
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

    // The plain API key is returned once — store it in the vessel .env immediately.
    return res.status(201).json({ vesselId, apiKey });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
