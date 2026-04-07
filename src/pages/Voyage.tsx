import {
  Wifi,
  WifiOff,
  Activity,
  MapPin,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { alerts } from '@/data/mock';

// ── Types ─────────────────────────────────────────────────────────

type ConnStatus = 'good' | 'slow' | 'down';

interface VoyageSegment {
  date: string;
  location: string;
  region: string;
  avgDownMbps: number;
  avgLatencyMs: number;
  uptimePct: number;
  provider: 'Starlink' | 'LTE' | 'None';
  incidents: number;
  blocks: ConnStatus[];
}

// ── Mock voyage data ──────────────────────────────────────────────

const voyageLog: VoyageSegment[] = [
  {
    date: '2026-04-07', location: 'Monaco, France',       region: 'Mediterranean',
    avgDownMbps: 138, avgLatencyMs: 29, uptimePct: 99.7, provider: 'Starlink',
    incidents: 2,
    blocks: ['good','good','good','good','slow','good','good','good','down','down','good','good','good','good','good','good','slow','good','good','good','good','good','good','good'],
  },
  {
    date: '2026-04-06', location: 'Cannes, France',        region: 'Mediterranean',
    avgDownMbps: 145, avgLatencyMs: 26, uptimePct: 100,  provider: 'Starlink',
    incidents: 0,
    blocks: ['good','good','good','good','good','good','good','good','good','good','good','good','good','good','good','good','good','good','good','good','good','good','good','good'],
  },
  {
    date: '2026-04-05', location: 'Antibes, France',       region: 'Mediterranean',
    avgDownMbps: 122, avgLatencyMs: 34, uptimePct: 97.2, provider: 'Starlink',
    incidents: 3,
    blocks: ['good','good','slow','slow','down','down','slow','good','good','good','good','good','good','good','good','slow','good','good','good','good','good','good','good','good'],
  },
  {
    date: '2026-04-04', location: 'Nice, France',          region: 'Mediterranean',
    avgDownMbps: 151, avgLatencyMs: 24, uptimePct: 100,  provider: 'Starlink',
    incidents: 0,
    blocks: Array(24).fill('good') as ConnStatus[],
  },
  {
    date: '2026-04-03', location: 'Genoa, Italy',          region: 'Mediterranean',
    avgDownMbps: 88,  avgLatencyMs: 52, uptimePct: 94.1, provider: 'LTE',
    incidents: 4,
    blocks: ['slow','slow','down','down','down','slow','good','good','slow','good','good','slow','slow','down','good','good','good','good','slow','good','good','good','good','good'],
  },
  {
    date: '2026-04-02', location: 'Portofino, Italy',      region: 'Mediterranean',
    avgDownMbps: 131, avgLatencyMs: 31, uptimePct: 98.8, provider: 'Starlink',
    incidents: 1,
    blocks: ['good','good','good','good','good','good','good','good','slow','good','good','good','good','good','good','good','good','good','good','good','good','good','good','good'],
  },
  {
    date: '2026-04-01', location: 'Gibraltar Strait',      region: 'Atlantic',
    avgDownMbps: 55,  avgLatencyMs: 78, uptimePct: 88.3, provider: 'LTE',
    incidents: 6,
    blocks: ['down','down','slow','slow','slow','down','down','slow','slow','good','good','slow','good','good','slow','slow','down','good','good','good','slow','slow','good','good'],
  },
  {
    date: '2026-03-31', location: 'Barcelona, Spain',      region: 'Mediterranean',
    avgDownMbps: 142, avgLatencyMs: 27, uptimePct: 99.9, provider: 'Starlink',
    incidents: 0,
    blocks: Array(24).fill('good') as ConnStatus[],
  },
];

// ── Helpers ───────────────────────────────────────────────────────

const connColors: Record<ConnStatus, string> = { good: '#22c55e', slow: '#f59e0b', down: '#ef4444' };

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

// ── 24h block timeline ────────────────────────────────────────────

function BlockTimeline({ blocks }: { blocks: ConnStatus[] }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {blocks.map((s, i) => (
        <div key={i} title={`Hour ${i}: ${s}`} style={{
          flex: 1, height: 18, borderRadius: 3,
          background: connColors[s], opacity: 0.85,
        }} />
      ))}
    </div>
  );
}

// ── Sparkline ─────────────────────────────────────────────────────

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const w = 90, h = 30;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  });
  const line = `M${pts[0]} L${pts.join(' L')}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Summary KPIs ──────────────────────────────────────────────────

function SummaryKpis() {
  const avgUptime  = +(voyageLog.reduce((s, d) => s + d.uptimePct, 0) / voyageLog.length).toFixed(1);
  const avgDown    = Math.round(voyageLog.reduce((s, d) => s + d.avgDownMbps, 0) / voyageLog.length);
  const totalInc   = voyageLog.reduce((s, d) => s + d.incidents, 0);
  const bestDay    = [...voyageLog].sort((a, b) => b.uptimePct - a.uptimePct)[0];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
      {[
        { label: 'Avg Voyage Uptime',   value: `${avgUptime}%`,     color: '#22c55e', icon: TrendingUp,   sub: `${voyageLog.length} days tracked` },
        { label: 'Avg Download Speed',  value: `${avgDown} Mbps`,   color: '#0ea5e9', icon: Activity,    sub: 'across all locations' },
        { label: 'Total Incidents',     value: totalInc,             color: totalInc > 5 ? '#ef4444' : '#f59e0b', icon: AlertTriangle, sub: 'connection drops & slowdowns' },
        { label: 'Best Connectivity',   value: bestDay.location.split(',')[0], color: '#22c55e', icon: CheckCircle2, sub: `${bestDay.uptimePct}% uptime` },
      ].map(({ label, value, color, icon: Icon, sub }) => (
        <Card key={label}>
          <CardLabel>{label}</CardLabel>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
              <div style={{ color: '#6b7f92', fontSize: 12, marginTop: 5 }}>{sub}</div>
            </div>
            <div style={{ background: color + '18', border: `1px solid ${color}33`, borderRadius: 10, padding: 9 }}>
              <Icon size={18} color={color} />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── Voyage day row ────────────────────────────────────────────────

function VoyageRow({ segment }: { segment: VoyageSegment }) {
  const dateFormatted = new Date(segment.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const isToday       = segment.date === voyageLog[0].date;
  const uptimeColor   = segment.uptimePct >= 99 ? '#22c55e' : segment.uptimePct >= 95 ? '#f59e0b' : '#ef4444';
  const downHistory   = voyageLog.map(d => d.avgDownMbps).reverse();

  return (
    <div style={{
      background: '#0a0f18',
      border: `1px solid ${segment.incidents > 3 ? 'rgba(239,68,68,0.2)' : '#1a2535'}`,
      borderRadius: 12, padding: '14px 18px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 12 }}>
        {/* Date + location */}
        <div style={{ width: 180, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <Clock size={11} color="#4a5a6a" />
            <span style={{ color: '#4a5a6a', fontSize: 11 }}>{dateFormatted}</span>
            {isToday && <span style={{ background: 'rgba(14,165,233,0.15)', color: '#7dd3fc', borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>TODAY</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
            <MapPin size={11} color="#6b7f92" />
            <span style={{ color: '#f0f4f8', fontSize: 13, fontWeight: 600 }}>{segment.location}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            {segment.provider === 'Starlink'
              ? <Wifi size={11} color="#0ea5e9" />
              : segment.provider === 'LTE'
              ? <Activity size={11} color="#8b5cf6" />
              : <WifiOff size={11} color="#ef4444" />
            }
            <span style={{ color: '#6b7f92', fontSize: 11 }}>{segment.provider}</span>
          </div>
        </div>

        {/* Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 90px)', gap: 10 }}>
          {[
            { label: 'Uptime',    value: `${segment.uptimePct}%`, color: uptimeColor },
            { label: 'Download',  value: `${segment.avgDownMbps} Mbps`, color: '#0ea5e9' },
            { label: 'Latency',   value: `${segment.avgLatencyMs} ms`,   color: '#22c55e' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: '#0d1421', border: '1px solid #1a2535', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ color: '#4a5a6a', fontSize: 10, marginBottom: 3 }}>{label}</div>
              <div style={{ color, fontSize: 14, fontWeight: 700 }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Incidents */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {segment.incidents === 0 ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>
              <CheckCircle2 size={11} /> No incidents
            </span>
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, background: segment.incidents > 3 ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)', color: segment.incidents > 3 ? '#ef4444' : '#f59e0b', border: `1px solid ${segment.incidents > 3 ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)'}`, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>
              <AlertTriangle size={11} /> {segment.incidents} incident{segment.incidents > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div style={{ marginLeft: 'auto' }}>
          <Sparkline data={downHistory} color="#0ea5e9" />
        </div>
      </div>

      {/* 24h timeline */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ color: '#4a5a6a', fontSize: 10 }}>Connection quality — 24h</span>
          <span style={{ color: '#4a5a6a', fontSize: 10 }}>Midnight → Midnight</span>
        </div>
        <BlockTimeline blocks={segment.blocks} />
        <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
          {[['good', 'Good'], ['slow', 'Slow'], ['down', 'Down']].map(([k, l]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: connColors[k as ConnStatus] }} />
              <span style={{ color: '#4a5a6a', fontSize: 10 }}>{l}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Recent incidents feed ─────────────────────────────────────────

function IncidentFeed() {
  const incident = alerts.filter(a => a.severity !== 'info').slice(0, 5);
  return (
    <Card>
      <CardLabel>Recent Incidents</CardLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {incident.map(a => {
          const color = a.severity === 'critical' ? '#ef4444' : '#f59e0b';
          return (
            <div key={a.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              background: '#0a0f18', borderRadius: 10, padding: '10px 14px',
              borderLeft: `3px solid ${color}`,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: a.resolved ? '#6b7f92' : '#f0f4f8', fontSize: 13, fontWeight: 500 }}>{a.title}</div>
                <div style={{ color: '#4a5a6a', fontSize: 11, marginTop: 2 }}>
                  {new Date(a.timestamp).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              {a.resolved
                ? <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#22c55e', fontSize: 11 }}><CheckCircle2 size={11} /> Resolved</span>
                : <span style={{ background: color + '18', color, borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>{a.severity}</span>
              }
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────

export default function Voyage() {
  return (
    <div style={{ padding: 28, maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div>
        <div style={{ color: '#f0f4f8', fontSize: 20, fontWeight: 800, letterSpacing: 0.2 }}>Voyage Log</div>
        <div style={{ color: '#6b7f92', fontSize: 13, marginTop: 4 }}>
          Connectivity history and performance across this voyage
        </div>
      </div>

      <SummaryKpis />

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, alignItems: 'start' }}>
        {/* Timeline */}
        <Card>
          <CardLabel>Day-by-Day Connectivity</CardLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {voyageLog.map(s => <VoyageRow key={s.date} segment={s} />)}
          </div>
        </Card>

        {/* Incidents sidebar */}
        <IncidentFeed />
      </div>

    </div>
  );
}
