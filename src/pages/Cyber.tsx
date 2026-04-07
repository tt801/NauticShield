import { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Radar,
  Fingerprint,
  Lock,
  Unlock,
  Globe,
  Zap,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Clock,
  CalendarCheck,
  CalendarX,
  Laptop,
  Smartphone,
  HardDrive,
  BadgeCheck,
  BadgeAlert,
  Eye,
  EyeOff,
  Flame,
} from 'lucide-react';
import { useVesselData } from '@/context/VesselDataProvider';
import type { Device } from '@/data/mock';

// ── Design tokens ────────────────────────────────────────────────

const GOLD   = '#d4a847';
const GOLD_BG  = 'rgba(212,168,71,0.08)';
const GOLD_BORDER = 'rgba(212,168,71,0.25)';

// ── Types ─────────────────────────────────────────────────────────

type ThreatLevel    = 'critical' | 'high' | 'medium' | 'low' | 'clear';
type FirewallRule   = { id: string; name: string; direction: 'inbound' | 'outbound'; action: 'allow' | 'block'; port: string; protocol: string; enabled: boolean };
type ThreatEntry    = { id: string; deviceId?: string; deviceName: string; ip: string; type: string; detail: string; level: ThreatLevel; time: string; mitigated: boolean };
type ScanResult     = { id: string; deviceId: string; deviceName: string; ip: string; openPorts: number[]; riskPorts: number[]; manufacturer: string; flagged: boolean };
type IncidentStatus = 'open' | 'investigating' | 'contained' | 'resolved';
type Incident       = { id: string; title: string; description: string; severity: 'critical' | 'high' | 'medium'; status: IncidentStatus; opened: string; updated: string; assignee: string; slaHours: number };
type PenTest        = { id: string; label: string; date: string; result: 'pass' | 'fail' | 'scheduled'; findings: number; nextDue: string };
type ProtectionStatus = 'protected' | 'partial' | 'unprotected';
type DeviceProtection = { deviceId: string; name: string; ip: string; type: string; edr: boolean; epp: boolean; encrypted: boolean; status: ProtectionStatus };

// ── Static premium data ───────────────────────────────────────────

const defaultFirewallRules: FirewallRule[] = [
  { id: 'fw1', name: 'Block Telnet',       direction: 'inbound',  action: 'block', port: '23',   protocol: 'TCP', enabled: true  },
  { id: 'fw2', name: 'Block RDP',          direction: 'inbound',  action: 'block', port: '3389', protocol: 'TCP', enabled: true  },
  { id: 'fw3', name: 'Allow HTTPS',        direction: 'outbound', action: 'allow', port: '443',  protocol: 'TCP', enabled: true  },
  { id: 'fw4', name: 'Allow DNS',          direction: 'outbound', action: 'allow', port: '53',   protocol: 'UDP', enabled: true  },
  { id: 'fw5', name: 'Block SMB',          direction: 'inbound',  action: 'block', port: '445',  protocol: 'TCP', enabled: true  },
  { id: 'fw6', name: 'Block Telnet (out)', direction: 'outbound', action: 'block', port: '23',   protocol: 'TCP', enabled: false },
];

const mockThreats: ThreatEntry[] = [
  { id: 't1', deviceName: 'Unknown Device',    ip: '192.168.0.138', type: 'Rogue Device',          detail: 'Unrecognised MAC — no hostname, probe requests to 5 SSIDs', level: 'critical', time: new Date(Date.now() - 1000*60*4).toISOString(),  mitigated: false },
  { id: 't2', deviceName: 'Samsung Smart TV',  ip: '192.168.0.42',  type: 'Telemetry Beacon',      detail: 'Outbound connections to Samsung analytics on port 4443',     level: 'medium',   time: new Date(Date.now() - 1000*60*22).toISOString(), mitigated: false },
  { id: 't3', deviceName: 'Guest MacBook Pro', ip: '192.168.0.77',  type: 'Port Scan Detected',    detail: 'Swept ports 22, 80, 443, 8080 on 3 internal hosts',           level: 'high',     time: new Date(Date.now() - 1000*60*48).toISOString(), mitigated: false },
  { id: 't4', deviceName: 'IP Camera #3',      ip: '192.168.0.91',  type: 'Known CVE (CVE-2023-1)', detail: 'Hikvision firmware v3.2.1 — unauthenticated RCE vulnerability',level: 'critical', time: new Date(Date.now() - 1000*60*120).toISOString(),mitigated: true  },
  { id: 't5', deviceName: 'Starlink Router',   ip: '192.168.0.1',   type: 'Default Credentials',   detail: 'Admin interface reachable with default factory password',      level: 'high',     time: new Date(Date.now() - 1000*60*200).toISOString(),mitigated: true  },
];

const RISK_PORTS = [21, 22, 23, 25, 53, 80, 110, 135, 139, 143, 443, 445, 3389, 8080, 8443];

// Incident log
const mockIncidents: Incident[] = [
  {
    id: 'i1', title: 'Rogue Device Detected on Guest VLAN',
    description: 'Unknown MAC address B6:90:FA:FD:FE:D5 began probing internal hosts. Device has no hostname and is not registered in any allowlist.',
    severity: 'critical', status: 'investigating',
    opened: new Date(Date.now() - 1000*60*60*3).toISOString(),
    updated: new Date(Date.now() - 1000*60*18).toISOString(),
    assignee: 'NauticShield SOC', slaHours: 4,
  },
  {
    id: 'i2', title: 'Port Scan from Guest MacBook',
    description: 'Guest device 192.168.0.77 swept ports 22, 80, 443, 8080 on three internal hosts over a 2-minute window.',
    severity: 'high', status: 'contained',
    opened: new Date(Date.now() - 1000*60*60*27).toISOString(),
    updated: new Date(Date.now() - 1000*60*60*5).toISOString(),
    assignee: 'Alex Thompson', slaHours: 8,
  },
  {
    id: 'i3', title: 'Hikvision Camera CVE-2023-1 Detected',
    description: 'IP Camera #3 running firmware v3.2.1 is vulnerable to unauthenticated RCE. Camera isolated from main LAN pending firmware update.',
    severity: 'critical', status: 'resolved',
    opened: new Date(Date.now() - 1000*60*60*72).toISOString(),
    updated: new Date(Date.now() - 1000*60*60*48).toISOString(),
    assignee: 'NauticShield SOC', slaHours: 4,
  },
  {
    id: 'i4', title: 'Starlink Admin Panel Default Credentials',
    description: 'Starlink router admin interface accessible with default factory credentials. Password updated and remote management disabled.',
    severity: 'high', status: 'resolved',
    opened: new Date(Date.now() - 1000*60*60*120).toISOString(),
    updated: new Date(Date.now() - 1000*60*60*96).toISOString(),
    assignee: 'Alex Thompson', slaHours: 8,
  },
];

// Pen test schedule
const mockPenTests: PenTest[] = [
  { id: 'pt1', label: 'Annual Pen Test — Q1 2026', date: '2026-03-15', result: 'pass',      findings: 2, nextDue: '2027-03-15' },
  { id: 'pt2', label: 'Annual Pen Test — Q1 2025', date: '2025-03-10', result: 'pass',      findings: 4, nextDue: '2026-03-10' },
  { id: 'pt3', label: 'Annual Pen Test — Q1 2024', date: '2024-03-08', result: 'fail',      findings: 7, nextDue: '2025-03-08' },
  { id: 'pt4', label: 'Annual Pen Test — Q2 2026', date: '2026-06-01', result: 'scheduled', findings: 0, nextDue: '2026-06-01' },
];

// Device protection coverage (built from live devices)
function buildProtection(devices: Device[]): DeviceProtection[] {
  return devices.map(d => {
    const seed = Array.from(d.mac || d.id).reduce((a, c) => a + c.charCodeAt(0), 0);
    const edr       = d.type !== 'unknown' && (seed % 3) !== 0;
    const epp       = d.type !== 'unknown' && (seed % 4) !== 0;
    const encrypted = d.type !== 'unknown' && (seed % 5) !== 0;
    const status: ProtectionStatus =
      (!edr && !epp) ? 'unprotected' :
      (!edr || !epp) ? 'partial' : 'protected';
    return { deviceId: d.id, name: d.name, ip: d.ip, type: d.type, edr, epp, encrypted, status };
  });
}

function buildScanResults(devices: Device[]): ScanResult[] {
  return devices.filter(d => d.status === 'online').map(d => {
    const seed = Array.from(d.mac || '').reduce((a, c) => a + c.charCodeAt(0), 0);
    const openPorts = RISK_PORTS.filter((_, i) => ((seed + i * 7) % 5) === 0);
    const riskPorts = openPorts.filter(p => [23, 3389, 445, 135, 139].includes(p));
    return {
      id: d.id,
      deviceId: d.id,
      deviceName: d.name,
      ip: d.ip,
      openPorts,
      riskPorts,
      manufacturer: d.manufacturer || 'Unknown',
      flagged: riskPorts.length > 0 || d.type === 'unknown',
    };
  });
}

// ── Helpers ───────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const threatConfig: Record<ThreatLevel, { label: string; color: string; bg: string; border: string }> = {
  critical: { label: 'Critical', color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.3)'  },
  high:     { label: 'High',     color: '#f97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.3)' },
  medium:   { label: 'Medium',   color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.3)' },
  low:      { label: 'Low',      color: '#0ea5e9', bg: 'rgba(14,165,233,0.08)', border: 'rgba(14,165,233,0.3)' },
  clear:    { label: 'Clear',    color: '#22c55e', bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.3)'  },
};

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
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: '#4a5a6a', marginBottom: 14 }}>
      {children}
    </div>
  );
}

function PremiumBadge() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: GOLD_BG, color: GOLD, border: `1px solid ${GOLD_BORDER}`,
      borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
    }}>
      ✦ Premium
    </span>
  );
}

// ── Threat Score Ring ─────────────────────────────────────────────

function ThreatRing({ score }: { score: number }) {
  const r = 54, cx = 62, cy = 62;
  const circumference = 2 * Math.PI * r;
  const danger = 100 - score; // higher danger = worse
  const color  = danger < 20 ? '#22c55e' : danger < 50 ? '#f59e0b' : '#ef4444';
  const label  = danger < 20 ? 'Secure' : danger < 50 ? 'Elevated' : 'At Risk';
  const offset = circumference * (1 - danger / 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
      <svg width={124} height={124}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1a2535" strokeWidth={10} />
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <text x={cx} y={cy - 6} textAnchor="middle" fill={color} fontSize={22} fontWeight={800}>{danger}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fill="#6b7f92" fontSize={11}>{label}</text>
      </svg>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 12, color: '#8899aa' }}>Threat exposure score</div>
        <div style={{ fontSize: 11, color: '#4a5a6a' }}>Updated every 30s</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
          {[
            { label: 'Rogue devices',    val: mockThreats.filter(t => t.type === 'Rogue Device'  && !t.mitigated).length, c: '#ef4444' },
            { label: 'Active CVEs',      val: mockThreats.filter(t => t.type.includes('CVE')     && !t.mitigated).length, c: '#f97316' },
            { label: 'Anomalies',        val: mockThreats.filter(t => !t.mitigated).length,                                c: '#f59e0b' },
          ].map(({ label, val, c }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: c, flexShrink: 0 }} />
              <span style={{ color: '#6b7f92', fontSize: 11 }}>{label}</span>
              <span style={{ color: val > 0 ? c : '#22c55e', fontWeight: 700, fontSize: 12, marginLeft: 'auto' }}>{val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Threat feed row ───────────────────────────────────────────────

function ThreatRow({ threat, onMitigate }: { threat: ThreatEntry; onMitigate: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const c = threatConfig[threat.level];

  return (
    <div style={{
      background: '#0a0f18',
      border: `1px solid ${threat.mitigated ? '#1a2535' : c.border}`,
      borderLeft: `3px solid ${threat.mitigated ? '#1a2535' : c.color}`,
      borderRadius: 12, overflow: 'hidden',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 12, padding: '13px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: threat.mitigated ? 'rgba(34,197,94,0.1)' : c.bg }}>
          {threat.mitigated ? <ShieldCheck size={15} color="#22c55e" /> : <ShieldAlert size={15} color={c.color} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ background: threat.mitigated ? 'rgba(34,197,94,0.1)' : c.bg, color: threat.mitigated ? '#22c55e' : c.color, border: `1px solid ${threat.mitigated ? 'rgba(34,197,94,0.3)' : c.border}`, borderRadius: 20, padding: '2px 9px', fontSize: 10, fontWeight: 700 }}>
              {threat.mitigated ? 'Mitigated' : c.label}
            </span>
            <span style={{ color: '#6b7f92', fontSize: 11, fontFamily: 'monospace' }}>{threat.type}</span>
          </div>
          <div style={{ color: threat.mitigated ? '#6b7f92' : '#f0f4f8', fontSize: 13, fontWeight: 500 }}>{threat.deviceName} — {threat.ip}</div>
          <div style={{ color: '#4a5a6a', fontSize: 11, marginTop: 2 }}>{timeAgo(threat.time)}</div>
        </div>
        <div style={{ color: '#4a5a6a', flexShrink: 0 }}>{open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</div>
      </button>
      {open && (
        <div style={{ borderTop: '1px solid #1a2535', padding: '12px 16px 14px 60px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
          <span style={{ color: '#8899aa', fontSize: 13, lineHeight: 1.6 }}>{threat.detail}</span>
          {!threat.mitigated && (
            <button
              onClick={() => onMitigate(threat.id)}
              style={{ flexShrink: 0, background: GOLD_BG, color: GOLD, border: `1px solid ${GOLD_BORDER}`, borderRadius: 8, padding: '5px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              Mitigate
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Port scan table ───────────────────────────────────────────────

function PortScanTable({ results }: { results: ScanResult[] }) {
  const flagged = results.filter(r => r.flagged);
  const clean   = results.filter(r => !r.flagged);

  return (
    <Card>
      <CardLabel>Port Exposure Scan — {results.length} devices</CardLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[...flagged, ...clean].map(r => (
          <div key={r.id} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: '#080b10',
            border: `1px solid ${r.flagged ? 'rgba(249,115,22,0.2)' : '#1a2535'}`,
            borderRadius: 10, padding: '10px 14px',
          }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: r.flagged ? 'rgba(249,115,22,0.1)' : 'rgba(34,197,94,0.07)', flexShrink: 0 }}>
              {r.flagged ? <ShieldX size={13} color="#f97316" /> : <ShieldCheck size={13} color="#22c55e" />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#f0f4f8', fontSize: 13, fontWeight: 500 }}>{r.deviceName}</div>
              <div style={{ color: '#4a5a6a', fontSize: 11, fontFamily: 'monospace' }}>{r.ip} · {r.manufacturer}</div>
            </div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 220 }}>
              {r.openPorts.length === 0 && (
                <span style={{ color: '#22c55e', fontSize: 11 }}>No open ports</span>
              )}
              {r.openPorts.map(p => (
                <span key={p} style={{
                  background: r.riskPorts.includes(p) ? 'rgba(249,115,22,0.12)' : 'rgba(14,165,233,0.08)',
                  color: r.riskPorts.includes(p) ? '#f97316' : '#7dd3fc',
                  border: `1px solid ${r.riskPorts.includes(p) ? 'rgba(249,115,22,0.3)' : 'rgba(14,165,233,0.2)'}`,
                  borderRadius: 5, padding: '1px 7px', fontSize: 11, fontFamily: 'monospace',
                }}>
                  {p}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Firewall rules ────────────────────────────────────────────────

function FirewallPanel({ rules, onToggle }: { rules: FirewallRule[]; onToggle: (id: string) => void }) {
  return (
    <Card>
      <CardLabel>Firewall Rules — {rules.filter(r => r.enabled).length} active</CardLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rules.map(r => (
          <div key={r.id} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: '#080b10', border: '1px solid #1a2535', borderRadius: 10, padding: '10px 14px',
            opacity: r.enabled ? 1 : 0.45,
          }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: r.action === 'block' ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.08)', flexShrink: 0 }}>
              {r.action === 'block' ? <Lock size={13} color="#ef4444" /> : <Unlock size={13} color="#22c55e" />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#f0f4f8', fontSize: 13, fontWeight: 500 }}>{r.name}</div>
              <div style={{ color: '#4a5a6a', fontSize: 11, marginTop: 1 }}>
                {r.direction} · port {r.port} · {r.protocol}
              </div>
            </div>
            <span style={{ background: r.action === 'block' ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.08)', color: r.action === 'block' ? '#ef4444' : '#22c55e', borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>
              {r.action.toUpperCase()}
            </span>
            <button
              onClick={() => onToggle(r.id)}
              style={{
                width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', padding: 0,
                background: r.enabled ? '#22c55e' : '#1a2535', position: 'relative', flexShrink: 0,
                transition: 'background 0.2s',
              }}
            >
              <div style={{
                position: 'absolute', top: 2, width: 16, height: 16, borderRadius: '50%',
                background: '#f0f4f8',
                left: r.enabled ? 18 : 2,
                transition: 'left 0.2s',
              }} />
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Traffic monitor ───────────────────────────────────────────────

function TrafficMonitor() {
  const [masked, setMasked] = useState(true);
  const samples = [38, 52, 41, 67, 55, 49, 72, 61, 44, 58, 65, 53, 70, 48, 56, 62, 75, 59, 43, 68, 57, 50, 64, 71];
  const max = Math.max(...samples);

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <CardLabel>Traffic Anomaly Monitor</CardLabel>
        <button
          onClick={() => setMasked(m => !m)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px solid #1a2535', borderRadius: 8, padding: '4px 10px', color: '#6b7f92', fontSize: 11, cursor: 'pointer' }}
        >
          {masked ? <Eye size={12} /> : <EyeOff size={12} />}
          {masked ? 'Reveal IPs' : 'Mask IPs'}
        </button>
      </div>

      {/* Sparkline */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 56, marginBottom: 16 }}>
        {samples.map((v, i) => {
          const h = Math.max(4, Math.round((v / max) * 54));
          const isSpike = v > 68;
          return (
            <div key={i} style={{ flex: 1, height: h, borderRadius: 3, background: isSpike ? '#ef4444' : 'rgba(14,165,233,0.35)', transition: 'height 0.3s' }} title={`${v} Mbps`} />
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4a5a6a', fontSize: 10, marginBottom: 14 }}>
        <span>24h ago</span><span>Now</span>
      </div>

      {/* Anomaly rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[
          { name: masked ? '192.168.0.██' : '192.168.0.138', label: 'High outbound to 104.21.x', spike: '74 Mbps', color: '#ef4444' },
          { name: masked ? '192.168.0.██' : '192.168.0.77',  label: 'Repeated DNS queries (>200/min)', spike: '71 Mbps', color: '#f97316' },
        ].map(r => (
          <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#080b10', borderRadius: 10, padding: '9px 13px', borderLeft: `3px solid ${r.color}` }}>
            <Flame size={13} color={r.color} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ color: '#f0f4f8', fontSize: 12, fontWeight: 500 }}>{r.name} — {r.label}</div>
            </div>
            <span style={{ color: r.color, fontSize: 12, fontWeight: 700 }}>{r.spike}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Incident log ─────────────────────────────────────────────────

const incidentStatusConfig: Record<IncidentStatus, { label: string; color: string; bg: string }> = {
  open:          { label: 'Open',          color: '#ef4444', bg: 'rgba(239,68,68,0.1)'  },
  investigating: { label: 'Investigating', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  contained:     { label: 'Contained',     color: '#0ea5e9', bg: 'rgba(14,165,233,0.1)' },
  resolved:      { label: 'Resolved',      color: '#22c55e', bg: 'rgba(34,197,94,0.1)'  },
};

function slaHoursElapsed(opened: string) {
  return Math.floor((Date.now() - new Date(opened).getTime()) / (1000 * 60 * 60));
}

function IncidentLog({ incidents, onUpdateStatus }: { incidents: Incident[]; onUpdateStatus: (id: string, s: IncidentStatus) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const active = incidents.filter(i => i.status !== 'resolved');
  const resolved = incidents.filter(i => i.status === 'resolved');

  function IncidentRow({ inc }: { inc: Incident }) {
    const elapsed  = slaHoursElapsed(inc.opened);
    const slaBreached = elapsed > inc.slaHours && inc.status !== 'resolved';
    const sc = incidentStatusConfig[inc.status];
    const expanded = open === inc.id;
    const nextStatuses: IncidentStatus[] = inc.status === 'open' ? ['investigating'] :
      inc.status === 'investigating' ? ['contained', 'resolved'] :
      inc.status === 'contained' ? ['resolved'] : [];

    return (
      <div style={{
        background: '#0a0f18',
        border: `1px solid ${slaBreached ? 'rgba(239,68,68,0.3)' : '#1a2535'}`,
        borderLeft: `3px solid ${sc.color}`,
        borderRadius: 12, overflow: 'hidden',
      }}>
        <button
          onClick={() => setOpen(expanded ? null : inc.id)}
          style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 12, padding: '13px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
        >
          <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: sc.bg }}>
            <ClipboardList size={15} color={sc.color} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ background: sc.bg, color: sc.color, borderRadius: 20, padding: '2px 9px', fontSize: 10, fontWeight: 700 }}>{sc.label}</span>
              {slaBreached && (
                <span style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: 20, padding: '2px 9px', fontSize: 10, fontWeight: 700 }}>
                  SLA BREACHED +{elapsed - inc.slaHours}h
                </span>
              )}
              <span style={{ color: '#4a5a6a', fontSize: 11 }}>SLA: {inc.slaHours}h · {elapsed}h elapsed</span>
            </div>
            <div style={{ color: '#f0f4f8', fontSize: 13, fontWeight: 500 }}>{inc.title}</div>
            <div style={{ display: 'flex', gap: 12, marginTop: 3 }}>
              <span style={{ color: '#4a5a6a', fontSize: 11 }}>Assignee: {inc.assignee}</span>
              <span style={{ color: '#4a5a6a', fontSize: 11 }}>Updated: {timeAgo(inc.updated)}</span>
            </div>
          </div>
          <div style={{ color: '#4a5a6a', flexShrink: 0 }}>{expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</div>
        </button>
        {expanded && (
          <div style={{ borderTop: '1px solid #1a2535', padding: '12px 16px 14px 60px' }}>
            <p style={{ color: '#8899aa', fontSize: 13, lineHeight: 1.6, margin: '0 0 12px' }}>{inc.description}</p>
            {nextStatuses.length > 0 && (
              <div style={{ display: 'flex', gap: 8 }}>
                {nextStatuses.map(s => (
                  <button key={s} onClick={() => onUpdateStatus(inc.id, s)} style={{
                    background: incidentStatusConfig[s].bg, color: incidentStatusConfig[s].color,
                    border: `1px solid ${incidentStatusConfig[s].color}40`, borderRadius: 8,
                    padding: '5px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  }}>
                    Mark {incidentStatusConfig[s].label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <CardLabel>Incident Log — {active.length} active</CardLabel>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['open','investigating','contained'] as IncidentStatus[]).map(s => {
            const count = incidents.filter(i => i.status === s).length;
            if (!count) return null;
            const c = incidentStatusConfig[s];
            return <span key={s} style={{ background: c.bg, color: c.color, borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 700 }}>{count} {c.label}</span>;
          })}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[...active, ...resolved].map(i => <IncidentRow key={i.id} inc={i} />)}
      </div>
    </Card>
  );
}

// ── Pen test schedule ─────────────────────────────────────────────

function PenTestPanel({ tests }: { tests: PenTest[] }) {
  const next = tests.find(t => t.result === 'scheduled');
  const daysUntil = next ? Math.ceil((new Date(next.date).getTime() - Date.now()) / (1000*60*60*24)) : null;

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <CardLabel>Penetration Test Schedule</CardLabel>
        {next && (
          <span style={{ background: GOLD_BG, color: GOLD, border: `1px solid ${GOLD_BORDER}`, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>
            Next in {daysUntil}d
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tests.map(t => {
          const isScheduled = t.result === 'scheduled';
          const color = t.result === 'pass' ? '#22c55e' : t.result === 'fail' ? '#ef4444' : GOLD;
          const Icon  = t.result === 'pass' ? CalendarCheck : t.result === 'fail' ? CalendarX : Clock;
          return (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: '#080b10', borderRadius: 10, padding: '11px 14px',
              border: `1px solid ${isScheduled ? GOLD_BORDER : '#1a2535'}`,
              opacity: isScheduled ? 1 : 0.85,
            }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${color}18`, flexShrink: 0 }}>
                <Icon size={14} color={color} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#f0f4f8', fontSize: 13, fontWeight: 500 }}>{t.label}</div>
                <div style={{ color: '#4a5a6a', fontSize: 11, marginTop: 2 }}>
                  {isScheduled ? `Scheduled for ${new Date(t.date).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}` :
                    `Completed ${new Date(t.date).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })} · Next due ${new Date(t.nextDue).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}`}
                </div>
              </div>
              {!isScheduled && (
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span style={{ background: `${color}18`, color, borderRadius: 6, padding: '2px 9px', fontSize: 11, fontWeight: 700 }}>
                    {t.result === 'pass' ? 'PASS' : 'FAIL'}
                  </span>
                  {t.findings > 0 && (
                    <div style={{ color: '#4a5a6a', fontSize: 11, marginTop: 3 }}>{t.findings} finding{t.findings > 1 ? 's' : ''}</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 14, padding: '10px 14px', background: '#080b10', borderRadius: 10, border: '1px solid #1a2535' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={13} color="#22c55e" />
          <span style={{ color: '#8899aa', fontSize: 12 }}>Annual cadence recommended for low-sensitivity yacht environments. Quarterly testing is unnecessary at this risk level.</span>
        </div>
      </div>
    </Card>
  );
}

// ── Device protection coverage ────────────────────────────────────

function ProtectionCoverage({ coverage }: { coverage: DeviceProtection[] }) {
  const protected_  = coverage.filter(d => d.status === 'protected').length;
  const partial     = coverage.filter(d => d.status === 'partial').length;
  const unprotected = coverage.filter(d => d.status === 'unprotected').length;
  const pct = coverage.length ? Math.round((protected_ / coverage.length) * 100) : 0;

  const typeIcon = (type: string) => {
    if (type === 'laptop') return Laptop;
    if (type === 'phone') return Smartphone;
    return HardDrive;
  };

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <CardLabel>Endpoint Protection Coverage</CardLabel>
        <span style={{ fontSize: 22, fontWeight: 800, color: pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444' }}>{pct}%</span>
      </div>

      {/* Coverage bar */}
      <div style={{ display: 'flex', gap: 2, height: 8, borderRadius: 6, overflow: 'hidden', marginBottom: 10 }}>
        <div style={{ flex: protected_, background: '#22c55e', transition: 'flex 0.4s' }} />
        <div style={{ flex: partial, background: '#f59e0b', transition: 'flex 0.4s' }} />
        <div style={{ flex: unprotected, background: '#ef4444', transition: 'flex 0.4s' }} />
      </div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        {[
          { label: 'Protected',   count: protected_,  color: '#22c55e' },
          { label: 'Partial',     count: partial,     color: '#f59e0b' },
          { label: 'Unprotected', count: unprotected, color: '#ef4444' },
        ].map(({ label, count, color }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
            <span style={{ color: '#6b7f92', fontSize: 11 }}>{count} {label}</span>
          </div>
        ))}
      </div>

      {/* Column headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 60px 80px 90px', gap: 8, padding: '0 4px', marginBottom: 6 }}>
        {['Device', 'EDR', 'EPP', 'Encrypted', 'Status'].map(h => (
          <div key={h} style={{ color: '#3a4a5a', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</div>
        ))}
      </div>

      {/* Device rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 280, overflowY: 'auto' }}>
        {coverage.map(d => {
          const Icon = typeIcon(d.type);
          const sc = d.status === 'protected' ? { color: '#22c55e', label: 'Protected' } :
                     d.status === 'partial'    ? { color: '#f59e0b', label: 'Partial' } :
                                                 { color: '#ef4444', label: 'Exposed' };
          return (
            <div key={d.deviceId} style={{
              display: 'grid', gridTemplateColumns: '1fr 60px 60px 80px 90px', gap: 8, alignItems: 'center',
              background: '#080b10', borderRadius: 8, padding: '8px 10px',
              border: `1px solid ${d.status === 'unprotected' ? 'rgba(239,68,68,0.15)' : '#1a2535'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <Icon size={13} color="#4a5a6a" style={{ flexShrink: 0 }} />
                <span style={{ color: '#f0f4f8', fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
              </div>
              {[d.edr, d.epp, d.encrypted].map((ok, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'center' }}>
                  {ok ? <BadgeCheck size={14} color="#22c55e" /> : <BadgeAlert size={14} color="#ef4444" />}
                </div>
              ))}
              <span style={{ background: `${sc.color}18`, color: sc.color, borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 700, textAlign: 'center' }}>
                {sc.label}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── Page ─────────────────────────────────────────────────────────

export default function Cyber() {
  const { devices } = useVesselData();
  const [threats,   setThreats]   = useState<ThreatEntry[]>(mockThreats);
  const [fwRules,   setFwRules]   = useState<FirewallRule[]>(defaultFirewallRules);
  const [incidents, setIncidents] = useState<Incident[]>(mockIncidents);
  const [scanOpen,  setScanOpen]  = useState(false);

  const scanResults   = buildScanResults(devices);
  const coverage      = buildProtection(devices);
  const activeThreats = threats.filter(t => !t.mitigated);
  const activeIncidents = incidents.filter(i => i.status !== 'resolved');
  const overallDanger = Math.min(100, activeThreats.length * 18 + scanResults.filter(r => r.flagged).length * 6);
  const protectedPct  = coverage.length ? Math.round((coverage.filter(d => d.status === 'protected').length / coverage.length) * 100) : 0;

  function mitigate(id: string) {
    setThreats(ts => ts.map(t => t.id === id ? { ...t, mitigated: true } : t));
  }
  function toggleRule(id: string) {
    setFwRules(rs => rs.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  }
  function updateIncident(id: string, status: IncidentStatus) {
    setIncidents(prev => prev.map(i => i.id === id ? { ...i, status, updated: new Date().toISOString() } : i));
  }

  return (
    <div style={{ padding: 28, maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ color: '#f0f4f8', fontSize: 20, fontWeight: 800, letterSpacing: 0.2 }}>Cyber Management</div>
            <PremiumBadge />
          </div>
          <div style={{ color: '#6b7f92', fontSize: 13, marginTop: 4 }}>
            Real-time threat detection, port scanning and firewall control
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => setScanOpen(o => !o)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: GOLD_BG, color: GOLD, border: `1px solid ${GOLD_BORDER}`, borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            <Radar size={15} /> {scanOpen ? 'Hide Port Scan' : 'Run Port Scan'}
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {[
          { label: 'Active Threats',    value: activeThreats.length,                                   icon: ShieldAlert,   color: activeThreats.length > 0 ? '#ef4444' : '#22c55e' },
          { label: 'Open Incidents',    value: activeIncidents.length,                                 icon: ClipboardList, color: activeIncidents.length > 0 ? '#f97316' : '#22c55e' },
          { label: 'Endpoint Coverage', value: `${protectedPct}%`,                                     icon: ShieldCheck,   color: protectedPct >= 80 ? '#22c55e' : protectedPct >= 50 ? '#f59e0b' : '#ef4444' },
          { label: 'Firewall Rules',    value: `${fwRules.filter(r => r.enabled).length}/${fwRules.length}`, icon: Lock,     color: GOLD },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.1, textTransform: 'uppercase', color: '#4a5a6a' }}>{label}</div>
              <Icon size={14} color={color} />
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
          </Card>
        ))}
      </div>

      {/* Threat score + feed */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 14 }}>

        {/* Score */}
        <Card style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <CardLabel>Vessel Threat Score</CardLabel>
          <ThreatRing score={100 - overallDanger} />
          <div style={{ borderTop: '1px solid #1a2535', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'Encryption',       ok: true  },
              { label: 'Firewall active',  ok: fwRules.some(r => r.enabled && r.action === 'block') },
              { label: 'No rogue devices', ok: !threats.some(t => t.type === 'Rogue Device' && !t.mitigated) },
              { label: 'CVE free',         ok: !threats.some(t => t.type.includes('CVE') && !t.mitigated) },
            ].map(({ label, ok }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {ok ? <CheckCircle2 size={13} color="#22c55e" /> : <AlertTriangle size={13} color="#f59e0b" />}
                <span style={{ color: ok ? '#8899aa' : '#f0f4f8', fontSize: 12 }}>{label}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Threat feed */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <CardLabel>Threat Intelligence Feed</CardLabel>
            <div style={{ display: 'flex', gap: 6 }}>
              <span style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 700 }}>
                {threats.filter(t => (t.level === 'critical' || t.level === 'high') && !t.mitigated).length} high priority
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {threats.map(t => <ThreatRow key={t.id} threat={t} onMitigate={mitigate} />)}
          </div>
        </Card>
      </div>

      {/* Port scan (toggleable) */}
      {scanOpen && <PortScanTable results={scanResults} />}

      {/* Traffic + Firewall side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <TrafficMonitor />
        <FirewallPanel rules={fwRules} onToggle={toggleRule} />
      </div>

      {/* Incident log */}
      <IncidentLog incidents={incidents} onUpdateStatus={updateIncident} />

      {/* Pen test + Coverage side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <PenTestPanel tests={mockPenTests} />
        <ProtectionCoverage coverage={coverage} />
      </div>

      {/* Recommendations */}
      <Card style={{ border: `1px solid ${GOLD_BORDER}`, background: `linear-gradient(135deg, #0d1421 80%, rgba(212,168,71,0.04))` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <Fingerprint size={16} color={GOLD} />
          <CardLabel>AI Security Recommendations</CardLabel>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { icon: ShieldX,    color: '#ef4444', text: 'Isolate device 192.168.0.138 — unrecognised MAC with active probe requests. Block at switch level.' },
            { icon: Globe,      color: '#f97316', text: 'Enable outbound traffic filtering. Samsung TV is beaconing to analytics servers on non-standard ports.' },
            { icon: TrendingUp, color: '#f59e0b', text: 'Update Hikvision camera firmware immediately — CVE-2023-1 allows unauthenticated remote code execution.' },
            { icon: Zap,        color: GOLD,      text: 'Consider enabling Starlink Enhanced Security Mode to block inbound unsolicited traffic before it reaches the LAN.' },
          ].map(({ icon: Icon, color, text }) => (
            <div key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: '#080b10', borderRadius: 10, padding: '12px 14px', border: '1px solid #1a2535' }}>
              <Icon size={14} color={color} style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ color: '#8899aa', fontSize: 13, lineHeight: 1.6 }}>{text}</span>
            </div>
          ))}
        </div>
      </Card>

    </div>
  );
}
