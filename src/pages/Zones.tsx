import { useState } from 'react';
import {
  Smartphone,
  Laptop,
  Tv,
  Camera,
  Router,
  HelpCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { devices } from '@/data/mock';
import type { DeviceStatus, DeviceType } from '@/data/mock';

// ── Helpers ───────────────────────────────────────────────────────

const typeIcons: Record<DeviceType, React.ElementType> = {
  phone:   Smartphone,
  laptop:  Laptop,
  tv:      Tv,
  camera:  Camera,
  router:  Router,
  unknown: HelpCircle,
};

const statusColors: Record<DeviceStatus, { color: string; label: string; glow: string }> = {
  online:  { color: '#22c55e', label: 'Online',  glow: 'rgba(34,197,94,0.4)'  },
  offline: { color: '#ef4444', label: 'Offline', glow: 'rgba(239,68,68,0.4)'  },
  unknown: { color: '#f59e0b', label: 'Unknown', glow: 'rgba(245,158,11,0.4)' },
};

// ── Zone definitions ──────────────────────────────────────────────

interface Zone {
  id: string;
  label: string;
  deck: string;
  description: string;
  emoji: string;
}

const zones: Zone[] = [
  { id: 'Bridge',        label: 'Bridge',           deck: 'Fly Bridge / Wheelhouse', description: 'Navigation, helm controls, AV',         emoji: '🧭' },
  { id: 'Main Salon',    label: 'Main Salon',        deck: 'Main Deck',               description: 'Guest entertainment & relaxation',      emoji: '🛋️' },
  { id: 'Guest Suite 1', label: 'Guest Suite 1',     deck: 'Lower Deck',              description: 'Primary guest cabin & AV',              emoji: '🛏️' },
  { id: 'Guest Suite 2', label: 'Guest Suite 2',     deck: 'Lower Deck',              description: 'Secondary guest cabin & AV',            emoji: '🛏️' },
  { id: 'Engine Room',   label: 'Engine Room',       deck: 'Below Deck',              description: 'Engineering systems & monitoring',      emoji: '⚙️' },
  { id: 'Bow Deck',      label: 'Bow Deck',          deck: 'Upper Deck',              description: 'Forward outdoor area & WiFi coverage',  emoji: '⚓' },
  { id: 'Stern Deck',    label: 'Stern Deck',        deck: 'Upper Deck',              description: 'Aft outdoor area & WiFi coverage',      emoji: '🌊' },
  { id: 'Crew Quarters', label: 'Crew Quarters',     deck: 'Lower Deck',              description: 'Crew accommodation & devices',          emoji: '👥' },
  { id: 'Fly Bridge',    label: 'Fly Bridge',        deck: 'Fly Bridge',              description: 'Open-air helm & satellite equipment',   emoji: '📡' },
  { id: 'Unassigned',    label: 'Unassigned',        deck: 'Unknown Location',        description: 'Devices without a confirmed location',  emoji: '❓' },
];

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

// ── Zone health badge ─────────────────────────────────────────────

function ZoneHealth({ zoneDevices }: { zoneDevices: (typeof devices) }) {
  const total   = zoneDevices.length;
  const online  = zoneDevices.filter(d => d.status === 'online').length;
  const offline = zoneDevices.filter(d => d.status === 'offline').length;
  const unknown = zoneDevices.filter(d => d.type === 'unknown').length;

  if (total === 0) return <span style={{ color: '#4a5a6a', fontSize: 12 }}>No devices</span>;

  const allGood = offline === 0 && unknown === 0;
  const hasCritical = offline > 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {allGood ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>
          <CheckCircle2 size={11} /> All good
        </span>
      ) : (
        <>
          {hasCritical && (
            <span style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>
              {offline} offline
            </span>
          )}
          {unknown > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>
              <AlertTriangle size={10} /> {unknown} unknown
            </span>
          )}
        </>
      )}
      <span style={{ color: '#4a5a6a', fontSize: 12 }}>{online}/{total} online</span>
    </div>
  );
}

// ── Zone card ─────────────────────────────────────────────────────

function ZoneCard({ zone }: { zone: Zone }) {
  const [open, setOpen] = useState(false);

  const zoneDevices = devices.filter(d => {
    if (zone.id === 'Unassigned') return !d.location;
    return d.location === zone.id;
  });

  if (zoneDevices.length === 0 && zone.id !== 'Unassigned') return null;

  const hasIssue = zoneDevices.some(d => d.status === 'offline' || d.type === 'unknown');

  return (
    <div style={{
      background: '#0d1421',
      border: `1px solid ${hasIssue ? 'rgba(239,68,68,0.25)' : '#1a2535'}`,
      borderRadius: 14,
      overflow: 'hidden',
    }}>
      {/* Zone header — click to expand */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 14,
          padding: '16px 20px', background: 'transparent', border: 'none',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        {/* Status strip */}
        <div style={{
          width: 4, alignSelf: 'stretch', borderRadius: 2, flexShrink: 0,
          background: hasIssue ? '#ef4444' : '#22c55e',
          boxShadow: hasIssue ? '0 0 8px rgba(239,68,68,0.4)' : '0 0 8px rgba(34,197,94,0.3)',
        }} />

        {/* Emoji + name */}
        <div style={{ fontSize: 22, flexShrink: 0 }}>{zone.emoji}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#f0f4f8', fontSize: 14, fontWeight: 700 }}>{zone.label}</div>
          <div style={{ color: '#4a5a6a', fontSize: 11, marginTop: 2 }}>{zone.deck} · {zone.description}</div>
        </div>

        <ZoneHealth zoneDevices={zoneDevices} />

        <div style={{ color: '#4a5a6a', flexShrink: 0, marginLeft: 8 }}>
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {/* Expanded device list */}
      {open && (
        <div style={{ borderTop: '1px solid #1a2535', padding: '12px 20px 16px' }}>
          {zoneDevices.length === 0 ? (
            <div style={{ color: '#4a5a6a', fontSize: 12, padding: '8px 0' }}>No devices in this zone.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {zoneDevices.map(device => {
                const Icon = typeIcons[device.type];
                const sc   = statusColors[device.status];
                const isUnknown = device.type === 'unknown';

                return (
                  <div key={device.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    background: '#0a0f18',
                    border: `1px solid ${isUnknown ? 'rgba(245,158,11,0.2)' : device.status === 'offline' ? 'rgba(239,68,68,0.2)' : '#1a2535'}`,
                    borderRadius: 10, padding: '10px 14px',
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: isUnknown ? 'rgba(245,158,11,0.1)' : 'rgba(14,165,233,0.08)',
                    }}>
                      <Icon size={15} color={isUnknown ? '#f59e0b' : '#0ea5e9'} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: '#f0f4f8', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {device.name}
                      </div>
                      <div style={{ color: '#6b7f92', fontSize: 11, marginTop: 2, fontFamily: 'monospace' }}>{device.ip}</div>
                    </div>

                    <div style={{ color: '#4a5a6a', fontSize: 11, textAlign: 'right', flexShrink: 0 }}>
                      <div>Last seen</div>
                      <div style={{ color: '#8899aa', fontWeight: 500 }}>{device.lastSeen}</div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, width: 68, justifyContent: 'flex-end' }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: sc.color, boxShadow: `0 0 5px ${sc.glow}` }} />
                      <span style={{ color: sc.color, fontSize: 11, fontWeight: 600 }}>{sc.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Summary bar ───────────────────────────────────────────────────

function SummaryBar() {
  const total    = devices.length;
  const online   = devices.filter(d => d.status === 'online').length;
  const offline  = devices.filter(d => d.status === 'offline').length;
  const unknown  = devices.filter(d => d.type === 'unknown').length;
  const affected = zones.filter(z => {
    const zd = devices.filter(d => z.id === 'Unassigned' ? !d.location : d.location === z.id);
    return zd.some(d => d.status === 'offline' || d.type === 'unknown');
  }).length;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
      {[
        { label: 'Devices Online',    value: `${online}/${total}`, color: '#22c55e', sub: 'across all zones' },
        { label: 'Offline Devices',   value: offline,              color: '#ef4444', sub: 'need attention' },
        { label: 'Unknown Devices',   value: unknown,              color: '#f59e0b', sub: 'need review' },
        { label: 'Zones with Issues', value: affected,             color: affected > 0 ? '#ef4444' : '#22c55e', sub: affected > 0 ? 'require action' : 'all clear' },
      ].map(({ label, value, color, sub }) => (
        <Card key={label}>
          <CardLabel>{label}</CardLabel>
          <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
          <div style={{ color: '#6b7f92', fontSize: 12, marginTop: 5 }}>{sub}</div>
        </Card>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────

export default function Zones() {
  return (
    <div style={{ padding: 28, maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div>
        <div style={{ color: '#f0f4f8', fontSize: 20, fontWeight: 800, letterSpacing: 0.2 }}>Vessel Zones</div>
        <div style={{ color: '#6b7f92', fontSize: 13, marginTop: 4 }}>
          Tech status by location — tap any zone to see its devices
        </div>
      </div>

      {/* Summary KPIs */}
      <SummaryBar />

      {/* Zone cards */}
      <Card>
        <CardLabel>All Zones</CardLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {zones.map(z => <ZoneCard key={z.id} zone={z} />)}
        </div>
      </Card>

    </div>
  );
}
