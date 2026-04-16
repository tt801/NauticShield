import { useEffect, useState, useCallback } from 'react';
import {
  Wifi,
  WifiOff,
  Activity,
  MapPin,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Plus,
  X,
  Trash2,
} from 'lucide-react';
import { useVesselData } from '@/context/VesselDataProvider';
import { agentApi }      from '@/api/client';
import type { VoyageEntry } from '@/api/client';
import type { Alert }    from '@/data/mock';

// ── Types ─────────────────────────────────────────────────────────

type ConnStatus = 'good' | 'slow' | 'down';

// ── Helpers ───────────────────────────────────────────────────────

const connColors: Record<ConnStatus, string> = { good: '#22c55e', slow: '#f59e0b', down: '#ef4444' };

function parseBlocks(raw: string): ConnStatus[] {
  try { return JSON.parse(raw) as ConnStatus[]; }
  catch { return []; }
}

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
  if (blocks.length === 0) return <div style={{ color: '#4a5a6a', fontSize: 11 }}>No hourly data</div>;
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
  if (data.length < 2) return null;
  const w = 90, h = 30;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  });
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <path d={`M${pts[0]} L${pts.join(' L')}`} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Summary KPIs strip ────────────────────────────────────────────

function SummaryKpis({ log }: { log: VoyageEntry[] }) {
  if (log.length === 0) return null;
  const avgUptime = +(log.reduce((s, d) => s + d.uptimePct, 0) / log.length).toFixed(1);
  const avgDown   = Math.round(log.reduce((s, d) => s + d.avgDownMbps, 0) / log.length);
  const totalInc  = log.reduce((s, d) => s + d.incidents, 0);
  const bestDay   = [...log].sort((a, b) => b.uptimePct - a.uptimePct)[0];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
      {[
        { label: 'Avg Voyage Uptime',  value: `${avgUptime}%`,               color: '#22c55e', icon: TrendingUp,   sub: `${log.length} voyage windows tracked` },
        { label: 'Avg Download Speed', value: `${avgDown} Mbps`,              color: '#0ea5e9', icon: Activity,     sub: 'across all locations' },
        { label: 'Total Incidents',    value: totalInc,                        color: totalInc > 5 ? '#ef4444' : '#f59e0b', icon: AlertTriangle, sub: 'connection drops & slowdowns' },
        { label: 'Best Connectivity',  value: bestDay.location.split(',')[0], color: '#22c55e', icon: CheckCircle2, sub: `${bestDay.uptimePct}% uptime` },
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

type VoyageStatus = 'in_port' | 'underway' | 'completed';

const STATUS_CONFIG: Record<VoyageStatus, { label: string; color: string; bg: string; border: string }> = {
  in_port:   { label: 'IN PORT',   color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)',  border: 'rgba(14,165,233,0.3)'  },
  underway:  { label: 'UNDERWAY',  color: '#a78bfa', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.3)' },
  completed: { label: 'COMPLETED', color: '#4a5a6a', bg: 'rgba(74,90,106,0.12)',  border: 'rgba(74,90,106,0.3)'  },
};

function LocationBlock({ name, country, region, label }: { name: string; country: string; region: string; label?: string }) {
  const meta = [country, region].filter(Boolean).join(', ');
  return (
    <div>
      {label && <div style={{ color: '#4a5a6a', fontSize: 10, fontWeight: 600, letterSpacing: 0.8, marginBottom: 2 }}>{label}</div>}
      <div style={{ color: '#f0f4f8', fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>{name || '—'}</div>
      {meta && <div style={{ color: '#4a5a6a', fontSize: 11, marginTop: 1 }}>{meta}</div>}
    </div>
  );
}

function VoyageRow({ entry, downHistory, onDelete, onUpdate }: {
  entry:       VoyageEntry;
  downHistory: number[];
  onDelete:    (id: string) => void;
  onUpdate:    (id: string, patch: Partial<Omit<VoyageEntry, 'id' | 'createdAt'>>) => void;
}) {
  const blocks        = parseBlocks(entry.blocks);
  const dateFormatted = new Date(entry.date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const uptimeColor   = entry.uptimePct >= 99 ? '#22c55e' : entry.uptimePct >= 95 ? '#f59e0b' : '#ef4444';
  const status        = (entry.status as VoyageStatus) ?? 'completed';
  const statusCfg     = STATUS_CONFIG[status] ?? STATUS_CONFIG.completed;
  const isUnderway    = !!entry.locationTo;
  const isActive      = status === 'in_port' || status === 'underway';
  const [picking, setPicking] = useState(false);
  const etaFormatted  = entry.eta
    ? new Date(entry.eta + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : null;

  return (
    <div style={{
      background: '#0a0f18',
      border: `1px solid ${isActive ? statusCfg.border : entry.incidents > 3 ? 'rgba(239,68,68,0.2)' : '#1a2535'}`,
      borderRadius: 12, overflow: 'hidden',
    }}>
      {/* Active status banner */}
      {isActive && (
        <div style={{ background: statusCfg.bg, borderBottom: `1px solid ${statusCfg.border}`, padding: '6px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: statusCfg.color, boxShadow: `0 0 6px ${statusCfg.color}` }} />
            <span style={{ color: statusCfg.color, fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>{statusCfg.label}</span>
            {status === 'underway' && etaFormatted && (
              <span style={{ color: '#6b7f92', fontSize: 11 }}>· ETA {etaFormatted}</span>
            )}
          </div>
          {status === 'in_port' && (
            <button
              onClick={() => onUpdate(entry.id, { status: 'completed' })}
              style={{ background: 'rgba(14,165,233,0.1)', color: '#7dd3fc', border: '1px solid rgba(14,165,233,0.3)', borderRadius: 7, padding: '4px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
            >
              End Port Stay
            </button>
          )}
          {status === 'underway' && (
            <button
              onClick={async () => {
                const today = new Date().toISOString().slice(0, 10);
                const perf  = await agentApi.voyage.autofillRange(entry.date, today).catch(() => null);
                const patch: Partial<Omit<VoyageEntry, 'id' | 'createdAt'>> = { status: 'completed' };
                if (perf?.hasData) {
                  patch.avgDownMbps  = perf.avgDownMbps;
                  patch.avgLatencyMs = perf.avgLatencyMs;
                  patch.uptimePct    = perf.uptimePct;
                  patch.provider     = perf.provider;
                  patch.incidents    = perf.incidents;
                }
                onUpdate(entry.id, patch);
              }}
              style={{ background: 'rgba(139,92,246,0.1)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 7, padding: '4px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
            >
              Mark as Arrived ✓
            </button>
          )}
        </div>
      )}

      <div style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: blocks.length > 0 ? 12 : 0 }}>

          {/* Date + location block */}
          <div style={{ minWidth: 210, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Clock size={11} color="#4a5a6a" />
              <span style={{ color: '#4a5a6a', fontSize: 11 }}>{dateFormatted}</span>
              {!isActive && (
                <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                  <button
                    onClick={() => setPicking(p => !p)}
                    title="Change status"
                    style={{ background: statusCfg.bg, color: statusCfg.color, border: `1px solid ${statusCfg.border}`, borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}
                  >
                    {isUnderway ? 'TRANSIT' : 'PORT STAY'} ▾
                  </button>
                  {picking && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: '#0d1421', border: '1px solid #1a2535', borderRadius: 8, padding: 6, display: 'flex', flexDirection: 'column', gap: 4, zIndex: 10, whiteSpace: 'nowrap', boxShadow: '0 4px 16px rgba(0,0,0,0.5)' }}>
                      <button onClick={() => { onUpdate(entry.id, { status: 'in_port' }); setPicking(false); }}
                        style={{ background: 'rgba(14,165,233,0.1)', color: '#7dd3fc', border: '1px solid rgba(14,165,233,0.25)', borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
                        ⚓ In Port
                      </button>
                      <button onClick={() => { onUpdate(entry.id, { status: 'underway' }); setPicking(false); }}
                        style={{ background: 'rgba(139,92,246,0.1)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
                        ⛵ Underway
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {isUnderway ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <MapPin size={11} color="#6b7f92" style={{ marginTop: 3, flexShrink: 0 }} />
                  <LocationBlock name={entry.location} country={entry.country} region={entry.region} label="FROM" />
                </div>
                <div style={{ paddingLeft: 17, color: '#4a5a6a', fontSize: 18, lineHeight: 1 }}>↓</div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <MapPin size={11} color="#a78bfa" style={{ marginTop: 3, flexShrink: 0 }} />
                  <LocationBlock name={entry.locationTo} country={entry.locationToCountry} region={entry.locationToRegion} label="TO" />
                </div>
                {etaFormatted && status === 'completed' && (
                  <div style={{ color: '#4a5a6a', fontSize: 11, paddingLeft: 17 }}>Arrived {etaFormatted}</div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                <MapPin size={11} color="#6b7f92" style={{ marginTop: 3, flexShrink: 0 }} />
                <LocationBlock name={entry.location} country={entry.country} region={entry.region} />
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8 }}>
              {entry.provider === 'Starlink'
                ? <Wifi size={11} color="#0ea5e9" />
                : entry.provider === 'LTE'
                ? <Activity size={11} color="#8b5cf6" />
                : <WifiOff size={11} color="#ef4444" />
              }
              <span style={{ color: '#6b7f92', fontSize: 11 }}>{entry.provider}</span>
            </div>
            {entry.notes && (
              <div style={{ color: '#4a5a6a', fontSize: 11, marginTop: 4, fontStyle: 'italic' }}>{entry.notes}</div>
            )}
          </div>

          {/* Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 84px)', gap: 8 }}>
            {[
              { label: 'Uptime',   value: `${entry.uptimePct}%`,      color: uptimeColor },
              { label: 'Download', value: `${entry.avgDownMbps} Mbps`, color: '#0ea5e9'  },
              { label: 'Latency',  value: `${entry.avgLatencyMs} ms`,  color: '#22c55e'  },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: '#0d1421', border: '1px solid #1a2535', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ color: '#4a5a6a', fontSize: 10, marginBottom: 3 }}>{label}</div>
                <div style={{ color, fontSize: 13, fontWeight: 700 }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Incidents */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {entry.incidents === 0 ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>
                <CheckCircle2 size={11} /> No incidents
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, background: entry.incidents > 3 ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)', color: entry.incidents > 3 ? '#ef4444' : '#f59e0b', border: `1px solid ${entry.incidents > 3 ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)'}`, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>
                <AlertTriangle size={11} /> {entry.incidents} incident{entry.incidents > 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sparkline data={downHistory} color="#0ea5e9" />
            <button
              onClick={() => onDelete(entry.id)}
              title="Delete entry"
              style={{ background: 'transparent', border: '1px solid #1a2535', borderRadius: 7, padding: '5px 7px', cursor: 'pointer', color: '#4a5a6a', display: 'flex', alignItems: 'center' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#4a5a6a'; e.currentTarget.style.borderColor = '#1a2535'; }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* 24h block timeline */}
        {blocks.length > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: '#4a5a6a', fontSize: 10 }}>Connection quality — {blocks.length}h</span>
              <span style={{ color: '#4a5a6a', fontSize: 10 }}>Midnight → Midnight</span>
            </div>
            <BlockTimeline blocks={blocks} />
            <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
              {[['good', 'Good'], ['slow', 'Slow'], ['down', 'Down']].map(([k, l]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: connColors[k as ConnStatus] }} />
                  <span style={{ color: '#4a5a6a', fontSize: 10 }}>{l}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Recent incidents feed ─────────────────────────────────────────

function IncidentFeed({ alerts }: { alerts: Alert[] }) {
  const incident = alerts.filter(a => a.severity !== 'info').slice(0, 5);
  return (
    <div style={{ background: '#0d1421', border: '1px solid #1a2535', borderRadius: 14, padding: 20 }}>
      <div style={{ color: '#4a5a6a', fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Recent Incidents</div>
      {incident.length === 0 ? (
        <div style={{ color: '#4a5a6a', fontSize: 12 }}>No incidents recorded.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {incident.map(a => {
            const color = a.severity === 'critical' ? '#ef4444' : '#f59e0b';
            return (
              <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: '#0a0f18', borderRadius: 10, padding: '10px 14px', borderLeft: `3px solid ${color}` }}>
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
      )}
    </div>
  );
}

// ── Geocoding ────────────────────────────────────────────────────

async function geocodeLocation(query: string): Promise<{ country: string; region: string } | null> {
  if (!query.trim()) return null;
  try {
    const url  = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`;
    const r    = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    const data = await r.json() as Array<{ address?: Record<string, string> }>;
    if (!data[0]?.address) return null;
    const addr    = data[0].address;
    const country = addr.country ?? '';
    const region  = addr.state ?? addr.county ?? addr.region ?? addr.territory ?? '';
    return { country, region };
  } catch { return null; }
}

// ── Add Entry Modal ───────────────────────────────────────────────

function GeoField({ label, loading, placeholder, value, onChange }: {
  label: string; loading: boolean; placeholder: string;
  value: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <div style={{ color: '#6b7f92', fontSize: 11, fontWeight: 600, marginBottom: 5 }}>{loading ? `${label} (detecting…)` : label}</div>
      <input
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ background: '#080b10', color: loading ? '#4a5a6a' : '#f0f4f8', border: '1px solid #1a2535', borderRadius: 8, padding: '8px 12px', fontSize: 13, width: '100%', outline: 'none', boxSizing: 'border-box' as const }}
      />
    </div>
  );
}

function AddEntryModal({ onSave, onClose }: {
  onSave:  (entry: Omit<VoyageEntry, 'id' | 'createdAt'>) => Promise<void>;
  onClose: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const inputStyle: React.CSSProperties = {
    background: '#080b10', color: '#f0f4f8', border: '1px solid #1a2535',
    borderRadius: 8, padding: '8px 12px', fontSize: 13, width: '100%', outline: 'none', boxSizing: 'border-box',
  };
  const lbl = (t: string) => <div style={{ color: '#6b7f92', fontSize: 11, fontWeight: 600, marginBottom: 5 }}>{t}</div>;

  const [fromDate,          setFromDate]          = useState(today);
  const [toDate,            setToDate]            = useState(today);
  const [locFrom,           setLocFrom]           = useState('');
  const [country,           setCountry]           = useState('');
  const [region,            setRegion]            = useState('');
  const [geoFromLoading,    setGeoFromLoading]    = useState(false);
  const [locTo,             setLocTo]             = useState('');
  const [locationToCountry, setLocationToCountry] = useState('');
  const [locationToRegion,  setLocationToRegion]  = useState('');
  const [geoToLoading,      setGeoToLoading]      = useState(false);
  const [notes,             setNotes]             = useState('');
  const [autoFilling,       setAutoFilling]       = useState(false);
  const [autoFilled,        setAutoFilled]        = useState(false);
  const [saving,            setSaving]            = useState(false);
  const [saveError,         setSaveError]         = useState('');
  const [autoData,          setAutoData]          = useState<{ avgDownMbps: number; avgLatencyMs: number; uptimePct: number; provider: string; incidents: number; blocks: string } | null>(null);

  useEffect(() => {
    if (toDate < fromDate) {
      setAutoFilling(false);
      setAutoFilled(false);
      setAutoData(null);
      return;
    }

    let cancelled = false;
    setAutoFilling(true);
    setAutoFilled(false);
    setAutoData(null);
    agentApi.voyage.autofillRange(fromDate, toDate).then(data => {
      if (cancelled) return;
      if (data.hasData) { setAutoData(data); setAutoFilled(true); }
    }).catch(() => {}).finally(() => { if (!cancelled) setAutoFilling(false); });
    return () => { cancelled = true; };
  }, [fromDate, toDate]);

  async function geocodeFrom(query: string) {
    if (!query.trim()) return;
    setGeoFromLoading(true);
    const r = await geocodeLocation(query);
    setGeoFromLoading(false);
    if (r) {
      if (!country) setCountry(r.country);
      if (!region)  setRegion(r.region);
    }
  }

  async function geocodeTo(query: string) {
    if (!query.trim()) return;
    setGeoToLoading(true);
    const r = await geocodeLocation(query);
    setGeoToLoading(false);
    if (r) {
      if (!locationToCountry) setLocationToCountry(r.country);
      if (!locationToRegion)  setLocationToRegion(r.region);
    }
  }

  const hasDestination = locTo.trim().length > 0;
  const canSave    = fromDate.length > 0 && toDate.length > 0 && toDate >= fromDate;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setSaveError('');
    try {
      await onSave({
        date:              fromDate,
        location:          locFrom.trim(),
        region:            region.trim(),
        country:           country.trim(),
        locationTo:        hasDestination ? locTo.trim()             : '',
        locationToCountry: hasDestination ? locationToCountry.trim() : '',
        locationToRegion:  hasDestination ? locationToRegion.trim()  : '',
        eta:               toDate,
        status:            'completed',
        avgDownMbps:       autoData?.avgDownMbps  ?? 0,
        avgLatencyMs:      autoData?.avgLatencyMs ?? 0,
        uptimePct:         autoData?.uptimePct    ?? 100,
        provider:          autoData?.provider     ?? 'Starlink',
        incidents:         autoData?.incidents    ?? 0,
        blocks:            autoData?.blocks       ?? '[]',
        notes:             notes.trim(),
      });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Voyage range could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: '#0d1421', border: '1px solid #1a2535', borderRadius: 16, padding: 28, width: 540, maxWidth: '95vw', maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ color: '#f0f4f8', fontSize: 16, fontWeight: 700 }}>Add Voyage Range</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7f92' }}><X size={18} /></button>
        </div>

        <div style={{
          marginBottom: 16,
          borderRadius: 8,
          padding: '7px 12px',
          fontSize: 12,
          ...(autoFilling
            ? { background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.2)', color: '#7dd3fc' }
            : autoFilled
            ? { background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: '#4ade80' }
            : { background: 'rgba(107,127,146,0.06)', border: '1px solid #1a2535', color: '#4a5a6a' }),
        }}>
          {autoFilling
            ? 'Fetching performance data for the selected voyage window…'
            : autoFilled
            ? '✓ Speed, latency, uptime and incidents pulled from the selected date range.'
            : 'No agent data found for this date range — performance metrics will default to zero.'}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              {lbl('From date')}
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={inputStyle} />
            </div>
            <div>
              {lbl('To date')}
              <input type="date" value={toDate} min={fromDate} onChange={e => setToDate(e.target.value)} style={inputStyle} />
            </div>
          </div>

          {toDate < fromDate && (
            <div style={{ color: '#f87171', fontSize: 12 }}>The end date must be on or after the start date.</div>
          )}

          <div style={{ color: '#6b7f92', fontSize: 12, lineHeight: 1.6 }}>
            Choose the voyage start and end dates first. Location fields are optional, so you can save a date-range report even if no departure or arrival port is needed.
          </div>

          <div style={{ background: '#080b10', border: '1px solid #1a2535', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ color: '#6b7f92', fontSize: 11, fontWeight: 700, letterSpacing: 0.8 }}>⚓️  DEPARTED FROM (OPTIONAL)</div>
            <div>
              {lbl('Port / Place name (optional)')}
              <input
                placeholder="e.g. Monaco"
                value={locFrom}
                onChange={e => setLocFrom(e.target.value)}
                onBlur={() => geocodeFrom(locFrom)}
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <GeoField label="Country" loading={geoFromLoading} placeholder="France" value={country} onChange={setCountry} />
              <GeoField label="Region"  loading={geoFromLoading} placeholder="Provence" value={region}  onChange={setRegion} />
            </div>
          </div>

          {/* Destination */}
          <div style={{ background: '#080b10', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ color: '#a78bfa', fontSize: 11, fontWeight: 700, letterSpacing: 0.8 }}>⛵  ARRIVED AT</div>
            <div>
              {lbl('Destination port / place (optional)')}
              <input
                placeholder="e.g. Nice, France"
                value={locTo}
                onChange={e => setLocTo(e.target.value)}
                onBlur={() => geocodeTo(locTo)}
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <GeoField label="Country"       loading={geoToLoading} placeholder="France"       value={locationToCountry} onChange={setLocationToCountry} />
              <GeoField label="Region"        loading={geoToLoading} placeholder="Côte d'Azur" value={locationToRegion}  onChange={setLocationToRegion} />
            </div>
          </div>

          {/* Notes */}
          <div>
            {lbl('Notes (optional)')}
            <input
              placeholder="e.g. Choppy seas, Starlink degraded near coast"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        {saveError && (
          <div style={{ marginTop: 18, color: '#fca5a5', fontSize: 12, lineHeight: 1.5 }}>
            {saveError}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #1a2535', color: '#6b7f92', borderRadius: 9, padding: '9px 18px', fontSize: 13, cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            style={{ background: canSave && !saving ? 'rgba(14,165,233,0.15)' : '#0d1421', color: canSave && !saving ? '#7dd3fc' : '#4a5a6a', border: `1px solid ${canSave && !saving ? 'rgba(14,165,233,0.35)' : '#1a2535'}`, borderRadius: 9, padding: '9px 22px', fontSize: 13, fontWeight: 600, cursor: canSave && !saving ? 'pointer' : 'default' }}
          >
            {saving ? 'Saving…' : 'Save Voyage'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────

export default function Voyage() {
  const { alerts } = useVesselData();
  const [log,       setLog]       = useState<VoyageEntry[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);

  const fetchLog = useCallback(async () => {
    try {
      const entries = await agentApi.voyage.list();
      setLog(entries);
    } catch {
      // agent offline
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLog(); }, [fetchLog]);

  async function handleAdd(entry: Omit<VoyageEntry, 'id' | 'createdAt'>) {
    try {
      const created = await agentApi.voyage.add(entry);
      setLog(l => [created, ...l]);
      setShowModal(false);
    } catch (err) {
      console.error('Failed to add voyage entry', err);
      throw err;
    }
  }

  async function handleDelete(id: string) {
    try {
      await agentApi.voyage.delete(id);
      setLog(l => l.filter(e => e.id !== id));
    } catch (err) {
      console.error('Failed to delete voyage entry', err);
    }
  }

  async function handleUpdate(id: string, patch: Partial<Omit<VoyageEntry, 'id' | 'createdAt'>>) {
    // Optimistic update — apply patch immediately so the UI responds without waiting for the agent
    setLog(l => l.map(e => e.id === id ? { ...e, ...patch } : e));
    try {
      const updated = await agentApi.voyage.update(id, patch);
      setLog(l => l.map(e => e.id === id ? updated : e));
    } catch (err) {
      console.error('Failed to update voyage entry — agent may be offline', err);
    }
  }

  // Active entries (in_port / underway) float to top, then date desc
  const sorted = [...log].sort((a, b) => {
    const aA = a.status === 'in_port' || a.status === 'underway' ? 0 : 1;
    const bA = b.status === 'in_port' || b.status === 'underway' ? 0 : 1;
    if (aA !== bA) return aA - bA;
    return b.date.localeCompare(a.date);
  });

  const downHistory = [...log].sort((a, b) => a.date.localeCompare(b.date)).map(e => e.avgDownMbps);

  return (
    <div style={{ padding: 28, maxWidth: 1150, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ color: '#f0f4f8', fontSize: 20, fontWeight: 800, letterSpacing: 0.2 }}>Voyage Log</div>
          <div style={{ color: '#6b7f92', fontSize: 13, marginTop: 4 }}>Connectivity history and performance across each completed voyage window</div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(14,165,233,0.1)', color: '#7dd3fc', border: '1px solid rgba(14,165,233,0.3)', borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          <Plus size={15} /> Add Voyage
        </button>
      </div>

      <SummaryKpis log={log} />

      {loading ? (
        <div style={{ background: '#0d1421', border: '1px solid #1a2535', borderRadius: 14, padding: 40, textAlign: 'center', color: '#4a5a6a', fontSize: 13 }}>
          Loading voyage log\u2026
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, alignItems: 'start' }}>
          <div style={{ background: '#0d1421', border: '1px solid #1a2535', borderRadius: 14, padding: 20 }}>
            <div style={{ color: '#4a5a6a', fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>
              Voyage Entries ({sorted.length})
            </div>
            {sorted.length === 0 ? (
              <div style={{ color: '#4a5a6a', fontSize: 13, padding: '10px 0' }}>No entries yet \u2014 add your first voyage entry above.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {sorted.map(s => (
                  <VoyageRow key={s.id} entry={s} downHistory={downHistory} onDelete={handleDelete} onUpdate={handleUpdate} />
                ))}
              </div>
            )}
          </div>
          <IncidentFeed alerts={alerts} />
        </div>
      )}

      {showModal && <AddEntryModal onSave={handleAdd} onClose={() => setShowModal(false)} />}
    </div>
  );
}
