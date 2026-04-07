import {
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Wifi,
  MonitorSmartphone,
  Printer,
  Activity,
} from 'lucide-react';
import { alerts, devices, internetStatus, networkHealth } from '@/data/mock';

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
  const now     = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  const activeAlerts   = alerts.filter(a => !a.resolved);
  const resolvedAlerts = alerts.filter(a => a.resolved);
  const criticalCount  = activeAlerts.filter(a => a.severity === 'critical').length;
  const warningCount   = activeAlerts.filter(a => a.severity === 'warning').length;
  const offlineDevices = devices.filter(d => d.status === 'offline');
  const unknownDevices = devices.filter(d => d.type === 'unknown');
  const onlineDevices  = devices.filter(d => d.status === 'online');

  const summaryText = (() => {
    const parts: string[] = [];
    if (criticalCount > 0) parts.push(`${criticalCount} critical issue${criticalCount > 1 ? 's' : ''} require immediate action`);
    if (warningCount  > 0) parts.push(`${warningCount} warning${warningCount > 1 ? 's' : ''} noted`);
    if (offlineDevices.length > 0) parts.push(`${offlineDevices.length} device${offlineDevices.length > 1 ? 's' : ''} offline`);
    if (unknownDevices.length > 0) parts.push(`${unknownDevices.length} unrecognised device${unknownDevices.length > 1 ? 's' : ''} on the network`);
    if (parts.length === 0) return 'All monitored systems are operating normally. No issues detected.';
    return parts.join(', ') + '. ' + (criticalCount > 0 ? 'Immediate crew action is recommended.' : 'Crew awareness is advised.');
  })();

  return (
    <div style={{ padding: 28, maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ color: '#f0f4f8', fontSize: 20, fontWeight: 800, letterSpacing: 0.2 }}>Owner Report</div>
          <div style={{ color: '#6b7f92', fontSize: 13, marginTop: 4 }}>
            Generated {dateStr} at {timeStr}
          </div>
        </div>
        <button
          onClick={() => window.print()}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#0ea5e9', color: '#fff', border: 'none',
            borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <Printer size={15} /> Export / Print
        </button>
      </div>

      {/* Overall health */}
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

      {/* Footer */}
      <div style={{ textAlign: 'center', color: '#2a3a50', fontSize: 12, paddingBottom: 8 }}>
        NauticShield · Vessel Technology Report · {dateStr}
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          button { display: none !important; }
        }
      `}</style>
    </div>
  );
}
