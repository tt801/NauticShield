/**
 * GET /api/vessels/:vesselId/snapshot
 * Returns the latest synced snapshot for a vessel.
 * Used by the frontend when the local agent is unreachable (cloud fallback).
 */
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

  const { data, error } = await supabase
    .from('vessel_snapshots')
    .select('devices, alerts, internet_status, network_health, synced_at')
    .eq('vessel_id', vessel.id)
    .single();

  if (error || !data) return res.status(404).json({ error: 'No snapshot available' });

  return res.json({
    devices:        data.devices        ?? [],
    alerts:         data.alerts         ?? [],
    internetStatus: data.internet_status,
    networkHealth:  data.network_health,
    timestamp:      data.synced_at,
  });
}
