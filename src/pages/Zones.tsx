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
  Pencil,
  Trash2,
  Plus,
  X,
} from 'lucide-react';
import type { Device, DeviceStatus, DeviceType } from '@/data/mock';
import { useVesselData } from '@/context/VesselDataProvider';

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

const DEFAULT_ZONES: Zone[] = [
  { id: 'Bridge',        label: 'Bridge',        deck: 'Fly Bridge / Wheelhouse', description: 'Navigation, helm controls, AV',        emoji: '🧭' },
  { id: 'Main Salon',    label: 'Main Salon',    deck: 'Main Deck',               description: 'Guest entertainment & relaxation',     emoji: '🛋️' },
  { id: 'Guest Suite 1', label: 'Guest Suite 1', deck: 'Lower Deck',              description: 'Primary guest cabin & AV',             emoji: '🛏️' },
  { id: 'Guest Suite 2', label: 'Guest Suite 2', deck: 'Lower Deck',              description: 'Secondary guest cabin & AV',           emoji: '🛏️' },
  { id: 'Engine Room',   label: 'Engine Room',   deck: 'Below Deck',              description: 'Engineering systems & monitoring',     emoji: '⚙️' },
  { id: 'Bow Deck',      label: 'Bow Deck',      deck: 'Upper Deck',              description: 'Forward outdoor area & WiFi coverage', emoji: '⚓' },
  { id: 'Stern Deck',    label: 'Stern Deck',    deck: 'Upper Deck',              description: 'Aft outdoor area & WiFi coverage',     emoji: '🌊' },
  { id: 'Crew Quarters', label: 'Crew Quarters', deck: 'Lower Deck',              description: 'Crew accommodation & devices',         emoji: '👥' },
  { id: 'Fly Bridge',    label: 'Fly Bridge',    deck: 'Fly Bridge',              description: 'Open-air helm & satellite equipment',  emoji: '📡' },
  { id: 'Unassigned',    label: 'Unassigned',    deck: 'Unknown Location',        description: 'Devices without a confirmed location', emoji: '❓' },
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

function ZoneHealth({ zoneDevices }: { zoneDevices: Device[] }) {
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

// ── Zone modal (add / edit) ───────────────────────────────────────

const EMOJI_OPTIONS = ['🧭','🛋️','🛏️','⚙️','⚓','🌊','👥','📡','🍽️','🍸','🏊','🎬','💼','🔧','📺','🛁','🪴'];

function ZoneModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: Zone;
  onSave: (z: Omit<Zone, 'id'> & { id?: string }) => void;
  onClose: () => void;
}) {
  const [label,       setLabel]       = useState(initial?.label       ?? '');
  const [deck,        setDeck]        = useState(initial?.deck        ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [emoji,       setEmoji]       = useState(initial?.emoji       ?? '🛋️');

  const isEdit = !!initial;

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#080b10', border: '1px solid #1a2535', borderRadius: 8,
    color: '#f0f4f8', fontSize: 13, padding: '9px 12px', outline: 'none',
    boxSizing: 'border-box',
  };

  function handleSave() {
    if (!label.trim()) return;
    onSave({ id: initial?.id, label: label.trim(), deck: deck.trim(), description: description.trim(), emoji });
  }

  return (
    /* Backdrop */
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      {/* Modal */}
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#0d1421', border: '1px solid #1a2535', borderRadius: 16, padding: 24, width: 420, maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ color: '#f0f4f8', fontSize: 15, fontWeight: 700 }}>{isEdit ? 'Edit Zone' : 'Add Zone'}</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7f92', padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        {/* Emoji picker */}
        <div>
          <div style={{ color: '#4a5a6a', fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Icon</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {EMOJI_OPTIONS.map(e => (
              <button
                key={e}
                onClick={() => setEmoji(e)}
                style={{
                  fontSize: 20, padding: '6px 8px', borderRadius: 8, cursor: 'pointer', border: '1px solid',
                  borderColor: emoji === e ? '#0ea5e9' : '#1a2535',
                  background: emoji === e ? 'rgba(14,165,233,0.12)' : '#080b10',
                }}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        {/* Fields */}
        {[
          { label: 'Zone name',   value: label,       set: setLabel,       placeholder: 'e.g. Master Suite' },
          { label: 'Deck',        value: deck,        set: setDeck,        placeholder: 'e.g. Lower Deck' },
          { label: 'Description', value: description, set: setDescription, placeholder: 'e.g. Owner cabin & AV' },
        ].map(({ label: lbl, value, set, placeholder }) => (
          <div key={lbl}>
            <div style={{ color: '#4a5a6a', fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>{lbl}</div>
            <input
              value={value}
              onChange={e => set(e.target.value)}
              placeholder={placeholder}
              style={inputStyle}
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
            />
          </div>
        ))}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
          <button onClick={onClose} style={{ background: '#0a0f18', border: '1px solid #1a2535', color: '#8899aa', borderRadius: 8, padding: '8px 18px', fontSize: 13, cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!label.trim()}
            style={{ background: label.trim() ? 'rgba(14,165,233,0.15)' : '#0a0f18', border: '1px solid', borderColor: label.trim() ? 'rgba(14,165,233,0.4)' : '#1a2535', color: label.trim() ? '#7dd3fc' : '#3a4a5a', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: label.trim() ? 'pointer' : 'default' }}
          >
            {isEdit ? 'Save changes' : 'Add zone'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Zone card ─────────────────────────────────────────────────────

function ZoneCard({ zone, devices, zones, isFixed, onEdit, onDelete, onAssign }: {
  zone: Zone;
  devices: Device[];
  zones: Zone[];
  isFixed: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onAssign: (deviceId: string, targetZoneId: string) => void;
}) {
  const [open, setOpen]                 = useState(false);
  const [assignTarget, setAssignTarget] = useState('');

  const zoneDevices = devices.filter(d => {
    if (zone.id === 'Unassigned') return !d.location;
    return d.location === zone.id;
  });

  const hasIssue = zoneDevices.some(d => d.status === 'offline' || d.type === 'unknown');

  return (
    <div style={{
      background: '#0d1421',
      border: `1px solid ${hasIssue ? 'rgba(239,68,68,0.25)' : '#1a2535'}`,
      borderRadius: 14,
      overflow: 'hidden',
    }}>
      {/* Zone header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px' }}>
        {/* Status strip */}
        <div style={{
          width: 4, alignSelf: 'stretch', borderRadius: 2, flexShrink: 0,
          background: hasIssue ? '#ef4444' : '#22c55e',
          boxShadow: hasIssue ? '0 0 8px rgba(239,68,68,0.4)' : '0 0 8px rgba(34,197,94,0.3)',
          minHeight: 36,
        }} />

        {/* Emoji */}
        <div style={{ fontSize: 22, flexShrink: 0 }}>{zone.emoji}</div>

        {/* Name + meta — clickable to expand */}
        <button
          onClick={() => setOpen(o => !o)}
          style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
        >
          <div style={{ color: '#f0f4f8', fontSize: 14, fontWeight: 700 }}>{zone.label}</div>
          <div style={{ color: '#4a5a6a', fontSize: 11, marginTop: 2 }}>{zone.deck}{zone.description ? ` · ${zone.description}` : ''}</div>
        </button>

        <ZoneHealth zoneDevices={zoneDevices} />

        {/* Edit / Delete — hidden for Unassigned */}
        {!isFixed && (
          <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginLeft: 6 }}>
            <button
              onClick={onEdit}
              title="Edit zone"
              style={{ background: 'transparent', border: '1px solid #1a2535', borderRadius: 7, padding: '5px 7px', cursor: 'pointer', color: '#6b7f92', display: 'flex', alignItems: 'center' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#0ea5e9'; e.currentTarget.style.color = '#7dd3fc'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#1a2535'; e.currentTarget.style.color = '#6b7f92'; }}
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={onDelete}
              title="Delete zone"
              style={{ background: 'transparent', border: '1px solid #1a2535', borderRadius: 7, padding: '5px 7px', cursor: 'pointer', color: '#6b7f92', display: 'flex', alignItems: 'center' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#1a2535'; e.currentTarget.style.color = '#6b7f92'; }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}

        <button
          onClick={() => setOpen(o => !o)}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#4a5a6a', flexShrink: 0, padding: 0 }}
        >
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* Expanded device list */}
      {open && (
        <div style={{ borderTop: '1px solid #1a2535', padding: '12px 20px 16px' }}>
          {zoneDevices.length === 0 ? (
            <div style={{ color: '#4a5a6a', fontSize: 12, padding: '8px 0' }}>No devices assigned to this zone.</div>
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
                    <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isUnknown ? 'rgba(245,158,11,0.1)' : 'rgba(14,165,233,0.08)' }}>
                      <Icon size={15} color={isUnknown ? '#f59e0b' : '#0ea5e9'} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: '#f0f4f8', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{device.name}</div>
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
                    {/* Assignment action */}
                    {zone.id === 'Unassigned' ? (
                      <select
                        defaultValue=""
                        onChange={e => { if (e.target.value) { onAssign(device.id, e.target.value); e.currentTarget.value = ''; } }}
                        style={{ background: '#080b10', color: '#8899aa', border: '1px solid #1a2535', borderRadius: 6, fontSize: 11, padding: '4px 8px', cursor: 'pointer', flexShrink: 0 }}
                        title="Move device to a zone"
                      >
                        <option value="">Move to…</option>
                        {zones.filter(z => z.id !== 'Unassigned').map(z => (
                          <option key={z.id} value={z.id}>{z.emoji} {z.label}</option>
                        ))}
                      </select>
                    ) : (
                      <button
                        onClick={() => onAssign(device.id, 'Unassigned')}
                        title="Remove from zone"
                        style={{ background: 'transparent', border: '1px solid #1a2535', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', color: '#6b7f92', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#6b7f92'; e.currentTarget.style.borderColor = '#1a2535'; }}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {/* Assign a device to this zone (non-Unassigned zones only) */}
          {zone.id !== 'Unassigned' && (() => {
            const available = devices.filter(d => d.location !== zone.id);
            if (available.length === 0) return null;
            return (
              <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
                <select
                  value={assignTarget}
                  onChange={e => setAssignTarget(e.target.value)}
                  style={{ flex: 1, background: '#080b10', color: assignTarget ? '#f0f4f8' : '#4a5a6a', border: '1px solid #1a2535', borderRadius: 8, fontSize: 12, padding: '7px 10px', cursor: 'pointer' }}
                >
                  <option value="">— assign a device to this zone —</option>
                  {available.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.ip}){d.location ? ` · from ${d.location}` : ' · Unassigned'}
                    </option>
                  ))}
                </select>
                <button
                  disabled={!assignTarget}
                  onClick={() => { onAssign(assignTarget, zone.id); setAssignTarget(''); }}
                  style={{ background: assignTarget ? 'rgba(14,165,233,0.15)' : 'transparent', color: assignTarget ? '#7dd3fc' : '#4a5a6a', border: `1px solid ${assignTarget ? 'rgba(14,165,233,0.3)' : '#1a2535'}`, borderRadius: 8, padding: '7px 16px', fontSize: 12, fontWeight: 600, cursor: assignTarget ? 'pointer' : 'default', flexShrink: 0 }}
                >
                  Assign
                </button>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// ── Summary bar ───────────────────────────────────────────────────

function SummaryBar({ devices, zones }: { devices: Device[]; zones: Zone[] }) {
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
  const { devices, renameDevice } = useVesselData();
  const [zones,       setZones]       = useState<Zone[]>(DEFAULT_ZONES);
  const [modalTarget, setModalTarget] = useState<Zone | null | 'new'>(null); // null=closed, 'new'=add, Zone=edit

  function handleSave(data: Omit<Zone, 'id'> & { id?: string }) {
    if (data.id) {
      // Edit existing
      setZones(zs => zs.map(z => z.id === data.id ? { ...z, ...data, id: z.id } : z));
    } else {
      // Add new — use label as id (slugified)
      const id = data.label.trim().replace(/\s+/g, ' ');
      setZones(zs => {
        // Insert before Unassigned
        const idx = zs.findIndex(z => z.id === 'Unassigned');
        const copy = [...zs];
        copy.splice(idx >= 0 ? idx : copy.length, 0, { ...data, id });
        return copy;
      });
    }
    setModalTarget(null);
  }

  function handleDelete(id: string) {
    setZones(zs => zs.filter(z => z.id !== id));
  }

  return (
    <div style={{ padding: 28, maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ color: '#f0f4f8', fontSize: 20, fontWeight: 800, letterSpacing: 0.2 }}>Vessel Zones</div>
          <div style={{ color: '#6b7f92', fontSize: 13, marginTop: 4 }}>
            Tech status by location — tap any zone to see its devices
          </div>
        </div>
        <button
          onClick={() => setModalTarget('new')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(14,165,233,0.1)', color: '#7dd3fc', border: '1px solid rgba(14,165,233,0.3)', borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
        >
          <Plus size={15} /> Add Zone
        </button>
      </div>

      {/* Summary KPIs */}
      <SummaryBar devices={devices} zones={zones} />

      {/* Zone cards */}
      <Card>
        <CardLabel>{zones.length} zone{zones.length !== 1 ? 's' : ''}</CardLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {zones.map(z => (
            <ZoneCard
              key={z.id}
              zone={z}
              zones={zones}
              devices={devices}
              isFixed={z.id === 'Unassigned'}
              onEdit={() => setModalTarget(z)}
              onDelete={() => handleDelete(z.id)}
              onAssign={(deviceId, targetZoneId) =>
                renameDevice(deviceId, { location: targetZoneId === 'Unassigned' ? '' : targetZoneId })
              }
            />
          ))}
        </div>
      </Card>

      {/* Modal */}
      {modalTarget !== null && (
        <ZoneModal
          initial={modalTarget === 'new' ? undefined : modalTarget}
          onSave={handleSave}
          onClose={() => setModalTarget(null)}
        />
      )}

    </div>
  );
}
