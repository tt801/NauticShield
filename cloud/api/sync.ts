/**
 * POST /api/sync
 *
 * Called by the vessel agent every SYNC_INTERVAL_MS when internet is available.
 * Authenticated by the vessel's CLOUD_API_KEY (stored as SHA-256 hash in Supabase).
 *
 * Body: SyncPayload (see agent/src/sync.ts for the exact shape)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase }            from '../lib/supabase';
import { verifyVesselApiKey }  from '../lib/auth';
import { writeAudit }          from '../lib/audit';
import { rateLimit }           from '../lib/rateLimit';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 20 syncs/min per IP — prevents accidental hammering
  if (rateLimit(req, res, 20, 60_000)) return;

  const vessel = await verifyVesselApiKey(req);
  if (!vessel) return res.status(401).json({ error: 'Invalid API key' });

  const {
    syncedAt, devices, alerts, internetStatus,
    networkHealth, voyageLog, cyberAssessments, cyberFindings,
  } = req.body ?? {};

  // 1. Update vessel last_synced_at
  await supabase
    .from('vessels')
    .update({ last_synced_at: syncedAt ?? new Date().toISOString() })
    .eq('id', vessel.id);

  // 2. Upsert main snapshot (one row per vessel)
  await supabase
    .from('vessel_snapshots')
    .upsert({
      vessel_id:       vessel.id,
      synced_at:       syncedAt ?? new Date().toISOString(),
      devices:         devices         ?? [],
      alerts:          alerts          ?? [],
      internet_status: internetStatus  ?? null,
      network_health:  networkHealth   ?? null,
      updated_at:      new Date().toISOString(),
    }, { onConflict: 'vessel_id' });

  // 3. Upsert voyage log entries
  if (Array.isArray(voyageLog) && voyageLog.length > 0) {
    await supabase
      .from('voyage_log')
      .upsert(
        voyageLog.map((entry: Record<string, unknown>) => ({
          id:         entry.id,
          vessel_id:  vessel.id,
          data:       entry,
          synced_at:  new Date().toISOString(),
        })),
        { onConflict: 'id,vessel_id' },
      );
  }

  // 4. Upsert cyber assessments
  if (Array.isArray(cyberAssessments) && cyberAssessments.length > 0) {
    await supabase
      .from('cyber_assessments')
      .upsert(
        cyberAssessments.map((a: Record<string, unknown>) => ({
          id:        a.id,
          vessel_id: vessel.id,
          data:      a,
          synced_at: new Date().toISOString(),
        })),
        { onConflict: 'id,vessel_id' },
      );
  }

  // 5. Upsert cyber findings
  if (Array.isArray(cyberFindings) && cyberFindings.length > 0) {
    await supabase
      .from('cyber_findings')
      .upsert(
        cyberFindings.map((f: Record<string, unknown>) => ({
          id:        f.id,
          vessel_id: vessel.id,
          data:      f,
          synced_at: new Date().toISOString(),
        })),
        { onConflict: 'id,vessel_id' },
      );
  }

  await writeAudit({
    org_id:   vessel.org_id,
    actor:    'agent',
    action:   'sync.push',
    resource: vessel.id,
    metadata: { deviceCount: (devices ?? []).length, alertCount: (alerts ?? []).length },
  }, req);

  return res.status(200).json({ ok: true, syncedAt });
}
