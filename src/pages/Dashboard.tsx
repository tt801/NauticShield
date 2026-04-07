import { useState } from 'react';
import {
  Wifi,
  WifiOff,
  Activity,
  MonitorSmartphone,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Zap,
  Globe,
  Eye,
  RefreshCw,
  Loader2,
  XCircle,
  ShieldX,
  Tv,
  Camera,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { internetStatus, networkHealth, alerts, devices } from '@/data/mock';
import type { ConnectionStatus, AlertSeverity } from '@/data/mock';

// ── colour maps ──────────────────────────────────────────────────

const connColors: Record<ConnectionStatus, { label: string; text: string; bg: string; glow: string }> = {
  good: { label: 'Good',  text: '#22c55e', bg: 'rgba(34,197,94,0.1)',  glow: 'rgba(34,197,94,0.3)' },
  slow: { label: 'Slow',  text: '#f59e0b', bg: 'rgba(245,158,11,0.1)', glow: 'rgba(245,158,11,0.3)' },
  down: { label: 'Down',  text: '#ef4444', bg: 'rgba(239,68,68,0.1)',  glow: 'rgba(239,68,68,0.3)' },
};

const sevColors: Record<AlertSeverity, { text: string; bg: string; border: string }> = {
  critical: { text: '#ef4444', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.25)' },
  warning:  { text: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)' },
  info:     { text: '#0ea5e9', bg: 'rgba(14,165,233,0.1)', border: 'rgba(14,165,233,0.25)' },
};

// ── Sparkline ─────────────────────────────────────────────────────

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const w = 80, h = 28;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  });
  const area = `M${pts[0]} L${pts.join(' L')} L${w},${h} L0,${h} Z`;
  const line = `M${pts[0]} L${pts.join(' L')}`;
  const gradId = `sg-${color.replace('#', '')}`;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Radial score ──────────────────────────────────────────────────

function RadialScore({ score }: { score: number }) {
  const r = 44, cx = 52, cy = 52;
  const circumference = 2 * Math.PI * r;
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';
  const offset = circumference * (1 - score / 100);
  return (
    <svg width={104} height={104} viewBox="0 0 104 104">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1a2535" strokeWidth="7" />
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={color}
        strokeWidth="7"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ filter: `drop-shadow(0 0 6px ${color})` }}
      />
      <text x={cx} y={cy - 6} textAnchor="middle" fill={color} fontSize="20" fontWeight="700">{score}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="#6b7f92" fontSize="10">/ 100</text>
    </svg>
  );
}

// ── Connection quality timeline (24h) ─────────────────────────────

const qualityBlocks: ConnectionStatus[] = [
  'good','good','good','good','slow','good','good','good','down','down',
  'good','good','good','good','good','good','slow','good','good','good',
  'good','good','good','good',
];

function ConnectionTimeline() {
  const blockColors: Record<ConnectionStatus, string> = {
    good: '#22c55e', slow: '#f59e0b', down: '#ef4444',
  };
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ color: '#6b7f92', fontSize: 11 }}>Connection quality — last 24h</span>
        <span style={{ color: '#22c55e', fontSize: 11, fontWeight: 600 }}>99.7% uptime</span>
      </div>
      <div style={{ display: 'flex', gap: 3 }}>
        {qualityBlocks.map((s, i) => (
          <div key={i} title={s} style={{ flex: 1, height: 22, borderRadius: 4, background: blockColors[s], opacity: 0.8 }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ color: '#4a5a6a', fontSize: 10 }}>24h ago</span>
        <span style={{ color: '#4a5a6a', fontSize: 10 }}>Now</span>
      </div>
    </div>
  );
}

// ── Card shell ────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: '#0d1421', border: '1px solid #1a2535', borderRadius: 14, padding: 20, ...style }}>
      {children}
    </div>
  );
}

function CardLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color: '#4a5a6a', fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>
      {children}
    </div>
  );
}

// ── KPI card ──────────────────────────────────────────────────────

interface KpiProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  iconColor: string;
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
  sparkData?: number[];
}

function KpiCard({ label, value, sub, icon: Icon, iconColor, trend, trendLabel, sparkData }: KpiProps) {
  const trendColor = trend === 'up' ? '#22c55e' : trend === 'down' ? '#ef4444' : '#f59e0b';
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Activity;

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <CardLabel>{label}</CardLabel>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#f0f4f8', lineHeight: 1 }}>{value}</div>
          {sub && <div style={{ color: '#6b7f92', fontSize: 12, marginTop: 5 }}>{sub}</div>}
        </div>
        <div style={{
          background: `linear-gradient(135deg, ${iconColor}22, ${iconColor}11)`,
          border: `1px solid ${iconColor}33`,
          borderRadius: 10,
          padding: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Icon size={20} color={iconColor} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
        {trendLabel && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: trendColor, fontSize: 12 }}>
            <TrendIcon size={13} color={trendColor} />
            <span>{trendLabel}</span>
          </div>
        )}
        {sparkData && <Sparkline data={sparkData} color={iconColor} />}
      </div>
    </Card>
  );
}

// ── Internet card ─────────────────────────────────────────────────

const dlHistory = [110,125,132,141,138,130,135,140,142,139,145,142];
const ulHistory = [22,25,28,30,31,29,28,32,31,33,31,31];

function InternetCard() {
  const s = internetStatus;
  const c = connColors[s.status];

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <CardLabel>Internet Connection</CardLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: c.text,
              boxShadow: `0 0 8px ${c.glow}`,
            }} />
            <span style={{ fontSize: 26, fontWeight: 800, color: c.text }}>{c.label}</span>
            <span style={{
              background: c.bg, border: `1px solid ${c.glow}`,
              color: c.text, borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 600,
            }}>via {s.provider}</span>
          </div>
        </div>
        <div style={{ background: c.bg, border: `1px solid ${c.glow}`, borderRadius: 12, padding: 10 }}>
          {s.status === 'down' ? <WifiOff size={22} color={c.text} /> : <Wifi size={22} color={c.text} />}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 4 }}>
        {[
          { label: 'Download', value: `${s.downloadMbps}`, unit: 'Mbps', spark: dlHistory,                                          color: '#0ea5e9' },
          { label: 'Upload',   value: `${s.uploadMbps}`,   unit: 'Mbps', spark: ulHistory,                                          color: '#8b5cf6' },
          { label: 'Latency',  value: `${s.latencyMs}`,    unit: 'ms',   spark: [32,30,28,29,31,28,27,28,30,28,29,28],              color: '#22c55e' },
          { label: 'Uptime',   value: s.uptime,            unit: '',     spark: [100,100,99,100,100,97,100,100,100,100,100,100],     color: '#f59e0b' },
        ].map(({ label, value, unit, spark, color }) => (
          <div key={label} style={{ background: '#0a0f18', border: '1px solid #1a2535', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ color: '#6b7f92', fontSize: 11, marginBottom: 4 }}>{label}</div>
                <div style={{ color: '#f0f4f8', fontSize: 18, fontWeight: 700, lineHeight: 1 }}>
                  {value}<span style={{ color: '#6b7f92', fontSize: 12, marginLeft: 3 }}>{unit}</span>
                </div>
              </div>
              <Sparkline data={spark} color={color} />
            </div>
          </div>
        ))}
      </div>

      <ConnectionTimeline />
    </Card>
  );
}

// ── Network health card ───────────────────────────────────────────

function NetworkHealthCard() {
  const n = networkHealth;
  return (
    <Card>
      <CardLabel>Network Health</CardLabel>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <RadialScore score={n.score} />
        <div style={{ flex: 1 }}>
          {[
            { label: 'Active',  value: n.activeDevices,  color: '#22c55e' },
            { label: 'Offline', value: n.offlineDevices, color: '#ef4444' },
            { label: 'Unknown', value: n.unknownDevices,  color: '#f59e0b' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: '#8899aa' }}>{label}</span>
                <span style={{ color, fontWeight: 600 }}>{value}</span>
              </div>
              <div style={{ height: 4, background: '#1a2535', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${(value / n.totalDevices) * 100}%`, height: '100%', background: color, borderRadius: 2 }} />
              </div>
            </div>
          ))}
          <Link to="/devices" style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#0ea5e9', fontSize: 12, fontWeight: 500, textDecoration: 'none', marginTop: 4 }}>
            View all devices <ArrowRight size={12} />
          </Link>
        </div>
      </div>
    </Card>
  );
}

// ── Alert feed ────────────────────────────────────────────────────

function AlertFeed() {
  const feed = [...alerts.filter(a => !a.resolved), ...alerts.filter(a => a.resolved)].slice(0, 5);
  const active = alerts.filter(a => !a.resolved);
  const counts = {
    critical: active.filter(a => a.severity === 'critical').length,
    warning:  active.filter(a => a.severity === 'warning').length,
    info:     active.filter(a => a.severity === 'info').length,
  };

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <CardLabel>Active Alerts</CardLabel>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['critical','warning','info'] as AlertSeverity[]).map(s => {
              const c = sevColors[s];
              return (
                <span key={s} style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}`, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>
                  {counts[s]} {s}
                </span>
              );
            })}
          </div>
        </div>
        <Link to="/alerts" style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#0ea5e9', fontSize: 12, fontWeight: 500, textDecoration: 'none' }}>
          All alerts <ArrowRight size={12} />
        </Link>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {feed.map(alert => {
          const c = sevColors[alert.severity];
          const time = new Date(alert.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
          return (
            <div key={alert.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: '#0a0f18',
              border: `1px solid ${alert.resolved ? '#1a2535' : c.border}`,
              borderLeft: `3px solid ${alert.resolved ? '#1a2535' : c.text}`,
              borderRadius: 10,
              padding: '11px 14px',
            }}>
              <div style={{ background: c.bg, borderRadius: 8, padding: 7, flexShrink: 0 }}>
                <ShieldAlert size={14} color={c.text} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: alert.resolved ? '#6b7f92' : '#dce8f4', fontSize: 13, fontWeight: 500 }}>
                  {alert.title}
                </div>
                <div style={{ color: '#4a5a6a', fontSize: 11, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {alert.description}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                <span style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}`, borderRadius: 4, padding: '2px 8px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>
                  {alert.severity}
                </span>
                {alert.resolved
                  ? <span style={{ color: '#22c55e', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}><CheckCircle2 size={11} /> Resolved</span>
                  : <span style={{ color: '#6b7f92', fontSize: 11 }}>{time}</span>
                }
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── Device overview ───────────────────────────────────────────────

function DeviceOverviewCard() {
  const online  = devices.filter(d => d.status === 'online').length;
  const offline = devices.filter(d => d.status === 'offline').length;
  const unknown = devices.filter(d => d.type === 'unknown').length;
  const total   = devices.length;

  const typeGroups = ['phone','laptop','tv','camera','router','unknown'] as const;
  const typeCounts = Object.fromEntries(typeGroups.map(t => [t, devices.filter(d => d.type === t).length]));
  const typeColors: Record<string, string> = {
    phone: '#0ea5e9', laptop: '#8b5cf6', tv: '#f59e0b',
    camera: '#22c55e', router: '#ec4899', unknown: '#6b7280',
  };

  return (
    <Card>
      <CardLabel>Devices Overview</CardLabel>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 12 }}>
        <span style={{ fontSize: 36, fontWeight: 800, color: '#f0f4f8', lineHeight: 1 }}>{total}</span>
        <span style={{ color: '#6b7f92', fontSize: 13 }}>devices</span>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: `${online} online`,  color: '#22c55e' },
          { label: `${offline} offline`, color: '#ef4444' },
          { label: `${unknown} unknown`, color: '#f59e0b' },
        ].map(({ label, color }) => (
          <span key={label} style={{ background: color + '18', color, border: `1px solid ${color}33`, borderRadius: 20, padding: '3px 9px', fontSize: 11, fontWeight: 600 }}>
            {label}
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {typeGroups.map(t => typeCounts[t] > 0 && (
          <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: typeColors[t], flexShrink: 0 }} />
            <div style={{ flex: 1, height: 3, background: '#1a2535', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${(typeCounts[t] / total) * 100}%`, height: '100%', background: typeColors[t], borderRadius: 2 }} />
            </div>
            <span style={{ color: '#8899aa', fontSize: 11, width: 52 }}>{t}</span>
            <span style={{ color: typeColors[t], fontSize: 12, fontWeight: 600, width: 16, textAlign: 'right' }}>{typeCounts[t]}</span>
          </div>
        ))}
      </div>
      {unknown > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '8px 12px', marginTop: 14, color: '#f59e0b', fontSize: 12 }}>
          <AlertTriangle size={13} />
          {unknown} unknown device{unknown > 1 ? 's' : ''} need review
        </div>
      )}
      <Link to="/devices" style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#0ea5e9', fontSize: 12, fontWeight: 500, textDecoration: 'none', marginTop: 12 }}>
        View all devices <ArrowRight size={12} />
      </Link>
    </Card>
  );
}

// ── Quick Actions card ───────────────────────────────────────────

type ActionState = 'idle' | 'running' | 'done' | 'failed';

interface QuickAction {
  id: string;
  icon: React.ElementType;
  problem: string;
  plain: string;
  buttonLabel: string;
  severity: AlertSeverity;
  successMsg: string;
}

const quickActions: QuickAction[] = [
  {
    id: 'stern-camera',
    icon: Camera,
    problem: 'Stern camera is offline',
    plain: 'The security camera at the stern has not been reachable for 48 hours.',
    buttonLabel: 'Restart Camera',
    severity: 'critical',
    successMsg: 'Camera restarted — coming back online.',
  },
  {
    id: 'salon-tv',
    icon: Tv,
    problem: 'Salon TV (Starboard) is not responding',
    plain: 'Guests in the main salon may not have TV. The starboard screen stopped responding at 04:22.',
    buttonLabel: 'Restart TV',
    severity: 'critical',
    successMsg: 'TV restarted — signal restored.',
  },
  {
    id: 'unknown-devices',
    icon: ShieldX,
    problem: '3 unrecognised devices on the network',
    plain: 'Three devices with unknown identities are connected. They may belong to guests or could be a security risk.',
    buttonLabel: 'Block & Review',
    severity: 'warning',
    successMsg: 'Unknown devices blocked. Review them in Devices.',
  },
];

function QuickActionsCard() {
  const [states, setStates] = useState<Record<string, ActionState>>({});

  function runAction(id: string) {
    setStates(s => ({ ...s, [id]: 'running' }));
    const willSucceed = Math.random() > 0.15;
    setTimeout(() => {
      setStates(s => ({ ...s, [id]: willSucceed ? 'done' : 'failed' }));
    }, 2200);
  }

  const sevColors: Record<AlertSeverity, { text: string; bg: string; border: string }> = {
    critical: { text: '#ef4444', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.25)' },
    warning:  { text: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)' },
    info:     { text: '#0ea5e9', bg: 'rgba(14,165,233,0.08)', border: 'rgba(14,165,233,0.25)' },
  };

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <CardLabel>Issues Requiring Attention</CardLabel>
          <div style={{ color: '#f0f4f8', fontSize: 15, fontWeight: 700 }}>Quick Fixes</div>
        </div>
        <span style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>
          {quickActions.length} action{quickActions.length !== 1 ? 's' : ''} needed
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {quickActions.map(action => {
          const c = sevColors[action.severity];
          const state = states[action.id] ?? 'idle';
          const Icon = action.icon;

          return (
            <div key={action.id} style={{
              display: 'flex', alignItems: 'center', gap: 16,
              background: '#0a0f18',
              border: `1px solid ${state === 'done' ? 'rgba(34,197,94,0.3)' : state === 'failed' ? 'rgba(239,68,68,0.3)' : c.border}`,
              borderLeft: `3px solid ${state === 'done' ? '#22c55e' : state === 'failed' ? '#ef4444' : c.text}`,
              borderRadius: 12,
              padding: '14px 16px',
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: state === 'done' ? 'rgba(34,197,94,0.12)' : c.bg,
              }}>
                <Icon size={18} color={state === 'done' ? '#22c55e' : c.text} />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#f0f4f8', fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{action.problem}</div>
                <div style={{ color: '#6b7f92', fontSize: 12, lineHeight: 1.4 }}>
                  {state === 'done'   ? action.successMsg :
                   state === 'failed' ? 'Action failed — please try again or contact support.' :
                   action.plain}
                </div>
              </div>

              <button
                onClick={() => state === 'idle' || state === 'failed' ? runAction(action.id) : undefined}
                disabled={state === 'running' || state === 'done'}
                style={{
                  flexShrink: 0,
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '9px 18px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  border: 'none',
                  cursor: state === 'running' || state === 'done' ? 'default' : 'pointer',
                  transition: 'opacity 0.15s',
                  ...(state === 'done'
                    ? { background: 'rgba(34,197,94,0.15)', color: '#22c55e' }
                    : state === 'failed'
                    ? { background: 'rgba(239,68,68,0.15)', color: '#ef4444' }
                    : state === 'running'
                    ? { background: 'rgba(14,165,233,0.15)', color: '#7dd3fc' }
                    : { background: '#0ea5e9', color: '#fff' }),
                }}
              >
                {state === 'running' ? (
                  <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Working…</>
                ) : state === 'done' ? (
                  <><CheckCircle2 size={14} /> Done</>
                ) : state === 'failed' ? (
                  <><XCircle size={14} /> Retry</>
                ) : (
                  <><RefreshCw size={14} /> {action.buttonLabel}</>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </Card>
  );
}

// ── Page ─────────────────────────────────────────────────────────

export default function Dashboard() {
  const online       = devices.filter(d => d.status === 'online').length;
  const activeAlerts = alerts.filter(a => !a.resolved).length;
  const date = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div style={{ padding: '24px 28px', minHeight: '100%', background: '#080b10' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ color: '#f0f4f8', fontSize: 20, fontWeight: 700, margin: 0 }}>Dashboard</h1>
          <p style={{ color: '#4a5a6a', fontSize: 13, margin: '4px 0 0' }}>{date}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {activeAlerts > 0 && (
            <Link to="/alerts" style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
              <ShieldAlert size={13} />
              {activeAlerts} active alert{activeAlerts > 1 ? 's' : ''}
            </Link>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: '#22c55e', borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 600 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e', display: 'inline-block' }} />
            Monitoring active
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ marginBottom: 14 }}>
        <QuickActionsCard />
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 14 }}>
        <KpiCard label="Download Speed" value={`${internetStatus.downloadMbps} Mbps`} sub="Starlink primary" icon={Globe} iconColor="#0ea5e9" trend="up" trendLabel="+12% vs yesterday" sparkData={dlHistory} />
        <KpiCard label="Latency" value={`${internetStatus.latencyMs} ms`} sub="Avg over last hour" icon={Zap} iconColor="#22c55e" trend="up" trendLabel="8ms better than avg" sparkData={[32,30,28,29,31,28,27,28,30,28,29,28]} />
        <KpiCard label="Devices Online" value={online} sub={`of ${devices.length} total`} icon={MonitorSmartphone} iconColor="#8b5cf6" trend="neutral" trendLabel="3 offline right now" sparkData={[20,22,21,23,22,23,22,24,23,22,23,online]} />
        <KpiCard
          label="Active Alerts"
          value={activeAlerts}
          sub="Require attention"
          icon={activeAlerts > 0 ? ShieldAlert : Eye}
          iconColor={activeAlerts > 0 ? '#ef4444' : '#22c55e'}
          trend={activeAlerts > 0 ? 'down' : 'up'}
          trendLabel={activeAlerts > 0 ? `${activeAlerts} unresolved` : 'All clear'}
          sparkData={[0,1,2,1,3,2,2,3,3,2,3,activeAlerts]}
        />
      </div>

      {/* Internet + Network health */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 14 }}>
        <InternetCard />
        <NetworkHealthCard />
      </div>

      {/* Alert feed + Device overview */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
        <AlertFeed />
        <DeviceOverviewCard />
      </div>
    </div>
  );
}
