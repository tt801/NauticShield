import { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Wifi,
  MonitorSmartphone,
  Printer,
  Activity,
  Shield,
  MapPin,
  Calendar,
  Mail,
  TrendingUp,
  Cpu,
  FileText,
  Pencil,
  Trash2,
  Play,
  Plus,
  X,
} from 'lucide-react';
import { useVesselData } from '@/context/VesselDataProvider';
import { agentApi } from '@/api/client';
import type { CyberAssessment, CyberFinding, ReportCadence, ReportPeriod, ReportSchedule, ReportSection } from '@/api/client';

// ── Helpers ───────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: '#0d1421', border: '1px solid #1a2535', borderRadius: 14, padding: 24, ...style }}>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color: '#4a5a6a', fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14, borderBottom: '1px solid #1a2535', paddingBottom: 8 }}>
      {children}
    </div>
  );
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PERIOD_LABELS: Record<ReportPeriod, string> = {
  live: 'Live Snapshot',
  daily: '24-Hour Summary',
  weekly: 'Weekly Overview',
  monthly: 'Monthly Report',
};
const CADENCE_LABELS: Record<ReportCadence, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};
const REPORT_SECTION_OPTIONS: Array<{ id: ReportSection; label: string }> = [
  { id: 'overview', label: 'Overview & summary' },
  { id: 'connectivity', label: 'Internet & connectivity' },
  { id: 'devices', label: 'Device status' },
  { id: 'zones', label: 'Zone health' },
  { id: 'security', label: 'Security posture' },
  { id: 'alerts', label: 'Active & resolved alerts' },
  { id: 'cyber', label: 'Cyber findings' },
];
const DEFAULT_REPORT_SECTIONS = REPORT_SECTION_OPTIONS.map(option => option.id);

function normalizeSections(sections?: ReportSection[] | null) {
  if (!Array.isArray(sections) || sections.length === 0) {
    return DEFAULT_REPORT_SECTIONS;
  }

  const allowed = new Set<ReportSection>(DEFAULT_REPORT_SECTIONS);
  const normalized = sections.filter((section): section is ReportSection => allowed.has(section));
  return normalized.length > 0 ? normalized : DEFAULT_REPORT_SECTIONS;
}

function formatSectionSummary(sections?: ReportSection[] | null) {
  const normalized = normalizeSections(sections);
  if (normalized.length === DEFAULT_REPORT_SECTIONS.length) return 'All sections';
  return normalized.map(section => REPORT_SECTION_OPTIONS.find(option => option.id === section)?.label ?? section).join(', ');
}

type ScheduleDraft = {
  id: string;
  name: string;
  recipient: string;
  period: ReportPeriod;
  sections: ReportSection[];
  cadence: ReportCadence;
  sendTime: string;
  timeZone: string;
  dayOfWeek: number;
  dayOfMonth: number;
  active: boolean;
  lastSentAt: string | null;
};

const DEFAULT_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const TIME_ZONES = typeof Intl.supportedValuesOf === 'function'
  ? Intl.supportedValuesOf('timeZone')
  : ['UTC', DEFAULT_TIME_ZONE];

function createScheduleDraft(schedule?: ReportSchedule): ScheduleDraft {
  return {
    id: schedule?.id ?? crypto.randomUUID(),
    name: schedule?.name ?? '',
    recipient: schedule?.recipient ?? '',
    period: schedule?.period ?? 'weekly',
    sections: normalizeSections(schedule?.sections),
    cadence: schedule?.cadence ?? 'weekly',
    sendTime: schedule?.sendTime ?? '07:00',
    timeZone: schedule?.timeZone ?? DEFAULT_TIME_ZONE,
    dayOfWeek: schedule?.dayOfWeek ?? 1,
    dayOfMonth: schedule?.dayOfMonth ?? 1,
    active: schedule?.active ?? true,
    lastSentAt: schedule?.lastSentAt ?? null,
  };
}

function toSchedule(draft: ScheduleDraft): ReportSchedule {
  return {
    id: draft.id,
    name: draft.name.trim(),
    recipient: draft.recipient.trim(),
    period: draft.period,
    sections: normalizeSections(draft.sections),
    cadence: draft.cadence,
    sendTime: draft.sendTime,
    timeZone: draft.timeZone,
    dayOfWeek: draft.cadence === 'weekly' ? draft.dayOfWeek : null,
    dayOfMonth: draft.cadence === 'monthly' ? draft.dayOfMonth : null,
    active: draft.active,
    lastSentAt: draft.lastSentAt,
    updatedAt: new Date().toISOString(),
  };
}

function formatScheduleFrequency(schedule: ReportSchedule) {
  if (schedule.cadence === 'daily') return `Daily at ${schedule.sendTime} (${schedule.timeZone})`;
  if (schedule.cadence === 'weekly') return `${WEEKDAYS[schedule.dayOfWeek ?? 1]} at ${schedule.sendTime} (${schedule.timeZone})`;
  return `Day ${schedule.dayOfMonth ?? 1} at ${schedule.sendTime} (${schedule.timeZone})`;
}

function formatLastSent(value: string | null) {
  if (!value) return 'Never sent';
  return new Date(value).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function scheduleErrorHint(error: string) {
  if (/No cloud vessel is registered/i.test(error)) {
    return 'Scheduled reports are cloud-delivered. Open Settings > Cloud Sync, register this vessel, then return here and save again.';
  }
  return '';
}

function ScheduleEditor({
  draft,
  saving,
  error,
  onChange,
  onClose,
  onSave,
}: {
  draft: ScheduleDraft;
  saving: boolean;
  error: string;
  onChange: (patch: Partial<ScheduleDraft>) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const inputStyle: React.CSSProperties = {
    background: '#080b10', color: '#f0f4f8', border: '1px solid #1a2535',
    borderRadius: 8, padding: '8px 12px', fontSize: 13, width: '100%', outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = { color: '#6b7f92', fontSize: 11, fontWeight: 600, marginBottom: 5 };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div style={{ background: '#0d1421', border: '1px solid #1a2535', borderRadius: 16, padding: 28, width: 520, maxWidth: '95vw', maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ color: '#f0f4f8', fontSize: 16, fontWeight: 700 }}>{draft.name ? 'Edit Schedule' : 'Add Schedule'}</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#6b7f92', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={labelStyle}>Schedule Name</div>
            <input value={draft.name} onChange={event => onChange({ name: event.target.value })} placeholder="e.g. Weekly Owner Brief" style={inputStyle} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={labelStyle}>Recipient Email</div>
            <input value={draft.recipient} onChange={event => onChange({ recipient: event.target.value })} placeholder="owner@example.com" style={inputStyle} />
          </div>
          <div>
            <div style={labelStyle}>Report Type</div>
            <select value={draft.period} onChange={event => onChange({ period: event.target.value as ReportPeriod })} style={inputStyle}>
              {Object.entries(PERIOD_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={labelStyle}>Included Sections</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
              {REPORT_SECTION_OPTIONS.map(option => {
                const checked = draft.sections.includes(option.id);
                return (
                  <label key={option.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#080b10', border: '1px solid #1a2535', borderRadius: 8, padding: '8px 10px', color: '#dce8f4', fontSize: 12, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={event => {
                        const next = event.target.checked
                          ? [...draft.sections, option.id]
                          : draft.sections.filter(section => section !== option.id);
                        onChange({ sections: normalizeSections(next) });
                      }}
                    />
                    <span>{option.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div>
            <div style={labelStyle}>Cadence</div>
            <select value={draft.cadence} onChange={event => onChange({ cadence: event.target.value as ReportCadence })} style={inputStyle}>
              {Object.entries(CADENCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div>
            <div style={labelStyle}>Send Time</div>
            <input type="time" value={draft.sendTime} onChange={event => onChange({ sendTime: event.target.value })} style={inputStyle} />
          </div>
          <div>
            <div style={labelStyle}>Time Zone</div>
            <select value={draft.timeZone} onChange={event => onChange({ timeZone: event.target.value })} style={inputStyle}>
              {TIME_ZONES.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          {draft.cadence === 'weekly' && (
            <div>
              <div style={labelStyle}>Day of Week</div>
              <select value={draft.dayOfWeek} onChange={event => onChange({ dayOfWeek: Number(event.target.value) })} style={inputStyle}>
                {WEEKDAYS.map((label, index) => <option key={label} value={index}>{label}</option>)}
              </select>
            </div>
          )}
          {draft.cadence === 'monthly' && (
            <div>
              <div style={labelStyle}>Day of Month</div>
              <input type="number" min={1} max={28} value={draft.dayOfMonth} onChange={event => onChange({ dayOfMonth: Number(event.target.value) })} style={inputStyle} />
            </div>
          )}
          <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
            <input id="schedule-active" type="checkbox" checked={draft.active} onChange={event => onChange({ active: event.target.checked })} />
            <label htmlFor="schedule-active" style={{ color: '#dce8f4', fontSize: 13 }}>Active schedule</label>
          </div>
        </div>

        {error ? <div style={{ marginTop: 14, color: '#fca5a5', fontSize: 12 }}>{error}</div> : null}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #1a2535', color: '#6b7f92', borderRadius: 9, padding: '9px 18px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={onSave} disabled={saving} style={{ background: 'rgba(212,168,71,0.16)', border: '1px solid rgba(212,168,71,0.35)', color: '#d4a847', borderRadius: 9, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: saving ? 'default' : 'pointer' }}>{saving ? 'Saving…' : 'Save Schedule'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Score ring ────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const r = 58, cx = 66, cy = 66;
  const circumference = 2 * Math.PI * r;
  const color  = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';
  const label  = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : 'Needs Attention';
  const offset = circumference * (1 - score / 100);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <svg width={132} height={132} viewBox="0 0 132 132">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1a2535"         strokeWidth="9" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="9"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`}
          style={{ filter: `drop-shadow(0 0 8px ${color})` }}
        />
        <text x={cx} y={cy - 8}  textAnchor="middle" fill={color}    fontSize="28" fontWeight="800">{score}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill="#6b7f92"  fontSize="11">/ 100</text>
      </svg>
      <div>
        <div style={{ color, fontSize: 22, fontWeight: 800, marginBottom: 4 }}>{label}</div>
        <div style={{ color: '#8899aa', fontSize: 13, lineHeight: 1.5, maxWidth: 280 }}>
          {score >= 80
            ? 'All critical systems are performing well. Minor items are being monitored.'
            : score >= 60
            ? 'Most systems are operational. Some issues require attention from the crew.'
            : 'Several systems need immediate attention. Please review the items below.'}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────

export default function Report() {
  const { alerts, devices, internetStatus, networkHealth } = useVesselData();
  const [period, setPeriod] = useState<'live' | 'daily' | 'weekly' | 'monthly'>('live');

  // ── Cyber DB data ─────────────────────────────────────────────
  const [latestAssessment, setLatestAssessment] = useState<CyberAssessment | null>(null);
  const [openFindings,     setOpenFindings]     = useState<CyberFinding[]>([]);
  const [schedules,        setSchedules]        = useState<ReportSchedule[]>([]);
  const [scheduleLoading,  setScheduleLoading]  = useState(true);
  const [scheduleSaving,   setScheduleSaving]   = useState(false);
  const [scheduleError,    setScheduleError]    = useState('');
  const [scheduleNotice,   setScheduleNotice]   = useState('');
  const [sendingScheduleId,setSendingScheduleId]= useState<string | null>(null);
  const [hoveredScheduleId,setHoveredScheduleId]= useState<string | null>(null);
  const [pressedScheduleId,setPressedScheduleId]= useState<string | null>(null);
  const [editorOpen,       setEditorOpen]       = useState(false);
  const [draft,            setDraft]            = useState<ScheduleDraft>(createScheduleDraft());

  useEffect(() => {
    agentApi.cyber.listAssessments().then(list => {
      if (list.length > 0) setLatestAssessment(list[0]);
    }).catch(() => {});
    agentApi.cyber.listFindings().then(list => {
      setOpenFindings(list.filter(f => f.findingStatus !== 'remediated'));
    }).catch(() => {});
    agentApi.reports.listSchedules().then(list => {
      setSchedules(list);
    }).catch(() => {
      setScheduleError('Report schedules could not be loaded.');
    }).finally(() => {
      setScheduleLoading(false);
    });
  }, []);

  const now     = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  const periodLabel: Record<typeof period, string> = {
    live:    `Live Snapshot · ${dateStr} at ${timeStr}`,
    daily:   `24-Hour Summary · ${dateStr}`,
    weekly:  `Weekly Overview · w/e ${dateStr}`,
    monthly: `Monthly Report · April 2026`,
  };

  const activeAlerts   = alerts.filter(a => !a.resolved);
  const resolvedAlerts = alerts.filter(a => a.resolved);
  const criticalCount  = activeAlerts.filter(a => a.severity === 'critical').length;
  const warningCount   = activeAlerts.filter(a => a.severity === 'warning').length;
  const offlineDevices = devices.filter(d => d.status === 'offline');
  const unknownDevices = devices.filter(d => d.type === 'unknown');
  const onlineDevices  = devices.filter(d => d.status === 'online');

  // Zone health — group devices by location
  const zoneGroups = devices.reduce<Record<string, { online: number; offline: number; total: number }>>((acc, d) => {
    const loc = d.location || 'Unassigned';
    if (!acc[loc]) acc[loc] = { online: 0, offline: 0, total: 0 };
    acc[loc].total++;
    if (d.status === 'online') acc[loc].online++;
    else acc[loc].offline++;
    return acc;
  }, {});
  const zoneEntries = Object.entries(zoneGroups).sort(([a], [b]) =>
    a === 'Unassigned' ? 1 : b === 'Unassigned' ? -1 : a.localeCompare(b)
  );

  // Security posture
  const secScore = Math.max(0, Math.min(100, 100 - criticalCount * 20 - warningCount * 5));
  const secLabel = secScore >= 80 ? 'Secure' : secScore >= 60 ? 'At Risk' : 'Critical';
  const secColor = secScore >= 80 ? '#22c55e' : secScore >= 60 ? '#f59e0b' : '#ef4444';

  const summaryText = (() => {
    const parts: string[] = [];
    if (criticalCount > 0) parts.push(`${criticalCount} critical issue${criticalCount > 1 ? 's' : ''} require immediate action`);
    if (warningCount  > 0) parts.push(`${warningCount} warning${warningCount > 1 ? 's' : ''} noted`);
    if (offlineDevices.length > 0) parts.push(`${offlineDevices.length} device${offlineDevices.length > 1 ? 's' : ''} offline`);
    if (unknownDevices.length > 0) parts.push(`${unknownDevices.length} unrecognised device${unknownDevices.length > 1 ? 's' : ''} on the network`);
    if (parts.length === 0) return 'All monitored systems are operating normally. No issues detected.';
    return parts.join(', ') + '. ' + (criticalCount > 0 ? 'Immediate crew action is recommended.' : 'Crew awareness is advised.');
  })();

  async function persistSchedules(next: ReportSchedule[]) {
    setScheduleSaving(true);
    setScheduleError('');
    setScheduleNotice('');
    try {
      const saved = await agentApi.reports.saveSchedules(next);
      setSchedules(saved);
      setEditorOpen(false);
    } catch (error) {
      setScheduleError(error instanceof Error ? error.message : 'Report schedules could not be saved.');
      throw error;
    } finally {
      setScheduleSaving(false);
    }
  }

  function openNewSchedule() {
    setScheduleError('');
    setScheduleNotice('');
    setDraft(createScheduleDraft());
    setEditorOpen(true);
  }

  function openEditSchedule(schedule: ReportSchedule) {
    setScheduleError('');
    setScheduleNotice('');
    setDraft(createScheduleDraft(schedule));
    setEditorOpen(true);
  }

  async function saveDraft() {
    const next = toSchedule(draft);
    if (!next.name || !next.recipient) {
      setScheduleError('Schedule name and recipient email are required.');
      return;
    }

    const updated = schedules.some(schedule => schedule.id === next.id)
      ? schedules.map(schedule => schedule.id === next.id ? next : schedule)
      : [next, ...schedules];

    await persistSchedules(updated);
  }

  async function deleteSchedule(id: string) {
    await persistSchedules(schedules.filter(schedule => schedule.id !== id));
  }

  async function toggleSchedule(id: string) {
    await persistSchedules(schedules.map(schedule => schedule.id === id ? { ...schedule, active: !schedule.active, updatedAt: new Date().toISOString() } : schedule));
  }

  // ── Print / Export ────────────────────────────────────────────

  function generateReport(targetPeriod: ReportPeriod = period) {
    const periodTitle: Record<ReportPeriod, string> = {
      live:    `Live Snapshot — ${dateStr} at ${timeStr}`,
      daily:   `24-Hour Summary — ${dateStr}`,
      weekly:  `Weekly Overview — week ending ${dateStr}`,
      monthly: `Monthly Report — April 2026`,
    };

    const statusEmoji = (s: string) => s === 'online' ? '●' : '○';
    const sevColor    = (s: string) => s === 'critical' ? '#c0392b' : s === 'warning' ? '#d35400' : '#2980b9';

    const deviceRows = devices.map(d => `
      <tr>
        <td>${d.name}</td>
        <td style="font-family:monospace">${d.ip}</td>
        <td>${d.type}</td>
        <td>${d.location || 'Unassigned'}</td>
        <td style="color:${d.status === 'online' ? '#27ae60' : '#c0392b'};font-weight:700">${statusEmoji(d.status)} ${d.status}</td>
        <td>${d.lastSeen}</td>
      </tr>`).join('');

    const activeAlertRows = activeAlerts.length === 0
      ? '<tr><td colspan="3" style="color:#888;text-align:center">No active alerts</td></tr>'
      : activeAlerts.map(a => `
        <tr>
          <td style="color:${sevColor(a.severity)};font-weight:700;text-transform:uppercase">${a.severity}</td>
          <td style="font-weight:600">${a.title}</td>
          <td style="color:#555">${a.description}</td>
        </tr>`).join('');

    const resolvedRows = resolvedAlerts.length === 0
      ? '<tr><td colspan="2" style="color:#888;text-align:center">None resolved in this period</td></tr>'
      : resolvedAlerts.map(a => `
        <tr>
          <td>${a.title}</td>
          <td>${new Date(a.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</td>
        </tr>`).join('');

    const zoneRows = zoneEntries.map(([zone, { online, offline, total }]) => {
      const pct   = total > 0 ? Math.round((online / total) * 100) : 0;
      const color = offline === 0 ? '#27ae60' : offline === total ? '#c0392b' : '#d35400';
      return `
        <tr>
          <td style="font-weight:600">${zone}</td>
          <td>${total}</td>
          <td style="color:#27ae60;font-weight:700">${online}</td>
          <td style="color:${offline > 0 ? '#c0392b' : '#888'};font-weight:${offline > 0 ? 700 : 400}">${offline}</td>
          <td>
            <div style="background:#e0e0e0;border-radius:4px;height:8px;width:120px;overflow:hidden">
              <div style="background:${color};height:100%;width:${pct}%;border-radius:4px"></div>
            </div>
            <span style="font-size:11px;color:${color}">${pct}%</span>
          </td>
        </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>NauticShield Vessel Report — ${dateStr}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      font-size: 13px;
      color: #1a1a2e;
      background: #fff;
      padding: 0;
    }
    .page { max-width: 900px; margin: 0 auto; padding: 40px 48px 60px; }

    /* Header */
    .report-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 24px;
      border-bottom: 3px solid #1a1a2e;
      margin-bottom: 32px;
    }
    .report-title { font-size: 28px; font-weight: 800; color: #1a1a2e; letter-spacing: -0.5px; }
    .report-vessel { font-size: 16px; font-weight: 600; color: #2c3e50; margin-top: 4px; }
    .report-date { font-size: 12px; color: #7f8c8d; margin-top: 4px; }
    .report-logo { font-size: 11px; color: #95a5a6; text-align: right; }
    .report-logo strong { display: block; font-size: 15px; color: #1a1a2e; font-weight: 800; }
    .period-badge {
      display: inline-block;
      background: #f5f0e0;
      border: 1px solid #c9a227;
      color: #8a6a00;
      border-radius: 4px;
      padding: 3px 10px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
      margin-top: 8px;
    }

    /* Section */
    .section { margin-bottom: 32px; }
    .section-title {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: #7f8c8d;
      border-bottom: 1px solid #e0e0e0;
      padding-bottom: 6px;
      margin-bottom: 16px;
    }

    /* KPI grid */
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 0; }
    .kpi-card {
      border: 1px solid #e8e8e8;
      border-radius: 8px;
      padding: 14px 16px;
      background: #fafafa;
    }
    .kpi-label { font-size: 11px; color: #7f8c8d; margin-bottom: 4px; }
    .kpi-value { font-size: 26px; font-weight: 800; line-height: 1; }
    .kpi-sub { font-size: 11px; color: #aaa; margin-top: 3px; }

    /* Score */
    .health-row { display: flex; align-items: center; gap: 24px; }
    .score-circle {
      width: 100px; height: 100px; border-radius: 50%; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center; flex-direction: column;
      border: 8px solid;
    }
    .score-number { font-size: 28px; font-weight: 800; line-height: 1; }
    .score-denom { font-size: 11px; color: #999; }
    .score-label { font-size: 20px; font-weight: 800; margin-bottom: 4px; }
    .score-desc { font-size: 12px; color: #555; line-height: 1.5; max-width: 340px; }

    /* Summary */
    .summary-box {
      border-left: 4px solid;
      background: #fafafa;
      border-radius: 0 8px 8px 0;
      padding: 16px 20px;
      font-size: 14px;
      line-height: 1.8;
      color: #2c3e50;
    }
    .pill {
      display: inline-block;
      border-radius: 20px;
      padding: 3px 10px;
      font-size: 11px;
      font-weight: 600;
      margin: 6px 4px 0 0;
    }

    /* Tables */
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th {
      background: #f5f5f5;
      font-weight: 700;
      font-size: 10px;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      color: #7f8c8d;
      padding: 8px 10px;
      text-align: left;
      border-bottom: 2px solid #e0e0e0;
    }
    td { padding: 8px 10px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    tr:nth-child(even) td { background: #fafafa; }

    /* Connectivity grid */
    .conn-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
    .conn-item { border: 1px solid #e8e8e8; border-radius: 8px; padding: 12px 16px; background: #fafafa; }
    .conn-item-label { font-size: 11px; color: #7f8c8d; margin-bottom: 2px; }
    .conn-item-value { font-size: 18px; font-weight: 700; }
    .conn-item-sub { font-size: 11px; color: #aaa; margin-top: 2px; }

    /* Security posture */
    .sec-row { display: flex; align-items: center; gap: 20px; }
    .sec-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; flex: 1; }
    .sec-item { border: 1px solid #e8e8e8; border-radius: 8px; padding: 10px 14px; background: #fafafa; }
    .sec-item-label { font-size: 11px; color: #7f8c8d; }
    .sec-item-value { font-size: 22px; font-weight: 800; line-height: 1.2; }

    /* Alert items */
    .alert-item {
      display: flex;
      gap: 12px;
      border-radius: 6px;
      padding: 10px 14px;
      margin-bottom: 6px;
      border-left: 4px solid;
    }

    /* Footer */
    .report-footer {
      margin-top: 48px;
      padding-top: 16px;
      border-top: 1px solid #e0e0e0;
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: #aaa;
    }
    .confidential {
      background: #fff8e1;
      border: 1px solid #f5c518;
      border-radius: 4px;
      padding: 8px 14px;
      font-size: 11px;
      color: #7a5c00;
      margin-bottom: 28px;
      font-style: italic;
    }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { padding: 20px 28px 40px; }
      .section { page-break-inside: avoid; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="report-header">
    <div>
      <div class="report-title">Vessel Technology Report</div>
      <div class="report-vessel">M/Y Aurora</div>
      <div class="report-date">Generated: ${dateStr} at ${timeStr}</div>
      <div class="period-badge">${periodTitle[targetPeriod]}</div>
    </div>
    <div class="report-logo">
      <strong>NauticShield</strong>
      Vessel Technology Management<br>
      Confidential — Owner / Captain Use Only
    </div>
  </div>

  <div class="confidential">
    This report is confidential and intended solely for the use of the vessel owner, captain, or designated management representatives.
  </div>

  <!-- KPI Strip -->
  <div class="section">
    <div class="section-title">At a Glance</div>
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Devices Online</div>
        <div class="kpi-value" style="color:${onlineDevices.length === devices.length ? '#27ae60' : '#d35400'}">${onlineDevices.length} / ${devices.length}</div>
        <div class="kpi-sub">across all zones</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Critical Alerts</div>
        <div class="kpi-value" style="color:${criticalCount > 0 ? '#c0392b' : '#27ae60'}">${criticalCount}</div>
        <div class="kpi-sub">${criticalCount > 0 ? 'require action' : 'all clear'}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Network Health</div>
        <div class="kpi-value" style="color:${networkHealth.score >= 80 ? '#27ae60' : networkHealth.score >= 60 ? '#d35400' : '#c0392b'}">${networkHealth.score}<span style="font-size:14px;font-weight:400;color:#999"> / 100</span></div>
        <div class="kpi-sub">overall score</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Internet Uptime</div>
        <div class="kpi-value" style="color:#2980b9">${internetStatus.uptime}</div>
        <div class="kpi-sub">this period</div>
      </div>
    </div>
  </div>

  <!-- Overall Health -->
  <div class="section">
    <div class="section-title">Overall System Health</div>
    <div class="health-row">
      <div class="score-circle" style="border-color:${networkHealth.score >= 80 ? '#27ae60' : networkHealth.score >= 60 ? '#d35400' : '#c0392b'}">
        <div class="score-number" style="color:${networkHealth.score >= 80 ? '#27ae60' : networkHealth.score >= 60 ? '#d35400' : '#c0392b'}">${networkHealth.score}</div>
        <div class="score-denom">/ 100</div>
      </div>
      <div>
        <div class="score-label" style="color:${networkHealth.score >= 80 ? '#27ae60' : networkHealth.score >= 60 ? '#d35400' : '#c0392b'}">
          ${networkHealth.score >= 80 ? 'Excellent' : networkHealth.score >= 60 ? 'Good' : 'Needs Attention'}
        </div>
        <div class="score-desc">
          ${networkHealth.score >= 80
            ? 'All critical systems are performing well. Minor items are being monitored.'
            : networkHealth.score >= 60
            ? 'Most systems are operational. Some issues require crew attention.'
            : 'Several systems need immediate attention. Please review active alerts.'}
        </div>
        <div style="margin-top:10px">
          <span class="pill" style="background:#e8f8ee;border:1px solid #27ae6055;color:#1e8449">${resolvedAlerts.length} issues resolved</span>
          <span class="pill" style="background:#e8f4fd;border:1px solid #2980b955;color:#1a5276">${internetStatus.uptime} internet uptime</span>
          <span class="pill" style="background:#f5eef8;border:1px solid #8e44ad55;color:#6c3483">${onlineDevices.length}/${devices.length} devices online</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Executive Summary -->
  <div class="section">
    <div class="section-title">Executive Summary</div>
    <div class="summary-box" style="border-color:${criticalCount > 0 ? '#c0392b' : warningCount > 0 ? '#d35400' : '#27ae60'}">
      ${summaryText}
    </div>
  </div>

  <!-- Internet & Connectivity -->
  <div class="section">
    <div class="section-title">Internet &amp; Connectivity</div>
    <div class="conn-grid">
      <div class="conn-item">
        <div class="conn-item-label">Connection Status</div>
        <div class="conn-item-value" style="color:#27ae60">Online</div>
        <div class="conn-item-sub">via ${internetStatus.provider}</div>
      </div>
      <div class="conn-item">
        <div class="conn-item-label">Download Speed</div>
        <div class="conn-item-value" style="color:#2980b9">${internetStatus.downloadMbps} Mbps</div>
        <div class="conn-item-sub">current speed</div>
      </div>
      <div class="conn-item">
        <div class="conn-item-label">Latency</div>
        <div class="conn-item-value" style="color:${internetStatus.latencyMs < 50 ? '#27ae60' : '#d35400'}">${internetStatus.latencyMs} ms</div>
        <div class="conn-item-sub">average response time</div>
      </div>
      <div class="conn-item">
        <div class="conn-item-label">Uptime This Period</div>
        <div class="conn-item-value" style="color:#d35400">${internetStatus.uptime}</div>
        <div class="conn-item-sub">last 24 hours</div>
      </div>
    </div>
  </div>

  <!-- Device Inventory -->
  <div class="section">
    <div class="section-title">Full Device Inventory (${devices.length} devices)</div>
    <table>
      <thead>
        <tr>
          <th>Device Name</th>
          <th>IP Address</th>
          <th>Type</th>
          <th>Zone / Location</th>
          <th>Status</th>
          <th>Last Seen</th>
        </tr>
      </thead>
      <tbody>${deviceRows}</tbody>
    </table>
  </div>

  <!-- Zone Health -->
  <div class="section">
    <div class="section-title">Zone Health Summary</div>
    <table>
      <thead>
        <tr>
          <th>Zone</th>
          <th>Total Devices</th>
          <th>Online</th>
          <th>Offline</th>
          <th>Health</th>
        </tr>
      </thead>
      <tbody>${zoneRows || '<tr><td colspan="5" style="color:#888;text-align:center">No zone data available</td></tr>'}</tbody>
    </table>
  </div>

  <!-- Security Posture -->
  <div class="section">
    <div class="section-title">Security Posture</div>
    <div class="sec-row">
      <div style="flex-shrink:0">
        <div class="score-circle" style="border-color:${secColor};width:80px;height:80px">
          <div class="score-number" style="color:${secColor};font-size:22px">${secScore}</div>
          <div class="score-denom">/ 100</div>
        </div>
        <div style="text-align:center;font-weight:800;color:${secColor};margin-top:6px;font-size:13px">${secLabel}</div>
      </div>
      <div class="sec-grid">
        <div class="sec-item">
          <div class="sec-item-label">Active Threats</div>
          <div class="sec-item-value" style="color:${criticalCount > 0 ? '#c0392b' : '#27ae60'}">${criticalCount}</div>
        </div>
        <div class="sec-item">
          <div class="sec-item-label">Open Warnings</div>
          <div class="sec-item-value" style="color:${warningCount > 0 ? '#d35400' : '#27ae60'}">${warningCount}</div>
        </div>
        <div class="sec-item">
          <div class="sec-item-label">Unknown Devices</div>
          <div class="sec-item-value" style="color:${unknownDevices.length > 0 ? '#d35400' : '#27ae60'}">${unknownDevices.length}</div>
        </div>
        <div class="sec-item">
          <div class="sec-item-label">Offline Devices</div>
          <div class="sec-item-value" style="color:${offlineDevices.length > 0 ? '#c0392b' : '#27ae60'}">${offlineDevices.length}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Active Alerts -->
  <div class="section">
    <div class="section-title">Active Alerts (${activeAlerts.length})</div>
    <table>
      <thead>
        <tr><th>Severity</th><th>Alert</th><th>Description</th></tr>
      </thead>
      <tbody>${activeAlertRows}</tbody>
    </table>
  </div>

  <!-- Resolved Today -->
  <div class="section">
    <div class="section-title">Resolved Alerts (${resolvedAlerts.length})</div>
    <table>
      <thead>
        <tr><th>Alert</th><th>Resolved At</th></tr>
      </thead>
      <tbody>${resolvedRows}</tbody>
    </table>
  </div>

  <!-- Footer -->
  <div class="report-footer">
    <span>NauticShield · Vessel Technology Management · M/Y Aurora</span>
    <span>Generated ${dateStr} at ${timeStr} · Confidential</span>
  </div>

</div>
<script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=960,height=700');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  }

  // ── PDF Download ─────────────────────────────────────────────

  function downloadPDF(targetPeriod: ReportPeriod = period) {
    const periodTitle: Record<ReportPeriod, string> = {
      live:    `Live Snapshot — ${dateStr} at ${timeStr}`,
      daily:   `24-Hour Summary — ${dateStr}`,
      weekly:  `Weekly Overview — week ending ${dateStr}`,
      monthly: `Monthly Report — April 2026`,
    };

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = 210, M = 16, CW = W - M * 2;
    let y = M;

    const chk = (n: number) => { if (y + n > 272) { doc.addPage(); y = M; } };
    const sc3 = (c: readonly [number,number,number]) => { doc.setTextColor(c[0],c[1],c[2]); };
    const fc3 = (c: readonly [number,number,number]) => { doc.setFillColor(c[0],c[1],c[2]); };
    const scoreRGB = (s: number): readonly [number,number,number] =>
      s >= 80 ? [39,174,96] : s >= 60 ? [211,84,0] : [192,57,43];
    const sevRGB = (s: string): readonly [number,number,number] =>
      s === 'critical' ? [192,57,43] : s === 'warning' ? [211,84,0] : [41,128,185];
    const DARK: readonly [number,number,number]  = [26, 32, 46];
    const LGRAY: readonly [number,number,number] = [248, 249, 250];
    const HEADER: readonly [number,number,number] = [15, 23, 42];

    const sectionHeading = (title: string) => {
      chk(12);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(120, 130, 145);
      doc.text(title.toUpperCase(), M, y);
      doc.setDrawColor(210, 215, 220);
      doc.setLineWidth(0.25);
      const tw = doc.getTextWidth(title.toUpperCase());
      doc.line(M + tw + 3, y - 0.5, W - M, y - 0.5);
      y += 6;
    };

    // ── Cover band ──
    fc3(HEADER);
    doc.rect(0, 0, 210, 30, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.setTextColor(255, 255, 255);
    doc.text('Vessel Technology Report', M, 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(190, 205, 220);
    doc.text('M/Y Aurora  ·  NauticShield', M, 19);
    doc.text(periodTitle[targetPeriod], M, 25);
    doc.setFontSize(8.5);
    doc.setTextColor(140, 155, 170);
    doc.text(`Generated: ${dateStr} at ${timeStr}`, W - M, 17, { align: 'right' });
    doc.text('Confidential — Owner / Captain Use Only', W - M, 23, { align: 'right' });
    y = 38;

    // ── KPI strip ──
    sectionHeading('At a Glance');
    const kpiW = (CW - 9) / 4;
    const kpis: { label: string; value: string; color: readonly [number,number,number] }[] = [
      { label: 'Devices Online',  value: `${onlineDevices.length}/${devices.length}`, color: onlineDevices.length === devices.length ? [39,174,96] : [211,84,0] },
      { label: 'Critical Alerts', value: String(criticalCount),    color: criticalCount > 0 ? [192,57,43] : [39,174,96] },
      { label: 'Network Health',  value: `${networkHealth.score}/100`, color: scoreRGB(networkHealth.score) },
      { label: 'Internet Uptime', value: internetStatus.uptime,    color: [41,128,185] },
    ];
    kpis.forEach((k, i) => {
      const x = M + i * (kpiW + 3);
      fc3(LGRAY);
      doc.setDrawColor(215, 220, 225);
      doc.setLineWidth(0.25);
      doc.roundedRect(x, y, kpiW, 18, 2, 2, 'FD');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(120, 130, 145);
      doc.text(k.label, x + 3, y + 5.5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      sc3(k.color);
      doc.text(k.value, x + 3, y + 13.5);
    });
    y += 24;

    // ── Overall health ──
    sectionHeading('Overall System Health');
    const hColor = scoreRGB(networkHealth.score);
    const hLabel = networkHealth.score >= 80 ? 'Excellent' : networkHealth.score >= 60 ? 'Good' : 'Needs Attention';
    const hDesc  = networkHealth.score >= 80
      ? 'All critical systems are performing well. Minor items are being monitored.'
      : networkHealth.score >= 60
      ? 'Most systems are operational. Some issues require crew attention.'
      : 'Several systems need immediate attention. Please review active alerts.';
    sc3(hColor);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(30);
    doc.text(String(networkHealth.score), M, y + 11);
    doc.setFontSize(7.5);
    doc.setTextColor(130, 140, 150);
    doc.text('/100', M + 12, y + 11);
    doc.setFontSize(11);
    sc3(hColor);
    doc.text(hLabel, M + 22, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(80, 95, 110);
    doc.text(doc.splitTextToSize(hDesc, CW - 26), M + 22, y + 11);
    y += 22;

    // ── Executive Summary ──
    sectionHeading('Executive Summary');
    const summAvailW = CW - 14; // account for 6mm left indent + 8mm right padding
    const summLines = doc.splitTextToSize(summaryText, summAvailW);
    const summH = summLines.length * 5.5 + 12;
    chk(summH + 16);
    const barColor = criticalCount > 0 ? [192,57,43] as const : warningCount > 0 ? [211,84,0] as const : [39,174,96] as const;
    fc3(LGRAY); doc.rect(M, y, CW, summH, 'F');
    fc3(barColor); doc.rect(M, y, 2.5, summH, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    sc3(DARK);
    doc.text(summLines, M + 6, y + 7, { maxWidth: summAvailW });
    y += summH + 5;
    // Pills — use autoTable row for reliable layout (avoids Unicode width bugs)
    autoTable(doc, {
      startY: y, margin: { left: M, right: M },
      body: [[
        `Resolved: ${resolvedAlerts.length} issues`,
        `Uptime: ${internetStatus.uptime}`,
        `Online: ${onlineDevices.length} / ${devices.length} devices`,
      ]],
      bodyStyles: { fontSize: 8, fontStyle: 'bold', halign: 'center', cellPadding: { top: 3, bottom: 3, left: 4, right: 4 } },
      columnStyles: {
        0: { textColor: [39,174,96],   fillColor: [232,248,238], lineColor: [39,174,96],   lineWidth: 0.3 },
        1: { textColor: [41,128,185],  fillColor: [232,242,253], lineColor: [41,128,185],  lineWidth: 0.3 },
        2: { textColor: [142,68,173],  fillColor: [245,238,252], lineColor: [142,68,173],  lineWidth: 0.3 },
      },
      tableLineWidth: 0,
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // ── Internet & Connectivity ──
    chk(30);
    sectionHeading('Internet & Connectivity');
    autoTable(doc, {
      startY: y, margin: { left: M, right: M },
      head: [['Metric', 'Value', 'Detail']],
      body: [
        ['Connection Status', 'Online',                       `via ${internetStatus.provider}`],
        ['Download Speed',    `${internetStatus.downloadMbps} Mbps`, 'current speed'],
        ['Latency',           `${internetStatus.latencyMs} ms`,      internetStatus.latencyMs < 50 ? 'Good' : 'Elevated'],
        ['Internet Uptime',   internetStatus.uptime,                 'this period'],
      ],
      headStyles: { fillColor: [...HEADER] as [number,number,number], textColor: [255,255,255], fontSize: 7.5, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8.5, textColor: [50, 60, 70] },
      alternateRowStyles: { fillColor: [248,249,250] },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 }, 1: { cellWidth: 50 } },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // ── Device Inventory ──
    chk(20);
    sectionHeading(`Full Device Inventory (${devices.length} devices)`);
    autoTable(doc, {
      startY: y, margin: { left: M, right: M },
      head: [['Device Name', 'IP Address', 'Type', 'Zone / Location', 'Status', 'Last Seen']],
      body: devices.map(d => [d.name, d.ip, d.type, d.location || 'Unassigned', d.status, d.lastSeen]),
      headStyles: { fillColor: [...HEADER] as [number,number,number], textColor: [255,255,255], fontSize: 7.5, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8, textColor: [50, 60, 70] },
      alternateRowStyles: { fillColor: [248,249,250] },
      columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 28 }, 2: { cellWidth: 22 }, 3: { cellWidth: 32 }, 4: { cellWidth: 20 }, 5: { cellWidth: 28 } },
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.column.index === 4) {
          data.cell.styles.textColor = data.cell.raw === 'online' ? [39,174,96] : [192,57,43];
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // ── Zone Health ──
    chk(20);
    sectionHeading('Zone Health Summary');
    autoTable(doc, {
      startY: y, margin: { left: M, right: M },
      head: [['Zone', 'Total', 'Online', 'Offline', 'Health']],
      body: zoneEntries.map(([zone, { online, offline, total }]) => [
        zone, total, online, offline,
        total > 0 ? `${Math.round((online/total)*100)}%` : 'N/A',
      ]),
      headStyles: { fillColor: [...HEADER] as [number,number,number], textColor: [255,255,255], fontSize: 7.5, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8.5, textColor: [50, 60, 70] },
      alternateRowStyles: { fillColor: [248,249,250] },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 65 } },
      didParseCell: (data: any) => {
        if (data.section !== 'body') return;
        const row = zoneEntries[data.row.index];
        if (!row) return;
        const [, { offline, total }] = row;
        if (data.column.index === 2) { data.cell.styles.textColor = [39,174,96]; data.cell.styles.fontStyle = 'bold'; }
        if (data.column.index === 3 && offline > 0) { data.cell.styles.textColor = [192,57,43]; data.cell.styles.fontStyle = 'bold'; }
        if (data.column.index === 4) {
          data.cell.styles.textColor = offline === 0 ? [39,174,96] : offline === total ? [192,57,43] : [211,84,0];
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // ── Security Posture ──
    chk(30);
    sectionHeading('Security Posture');
    const sColor = scoreRGB(secScore);
    sc3(sColor);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    doc.text(String(secScore), M, y + 10);
    doc.setFontSize(7.5);
    doc.setTextColor(130, 140, 150);
    doc.text('/100', M + 11, y + 10);
    doc.setFontSize(11);
    sc3(sColor);
    doc.text(secLabel, M + 22, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(90, 100, 115);
    doc.text('Network security score', M + 22, y + 11);
    y += 18;
    autoTable(doc, {
      startY: y, margin: { left: M, right: M },
      head: [['Metric', 'Value', 'Status']],
      body: [
        ['Active Threats',  String(criticalCount),         criticalCount === 0      ? 'Clear'       : 'Action Required'],
        ['Open Warnings',   String(warningCount),          warningCount === 0       ? 'Clear'       : 'Review Needed'],
        ['Unknown Devices', String(unknownDevices.length), unknownDevices.length === 0 ? 'Clear'    : 'Investigate'],
        ['Offline Devices', String(offlineDevices.length), offlineDevices.length === 0 ? 'All Online' : 'Attention Needed'],
      ],
      headStyles: { fillColor: [...HEADER] as [number,number,number], textColor: [255,255,255], fontSize: 7.5, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8.5, textColor: [50, 60, 70] },
      alternateRowStyles: { fillColor: [248,249,250] },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 }, 1: { cellWidth: 30 } },
      didParseCell: (data: any) => {
        if (data.section !== 'body') return;
        const vals = [criticalCount, warningCount, unknownDevices.length, offlineDevices.length];
        const v = vals[data.row.index] ?? 0;
        if (data.column.index === 1) { data.cell.styles.textColor = v === 0 ? [39,174,96] : [192,57,43]; data.cell.styles.fontStyle = 'bold'; }
        if (data.column.index === 2) { data.cell.styles.textColor = v === 0 ? [39,174,96] : data.row.index === 0 ? [192,57,43] : [211,84,0]; }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // ── Active Alerts ──
    chk(20);
    sectionHeading(`Active Alerts (${activeAlerts.length})`);
    autoTable(doc, {
      startY: y, margin: { left: M, right: M },
      head: [['Severity', 'Alert', 'Description']],
      body: activeAlerts.length === 0
        ? [['—', 'No active alerts', 'All systems clear']]
        : activeAlerts.map(a => [a.severity.toUpperCase(), a.title, a.description]),
      headStyles: { fillColor: [...HEADER] as [number,number,number], textColor: [255,255,255], fontSize: 7.5, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8.5, textColor: [50, 60, 70] },
      alternateRowStyles: { fillColor: [248,249,250] },
      columnStyles: { 0: { cellWidth: 28, fontStyle: 'bold' }, 1: { cellWidth: 55 } },
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.column.index === 0 && activeAlerts.length > 0) {
          const a = activeAlerts[data.row.index];
          if (a) data.cell.styles.textColor = [...sevRGB(a.severity)];
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // ── Resolved Alerts ──
    chk(20);
    sectionHeading(`Resolved Alerts (${resolvedAlerts.length})`);
    autoTable(doc, {
      startY: y, margin: { left: M, right: M },
      head: [['Alert', 'Resolved At']],
      body: resolvedAlerts.length === 0
        ? [['No alerts resolved in this period', '—']]
        : resolvedAlerts.map(a => [
            a.title,
            new Date(a.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          ]),
      headStyles: { fillColor: [...HEADER] as [number,number,number], textColor: [255,255,255], fontSize: 7.5, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8.5, textColor: [50, 60, 70] },
      alternateRowStyles: { fillColor: [248,249,250] },
      columnStyles: { 1: { cellWidth: 28 } },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // ── Cyber Assessment ──
    if (latestAssessment) {
      chk(30);
      sectionHeading('Cyber Security Assessment');
      const cs = latestAssessment.score;
      const cyberRGB = cs >= 80 ? [39,174,96] as const : cs >= 60 ? [211,84,0] as const : [192,57,43] as const;
      const cyberLbl = cs >= 80 ? 'Good Posture' : cs >= 60 ? 'Fair' : 'At Risk';
      sc3(cyberRGB);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.text(String(cs), M, y + 8);
      doc.setFontSize(7.5);
      doc.setTextColor(130, 140, 150);
      doc.text('/100', M + 9, y + 8);
      doc.setFontSize(10);
      sc3(cyberRGB);
      doc.text(cyberLbl, M + 22, y + 4);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(90, 100, 115);
      doc.text(`Last scan: ${new Date(latestAssessment.runAt).toLocaleDateString('en-GB')}  ·  BIMCO / IMO MSC-FAL.1 mapped`, M + 22, y + 10);
      y += 18;
      if (openFindings.length > 0) {
        autoTable(doc, {
          startY: y, margin: { left: M, right: M },
          head: [['Category', 'Finding', 'Status']],
          body: openFindings.map(f => [f.category, f.check_name, f.status.toUpperCase()]),
          headStyles: { fillColor: [...HEADER] as [number,number,number], textColor: [255,255,255], fontSize: 7.5, fontStyle: 'bold' },
          bodyStyles: { fontSize: 8, textColor: [50, 60, 70] },
          alternateRowStyles: { fillColor: [248,249,250] },
          columnStyles: { 0: { cellWidth: 40, fontStyle: 'bold' }, 2: { cellWidth: 26 } },
          didParseCell: (data: any) => {
            if (data.section === 'body' && data.column.index === 2) {
              data.cell.styles.textColor = openFindings[data.row.index]?.status === 'flagged' ? [192,57,43] : [211,84,0];
              data.cell.styles.fontStyle = 'bold';
            }
          },
        });
        y = (doc as any).lastAutoTable.finalY + 8;
      } else {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8.5);
        doc.setTextColor(39, 174, 96);
        doc.text('All findings remediated — no open items.', M, y + 4);
        y += 10;
      }
    }

    // ── Scheduled Reports ──
    chk(20);
    sectionHeading('Scheduled Reports');
    autoTable(doc, {
      startY: y, margin: { left: M, right: M },
      head: [['Report Name', 'Recipient', 'Frequency', 'Last Sent']],
      body: schedules.map(r => [r.name, r.recipient, formatScheduleFrequency(r), formatLastSent(r.lastSentAt)]),
      headStyles: { fillColor: [...HEADER] as [number,number,number], textColor: [255,255,255], fontSize: 7.5, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8.5, textColor: [50, 60, 70] },
      alternateRowStyles: { fillColor: [248,249,250] },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 52 } },
    });

    // ── Per-page footer ──
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setDrawColor(210, 215, 220);
      doc.setLineWidth(0.25);
      doc.line(M, 286, W - M, 286);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(160, 170, 180);
      doc.text('NauticShield · Vessel Technology Management · M/Y Aurora · Confidential', M, 291);
      doc.text(`Page ${i} of ${pageCount}`, W - M, 291, { align: 'right' });
    }

    doc.save(`NauticShield-Report-${targetPeriod}-${now.toISOString().slice(0, 10)}.pdf`);
  }

  async function runScheduledReport(schedule: ReportSchedule) {
    setScheduleError('');
    setScheduleNotice('');
    setSendingScheduleId(schedule.id);
    try {
      const updated = await agentApi.reports.sendNow(schedule.id);
      setSchedules(updated);
      setScheduleNotice(`Sent "${schedule.name}" to ${schedule.recipient}.`);
    } catch (error) {
      setScheduleError(error instanceof Error ? error.message : 'Report email could not be sent.');
    } finally {
      setSendingScheduleId(null);
    }
  }

  return (
    <div style={{ padding: 28, maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ color: '#f0f4f8', fontSize: 20, fontWeight: 800, letterSpacing: 0.2 }}>Reporting</div>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.5, background: 'rgba(212,168,71,0.15)', color: '#d4a847', border: '1px solid rgba(212,168,71,0.3)', borderRadius: 5, padding: '2px 7px' }}>✦ Premium</span>
          </div>
          <div style={{ color: '#6b7f92', fontSize: 13, marginTop: 4 }}>
            {periodLabel[period]}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => downloadPDF()}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(212,168,71,0.18)', color: '#d4a847',
              border: '1px solid rgba(212,168,71,0.4)',
              borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
          >
            <Printer size={15} /> Download PDF
          </button>
          <button
            onClick={() => generateReport()}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: '#0d1421', color: '#6b7f92',
              border: '1px solid #1a2535',
              borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Print / Preview
          </button>
        </div>
      </div>

      {/* Period selector */}
      <div style={{ display: 'flex', gap: 6 }}>
        {([['live','Live Snapshot'],['daily','24-Hour'],['weekly','Weekly'],['monthly','Monthly']] as const).map(([val, lbl]) => (
          <button
            key={val}
            onClick={() => setPeriod(val)}
            style={{
              background: period === val ? 'rgba(212,168,71,0.15)' : '#0d1421',
              color: period === val ? '#d4a847' : '#6b7f92',
              border: `1px solid ${period === val ? 'rgba(212,168,71,0.4)' : '#1a2535'}`,
              borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {lbl}
          </button>
        ))}
      </div>

      {/* Overall health */}
      <Card>
        <SectionTitle>Report Configuration</SectionTitle>
        <div style={{ color: '#6b7f92', fontSize: 12, lineHeight: 1.7 }}>
          Scheduled reports now keep their own content selection, so owner, captain, and crew recipients do not all receive the same report.
        </div>
      </Card>

      <Card>
        <SectionTitle>Overall System Health</SectionTitle>
        <ScoreRing score={networkHealth.score} />
      </Card>

      {/* Plain-English summary */}
      <Card style={{ borderLeft: `4px solid ${criticalCount > 0 ? '#ef4444' : warningCount > 0 ? '#f59e0b' : '#22c55e'}` }}>
        <SectionTitle>Executive Summary</SectionTitle>
        <p style={{ color: '#dce8f4', fontSize: 15, lineHeight: 1.7, margin: 0 }}>
          {summaryText}
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          {[
            { label: `${resolvedAlerts.length} issues resolved today`, color: '#22c55e' },
            { label: `${internetStatus.uptime} internet uptime`,        color: '#0ea5e9' },
            { label: `${onlineDevices.length} of ${devices.length} devices online`, color: '#8b5cf6' },
          ].map(({ label, color }) => (
            <span key={label} style={{ background: color + '18', color, border: `1px solid ${color}33`, borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 600 }}>
              {label}
            </span>
          ))}
        </div>
      </Card>

      {/* Connectivity */}
      <Card>
        <SectionTitle>Internet &amp; Connectivity</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {[
            { label: 'Connection Status', value: 'Good', color: '#22c55e', icon: Wifi,             sub: `via ${internetStatus.provider}` },
            { label: 'Download Speed',    value: `${internetStatus.downloadMbps} Mbps`, color: '#0ea5e9', icon: Activity, sub: 'current speed' },
            { label: 'Latency',           value: `${internetStatus.latencyMs} ms`,      color: '#22c55e', icon: Activity, sub: 'average response time' },
            { label: 'Uptime This Period',value: internetStatus.uptime,                 color: '#f59e0b', icon: Activity, sub: 'last 24 hours' },
          ].map(({ label, value, color, icon: Icon, sub }) => (
            <div key={label} style={{ background: '#0a0f18', border: '1px solid #1a2535', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ background: color + '18', border: `1px solid ${color}33`, borderRadius: 10, padding: 10 }}>
                <Icon size={18} color={color} />
              </div>
              <div>
                <div style={{ color: '#6b7f92', fontSize: 11, marginBottom: 2 }}>{label}</div>
                <div style={{ color: '#f0f4f8', fontSize: 18, fontWeight: 700 }}>{value}</div>
                <div style={{ color: '#4a5a6a', fontSize: 11 }}>{sub}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Devices */}
      <Card>
        <SectionTitle>Device Status</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: offlineDevices.length > 0 ? 16 : 0 }}>
          {[
            { label: 'Online',      value: onlineDevices.length,  color: '#22c55e', icon: MonitorSmartphone },
            { label: 'Offline',     value: offlineDevices.length, color: '#ef4444', icon: MonitorSmartphone },
            { label: 'Unrecognised',value: unknownDevices.length, color: '#f59e0b', icon: MonitorSmartphone },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} style={{ background: '#0a0f18', border: '1px solid #1a2535', borderRadius: 12, padding: '16px 20px', textAlign: 'center' }}>
              <div style={{ background: color + '18', borderRadius: 10, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                <Icon size={18} color={color} />
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
              <div style={{ color: '#6b7f92', fontSize: 12, marginTop: 5 }}>{label}</div>
            </div>
          ))}
        </div>

        {offlineDevices.length > 0 && (
          <div>
            <div style={{ color: '#8899aa', fontSize: 12, marginBottom: 8 }}>Offline devices requiring attention:</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {offlineDevices.map(d => (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 5px rgba(239,68,68,0.5)', flexShrink: 0 }} />
                  <span style={{ color: '#f0f4f8', fontSize: 13, flex: 1 }}>{d.name}</span>
                  <span style={{ color: '#4a5a6a', fontSize: 11 }}>{d.location ?? 'Unknown location'}</span>
                  <span style={{ color: '#6b7f92', fontSize: 11 }}>Last seen {d.lastSeen}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Zone Health Summary */}
      <Card>
        <SectionTitle>Zone Health Summary</SectionTitle>
        {zoneEntries.length === 0 ? (
          <div style={{ color: '#4a5a6a', fontSize: 13 }}>No devices with zone assignment found.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {zoneEntries.map(([zone, { online, offline, total }]) => {
              const pct   = total > 0 ? Math.round((online / total) * 100) : 0;
              const color = offline === 0 ? '#22c55e' : offline === total ? '#ef4444' : '#f59e0b';
              return (
                <div key={zone} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#0a0f18', border: '1px solid #1a2535', borderRadius: 10, padding: '10px 14px' }}>
                  <MapPin size={14} color={color} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#f0f4f8', fontSize: 13, fontWeight: 600 }}>{zone}</div>
                    <div style={{ marginTop: 5, height: 4, background: '#1a2535', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.4s' }} />
                    </div>
                  </div>
                  <div style={{ color: '#8899aa', fontSize: 12, textAlign: 'right', flexShrink: 0 }}>
                    <span style={{ color, fontWeight: 700 }}>{online}</span>
                    <span style={{ color: '#4a5a6a' }}>/{total} online</span>
                    {offline > 0 && <div style={{ color: '#ef4444', fontSize: 11 }}>{offline} offline</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Security Posture */}
      <Card>
        <SectionTitle>Security Posture</SectionTitle>
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexShrink: 0 }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%', flexShrink: 0,
              background: `conic-gradient(${secColor} ${secScore}%, #1a2535 0%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 14px ${secColor}40`,
            }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#0d1421', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                <div style={{ color: secColor, fontSize: 18, fontWeight: 800, lineHeight: 1 }}>{secScore}</div>
                <div style={{ color: '#4a5a6a', fontSize: 9 }}>/ 100</div>
              </div>
            </div>
            <div>
              <div style={{ color: secColor, fontSize: 16, fontWeight: 800 }}>{secLabel}</div>
              <div style={{ color: '#6b7f92', fontSize: 12, marginTop: 3 }}>Network security score</div>
            </div>
          </div>
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, minWidth: 260 }}>
            {[
              { label: 'Active Threats',     value: criticalCount,         color: criticalCount > 0      ? '#ef4444' : '#22c55e', icon: ShieldAlert   },
              { label: 'Open Warnings',      value: warningCount,          color: warningCount > 0       ? '#f59e0b' : '#22c55e', icon: AlertTriangle },
              { label: 'Unknown Devices',    value: unknownDevices.length, color: unknownDevices.length > 0 ? '#f59e0b' : '#22c55e', icon: Shield     },
              { label: 'Security Incidents', value: activeAlerts.length,   color: activeAlerts.length > 0   ? '#f59e0b' : '#22c55e', icon: TrendingUp },
            ].map(({ label, value, color, icon: Icon }) => (
              <div key={label} style={{ background: '#0a0f18', border: '1px solid #1a2535', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon size={15} color={color} style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ color: '#6b7f92', fontSize: 11 }}>{label}</div>
                  <div style={{ color, fontSize: 18, fontWeight: 800, lineHeight: 1.2 }}>{value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(212,168,71,0.06)', border: '1px solid rgba(212,168,71,0.2)', borderRadius: 8, color: '#a07830', fontSize: 12 }}>
          ✦ Full threat analysis, incident log and pen test schedule available in <span style={{ color: '#d4a847', fontWeight: 600 }}>Cyber Management</span>
        </div>
      </Card>

      {/* Active alerts */}
      {activeAlerts.length > 0 && (
        <Card>
          <SectionTitle>Active Issues</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activeAlerts.map(a => {
              const color = a.severity === 'critical' ? '#ef4444' : a.severity === 'warning' ? '#f59e0b' : '#0ea5e9';
              const Icon  = a.severity === 'critical' ? ShieldAlert : AlertTriangle;
              return (
                <div key={a.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  background: '#0a0f18', borderRadius: 10, padding: '12px 14px',
                  border: `1px solid ${color}33`, borderLeft: `3px solid ${color}`,
                }}>
                  <Icon size={15} color={color} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#f0f4f8', fontSize: 13, fontWeight: 600 }}>{a.title}</div>
                    <div style={{ color: '#8899aa', fontSize: 12, marginTop: 3, lineHeight: 1.5 }}>{a.description}</div>
                  </div>
                  <span style={{ background: color + '18', color, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700, flexShrink: 0, textTransform: 'uppercase' }}>
                    {a.severity}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Resolved today */}
      {resolvedAlerts.length > 0 && (
        <Card>
          <SectionTitle>Resolved Today</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {resolvedAlerts.map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #1a2535' }}>
                <CheckCircle2 size={14} color="#22c55e" style={{ flexShrink: 0 }} />
                <span style={{ color: '#8899aa', fontSize: 13, flex: 1 }}>{a.title}</span>
                <span style={{ color: '#4a5a6a', fontSize: 11 }}>
                  {new Date(a.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Cyber Security Assessment */}
      <Card>
        <SectionTitle>Cyber Security Assessment</SectionTitle>
        {latestAssessment ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Score row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {(() => {
                const s = latestAssessment.score;
                const c2 = s >= 80 ? '#22c55e' : s >= 60 ? '#f59e0b' : '#ef4444';
                const lbl = s >= 80 ? 'Good Posture' : s >= 60 ? 'Fair' : 'At Risk';
                return (
                  <>
                    <div style={{
                      width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
                      background: `conic-gradient(${c2} ${s}%, #1a2535 0%)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: `0 0 12px ${c2}40`,
                    }}>
                      <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#0d1421', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                        <div style={{ color: c2, fontSize: 16, fontWeight: 800, lineHeight: 1 }}>{s}</div>
                        <div style={{ color: '#4a5a6a', fontSize: 8 }}>/ 100</div>
                      </div>
                    </div>
                    <div>
                      <div style={{ color: c2, fontSize: 16, fontWeight: 800 }}>{lbl}</div>
                      <div style={{ color: '#6b7f92', fontSize: 12, marginTop: 2 }}>
                        Last scan: {new Date(latestAssessment.runAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </>
                );
              })()}
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(212,168,71,0.08)', border: '1px solid rgba(212,168,71,0.2)', borderRadius: 8, padding: '6px 12px' }}>
                <Cpu size={13} color="#d4a847" />
                <span style={{ color: '#d4a847', fontSize: 12, fontWeight: 600 }}>BIMCO / IMO MSC-FAL.1 Mapped</span>
              </div>
            </div>

            {/* Open findings */}
            {openFindings.length > 0 && (
              <div>
                <div style={{ color: '#6b7f92', fontSize: 11, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>
                  {openFindings.length} Open Finding{openFindings.length !== 1 ? 's' : ''}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {openFindings.slice(0, 5).map(f => {
                    const fc = f.status === 'flagged' ? '#ef4444' : '#f59e0b';
                    return (
                      <div key={f.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        background: '#0a0f18', border: `1px solid ${fc}33`, borderLeft: `3px solid ${fc}`,
                        borderRadius: 8, padding: '8px 12px',
                      }}>
                        <FileText size={12} color={fc} style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: '#f0f4f8', fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.check_name}</div>
                          <div style={{ color: '#4a5a6a', fontSize: 11, marginTop: 1 }}>{f.category}</div>
                        </div>
                        <span style={{ background: fc + '18', color: fc, borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 700, flexShrink: 0, textTransform: 'uppercase' }}>
                          {f.status}
                        </span>
                      </div>
                    );
                  })}
                  {openFindings.length > 5 && (
                    <div style={{ color: '#4a5a6a', fontSize: 12, textAlign: 'center', paddingTop: 4 }}>
                      + {openFindings.length - 5} more — see Cyber Management for full list
                    </div>
                  )}
                </div>
              </div>
            )}

            {openFindings.length === 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, padding: '10px 14px', color: '#22c55e', fontSize: 13 }}>
                <CheckCircle2 size={14} /> All pen test findings remediated — no open items.
              </div>
            )}
          </div>
        ) : (
          <div style={{ color: '#4a5a6a', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>
            No cyber assessment on record. Run a Quick Security Scan from the Cyber Management page.
          </div>
        )}
      </Card>

      {/* Scheduled Reports */}
      <Card>
        <SectionTitle>Scheduled Reports</SectionTitle>
        {scheduleNotice && !editorOpen ? (
          <div style={{ marginBottom: 10, color: '#86efac', fontSize: 12, lineHeight: 1.6 }}>
            {scheduleNotice}
          </div>
        ) : null}
        {scheduleError && !editorOpen ? (
          <div style={{ marginBottom: 10, color: '#fca5a5', fontSize: 12, lineHeight: 1.6 }}>
            <div>{scheduleError}</div>
            {scheduleErrorHint(scheduleError) ? <div style={{ color: '#fcd34d', marginTop: 4 }}>{scheduleErrorHint(scheduleError)}</div> : null}
          </div>
        ) : null}
        {scheduleLoading ? (
          <div style={{ color: '#4a5a6a', fontSize: 13, padding: '16px 0' }}>Loading schedules…</div>
        ) : schedules.length === 0 ? (
          <div style={{ color: '#4a5a6a', fontSize: 13, padding: '16px 0' }}>No schedules configured yet. Add your first owner or crew report delivery.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {schedules.map(schedule => (
              <div key={schedule.id} style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#0a0f18', border: '1px solid #1a2535', borderRadius: 10, padding: '12px 16px' }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(212,168,71,0.08)', border: '1px solid rgba(212,168,71,0.2)' }}>
                  <Mail size={16} color="#d4a847" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ color: '#f0f4f8', fontSize: 13, fontWeight: 600 }}>{schedule.name}</div>
                    <span style={{ background: schedule.active ? 'rgba(34,197,94,0.14)' : 'rgba(107,127,146,0.12)', color: schedule.active ? '#22c55e' : '#6b7f92', borderRadius: 999, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>{schedule.active ? 'ACTIVE' : 'PAUSED'}</span>
                  </div>
                  <div style={{ color: '#6b7f92', fontSize: 11, marginTop: 2 }}>{schedule.recipient} · {PERIOD_LABELS[schedule.period]}</div>
                  <div style={{ color: '#4a5a6a', fontSize: 11, marginTop: 4 }}>{formatSectionSummary(schedule.sections)}</div>
                </div>
                <div style={{ color: '#4a5a6a', fontSize: 11, textAlign: 'right', flexShrink: 0, minWidth: 150 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end', marginBottom: 2 }}>
                    <Calendar size={10} color="#4a5a6a" />
                    <span>{formatScheduleFrequency(schedule)}</span>
                  </div>
                  <div style={{ color: '#6b7f92' }}>Last: {formatLastSent(schedule.lastSentAt)}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {(() => {
                    const isSending = sendingScheduleId === schedule.id;
                    const isHovered = hoveredScheduleId === schedule.id;
                    const isPressed = pressedScheduleId === schedule.id;

                    return (
                  <button
                    onClick={() => runScheduledReport(schedule)}
                    disabled={isSending}
                    onMouseEnter={() => setHoveredScheduleId(schedule.id)}
                    onMouseLeave={() => {
                      setHoveredScheduleId(current => current === schedule.id ? null : current);
                      setPressedScheduleId(current => current === schedule.id ? null : current);
                    }}
                    onMouseDown={() => setPressedScheduleId(schedule.id)}
                    onMouseUp={() => setPressedScheduleId(current => current === schedule.id ? null : current)}
                    onBlur={() => {
                      setHoveredScheduleId(current => current === schedule.id ? null : current);
                      setPressedScheduleId(current => current === schedule.id ? null : current);
                    }}
                    style={{
                      background: isSending || isPressed
                        ? 'rgba(14,165,233,0.22)'
                        : isHovered
                          ? 'rgba(14,165,233,0.16)'
                          : 'rgba(14,165,233,0.12)',
                      color: '#7dd3fc',
                      border: isHovered || isPressed
                        ? '1px solid rgba(125,211,252,0.42)'
                        : '1px solid rgba(14,165,233,0.25)',
                      borderRadius: 8,
                      padding: '7px 10px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: isSending ? 'default' : 'pointer',
                      opacity: isSending ? 0.8 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      boxShadow: isHovered || isPressed ? '0 0 0 1px rgba(125,211,252,0.12), 0 10px 24px rgba(14,165,233,0.12)' : 'none',
                      transform: isPressed ? 'translateY(1px) scale(0.99)' : isHovered ? 'translateY(-1px)' : 'translateY(0)',
                      transition: 'background 120ms ease, border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease, opacity 120ms ease',
                    }}
                  >
                    <Play size={12} /> {isSending ? 'Sending…' : 'Email now'}
                  </button>
                    );
                  })()}
                  <button onClick={() => openEditSchedule(schedule)} style={{ background: 'transparent', color: '#d4a847', border: '1px solid rgba(212,168,71,0.25)', borderRadius: 8, padding: '7px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Pencil size={12} /> Edit
                  </button>
                  <button onClick={() => toggleSchedule(schedule.id)} style={{ background: 'transparent', color: schedule.active ? '#6b7f92' : '#22c55e', border: '1px solid #1a2535', borderRadius: 8, padding: '7px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    {schedule.active ? 'Pause' : 'Activate'}
                  </button>
                  <button onClick={() => deleteSchedule(schedule.id)} style={{ background: 'transparent', color: '#ef4444', border: '1px solid rgba(239,68,68,0.22)', borderRadius: 8, padding: '7px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={openNewSchedule} style={{ background: 'rgba(212,168,71,0.1)', color: '#d4a847', border: '1px solid rgba(212,168,71,0.25)', borderRadius: 8, padding: '7px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={13} /> Add Schedule
          </button>
        </div>
      </Card>

      {/* Footer */}
      <div style={{ textAlign: 'center', color: '#2a3a50', fontSize: 12, paddingBottom: 8 }}>
        NauticShield · Vessel Technology Reporting · {dateStr}
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          button { display: none !important; }
        }
      `}</style>

      {editorOpen ? (
        <ScheduleEditor
          draft={draft}
          saving={scheduleSaving}
          error={scheduleError}
          onChange={patch => setDraft(current => ({ ...current, ...patch }))}
          onClose={() => setEditorOpen(false)}
          onSave={saveDraft}
        />
      ) : null}
    </div>
  );
}
