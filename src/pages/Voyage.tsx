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
        { label: 'Avg Voyage Uptime',  value: `${avgUptime}%`,               color: '#22c55e', icon: TrendingUp,   sub: `${log.length} days tracked` },
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

function VoyageRow({ entry, downHistory, onDelete }: {
  entry:       VoyageEntry;
  downHistory: number[];
  onDelete:    (id: string) => void;
}) {
  const blocks        = parseBlocks(entry.blocks);
  const dateFormatted = new Date(entry.date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const uptimeColor   = entry.uptimePct >= 99 ? '#22c55e' : entry.uptimePct >= 95 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{
      background: '#0a0f18',
      border: `1px solid ${entry.incidents > 3 ? 'rgba(239,68,68,0.2)' : '#1a2535'}`,
      borderRadius: 12, padding: '14px 18px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: blocks.length > 0 ? 12 : 0 }}>
        {/* Date + location */}
        <div style={{ width: 180, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <Clock size={11} color="#4a5a6a" />
            <span style={{ color: '#4a5a6a', fontSize: 11 }}>{dateFormatted}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
            <MapPin size={11} color="#6b7f92" />
            <span style={{ color: '#f0f4f8', fontSize: 13, fontWeight: 600 }}>{entry.location}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 90px)', gap: 10 }}>
          {[
            { label: 'Uptime',   value: `${entry.uptimePct}%`,      color: uptimeColor },
            { label: 'Download', value: `${entry.avgDownMbps} Mbps`, color: '#0ea5e9' },
            { label: 'Latency',  value: `${entry.avgLatencyMs} ms`,  color: '#22c55e' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: '#0d1421', border: '1px solid #1a2535', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ color: '#4a5a6a', fontSize: 10, marginBottom: 3 }}>{label}</div>
              <div style={{ color, fontSize: 14, fontWeight: 700 }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Incidents */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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

      {/* 24h timeline */}
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
  );
}

// ── Recent incidents feed ─────────────────────────────────────────

function IncidentFeed({ alerts }: { alerts: Alert[] }) {
  const incident = alerts.filter(a => a.severity !== 'info').slice(0, 5);
  return (
    <Card>
      <CardLabel>Recent Incidents</CardLabel>
      {incident.length === 0 ? (
        <div style={{ color: '#4a5a6a', fontSize: 12 }}>No incidents recorded.</div>
      ) : (
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
      )}
    </Card>
  );
}

// ── Add Entry Modal ───────────────────────────────────────────────

const PROVIDERS = ['Starlink', 'LTE', 'VSAT', 'None'] as const;

function AddEntryModal({ onSave, onClose }: {
  onSave:  (entry: Omit<VoyageEntry, 'id' | 'createdAt'>) => void;
  onClose: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    date:         today,
    location:     '',
    region:       '',
    avgDownMbps:  '0',
    avgLatencyMs: '0',
    uptimePct:    '100',
    provider:     'Starlink' as typeof PROVIDERS[number],
    incidents:    '0',
    notes:        '',
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  function handleSave() {
    if (!form.location.trim()) return;
    onSave({
      date:         form.date,
      location:     form.location.trim(),
      region:       form.region.trim(),
      avgDownMbps:  parseFloat(form.avgDownMbps)  || 0,
      avgLatencyMs: parseFloat(form.avgLatencyMs) || 0,
      uptimePct:    parseFloat(form.uptimePct)     || 100,
      provider:     form.provider,
      incidents:    parseInt(form.incidents)        || 0,
      blocks:       '[]',
      notes:        form.notes.trim(),
    });
  }

  const inputStyle: React.CSSProperties = {
    background: '#080b10', color: '#f0f4f8', border: '1px solid #1a2535',
    borderRadius: 8, padding: '8px 12px', fontSize: 13, width: '100%',
    outline: 'none', boxSizing: 'border-box',
  };
  const lbl = (text: string) => (
    <div style={{ color: '#6b7f92', fontSize: 11, fontWeight: 600, marginBottom: 5 }}>{text}</div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: '#0d1421', border: '1px solid #1a2535', borderRadius: 16, padding: 28, width: 480, maxWidth: '95vw' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ color: '#f0f4f8', fontSize: 16, fontWeight: 700 }}>Add Voyage Entry</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7f92' }}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              {lbl('Date')}
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} style={inputStyle} />
            </div>
            <div>
              {lbl('Provider')}
              <select value={form.provider} onChange={e => set('provider', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div>
            {lbl('Location')}
            <input placeholder="Monaco, France" value={form.location} onChange={e => set('location', e.target.value)} style={inputStyle} />
          </div>

          <div>
            {lbl('Region (optional)')}
            <input placeholder="Mediterranean" value={form.region} onChange={e => set('region', e.target.value)} style={inputStyle} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <div>
              {lbl('Down (Mbps)')}
              <input type="number" min="0" value={form.avgDownMbps} onChange={e => set('avgDownMbps', e.target.value)} style={inputStyle} />
            </div>
            <div>
              {lbl('Latency (ms)')}
              <input type="number" min="0" value={form.avgLatencyMs} onChange={e => set('avgLatencyMs', e.target.value)} style={inputStyle} />
            </div>
            <div>
              {lbl('Uptime %')}
              <input type="number" min="0" max="100" step="0.1" value={form.uptimePct} onChange={e => set('uptimePct', e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div>
            {lbl('Incidents')}
            <input type="number" min="0" value={form.incidents} onChange={e => set('incidents', e.target.value)} style={inputStyle} />
          </div>

          <div>
            {lbl('Notes (optional)')}
            <input placeholder="e.g. Outage during bridge transit" value={form.notes} onChange={e => set('notes', e.target.value)} style={inputStyle} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #1a2535', color: '#6b7f92', borderRadius: 9, padding: '9px 18px', fontSize: 13, cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!form.location.trim()}
            style={{ background: form.location.trim() ? 'rgba(14,165,233,0.15)' : '#0d1421', color: form.location.trim() ? '#7dd3fc' : '#4a5a6a', border: `1px solid ${form.location.trim() ? 'rgba(14,165,233,0.35)' : '#1a2535'}`, borderRadius: 9, padding: '9px 22px', fontSize: 13, fontWeight: 600, cursor: form.location.trim() ? 'pointer' : 'default' }}
          >
            Save Entry
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
      // agent offline — keep empty
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

  const downHistory = [...log].reverse().map(e => e.avgDownMbps);

  return (
    <div style={{ padding: 28, maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ color: '#f0f4f8', fontSize: 20, fontWeight: 800, letterSpacing: 0.2 }}>Voyage Log</div>
          <div style={{ color: '#6b7f92', fontSize: 13, marginTop: 4 }}>
            Connectivity history and performance across this voyage
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(14,165,233,0.1)', color: '#7dd3fc', border: '1px solid rgba(14,165,233,0.3)', borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          <Plus size={15} /> Add Entry
        </button>
      </div>

      <SummaryKpis log={log} />

      {loading ? (
        <Card>
          <div style={{ color: '#4a5a6a', fontSize: 13, textAlign: 'center', padding: 20 }}>Loading voyage log…</div>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, alignItems: 'start' }}>
          <Card>
            <CardLabel>Day-by-Day Connectivity ({log.length} entries)</CardLabel>
            {log.length === 0 ? (
              <div style={{ color: '#4a5a6a', fontSize: 13, padding: '10px 0' }}>
                No entries yet — add your first voyage entry above.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {log.map(s => (
                  <VoyageRow key={s.id} entry={s} downHistory={downHistory} onDelete={handleDelete} />
                ))}
              </div>
            )}
          </Card>

          <IncidentFeed alerts={alerts} />
        </div>
      )}

      {showModal && <AddEntryModal onSave={handleAdd} onClose={() => setShowModal(false)} />}

    </div>
  );
}
