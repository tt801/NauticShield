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
  cadence: ReportCadence;
  sendTime: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  active: boolean;
  lastSentAt: string | null;
  updatedAt: string;
};

function normalizeReportSchedule(value: unknown): ReportSchedule | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Partial<ReportSchedule>;
  if (!source.id || !source.name || !source.recipient) return null;
  return {
    id: source.id,
    name: source.name,
    recipient: source.recipient,
    period: source.period === 'live' || source.period === 'daily' || source.period === 'monthly' ? source.period : 'weekly',
    cadence: source.cadence === 'daily' || source.cadence === 'monthly' ? source.cadence : 'weekly',
    sendTime: typeof source.sendTime === 'string' ? source.sendTime : '07:00',
    dayOfWeek: typeof source.dayOfWeek === 'number' ? source.dayOfWeek : null,
    dayOfMonth: typeof source.dayOfMonth === 'number' ? source.dayOfMonth : null,
    active: source.active !== false,
    lastSentAt: typeof source.lastSentAt === 'string' ? source.lastSentAt : null,
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : new Date().toISOString(),
  };
}

function isDue(schedule: ReportSchedule, now: Date) {
  if (!schedule.active) return false;
  const [hours, minutes] = schedule.sendTime.split(':').map(Number);
  if (now.getUTCHours() !== hours || now.getUTCMinutes() >= minutes + 15 || now.getUTCMinutes() < minutes) {
    return false;
  }

  if (schedule.lastSentAt) {
    const last = new Date(schedule.lastSentAt);
    const sameDay = last.toISOString().slice(0, 10) === now.toISOString().slice(0, 10);
    if (schedule.cadence === 'daily' && sameDay) return false;
    if (schedule.cadence === 'weekly' && sameDay) return false;
    if (schedule.cadence === 'monthly' && sameDay) return false;
  }

  if (schedule.cadence === 'weekly') return (schedule.dayOfWeek ?? 1) === now.getUTCDay();
  if (schedule.cadence === 'monthly') return (schedule.dayOfMonth ?? 1) === now.getUTCDate();
  return true;
}

function renderHtml(vesselName: string, schedule: ReportSchedule, snapshot: any, openFindings: any[]) {
  const internet = snapshot?.internet_status ?? {};
  const devices = Array.isArray(snapshot?.devices) ? snapshot.devices : [];
  const alerts = Array.isArray(snapshot?.alerts) ? snapshot.alerts : [];
  const activeAlerts = alerts.filter((alert: any) => !alert?.resolved);
  return `
    <div style="font-family:Arial,sans-serif;background:#080b10;color:#f0f4f8;padding:24px;line-height:1.6">
      <h1 style="margin:0 0 12px;font-size:22px;">${schedule.name}</h1>
      <p style="margin:0 0 16px;color:#9fb0c0;">${vesselName} · ${schedule.period.toUpperCase()} report</p>
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
      <h2 style="font-size:16px;margin:0 0 8px;">Open Security Findings</h2>
      <ul style="padding-left:20px;color:#dce8f4;">
        ${(openFindings.slice(0, 5).map((finding: any) => `<li>${finding.check_name} (${finding.status})</li>`).join('')) || '<li>No open findings.</li>'}
      </ul>
    </div>
  `;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;
  const isCronInvocation = Boolean(req.headers['x-vercel-cron']);
  if (!isCronInvocation && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.REPORTS_FROM_EMAIL;
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
      await resend.emails.send({
        from: fromEmail,
        to: schedule.recipient,
        subject: `${vessel?.name ?? vesselId} · ${schedule.name}`,
        html: renderHtml(vessel?.name ?? vesselId, schedule, snapshot, openFindings),
      });

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