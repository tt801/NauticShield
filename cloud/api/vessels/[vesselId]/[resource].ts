/**
 * GET /api/vessels/:vesselId/alerts
 * GET /api/vessels/:vesselId/devices
 * GET /api/vessels/:vesselId/snapshot
 * GET /api/vessels/:vesselId/voyage
 *
 * Consolidated into a single serverless function to stay within Vercel Hobby limits.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'crypto';
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
type ReportPeriod = 'live' | 'daily' | 'weekly' | 'monthly';
type ReportCadence = 'daily' | 'weekly' | 'monthly';
type ReportSchedule = {
  id: string;
  name: string;
  recipient: string;
  period: ReportPeriod;
  cadence: ReportCadence;
  sendTime: string;
  timeZone: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  active: boolean;
  lastSentAt: string | null;
  updatedAt: string;
};
type GuestDeviceAccess = 'approved' | 'blocked' | 'pending';
type GuestSplashType = 'tos' | 'click' | 'none';
type GuestNetworkSpeedResult = {
  dl: number;
  ul: number;
  ping: number;
  testedAt: string;
};
type GuestNetworkSettings = {
  wifiEnabled: boolean;
  portalEnabled: boolean;
  ssid: string;
  wifiPass: string;
  splashType: GuestSplashType;
  accessMap: Record<string, GuestDeviceAccess>;
  bandwidthMap: Record<string, string>;
  lastSpeedTest: GuestNetworkSpeedResult | null;
  updatedAt: string;
};

const DEFAULT_GUEST_NETWORK_SETTINGS: GuestNetworkSettings = {
  wifiEnabled: true,
  portalEnabled: true,
  ssid: 'Aurora Guest',
  wifiPass: 'Yacht2026!',
  splashType: 'tos',
  accessMap: {},
  bandwidthMap: {},
  lastSpeedTest: null,
  updatedAt: '',
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

function normalizeReportSchedule(value: unknown, fallbackId?: string): ReportSchedule | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Partial<ReportSchedule>;
  const cadence = source.cadence === 'daily' || source.cadence === 'weekly' || source.cadence === 'monthly'
    ? source.cadence
    : 'weekly';
  const period = source.period === 'live' || source.period === 'daily' || source.period === 'weekly' || source.period === 'monthly'
    ? source.period
    : 'weekly';
  const sendTime = typeof source.sendTime === 'string' && /^\d{2}:\d{2}$/.test(source.sendTime)
    ? source.sendTime
    : '07:00';
  const recipient = typeof source.recipient === 'string' ? source.recipient.trim() : '';
  const name = typeof source.name === 'string' ? source.name.trim() : '';
  const id = typeof source.id === 'string' && source.id.trim() ? source.id.trim() : (fallbackId ?? randomUUID());

  if (!recipient || !name) return null;

  return {
    id,
    name,
    recipient,
    period,
    cadence,
    sendTime,
    timeZone: typeof source.timeZone === 'string' && source.timeZone.trim() ? source.timeZone : 'UTC',
    dayOfWeek: cadence === 'weekly' && typeof source.dayOfWeek === 'number' ? Math.max(0, Math.min(6, Math.round(source.dayOfWeek))) : null,
    dayOfMonth: cadence === 'monthly' && typeof source.dayOfMonth === 'number' ? Math.max(1, Math.min(28, Math.round(source.dayOfMonth))) : null,
    active: typeof source.active === 'boolean' ? source.active : true,
    lastSentAt: typeof source.lastSentAt === 'string' && source.lastSentAt.trim() ? source.lastSentAt : null,
    updatedAt: typeof source.updatedAt === 'string' && source.updatedAt.trim() ? source.updatedAt : new Date().toISOString(),
  };
}

async function loadReportSchedules(orgId: string, vesselId: string) {
  const { data } = await supabase
    .from('audit_log')
    .select('metadata')
    .eq('org_id', orgId)
    .eq('resource', vesselId)
    .eq('action', 'report.schedules.updated')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const metadata = (data?.metadata ?? null) as Record<string, unknown> | null;
  const schedules = Array.isArray(metadata?.schedules) ? metadata.schedules : [];

  return schedules
    .map((entry, index) => normalizeReportSchedule(entry, `schedule-${index + 1}`))
    .filter((entry): entry is ReportSchedule => entry !== null);
}

function normalizeGuestNetworkSettings(value: unknown): GuestNetworkSettings {
  if (!value || typeof value !== 'object') return DEFAULT_GUEST_NETWORK_SETTINGS;
  const source = value as Partial<GuestNetworkSettings>;
  return {
    wifiEnabled: typeof source.wifiEnabled === 'boolean' ? source.wifiEnabled : DEFAULT_GUEST_NETWORK_SETTINGS.wifiEnabled,
    portalEnabled: typeof source.portalEnabled === 'boolean' ? source.portalEnabled : DEFAULT_GUEST_NETWORK_SETTINGS.portalEnabled,
    ssid: typeof source.ssid === 'string' && source.ssid.trim() ? source.ssid.trim() : DEFAULT_GUEST_NETWORK_SETTINGS.ssid,
    wifiPass: typeof source.wifiPass === 'string' && source.wifiPass.trim() ? source.wifiPass : DEFAULT_GUEST_NETWORK_SETTINGS.wifiPass,
    splashType: source.splashType === 'click' || source.splashType === 'none' ? source.splashType : 'tos',
    accessMap: source.accessMap && typeof source.accessMap === 'object' ? source.accessMap : {},
    bandwidthMap: source.bandwidthMap && typeof source.bandwidthMap === 'object' ? source.bandwidthMap : {},
    lastSpeedTest: source.lastSpeedTest && typeof source.lastSpeedTest === 'object' ? source.lastSpeedTest : null,
    updatedAt: typeof source.updatedAt === 'string' && source.updatedAt ? source.updatedAt : new Date().toISOString(),
  };
}

async function loadGuestNetworkSettings(orgId: string, vesselId: string) {
  const { data } = await supabase
    .from('audit_log')
    .select('metadata')
    .eq('org_id', orgId)
    .eq('resource', vesselId)
    .eq('action', 'guest.network.updated')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const metadata = (data?.metadata ?? null) as Record<string, unknown> | null;
  return normalizeGuestNetworkSettings(metadata?.settings);
}

async function saveGuestNetworkSettings(orgId: string, vesselId: string, actor: string, settings: GuestNetworkSettings, req: VercelRequest) {
  await writeAudit({
    org_id: orgId,
    actor,
    action: 'guest.network.updated',
    resource: vesselId,
    metadata: { settings },
  }, req);
  return settings;
}

async function latestSnapshot(vesselId: string) {
  const { data } = await supabase
    .from('vessel_snapshots')
    .select('devices, internet_status')
    .eq('vessel_id', vesselId)
    .single();

  return data as { devices?: Array<{ status?: string }>; internet_status?: { downloadMbps?: number; uploadMbps?: number; latencyMs?: number } } | null;
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
    if (resource === 'guest-network-speed-test') {
      const current = await loadGuestNetworkSettings(vessel.org_id, vessel.id);
      const snapshot = await latestSnapshot(vessel.id);
      const activeDevices = (snapshot?.devices ?? []).filter(device => device?.status === 'online').length;
      const baseDownload = Math.max(4, snapshot?.internet_status?.downloadMbps ?? 35);
      const baseUpload = Math.max(2, snapshot?.internet_status?.uploadMbps ?? Math.max(8, baseDownload / 3));
      const result: GuestNetworkSpeedResult = {
        dl: Math.max(2, +(baseDownload * Math.max(0.55, 1 - activeDevices * 0.03)).toFixed(1)),
        ul: Math.max(1, +(baseUpload * Math.max(0.6, 1 - activeDevices * 0.025)).toFixed(1)),
        ping: Math.max(12, Math.round((snapshot?.internet_status?.latencyMs ?? 45) + activeDevices * 2)),
        testedAt: new Date().toISOString(),
      };

      await saveGuestNetworkSettings(vessel.org_id, vessel.id, auth.userId, {
        ...current,
        lastSpeedTest: result,
        updatedAt: new Date().toISOString(),
      }, req);

      return res.json(result);
    }

    if (resource === 'pen-test-report') {
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

    if (resource === 'voyage') {
      const { date, location, region, country, locationTo, locationToCountry, locationToRegion, eta, status, avgDownMbps, avgLatencyMs, uptimePct, provider, incidents, blocks, notes } = req.body ?? {};

      if (typeof date !== 'string' || !date.trim()) {
        return res.status(400).json({ error: 'date is required' });
      }

      const entry = {
        id: randomUUID(),
        date: date.trim(),
        location: typeof location === 'string' ? location.trim() : '',
        region: typeof region === 'string' ? region.trim() : '',
        country: typeof country === 'string' ? country.trim() : '',
        locationTo: typeof locationTo === 'string' ? locationTo.trim() : '',
        locationToCountry: typeof locationToCountry === 'string' ? locationToCountry.trim() : '',
        locationToRegion: typeof locationToRegion === 'string' ? locationToRegion.trim() : '',
        eta: typeof eta === 'string' ? eta.trim() : '',
        status: typeof status === 'string' && status.trim() ? status.trim() : 'completed',
        avgDownMbps: typeof avgDownMbps === 'number' ? avgDownMbps : 0,
        avgLatencyMs: typeof avgLatencyMs === 'number' ? avgLatencyMs : 0,
        uptimePct: typeof uptimePct === 'number' ? uptimePct : 100,
        provider: typeof provider === 'string' && provider.trim() ? provider.trim() : 'Starlink',
        incidents: typeof incidents === 'number' ? incidents : 0,
        blocks: typeof blocks === 'string' ? blocks : JSON.stringify(blocks ?? []),
        notes: typeof notes === 'string' ? notes.trim() : '',
        createdAt: new Date().toISOString(),
      };

      const { error } = await supabase.from('voyage_log').upsert({
        id: entry.id,
        vessel_id: vessel.id,
        data: entry,
        synced_at: new Date().toISOString(),
      }, { onConflict: 'id,vessel_id' });

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      await writeAudit({
        org_id: vessel.org_id,
        actor: auth.userId,
        action: 'voyage.entry.created',
        resource: vessel.id,
        metadata: { voyageId: entry.id, date: entry.date },
      }, req);

      return res.status(201).json(entry);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (req.method === 'PUT') {
    if (resource === 'notifications') {
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

    if (resource === 'report-schedules') {
      const schedules = Array.isArray(req.body?.schedules)
        ? req.body.schedules.map((entry: unknown) => normalizeReportSchedule(entry)).filter((entry: ReportSchedule | null): entry is ReportSchedule => entry !== null)
        : [];

      await writeAudit({
        org_id: vessel.org_id,
        actor: auth.userId,
        action: 'report.schedules.updated',
        resource: vessel.id,
        metadata: { schedules },
      }, req);

      return res.json(schedules);
    }

    if (resource === 'guest-network') {
      const current = await loadGuestNetworkSettings(vessel.org_id, vessel.id);
      const settings = normalizeGuestNetworkSettings({ ...current, ...(req.body ?? {}) });
      await saveGuestNetworkSettings(vessel.org_id, vessel.id, auth.userId, settings, req);
      return res.json(settings);
    }

    return res.status(405).json({ error: 'Method not allowed' });
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

  if (resource === 'report-schedules') {
    return res.json(await loadReportSchedules(vessel.org_id, vessel.id));
  }

  if (resource === 'guest-network') {
    return res.json(await loadGuestNetworkSettings(vessel.org_id, vessel.id));
  }

  if (resource === 'pen-test-report') {
    return res.json(await getLatestPenTestReport(vessel.org_id, vessel.id));
  }

  return res.status(404).json({ error: 'Unknown resource' });
}
