import { useState, useRef, useEffect } from 'react';
import {
  Smartphone,
  Laptop,
  Tv,
  Camera,
  Router,
  HelpCircle,
  Search,
  Filter,
  AlertTriangle,
  Pencil,
  Check,
  X,
  ShieldAlert,
  Wifi,
  Clock,
  Terminal,
  MapPin,
  Lock,
  Unlock,
  Loader,
} from 'lucide-react';
import type { DeviceStatus, DeviceType } from '@/data/mock';
import { useVesselData } from '@/context/VesselDataProvider';

// ── Helpers ───────────────────────────────────────────────────────

// Quick CVE severity summary by device type (mirrors Cyber.tsx MARITIME_CVE_DB counts)
const CVE_SUMMARY: Record<string, { critical: number; high: number; medium: number }> = {
  camera:  { critical: 3, high: 2, medium: 1 },
  router:  { critical: 3, high: 3, medium: 0 },
  tv:      { critical: 0, high: 2, medium: 3 },
  laptop:  { critical: 1, high: 2, medium: 0 },
  phone:   { critical: 0, high: 1, medium: 1 },
  unknown: { critical: 1, high: 0, medium: 0 },
};

const MOCK_PORTS: Record<string, { port: number; service: string; state: 'open' | 'filtered' }[]> = {
  camera:  [{ port: 554, service: 'RTSP', state: 'open' }, { port: 8080, service: 'HTTP Admin', state: 'open' }, { port: 22, service: 'SSH', state: 'filtered' }],
  router:  [{ port: 80, service: 'HTTP', state: 'open' }, { port: 443, service: 'HTTPS', state: 'open' }, { port: 22, service: 'SSH', state: 'open' }, { port: 179, service: 'BGP', state: 'filtered' }],
  tv:      [{ port: 1900, service: 'SSDP/UPnP', state: 'open' }, { port: 8001, service: 'SmartTV', state: 'open' }],
  laptop:  [{ port: 445, service: 'SMB', state: 'filtered' }, { port: 3389, service: 'RDP', state: 'filtered' }],
  phone:   [{ port: 5353, service: 'mDNS', state: 'open' }],
  unknown: [{ port: 23, service: 'Telnet', state: 'open' }, { port: 80, service: 'HTTP', state: 'open' }, { port: 8888, service: 'Unknown', state: 'open' }],
};

const MOCK_ACTIVITY: Record<string, { time: string; event: string }[]> = {
  camera:  [{ time: '09:14', event: 'RTSP stream started' }, { time: '08:00', event: 'Device came online' }, { time: 'Yesterday', event: 'Firmware version queried' }],
  router:  [{ time: '09:30', event: 'DNS query burst (×340)' }, { time: '09:00', event: 'WAN link reset' }, { time: '08:22', event: 'DHCP table refreshed' }],
  tv:      [{ time: '22:14', event: 'Netflix stream started' }, { time: '20:00', event: 'Device came online' }, { time: '14:00', event: 'Software update checked' }],
  laptop:  [{ time: '09:45', event: 'Connected to guest SSID' }, { time: '09:44', event: 'DHCP lease granted' }, { time: 'Yesterday', event: 'SMB browse request' }],
  phone:   [{ time: '10:02', event: 'iMessage sync' }, { time: '09:55', event: 'Connected to ship Wi-Fi' }, { time: 'Yesterday', event: 'App store update' }],
  unknown: [{ time: '03:47', event: 'Port scan detected' }, { time: '03:46', event: 'ARP probe sent' }, { time: '03:45', event: 'Device appeared on network' }],
};

const typeIcons: Record<DeviceType, React.ElementType> = {
  phone:   Smartphone,
  laptop:  Laptop,
  tv:      Tv,
  camera:  Camera,
  router:  Router,
  unknown: HelpCircle,
};

const typeLabels: Record<DeviceType, string> = {
  phone:   'Phone / Tablet',
  laptop:  'Laptop / PC',
  tv:      'TV / Display',
  camera:  'Camera',
  router:  'Router / AP',
  unknown: 'Unknown',
};

const statusColors: Record<DeviceStatus, { color: string; label: string; glow: string }> = {
  online:  { color: '#22c55e', label: 'Online',  glow: 'rgba(34,197,94,0.4)' },
  offline: { color: '#ef4444', label: 'Offline', glow: 'rgba(239,68,68,0.4)' },
  unknown: { color: '#f59e0b', label: 'Unknown', glow: 'rgba(245,158,11,0.4)' },
};

type FilterStatus = DeviceStatus | 'all';
type FilterType   = DeviceType   | 'all';

function normalizeDeviceType(value: unknown): DeviceType {
  if (typeof value !== 'string') return 'unknown';
  return value in typeIcons ? (value as DeviceType) : 'unknown';
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

// ── Filter chip ───────────────────────────────────────────────────

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 12px',
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 500,
        border: '1px solid',
        cursor: 'pointer',
        transition: 'background 0.15s',
        ...(active
          ? { background: 'rgba(14,165,233,0.15)', color: '#7dd3fc', borderColor: 'rgba(14,165,233,0.4)' }
          : { background: '#0a0f18', color: '#8899aa', borderColor: '#1a2535' }),
      }}
    >
      {label}
    </button>
  );
}

// ── Device detail panel ──────────────────────────────────────────────

function DeviceDetailPanel({ device, onClose }: {
  device: { id: string; name: string; type: string; status: string; ip: string; mac: string; lastSeen: string; manufacturer?: string | null; location?: string | null };
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'overview' | 'ports' | 'activity'>('overview');
  const dt   = (device.type in CVE_SUMMARY) ? device.type : 'unknown';
  const cve  = CVE_SUMMARY[dt] ?? { critical: 0, high: 0, medium: 0 };
  const ports    = MOCK_PORTS[dt]    ?? [];
  const activity = MOCK_ACTIVITY[dt] ?? [];
  const Icon = typeIcons[device.type as keyof typeof typeIcons] ?? HelpCircle;
  const sc   = statusColors[device.status as keyof typeof statusColors] ?? statusColors.unknown;
  const totalCve = cve.critical + cve.high + cve.medium;
  const cveColor = cve.critical > 0 ? '#ef4444' : cve.high > 0 ? '#f97316' : cve.medium > 0 ? '#f59e0b' : '#22c55e';

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 420,
      background: '#080b10', borderLeft: '1px solid #1a2535',
      display: 'flex', flexDirection: 'column',
      zIndex: 1000, boxShadow: '-8px 0 40px rgba(0,0,0,0.7)',
    }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 0', borderBottom: '1px solid #1a2535', paddingBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 46, height: 46, borderRadius: 12, background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={22} color="#0ea5e9" />
            </div>
            <div>
              <div style={{ color: '#f0f4f8', fontSize: 16, fontWeight: 800, lineHeight: 1.2 }}>{device.name}</div>
              <div style={{ color: '#6b7f92', fontSize: 12, marginTop: 3 }}>{typeLabels[device.type as keyof typeof typeLabels] ?? device.type}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4a5a6a', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Status + IP + location pills */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: sc.color + '18', border: `1px solid ${sc.color}44`, borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 700, color: sc.color }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: sc.color, boxShadow: `0 0 5px ${sc.glow}` }} />
            {sc.label}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#0d1421', border: '1px solid #1a2535', borderRadius: 20, padding: '3px 10px', fontSize: 11, color: '#6b7f92', fontFamily: 'monospace' }}>
            <Wifi size={10} />{device.ip}
          </span>
          {device.location && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#0d1421', border: '1px solid #1a2535', borderRadius: 20, padding: '3px 10px', fontSize: 11, color: '#6b7f92' }}>
              <MapPin size={10} />{device.location}
            </span>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginTop: 14 }}>
          {(['overview', 'ports', 'activity'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12, fontWeight: 600,
              border: '1px solid', cursor: 'pointer',
              background: tab === t ? 'rgba(14,165,233,0.12)' : 'transparent',
              color: tab === t ? '#7dd3fc' : '#6b7f92',
              borderColor: tab === t ? 'rgba(14,165,233,0.35)' : '#1a2535',
            }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {tab === 'overview' && (
          <>
            <div style={{ background: '#0d1421', border: '1px solid #1a2535', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ color: '#4a5a6a', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase' }}>Device Info</div>
              {[
                { label: 'MAC Address',  value: device.mac,             mono: true },
                { label: 'Manufacturer', value: device.manufacturer ?? '—' },
                { label: 'Last Seen',    value: new Date(device.lastSeen).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) },
              ].map(({ label, value, mono }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#6b7f92', fontSize: 12 }}>{label}</span>
                  <span style={{ color: '#f0f4f8', fontSize: 12, fontFamily: mono ? 'monospace' : undefined }}>{value}</span>
                </div>
              ))}
            </div>

            <div style={{ background: '#0d1421', border: `1px solid ${cveColor}33`, borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <ShieldAlert size={14} color={cveColor} />
                  <span style={{ color: '#4a5a6a', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase' }}>CVE Exposure</span>
                </div>
                <span style={{ color: cveColor, fontSize: 11, fontWeight: 700 }}>
                  {totalCve === 0 ? 'No known CVEs' : `${totalCve} matched`}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { label: 'Critical', value: cve.critical, color: '#ef4444' },
                  { label: 'High',     value: cve.high,     color: '#f97316' },
                  { label: 'Medium',   value: cve.medium,   color: '#f59e0b' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ flex: 1, background: '#0a0f18', border: `1px solid ${value > 0 ? color + '33' : '#1a2535'}`, borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ color: value > 0 ? color : '#2a3a50', fontSize: 20, fontWeight: 800, lineHeight: 1 }}>{value}</div>
                    <div style={{ color: '#4a5a6a', fontSize: 10, marginTop: 3 }}>{label}</div>
                  </div>
                ))}
              </div>
              {totalCve > 0 && (
                <div style={{ marginTop: 10, color: '#4a5a6a', fontSize: 11, textAlign: 'center' }}>
                  Full CVE detail in <span style={{ color: '#0ea5e9' }}>Cyber → Device Risk Panel</span>
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'ports' && (
          <div style={{ background: '#0d1421', border: '1px solid #1a2535', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ color: '#4a5a6a', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 }}>Open / Filtered Ports</div>
            {ports.length === 0 ? (
              <div style={{ color: '#4a5a6a', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No port data available</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {ports.map(p => (
                  <div key={p.port} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#0a0f18', border: '1px solid #1a2535', borderRadius: 8, padding: '8px 12px' }}>
                    <Terminal size={12} color="#4a5a6a" />
                    <span style={{ color: '#f0f4f8', fontFamily: 'monospace', fontSize: 13, fontWeight: 700, width: 42 }}>{p.port}</span>
                    <span style={{ color: '#8899aa', fontSize: 12, flex: 1 }}>{p.service}</span>
                    <span style={{
                      borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 700,
                      background: p.state === 'open' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.08)',
                      color: p.state === 'open' ? '#ef4444' : '#f59e0b',
                      border: `1px solid ${p.state === 'open' ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)'}`,
                    }}>
                      {p.state}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'activity' && (
          <div style={{ background: '#0d1421', border: '1px solid #1a2535', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ color: '#4a5a6a', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 }}>Recent Activity</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {activity.map((ev, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, paddingBottom: i < activity.length - 1 ? 12 : 0, marginBottom: i < activity.length - 1 ? 12 : 0, borderBottom: i < activity.length - 1 ? '1px solid #1a2535' : 'none' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                    <Clock size={12} color="#4a5a6a" />
                    {i < activity.length - 1 && <div style={{ flex: 1, width: 1, background: '#1a2535' }} />}
                  </div>
                  <div>
                    <div style={{ color: '#f0f4f8', fontSize: 12 }}>{ev.event}</div>
                    <div style={{ color: '#4a5a6a', fontSize: 11, marginTop: 2 }}>{ev.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Device row ────────────────────────────────────────────────────

function DeviceRow({ device, onSave, onBlock, onUnblock, controlsEnabled, onNotify }: {
  device: { id: string; name: string; type: DeviceType; status: DeviceStatus; ip: string; mac: string; lastSeen: string; manufacturer?: string | null; location?: string | null; blocked?: boolean; blockedAt?: string; blockedReason?: string };
  onSave: (id: string, patch: { name?: string; type?: string; location?: string }) => void;
  onBlock?: (mac: string) => Promise<void>;
  onUnblock?: (mac: string) => Promise<void>;
  controlsEnabled?: boolean;
  onNotify?: (type: 'success' | 'error' | 'block', message: string) => void;
}) {
  const [editing, setEditing]   = useState(false);
  const [name, setName]         = useState(device.name);
  const [type, setType]         = useState<DeviceType>(normalizeDeviceType(device.type));
  const [location, setLocation] = useState(device.location ?? '');
  const [blocking, setBlocking] = useState(false);
  const [localBlocked, setLocalBlocked] = useState(Boolean(device.blocked));
  const nameRef = useRef<HTMLInputElement>(null);

  // Keep local state in sync if WS updates arrive while not editing
  useEffect(() => {
    if (!editing) {
      setName(device.name);
      setType(normalizeDeviceType(device.type));
      setLocation(device.location ?? '');
    }
  }, [device.name, device.type, device.location, editing]);

  useEffect(() => {
    setLocalBlocked(Boolean(device.blocked));
  }, [device.blocked]);

  useEffect(() => {
    if (editing) nameRef.current?.focus();
  }, [editing]);

  function commit() {
    onSave(device.id, { name: name.trim() || device.name, type, location: location.trim() || undefined });
    setEditing(false);
  }

  async function handleBlock() {
    if (!onBlock) return;
    setBlocking(true);
    onNotify?.('block', `Blocking ${device.name}...`);
    try {
      await onBlock(device.mac);
      setLocalBlocked(true);
      onNotify?.('block', `${device.name} blocked`);
    } catch (err) {
      console.error('Failed to block device:', err);
      onNotify?.('error', `Failed to block ${device.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setBlocking(false);
    }
  }

  async function handleUnblock() {
    if (!onUnblock) return;
    setBlocking(true);
    onNotify?.('success', `Unblocking ${device.name}...`);
    try {
      await onUnblock(device.mac);
      setLocalBlocked(false);
      onNotify?.('success', `${device.name} unblocked`);
    } catch (err) {
      console.error('Failed to unblock device:', err);
      onNotify?.('error', `Failed to unblock ${device.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setBlocking(false);
    }
  }

  function cancel() {
    setName(device.name);
    setType(normalizeDeviceType(device.type));
    setLocation(device.location ?? '');
    setEditing(false);
  }

  const normalizedType = normalizeDeviceType(type);
  const Icon = typeIcons[normalizedType] ?? HelpCircle;
  const sc   = statusColors[device.status];
  const isUnknown = normalizedType === 'unknown';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '12px 16px',
      borderRadius: 12,
      border: `1px solid ${isUnknown ? 'rgba(245,158,11,0.25)' : '#1a2535'}`,
      background: isUnknown ? 'rgba(245,158,11,0.04)' : '#0a0f18',
    }}>
      {/* Icon */}
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: isUnknown ? 'rgba(245,158,11,0.12)' : 'rgba(14,165,233,0.1)',
      }}>
        <Icon size={17} color={isUnknown ? '#f59e0b' : '#0ea5e9'} />
      </div>

      {/* Name + meta — editable */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input
              ref={nameRef}
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
              placeholder="Device name"
              style={{
                background: '#0d1421', border: '1px solid #0ea5e9', borderRadius: 6,
                color: '#f0f4f8', fontSize: 13, padding: '4px 10px', outline: 'none', width: '100%',
              }}
            />
            <div style={{ display: 'flex', gap: 6 }}>
              <select
                value={type}
                onChange={e => setType(e.target.value as DeviceType)}
                style={{
                  background: '#0d1421', border: '1px solid #1a2535', borderRadius: 6,
                  color: '#f0f4f8', fontSize: 12, padding: '3px 8px', outline: 'none', cursor: 'pointer',
                }}
              >
                {(Object.keys(typeLabels) as DeviceType[]).map(t => (
                  <option key={t} value={t}>{typeLabels[t]}</option>
                ))}
              </select>
              <input
                value={location}
                onChange={e => setLocation(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
                placeholder="Location (e.g. Bridge)"
                style={{
                  background: '#0d1421', border: '1px solid #1a2535', borderRadius: 6,
                  color: '#f0f4f8', fontSize: 12, padding: '3px 8px', outline: 'none', flex: 1,
                }}
              />
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#f0f4f8', fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {device.name}
              </span>
              {isUnknown && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: 'rgba(245,158,11,0.15)', color: '#f59e0b',
                  borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 600, flexShrink: 0,
                }}>
                  <AlertTriangle size={10} /> Unknown
                </span>
              )}
            </div>
            <div style={{ color: '#6b7f92', fontSize: 11, marginTop: 3 }}>
              {typeLabels[normalizeDeviceType(device.type)]}
              {device.manufacturer ? ` · ${device.manufacturer}` : ''}
              {device.location     ? ` · ${device.location}`     : ''}
            </div>
          </>
        )}
      </div>

      {/* Center state marker */}
      {localBlocked && (
        <div style={{ flexShrink: 0, width: 110, display: 'flex', justifyContent: 'center' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4px 10px',
            borderRadius: 999,
            border: '1px solid rgba(239,68,68,0.45)',
            background: 'rgba(239,68,68,0.16)',
            color: '#ef4444',
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 0.6,
            lineHeight: 1,
          }}>
            BLOCKED
          </span>
        </div>
      )}

      {/* IP + MAC */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ color: '#f0f4f8', fontSize: 12, fontFamily: 'monospace' }}>{device.ip}</div>
        <div style={{ color: '#6b7f92', fontSize: 11, fontFamily: 'monospace', marginTop: 2 }}>{device.mac}</div>
      </div>

      {/* Last seen */}
      <div style={{ textAlign: 'right', width: 100, flexShrink: 0 }}>
        <div style={{ color: '#6b7f92', fontSize: 11 }}>Last seen</div>
        <div style={{ color: '#f0f4f8', fontSize: 12, fontWeight: 500, marginTop: 2 }}>
          {new Date(device.lastSeen).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      {/* Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, width: 72, justifyContent: 'flex-end' }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: sc.color, boxShadow: `0 0 6px ${sc.glow}` }} />
        <span style={{ color: sc.color, fontSize: 12, fontWeight: 600 }}>{sc.label}</span>
      </div>

      {/* Edit / Save / Cancel buttons */}
      <div
        onClick={e => e.stopPropagation()}
        style={{ flexShrink: 0, display: 'flex', gap: 6, alignItems: 'center' }}
      >
        {editing ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={commit} title="Save" style={{
              background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)',
              color: '#22c55e', borderRadius: 7, padding: '5px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center',
            }}><Check size={13} /></button>
            <button onClick={cancel} title="Cancel" style={{
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              color: '#ef4444', borderRadius: 7, padding: '5px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center',
            }}><X size={13} /></button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} title="Rename" style={{
            background: 'transparent', border: '1px solid #1a2535',
            color: '#6b7f92', borderRadius: 7, padding: '5px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center',
          }}><Pencil size={13} /></button>
        )}

        {/* Block/Unblock button */}
        {!editing && (
          <>
            {localBlocked ? (
              <button
                onClick={handleUnblock}
                disabled={blocking || controlsEnabled === false}
                title={controlsEnabled === false ? 'Agent offline - controls disabled' : 'Unblock this device'}
                style={{
                  background: 'rgba(239,68,68,0.15)',
                  border: '1px solid rgba(239,68,68,0.4)',
                  color: '#ef4444',
                  borderRadius: 7,
                  padding: '5px 8px',
                  cursor: (blocking || controlsEnabled === false) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 12,
                  fontWeight: 600,
                  opacity: (blocking || controlsEnabled === false) ? 0.5 : 1,
                }}
              >
                {blocking ? <Loader size={13} /> : <Unlock size={13} />}
              </button>
            ) : (
              <button
                onClick={handleBlock}
                disabled={blocking || controlsEnabled === false}
                title={controlsEnabled === false ? 'Agent offline - controls disabled' : 'Block this device at the router'}
                style={{
                  background: 'rgba(249,115,22,0.12)',
                  border: '1px solid rgba(249,115,22,0.3)',
                  color: '#f97316',
                  borderRadius: 7,
                  padding: '5px 8px',
                  cursor: (blocking || controlsEnabled === false) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 12,
                  fontWeight: 600,
                  opacity: (blocking || controlsEnabled === false) ? 0.5 : 1,
                }}
              >
                {blocking ? <Loader size={13} /> : <Lock size={13} />}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────

export default function Devices() {
  const { devices, renameDevice, blockDevice, unblockDevice, isLive, agentStatus, scannerDiagnostics, updateScannerConfig } = useVesselData();
  const [search, setSearch]             = useState('');
  const [selectedDevice, setSelectedDevice] = useState<typeof devices[0] | null>(null);
  const [toast, setToast] = useState<{ id: number; type: 'success' | 'error' | 'block'; message: string } | null>(null);
  const [scannerModePreset, setScannerModePreset] = useState<'auto' | 'advanced'>('auto');
  const [scanModeInput, setScanModeInput] = useState<'auto' | 'fixed' | 'all'>('auto');
  const [subnetInput, setSubnetInput] = useState('');
  const [allowedInput, setAllowedInput] = useState('');
  const [warnCyclesInput, setWarnCyclesInput] = useState('3');
  const [savingScannerConfig, setSavingScannerConfig] = useState(false);
  const [showScannerAdvancedDetails, setShowScannerAdvancedDetails] = useState(false);
  
  useEffect(() => {
    if (!selectedDevice) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedDevice(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selectedDevice]);
  
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [typeFilter, setTypeFilter]     = useState<FilterType>('all');

  // Block/unblock handlers
  const handleBlock = async (mac: string) => {
    if (!isLive || agentStatus === 'offline') {
      throw new Error('Agent is offline. Wait for reconnect before blocking devices.');
    }
    try {
      await blockDevice(mac);
    } catch (err) {
      throw err;
    }
  };

  const handleUnblock = async (mac: string) => {
    if (!isLive || agentStatus === 'offline') {
      throw new Error('Agent is offline. Wait for reconnect before unblocking devices.');
    }
    try {
      await unblockDevice(mac);
    } catch (err) {
      throw err;
    }
  };

  const notify = (type: 'success' | 'error' | 'block', message: string) => {
    setToast({ id: Date.now(), type, message });
  };

  useEffect(() => {
    if (!scannerDiagnostics) return;
    setScanModeInput(scannerDiagnostics.scanMode);
    setScannerModePreset(scannerDiagnostics.scanMode === 'auto' ? 'auto' : 'advanced');
    setSubnetInput(scannerDiagnostics.configuredSubnet ?? '');
    setAllowedInput((scannerDiagnostics.allowedSubnets ?? []).join(', '));
    setWarnCyclesInput(String(scannerDiagnostics.warnAfterCycles ?? 3));
  }, [scannerDiagnostics]);

  useEffect(() => {
    if (scannerModePreset === 'auto') {
      setScanModeInput('auto');
      return;
    }

    if (scanModeInput === 'auto') {
      setScanModeInput('fixed');
    }
  }, [scannerModePreset, scanModeInput]);

  const applyScannerConfig = async (targetPreset: 'auto' | 'advanced') => {
    setSavingScannerConfig(true);
    try {
      if (targetPreset === 'auto') {
        await updateScannerConfig({
          scanMode: 'auto',
          subnet: undefined,
          allowedSubnets: [],
          warnAfterCycles: Math.max(1, Number(warnCyclesInput) || 1),
        });
      } else {
        await updateScannerConfig({
          scanMode: scanModeInput === 'auto' ? 'fixed' : scanModeInput,
          subnet: subnetInput.trim() || undefined,
          allowedSubnets: allowedInput
            .split(',')
            .map(v => v.trim())
            .filter(Boolean),
          warnAfterCycles: Math.max(1, Number(warnCyclesInput) || 1),
        });
      }
      notify('success', targetPreset === 'auto' ? 'Auto scanner mode enabled' : 'Scanner settings updated');
    } catch (err) {
      notify('error', `Failed to update scanner settings: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSavingScannerConfig(false);
    }
  };

  const handleSaveScannerConfig = async () => {
    await applyScannerConfig(scannerModePreset);
  };

  const handleScannerModePresetChange = async (nextPreset: 'auto' | 'advanced') => {
    setScannerModePreset(nextPreset);
    if (nextPreset === 'auto') {
      await applyScannerConfig('auto');
    }
  };

  const filtered = devices.filter(d => {
    const matchStatus = statusFilter === 'all' || d.status === statusFilter;
    const matchType   = typeFilter   === 'all' || d.type   === typeFilter;
    const matchSearch =
      search === '' ||
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.ip.includes(search) ||
      d.mac.toLowerCase().includes(search.toLowerCase()) ||
      (d.location ?? '').toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchType && matchSearch;
  });

  const unknownCount = devices.filter(d => d.type === 'unknown').length;
  const onlineCount  = devices.filter(d => d.status === 'online').length;
  const offlineCount = devices.filter(d => d.status === 'offline').length;
  const wsChip = agentStatus === 'online'
    ? { label: 'Agent Online', color: '#22c55e', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.35)' }
    : agentStatus === 'connecting'
      ? { label: 'Connecting', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)' }
      : agentStatus === 'cloud'
        ? { label: 'Cloud Fallback', color: '#38bdf8', bg: 'rgba(56,189,248,0.12)', border: 'rgba(56,189,248,0.35)' }
        : { label: 'Agent Offline', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)' };

  const subnetHealth = (() => {
    if (!scannerDiagnostics) {
      return {
        label: 'Diagnostics pending',
        color: '#f59e0b',
        bg: 'rgba(245,158,11,0.10)',
        border: 'rgba(245,158,11,0.30)',
        message: 'Waiting for scanner diagnostics from agent...',
      };
    }

    const hasSubnetMismatchWarning =
      scannerDiagnostics.scanMode !== 'auto' &&
      (Boolean(scannerDiagnostics.lastWarning) ||
        scannerDiagnostics.configuredSubnetMissStreak >= scannerDiagnostics.warnAfterCycles);

    if (hasSubnetMismatchWarning) {
      return {
        label: 'Attention needed',
        color: '#ef4444',
        bg: 'rgba(239,68,68,0.10)',
        border: 'rgba(239,68,68,0.30)',
        message: scannerDiagnostics.lastWarning ?? 'Configured subnet may not match the active onboard LAN.',
      };
    }

    return {
      label: 'Scanner healthy',
      color: '#22c55e',
      bg: 'rgba(34,197,94,0.10)',
      border: 'rgba(34,197,94,0.30)',
      message: 'Scanner is targeting the expected network segment.',
    };
  })();

  return (
    <div style={{ padding: 28, maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {toast && (
        <div style={{
          position: 'fixed',
          top: 18,
          right: 18,
          zIndex: 1200,
          maxWidth: 360,
          background: toast.type === 'success' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.16)',
          border: toast.type === 'success' ? '1px solid rgba(34,197,94,0.45)' : '1px solid rgba(239,68,68,0.45)',
          color: toast.type === 'success' ? '#86efac' : '#fca5a5',
          borderRadius: 10,
          padding: '10px 12px',
          fontSize: 13,
          fontWeight: 600,
          boxShadow: '0 8px 28px rgba(0,0,0,0.35)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <span style={{ flex: 1 }}>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'inherit',
              cursor: 'pointer',
              fontSize: 14,
              lineHeight: 1,
              opacity: 0.9,
            }}
            title="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ color: '#f0f4f8', fontSize: 20, fontWeight: 800, letterSpacing: 0.2 }}>Devices</div>
          <div style={{ color: '#6b7f92', fontSize: 13, marginTop: 4 }}>
            {onlineCount} online · {offlineCount} offline · {devices.length} total
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: wsChip.bg,
            color: wsChip.color,
            border: `1px solid ${wsChip.border}`,
            borderRadius: 20,
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 700,
          }}>
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: wsChip.color,
              boxShadow: `0 0 8px ${wsChip.color}`,
              display: 'inline-block',
            }} />
            {wsChip.label}
          </div>
          {unknownCount > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(245,158,11,0.1)', color: '#f59e0b',
              border: '1px solid rgba(245,158,11,0.3)',
              borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 600,
            }}>
              <AlertTriangle size={13} />
              {unknownCount} unknown device{unknownCount > 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      {(!isLive || agentStatus === 'offline') && (
        <div style={{
          borderRadius: 10,
          padding: '10px 12px',
          fontSize: 13,
          fontWeight: 700,
          background: 'rgba(245,158,11,0.12)',
          border: '1px solid rgba(245,158,11,0.35)',
          color: '#fbbf24',
        }}>
          Live agent connection is offline. Device control buttons are temporarily disabled.
        </div>
      )}

      <Card style={{ padding: 16 }}>
        <CardLabel>Scanner Diagnostics</CardLabel>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ color: '#f0f4f8', fontSize: 13, fontWeight: 700 }}>
              Scanner Mode
            </div>
            <select
              value={scannerModePreset}
              onChange={e => {
                void handleScannerModePresetChange(e.target.value as 'auto' | 'advanced');
              }}
              disabled={!isLive || agentStatus === 'offline' || savingScannerConfig}
              style={{
                minWidth: 190,
                background: '#0d1421',
                border: '1px solid #1a2535',
                borderRadius: 8,
                color: '#f0f4f8',
                fontSize: 12,
                padding: '8px 10px',
              }}
            >
              <option value="auto">Auto (recommended)</option>
              <option value="advanced">Manual</option>
            </select>
          </div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            borderRadius: 20,
            padding: '5px 10px',
            fontSize: 12,
            fontWeight: 700,
            color: subnetHealth.color,
            background: subnetHealth.bg,
            border: `1px solid ${subnetHealth.border}`,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: subnetHealth.color }} />
            {subnetHealth.label}
          </div>
        </div>

        <div style={{ color: '#8899aa', fontSize: 12, marginBottom: 12 }}>
          {subnetHealth.message}
        </div>

        <div style={{ marginBottom: 10 }}>
          <button
            type="button"
            onClick={() => setShowScannerAdvancedDetails(prev => !prev)}
            style={{
              background: '#0a0f18',
              border: '1px solid #1a2535',
              borderRadius: 8,
              color: '#9fb0c1',
              fontSize: 12,
              fontWeight: 700,
              padding: '7px 10px',
              cursor: 'pointer',
            }}
          >
            {showScannerAdvancedDetails ? 'Hide technical data' : 'Show technical data'}
          </button>
        </div>

        {showScannerAdvancedDetails && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8, marginBottom: 12 }}>
            <div style={{ background: '#0a0f18', border: '1px solid #1a2535', borderRadius: 10, padding: '8px 10px' }}>
              <div style={{ color: '#6b7f92', fontSize: 11 }}>Active subnet</div>
              <div style={{ color: '#f0f4f8', fontSize: 12, fontFamily: 'monospace', marginTop: 2 }}>
                {scannerDiagnostics?.activeSubnet ? `${scannerDiagnostics.activeSubnet}.0/24` : 'Scanning all available'}
              </div>
            </div>
            <div style={{ background: '#0a0f18', border: '1px solid #1a2535', borderRadius: 10, padding: '8px 10px' }}>
              <div style={{ color: '#6b7f92', fontSize: 11 }}>Configured subnet</div>
              <div style={{ color: '#f0f4f8', fontSize: 12, fontFamily: 'monospace', marginTop: 2 }}>
                {scannerDiagnostics?.configuredSubnet ? `${scannerDiagnostics.configuredSubnet}.0/24` : 'Not set'}
              </div>
            </div>
            <div style={{ background: '#0a0f18', border: '1px solid #1a2535', borderRadius: 10, padding: '8px 10px' }}>
              <div style={{ color: '#6b7f92', fontSize: 11 }}>Miss streak</div>
              <div style={{ color: '#f0f4f8', fontSize: 12, marginTop: 2 }}>
                {scannerDiagnostics?.configuredSubnetMissStreak ?? 0} cycle(s)
              </div>
            </div>
            <div style={{ background: '#0a0f18', border: '1px solid #1a2535', borderRadius: 10, padding: '8px 10px' }}>
              <div style={{ color: '#6b7f92', fontSize: 11 }}>Recommended action</div>
              <div style={{ color: '#f0f4f8', fontSize: 12, marginTop: 2 }}>
                {scannerDiagnostics?.scanMode !== 'auto' && scannerDiagnostics?.lastWarning
                  ? 'Switch to Auto mode or correct SUBNET setting.'
                  : 'No action required.'}
              </div>
            </div>
          </div>
        )}

        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #1a2535' }}>
          <div style={{ color: '#6b7f92', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 }}>
            Scanner Settings
          </div>

          <div style={{ color: '#6b7f92', fontSize: 11, marginBottom: 10 }}>
            Auto applies immediately. Manual changes apply when you click Save.
          </div>

          {scannerModePreset === 'advanced' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
            <div>
              <div style={{ color: '#6b7f92', fontSize: 11, marginBottom: 4 }}>Advanced Strategy</div>
              <select
                value={scanModeInput}
                onChange={e => setScanModeInput(e.target.value as 'auto' | 'fixed' | 'all')}
                disabled={!isLive || agentStatus === 'offline' || savingScannerConfig}
                style={{
                  width: '100%',
                  background: '#0d1421',
                  border: '1px solid #1a2535',
                  borderRadius: 8,
                  color: '#f0f4f8',
                  fontSize: 12,
                  padding: '8px 10px',
                }}
              >
                <option value="fixed">Fixed</option>
                <option value="all">All</option>
              </select>
            </div>

            <div>
              <div style={{ color: '#6b7f92', fontSize: 11, marginBottom: 4 }}>Preferred/Fixed Subnet</div>
              <input
                value={subnetInput}
                onChange={e => setSubnetInput(e.target.value)}
                placeholder="e.g. 192.168.0"
                disabled={!isLive || agentStatus === 'offline' || savingScannerConfig}
                style={{
                  width: '100%',
                  background: '#0d1421',
                  border: '1px solid #1a2535',
                  borderRadius: 8,
                  color: '#f0f4f8',
                  fontSize: 12,
                  padding: '8px 10px',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <div style={{ color: '#6b7f92', fontSize: 11, marginBottom: 4 }}>Allowed Subnets (comma-separated)</div>
              <input
                value={allowedInput}
                onChange={e => setAllowedInput(e.target.value)}
                placeholder="192.168.0, 192.168.1"
                disabled={!isLive || agentStatus === 'offline' || savingScannerConfig}
                style={{
                  width: '100%',
                  background: '#0d1421',
                  border: '1px solid #1a2535',
                  borderRadius: 8,
                  color: '#f0f4f8',
                  fontSize: 12,
                  padding: '8px 10px',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <div style={{ color: '#6b7f92', fontSize: 11, marginBottom: 4 }}>Miss Warning Cycles</div>
              <input
                type="number"
                min={1}
                value={warnCyclesInput}
                onChange={e => setWarnCyclesInput(e.target.value)}
                disabled={!isLive || agentStatus === 'offline' || savingScannerConfig}
                style={{
                  width: '100%',
                  background: '#0d1421',
                  border: '1px solid #1a2535',
                  borderRadius: 8,
                  color: '#f0f4f8',
                  fontSize: 12,
                  padding: '8px 10px',
                  outline: 'none',
                }}
              />
            </div>
          </div>
          )}

          {scannerModePreset === 'advanced' && (
            <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={handleSaveScannerConfig}
                disabled={!isLive || agentStatus === 'offline' || savingScannerConfig}
                style={{
                  background: 'rgba(14,165,233,0.15)',
                  border: '1px solid rgba(14,165,233,0.4)',
                  color: '#7dd3fc',
                  borderRadius: 8,
                  padding: '7px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: (!isLive || agentStatus === 'offline' || savingScannerConfig) ? 'not-allowed' : 'pointer',
                  opacity: (!isLive || agentStatus === 'offline' || savingScannerConfig) ? 0.5 : 1,
                }}
              >
                {savingScannerConfig ? 'Saving...' : 'Save Scanner Settings'}
              </button>
            </div>
          )}
        </div>
      </Card>

      {toast && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          borderRadius: 10,
          padding: '10px 12px',
          fontSize: 13,
          fontWeight: 700,
          background: toast.type === 'success' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.14)',
          border: toast.type === 'success' ? '1px solid rgba(34,197,94,0.35)' : '1px solid rgba(239,68,68,0.38)',
          color: toast.type === 'success' ? '#86efac' : '#fca5a5',
          justifyContent: 'space-between',
        }}>
          <span>{toast.type === 'error' ? 'Action failed:' : 'Action status:'} {toast.message}</span>
          <button
            onClick={() => setToast(null)}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'inherit',
              cursor: 'pointer',
              fontSize: 14,
              lineHeight: 1,
              opacity: 0.9,
              marginLeft: 10,
            }}
            title="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Search + filters */}
      <Card style={{ padding: 16 }}>
        <CardLabel>Search &amp; Filter</CardLabel>

        {/* Search bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: '#0a0f18', border: '1px solid #1a2535',
          borderRadius: 10, padding: '8px 14px', marginBottom: 14,
        }}>
          <Search size={15} color="#6b7f92" />
          <input
            type="text"
            placeholder="Search name, IP, MAC, location…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              color: '#f0f4f8', fontSize: 13, flex: 1,
            }}
          />
        </div>

        {/* Filter chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <Filter size={13} color="#6b7f92" />
          <span style={{ color: '#6b7f92', fontSize: 12 }}>Status:</span>
          {(['all', 'online', 'offline'] as FilterStatus[]).map(s => (
            <FilterChip
              key={s}
              label={s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              active={statusFilter === s}
              onClick={() => setStatusFilter(s)}
            />
          ))}
          <span style={{ color: '#6b7f92', fontSize: 12, marginLeft: 6 }}>Type:</span>
          {(['all', 'phone', 'laptop', 'tv', 'camera', 'router', 'unknown'] as FilterType[]).map(t => (
            <FilterChip
              key={t}
              label={t === 'all' ? 'All' : typeLabels[t as DeviceType] ?? t}
              active={typeFilter === t}
              onClick={() => setTypeFilter(t)}
            />
          ))}
        </div>
      </Card>

      {/* Device list */}
      <Card>
        <CardLabel>
          {filtered.length} device{filtered.length !== 1 ? 's' : ''}{filtered.length < devices.length ? ` of ${devices.length}` : ''}
        </CardLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.length === 0 ? (
            <div style={{ color: '#6b7f92', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>
              No devices match your filters.
            </div>
          ) : (
            filtered.map(d => (
              <div key={d.id} onClick={() => setSelectedDevice(d)} style={{ cursor: 'pointer' }}>
                <DeviceRow
                  device={d}
                  onSave={renameDevice}
                  onBlock={handleBlock}
                  onUnblock={handleUnblock}
                  controlsEnabled={isLive && agentStatus !== 'offline'}
                  onNotify={notify}
                />
              </div>
            ))
          )}
        </div>
      </Card>


      {/* Device detail panel overlay */}
      {selectedDevice && (
        <>
          <div
            onClick={() => setSelectedDevice(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 999 }}
          />
          <DeviceDetailPanel device={selectedDevice} onClose={() => setSelectedDevice(null)} />
        </>
      )}
    </div>
  );
}