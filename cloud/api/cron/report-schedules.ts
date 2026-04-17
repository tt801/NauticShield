import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';
import { supabase } from '../../lib/supabase';
import { writeAudit } from '../../lib/audit';

type ReportPeriod = 'live' | 'daily' | 'weekly' | 'monthly';
type ReportCadence = 'daily' | 'weekly' | 'monthly';
type ReportSchedule = {
  id: string;
  name: string;
  recipient: string;
  period: ReportPeriod;
  sections: Array<'overview' | 'connectivity' | 'devices' | 'zones' | 'security' | 'alerts' | 'cyber'>;
  cadence: ReportCadence;
  sendTime: string;
  timeZone: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  active: boolean;
  lastSentAt: string | null;
  updatedAt: string;
};

const DEFAULT_REPORT_SECTIONS: ReportSchedule['sections'] = ['overview', 'connectivity', 'devices', 'zones', 'security', 'alerts', 'cyber'];

function normalizeReportSections(value: unknown): ReportSchedule['sections'] {
  if (!Array.isArray(value) || value.length === 0) return DEFAULT_REPORT_SECTIONS;
  const allowed = new Set(DEFAULT_REPORT_SECTIONS);
  const normalized = value.filter((entry): entry is ReportSchedule['sections'][number] => typeof entry === 'string' && allowed.has(entry as ReportSchedule['sections'][number]));
  return normalized.length > 0 ? normalized : DEFAULT_REPORT_SECTIONS;
}

function normalizeReportSchedule(value: unknown): ReportSchedule | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Partial<ReportSchedule>;
  if (!source.id || !source.name || !source.recipient) return null;
  return {
    id: source.id,
    name: source.name,
    recipient: source.recipient,
    period: source.period === 'live' || source.period === 'daily' || source.period === 'monthly' ? source.period : 'weekly',
    sections: normalizeReportSections(source.sections),
    cadence: source.cadence === 'daily' || source.cadence === 'monthly' ? source.cadence : 'weekly',
    sendTime: typeof source.sendTime === 'string' ? source.sendTime : '07:00',
    timeZone: typeof source.timeZone === 'string' && source.timeZone.trim() ? source.timeZone : 'UTC',
    dayOfWeek: typeof source.dayOfWeek === 'number' ? source.dayOfWeek : null,
    dayOfMonth: typeof source.dayOfMonth === 'number' ? source.dayOfMonth : null,
    active: source.active !== false,
    lastSentAt: typeof source.lastSentAt === 'string' ? source.lastSentAt : null,
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : new Date().toISOString(),
  };
}

function getZonedParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

  const lookup = Object.fromEntries(formatter.formatToParts(date).map(part => [part.type, part.value]));
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    dateKey: `${lookup.year}-${lookup.month}-${lookup.day}`,
    weekday: weekdayMap[lookup.weekday] ?? 0,
    dayOfMonth: Number(lookup.day ?? '1'),
    hour: Number(lookup.hour ?? '0'),
    minute: Number(lookup.minute ?? '0'),
  };
}

function isDue(schedule: ReportSchedule, now: Date) {
  if (!schedule.active) return false;
  const zonedNow = getZonedParts(now, schedule.timeZone);
  const [hours, minutes] = schedule.sendTime.split(':').map(Number);
  if (zonedNow.hour !== hours || zonedNow.minute < minutes || zonedNow.minute >= minutes + 15) {
    return false;
  }

  if (schedule.lastSentAt) {
    const sameDay = getZonedParts(new Date(schedule.lastSentAt), schedule.timeZone).dateKey === zonedNow.dateKey;
    if (schedule.cadence === 'daily' && sameDay) return false;
    if (schedule.cadence === 'weekly' && sameDay) return false;
    if (schedule.cadence === 'monthly' && sameDay) return false;
  }

  if (schedule.cadence === 'weekly') return (schedule.dayOfWeek ?? 1) === zonedNow.weekday;
  if (schedule.cadence === 'monthly') return (schedule.dayOfMonth ?? 1) === zonedNow.dayOfMonth;
  return true;
}

function renderHtml(vesselName: string, schedule: ReportSchedule, snapshot: any, openFindings: any[]) {
  const internet = snapshot?.internet_status ?? {};
  const devices = Array.isArray(snapshot?.devices) ? snapshot.devices : [];
  const alerts = Array.isArray(snapshot?.alerts) ? snapshot.alerts : [];
  const activeAlerts = alerts.filter((alert: any) => !alert?.resolved);
  const sections = new Set(schedule.sections);
  const offlineDevices = devices.filter((device: any) => device?.status === 'offline');
  const zoneGroups = devices.reduce((acc: Record<string, { total: number; online: number; offline: number }>, device: any) => {
    const zone = typeof device?.location === 'string' && device.location.trim() ? device.location.trim() : 'Unassigned';
    if (!acc[zone]) acc[zone] = { total: 0, online: 0, offline: 0 };
    acc[zone].total += 1;
    if (device?.status === 'online') acc[zone].online += 1;
    else acc[zone].offline += 1;
    return acc;
  }, {});
  const zoneRows = Object.entries(zoneGroups as Record<string, { total: number; online: number; offline: number }>).map(([zone, counts]) => `<li>${zone}: ${counts.online}/${counts.total} online</li>`).join('');
  const findingItems = openFindings.slice(0, 5).map((finding: any) => `<li>${finding.check_name} (${finding.status})</li>`).join('');
  const alertItems = activeAlerts.slice(0, 5).map((alert: any) => `<li>${alert.title}</li>`).join('');
  return `
    <div style="font-family:Arial,sans-serif;background:#080b10;color:#f0f4f8;padding:24px;line-height:1.6">
      <h1 style="margin:0 0 12px;font-size:22px;">${schedule.name}</h1>
      <p style="margin:0 0 16px;color:#9fb0c0;">${vesselName} · ${schedule.period.toUpperCase()} report</p>
      ${sections.has('overview') ? `
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:18px;">
        <div style="background:#0d1421;border:1px solid #1a2535;border-radius:12px;padding:14px;">
          <div style="color:#6b7f92;font-size:12px;">Download</div>
          <div style="font-size:24px;font-weight:700;">${internet.downloadMbps ?? 0} Mbps</div>
        </div>
        <div style="background:#0d1421;border:1px solid #1a2535;border-radius:12px;padding:14px;">
          <div style="color:#6b7f92;font-size:12px;">Latency</div>
          <div style="font-size:24px;font-weight:700;">${internet.latencyMs ?? 0} ms</div>
        </div>
        <div style="background:#0d1421;border:1px solid #1a2535;border-radius:12px;padding:14px;">
          <div style="color:#6b7f92;font-size:12px;">Devices Online</div>
          <div style="font-size:24px;font-weight:700;">${devices.filter((device: any) => device?.status === 'online').length}</div>
        </div>
        <div style="background:#0d1421;border:1px solid #1a2535;border-radius:12px;padding:14px;">
          <div style="color:#6b7f92;font-size:12px;">Active Alerts</div>
          <div style="font-size:24px;font-weight:700;">${activeAlerts.length}</div>
        </div>
      </div>
      ` : ''}
      ${sections.has('connectivity') ? `
      <h2 style="font-size:16px;margin:0 0 8px;">Internet & Connectivity</h2>
      <ul style="padding-left:20px;color:#dce8f4;margin:0 0 16px;">
        <li>Provider: ${internet.provider ?? 'Unknown'}</li>
        <li>Download: ${internet.downloadMbps ?? 0} Mbps</li>
        <li>Upload: ${internet.uploadMbps ?? 0} Mbps</li>
        <li>Latency: ${internet.latencyMs ?? 0} ms</li>
      </ul>
      ` : ''}
      ${sections.has('devices') ? `
      <h2 style="font-size:16px;margin:0 0 8px;">Device Status</h2>
      <ul style="padding-left:20px;color:#dce8f4;margin:0 0 16px;">
        <li>${devices.filter((device: any) => device?.status === 'online').length} devices online</li>
        <li>${offlineDevices.length} devices offline</li>
        <li>${devices.filter((device: any) => device?.type === 'unknown').length} unrecognised devices</li>
      </ul>
      ` : ''}
      ${sections.has('zones') ? `
      <h2 style="font-size:16px;margin:0 0 8px;">Zone Health</h2>
      <ul style="padding-left:20px;color:#dce8f4;margin:0 0 16px;">
        ${zoneRows || '<li>No zone data available.</li>'}
      </ul>
      ` : ''}
      ${sections.has('security') ? `
      <h2 style="font-size:16px;margin:0 0 8px;">Security Posture</h2>
      <ul style="padding-left:20px;color:#dce8f4;margin:0 0 16px;">
        <li>${activeAlerts.length} active alerts</li>
        <li>${openFindings.length} open cyber findings</li>
      </ul>
      ` : ''}
      ${sections.has('alerts') ? `
      <h2 style="font-size:16px;margin:0 0 8px;">Active Alerts</h2>
      <ul style="padding-left:20px;color:#dce8f4;margin:0 0 16px;">
        ${alertItems || '<li>No active alerts.</li>'}
      </ul>
      ` : ''}
      ${sections.has('cyber') ? `
      <h2 style="font-size:16px;margin:0 0 8px;">Open Security Findings</h2>
      <ul style="padding-left:20px;color:#dce8f4;">
        ${findingItems || '<li>No open findings.</li>'}
      </ul>
      ` : ''}
    </div>
  `;
}

function getReportDeliveryConfig() {
  const resendApiKey = (process.env.RESEND_API_KEY ?? '').trim();
  const fromEmail = (process.env.REPORTS_FROM_EMAIL ?? '').trim();
  return { resendApiKey, fromEmail };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;
  const isCronInvocation = Boolean(req.headers['x-vercel-cron']);
  if (!isCronInvocation && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { resendApiKey, fromEmail } = getReportDeliveryConfig();
  console.log('[report delivery cron]', {
    hasResendApiKey: resendApiKey.length > 0,
    hasFromEmail: fromEmail.length > 0,
  });
  if (!resendApiKey || !fromEmail) {
    return res.status(200).json({ ok: true, skipped: 'RESEND_API_KEY or REPORTS_FROM_EMAIL missing' });
  }

  const resend = new Resend(resendApiKey);
  const { data: entries } = await supabase
    .from('audit_log')
    .select('org_id, resource, metadata')
    .eq('action', 'report.schedules.updated')
    .order('created_at', { ascending: false })
    .limit(2000);

  const latestPerVessel = new Map<string, { orgId: string; schedules: ReportSchedule[] }>();
  for (const entry of entries ?? []) {
    if (!entry.resource || !entry.org_id || latestPerVessel.has(entry.resource)) continue;
    const metadata = (entry.metadata ?? {}) as Record<string, unknown>;
    const schedules = Array.isArray(metadata.schedules)
      ? metadata.schedules.map(normalizeReportSchedule).filter((schedule): schedule is ReportSchedule => schedule !== null)
      : [];
    latestPerVessel.set(entry.resource, { orgId: entry.org_id, schedules });
  }

  const now = new Date();
  let sent = 0;

  for (const [vesselId, value] of latestPerVessel) {
    const dueSchedules = value.schedules.filter(schedule => isDue(schedule, now));
    if (dueSchedules.length === 0) continue;

    const [{ data: vessel }, { data: snapshot }, { data: findings }] = await Promise.all([
      supabase.from('vessels').select('name').eq('id', vesselId).single(),
      supabase.from('vessel_snapshots').select('devices, alerts, internet_status').eq('vessel_id', vesselId).single(),
      supabase.from('cyber_findings').select('data').eq('vessel_id', vesselId).order('synced_at', { ascending: false }).limit(20),
    ]);

    const openFindings = (findings ?? [])
      .map((entry: any) => entry.data)
      .filter((finding: any) => finding?.findingStatus !== 'remediated');

    for (const schedule of dueSchedules) {
      const result = await resend.emails.send({
        from: fromEmail,
        to: schedule.recipient,
        subject: `${vessel?.name ?? vesselId} · ${schedule.name}`,
        html: renderHtml(vessel?.name ?? vesselId, schedule, snapshot, openFindings),
      });

      if (result.error) {
        throw new Error(result.error.message || `Failed to send scheduled report ${schedule.id}`);
      }

      schedule.lastSentAt = now.toISOString();
      schedule.updatedAt = now.toISOString();
      sent += 1;

      await writeAudit({
        org_id: value.orgId,
        actor: 'system',
        action: 'report.schedule.sent',
        resource: vesselId,
        metadata: { scheduleId: schedule.id, recipient: schedule.recipient },
      }, req);
    }

    await writeAudit({
      org_id: value.orgId,
      actor: 'system',
      action: 'report.schedules.updated',
      resource: vesselId,
      metadata: { schedules: value.schedules },
    }, req);
  }

  return res.status(200).json({ ok: true, sent });
}