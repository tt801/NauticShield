/**
 * GET /api/vessels/:vesselId/alerts
 * GET /api/vessels/:vesselId/devices
 * GET /api/vessels/:vesselId/snapshot
 * GET /api/vessels/:vesselId/voyage
 *
 * Consolidated into a single serverless function to stay within Vercel Hobby limits.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase }            from '../../../lib/supabase';
import { verifyClerkJWT, assertVesselOwnership } from '../../../lib/auth';
import { cors } from '../../../lib/cors';
import { writeAudit } from '../../../lib/audit';

const PEN_TEST_REPORT_BUCKET = 'pen-test-reports';
const MAX_PEN_TEST_REPORT_BYTES = 10 * 1024 * 1024;

type NotificationCategory = 'new_device' | 'port_scan' | 'internet_down' | 'cyber_critical' | 'device_spike';
type CategoryPref = { email: boolean; sms: boolean };
type NotificationPrefs = {
  emailTo: string;
  phoneTo: string;
  categories: Record<NotificationCategory, CategoryPref>;
};

const DEFAULT_NOTIFICATION_CATEGORIES: Record<NotificationCategory, CategoryPref> = {
  new_device: { email: true, sms: false },
  port_scan: { email: true, sms: true },
  internet_down: { email: true, sms: true },
  cyber_critical: { email: true, sms: true },
  device_spike: { email: true, sms: false },
};

function normalizePlan(plan?: string | null) {
  switch ((plan ?? '').toLowerCase()) {
    case 'starter':
    case 'basic':
    case 'coastal':
      return 'coastal';
    case 'pro':
    case 'superyacht':
      return 'superyacht';
    case 'enterprise':
    case 'fleet':
      return 'fleet';
    default:
      return 'coastal';
  }
}

function maxVesselsForPlan(plan: string) {
  switch (normalizePlan(plan)) {
    case 'superyacht':
      return 3;
    case 'fleet':
      return 999;
    default:
      return 1;
  }
}

function mergeNotificationPrefs(value: unknown, current?: NotificationPrefs): NotificationPrefs {
  const source = (value && typeof value === 'object') ? value as Partial<NotificationPrefs> : {};
  const base = current ?? {
    emailTo: '',
    phoneTo: '',
    categories: DEFAULT_NOTIFICATION_CATEGORIES,
  };

  const categories = Object.entries(DEFAULT_NOTIFICATION_CATEGORIES).reduce((acc, [key, defaults]) => {
    const existing = base.categories[key as NotificationCategory] ?? defaults;
    const incoming = source.categories?.[key as NotificationCategory];

    acc[key as NotificationCategory] = {
      email: typeof incoming?.email === 'boolean' ? incoming.email : existing.email,
      sms: typeof incoming?.sms === 'boolean' ? incoming.sms : existing.sms,
    };

    return acc;
  }, {} as Record<NotificationCategory, CategoryPref>);

  return {
    emailTo: typeof source.emailTo === 'string' ? source.emailTo : base.emailTo,
    phoneTo: typeof source.phoneTo === 'string' ? source.phoneTo : base.phoneTo,
    categories,
  };
}

async function loadNotificationPrefs(orgId: string) {
  const { data } = await supabase
    .from('audit_log')
    .select('metadata')
    .eq('org_id', orgId)
    .eq('action', 'notification.preferences.updated')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const metadata = (data?.metadata ?? null) as Record<string, unknown> | null;
  return mergeNotificationPrefs(metadata?.preferences);
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').slice(0, 120) || 'pen-test-report.pdf';
}

async function ensurePenTestBucket() {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) throw error;

  if (buckets?.some(bucket => bucket.name === PEN_TEST_REPORT_BUCKET)) {
    return;
  }

  const { error: createError } = await supabase.storage.createBucket(PEN_TEST_REPORT_BUCKET, {
    public: false,
    fileSizeLimit: `${MAX_PEN_TEST_REPORT_BYTES}`,
    allowedMimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  });

  if (createError && !/already exists/i.test(createError.message)) {
    throw createError;
  }
}

async function getLatestPenTestReport(orgId: string, vesselId: string) {
  const { data, error } = await supabase
    .from('audit_log')
    .select('metadata, created_at')
    .eq('org_id', orgId)
    .eq('resource', vesselId)
    .eq('action', 'pen_test.report.uploaded')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.metadata) return null;

  const metadata = data.metadata as Record<string, unknown>;
  const path = typeof metadata.path === 'string' ? metadata.path : '';
  let downloadUrl: string | null = null;

  if (path) {
    const signed = await supabase.storage.from(PEN_TEST_REPORT_BUCKET).createSignedUrl(path, 60 * 60);
    downloadUrl = signed.data?.signedUrl ?? null;
  }

  return {
    fileName: typeof metadata.fileName === 'string' ? metadata.fileName : 'Pen test report',
    contentType: typeof metadata.contentType === 'string' ? metadata.contentType : 'application/octet-stream',
    sizeBytes: typeof metadata.sizeBytes === 'number' ? metadata.sizeBytes : 0,
    uploadedAt: typeof metadata.uploadedAt === 'string' ? metadata.uploadedAt : (data.created_at as string),
    bucket: PEN_TEST_REPORT_BUCKET,
    path,
    downloadUrl,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  if (!['GET', 'PUT', 'POST'].includes(req.method ?? '')) return res.status(405).json({ error: 'Method not allowed' });

  const auth = await verifyClerkJWT(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });

  const vessel = await assertVesselOwnership(req.query.vesselId as string, auth);
  if (!vessel) return res.status(404).json({ error: 'Vessel not found' });

  const resource = req.query.resource as string;

  if (req.method === 'POST') {
    if (resource !== 'pen-test-report') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const fileName = typeof req.body?.fileName === 'string' ? req.body.fileName.trim() : '';
    const contentType = typeof req.body?.contentType === 'string' ? req.body.contentType.trim() : 'application/octet-stream';
    const fileDataBase64 = typeof req.body?.fileDataBase64 === 'string' ? req.body.fileDataBase64 : '';

    if (!fileName || !fileDataBase64) {
      return res.status(400).json({ error: 'fileName and fileDataBase64 are required' });
    }

    const buffer = Buffer.from(fileDataBase64, 'base64');
    if (!buffer.length) {
      return res.status(400).json({ error: 'Uploaded file was empty' });
    }
    if (buffer.length > MAX_PEN_TEST_REPORT_BYTES) {
      return res.status(400).json({ error: 'Pen-test reports must be 10 MB or smaller' });
    }

    try {
      await ensurePenTestBucket();
      const safeFileName = sanitizeFileName(fileName);
      const path = `${vessel.org_id}/${vessel.id}/${Date.now()}-${safeFileName}`;
      const { error: uploadError } = await supabase.storage.from(PEN_TEST_REPORT_BUCKET).upload(path, buffer, {
        upsert: true,
        contentType,
      });

      if (uploadError) {
        return res.status(500).json({ error: uploadError.message });
      }

      const metadata = {
        fileName: safeFileName,
        contentType,
        sizeBytes: buffer.length,
        path,
        uploadedAt: new Date().toISOString(),
      };

      await writeAudit({
        org_id: vessel.org_id,
        actor: auth.userId,
        action: 'pen_test.report.uploaded',
        resource: vessel.id,
        metadata,
      }, req);

      return res.json(await getLatestPenTestReport(vessel.org_id, vessel.id));
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : 'Upload failed' });
    }
  }

  if (req.method === 'PUT') {
    if (resource !== 'notifications') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const current = await loadNotificationPrefs(vessel.org_id);
    const preferences = mergeNotificationPrefs(req.body, current);

    await writeAudit({
      org_id: vessel.org_id,
      actor: auth.userId,
      action: 'notification.preferences.updated',
      resource: vessel.id,
      metadata: { preferences },
    }, req);

    return res.json(preferences);
  }

  if (resource === 'alerts' || resource === 'devices') {
    const { data } = await supabase
      .from('vessel_snapshots')
      .select(resource)
      .eq('vessel_id', vessel.id)
      .single();
    return res.json((data as Record<string, unknown> | null)?.[resource] ?? []);
  }

  if (resource === 'snapshot') {
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

  if (resource === 'voyage') {
    const { data } = await supabase
      .from('voyage_log')
      .select('data')
      .eq('vessel_id', vessel.id)
      .order('synced_at', { ascending: false })
      .limit(200);

    return res.json((data ?? []).map((r: { data: unknown }) => r.data));
  }

  if (resource === 'quota') {
    const { count } = await supabase
      .from('vessels')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', vessel.org_id);

    const { data: primaryVessel } = await supabase
      .from('vessels')
      .select('plan')
      .eq('org_id', vessel.org_id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    const plan = normalizePlan(primaryVessel?.plan ?? null);
    return res.json({
      plan,
      currentVessels: count ?? 0,
      maxVessels: maxVesselsForPlan(plan),
    });
  }

  if (resource === 'audit') {
    const { data, error } = await supabase
      .from('audit_log')
      .select('actor, action, resource, created_at')
      .eq('org_id', vessel.org_id)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data ?? []);
  }

  if (resource === 'notifications') {
    return res.json(await loadNotificationPrefs(vessel.org_id));
  }

  if (resource === 'pen-test-report') {
    return res.json(await getLatestPenTestReport(vessel.org_id, vessel.id));
  }

  return res.status(404).json({ error: 'Unknown resource' });
}
