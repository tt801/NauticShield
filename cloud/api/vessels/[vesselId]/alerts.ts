import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase }            from '../../../lib/supabase';
import { verifyClerkJWT, assertVesselOwnership } from '../../../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await verifyClerkJWT(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });

  const vessel = await assertVesselOwnership(req.query.vesselId as string, auth);
  if (!vessel) return res.status(404).json({ error: 'Vessel not found' });

  const { data } = await supabase
    .from('vessel_snapshots')
    .select('alerts')
    .eq('vessel_id', vessel.id)
    .single();

  return res.json(data?.alerts ?? []);
}
