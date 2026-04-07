import { useState } from 'react';
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

// ── Device row ────────────────────────────────────────────────────

function DeviceRow({ device }: { device: (typeof devices)[number] }) {
  const Icon      = typeIcons[device.type];
  const sc        = statusColors[device.status];
  const isUnknown = device.type === 'unknown';

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

      {/* Name + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
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
              <AlertTriangle size={10} />
              Unknown
            </span>
          )}
        </div>
        <div style={{ color: '#6b7f92', fontSize: 11, marginTop: 3 }}>
          {typeLabels[device.type]}
          {device.manufacturer ? ` · ${device.manufacturer}` : ''}
          {device.location ? ` · ${device.location}` : ''}
        </div>
      </div>

      {/* IP + MAC */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ color: '#f0f4f8', fontSize: 12, fontFamily: 'monospace' }}>{device.ip}</div>
        <div style={{ color: '#6b7f92', fontSize: 11, fontFamily: 'monospace', marginTop: 2 }}>{device.mac}</div>
      </div>

      {/* Last seen */}
      <div style={{ textAlign: 'right', width: 100, flexShrink: 0 }}>
        <div style={{ color: '#6b7f92', fontSize: 11 }}>Last seen</div>
        <div style={{ color: '#f0f4f8', fontSize: 12, fontWeight: 500, marginTop: 2 }}>{device.lastSeen}</div>
      </div>

      {/* Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, width: 72, justifyContent: 'flex-end' }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: sc.color,
          boxShadow: `0 0 6px ${sc.glow}`,
        }} />
        <span style={{ color: sc.color, fontSize: 12, fontWeight: 600 }}>{sc.label}</span>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────

export default function Devices() {
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [typeFilter, setTypeFilter]   = useState<FilterType>('all');

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

  return (
    <div style={{ padding: 28, maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ color: '#f0f4f8', fontSize: 20, fontWeight: 800, letterSpacing: 0.2 }}>Devices</div>
          <div style={{ color: '#6b7f92', fontSize: 13, marginTop: 4 }}>
            {onlineCount} online · {offlineCount} offline · {devices.length} total
          </div>
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
            filtered.map(d => <DeviceRow key={d.id} device={d} />)
          )}
        </div>
      </Card>

    </div>
  );
}
