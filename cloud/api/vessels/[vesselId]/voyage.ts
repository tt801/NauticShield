import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase }            from '../../../lib/supabase';
import { verifyClerkJWT, assertVesselOwnership } from '../../../lib/auth';
import { cors } from '../../../lib/cors';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await verifyClerkJWT(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });

  const vessel = await assertVesselOwnership(req.query.vesselId as string, auth);
  if (!vessel) return res.status(404).json({ error: 'Vessel not found' });

  const { data } = await supabase
    .from('voyage_log')
    .select('data')
    .eq('vessel_id', vessel.id)
    .order('synced_at', { ascending: false })
    .limit(200);

  return res.json((data ?? []).map(r => r.data));
}
