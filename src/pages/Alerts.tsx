import { useState } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  Filter,
} from 'lucide-react';
import { alerts } from '@/data/mock';
import type { AlertSeverity } from '@/data/mock';

// ── Helpers ───────────────────────────────────────────────────────

const severityConfig: Record<AlertSeverity, { label: string; text: string; bg: string; border: string }> = {
  critical: { label: 'Critical', text: '#ef4444', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.3)'  },
  warning:  { label: 'Warning',  text: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.3)' },
  info:     { label: 'Info',     text: '#0ea5e9', bg: 'rgba(14,165,233,0.08)', border: 'rgba(14,165,233,0.3)' },
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

type FilterSev   = AlertSeverity | 'all';
type FilterState = 'all' | 'active' | 'resolved';

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

// ── Alert row ─────────────────────────────────────────────────────

function AlertRow({ alert }: { alert: (typeof alerts)[number] }) {
  const [expanded, setExpanded] = useState(false);
  const c = severityConfig[alert.severity];

  return (
    <div style={{
      background: '#0a0f18',
      border: `1px solid ${alert.resolved ? '#1a2535' : c.border}`,
      borderLeft: `3px solid ${alert.resolved ? '#1a2535' : c.text}`,
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', display: 'flex', alignItems: 'flex-start', gap: 14,
          padding: '14px 16px', textAlign: 'left', background: 'transparent',
          border: 'none', cursor: 'pointer',
        }}
      >
        {/* Severity icon */}
        <div style={{
          width: 34, height: 34, borderRadius: 10, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: c.bg, marginTop: 1,
        }}>
          <ShieldAlert size={16} color={c.text} />
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{
              background: c.bg, color: c.text, border: `1px solid ${c.border}`,
              borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700,
            }}>
              {c.label}
            </span>
            {alert.resolved && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: 'rgba(34,197,94,0.1)', color: '#22c55e',
                borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 600,
              }}>
                <CheckCircle2 size={10} />
                Resolved
              </span>
            )}
          </div>
          <div style={{ color: alert.resolved ? '#6b7f92' : '#f0f4f8', fontSize: 13, fontWeight: 500 }}>
            {alert.title}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#4a5a6a', fontSize: 11, marginTop: 4 }}>
            <Clock size={11} />
            {formatDateTime(alert.timestamp)}
          </div>
        </div>

        {/* Expand icon */}
        <div style={{ color: '#6b7f92', flexShrink: 0, marginTop: 4 }}>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {expanded && (
        <div style={{
          color: '#8899aa', fontSize: 13, lineHeight: 1.6,
          borderTop: '1px solid #1a2535',
          padding: '12px 16px 14px 64px',
        }}>
          {alert.description}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────

export default function Alerts() {
  const [sevFilter,   setSevFilter]   = useState<FilterSev>('all');
  const [stateFilter, setStateFilter] = useState<FilterState>('all');

  const filtered = alerts.filter(a => {
    const matchSev   = sevFilter === 'all' || a.severity === sevFilter;
    const matchState =
      stateFilter === 'all'    ? true :
      stateFilter === 'active' ? !a.resolved :
      a.resolved;
    return matchSev && matchState;
  });

  const activeCount   = alerts.filter(a => !a.resolved).length;
  const criticalCount = alerts.filter(a => a.severity === 'critical' && !a.resolved).length;

  return (
    <div style={{ padding: 28, maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ color: '#f0f4f8', fontSize: 20, fontWeight: 800, letterSpacing: 0.2 }}>Alerts</div>
          <div style={{ color: '#6b7f92', fontSize: 13, marginTop: 4 }}>
            {activeCount} active · {alerts.length} total in last 24h
          </div>
        </div>
        {criticalCount > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(239,68,68,0.1)', color: '#ef4444',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 600,
          }}>
            <ShieldAlert size={13} />
            {criticalCount} critical
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {(['critical', 'warning', 'info'] as AlertSeverity[]).map(sev => {
          const count = alerts.filter(a => a.severity === sev).length;
          const c = severityConfig[sev];
          const active = sevFilter === sev;
          return (
            <div
              key={sev}
              onClick={() => setSevFilter(s => s === sev ? 'all' : sev)}
              style={{
                background: active ? c.bg : '#0d1421',
                border: `1px solid ${active ? c.border : '#1a2535'}`,
                borderRadius: 14, padding: '16px 20px',
                textAlign: 'center', cursor: 'pointer',
                transition: 'background 0.15s, border-color 0.15s',
              }}
            >
              <div style={{ fontSize: 28, fontWeight: 800, color: c.text, lineHeight: 1 }}>{count}</div>
              <div style={{ color: '#6b7f92', fontSize: 12, marginTop: 6 }}>{c.label}</div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <Card style={{ padding: 16 }}>
        <CardLabel>Filter</CardLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <Filter size={13} color="#6b7f92" />
          <span style={{ color: '#6b7f92', fontSize: 12 }}>Status:</span>
          {(['all', 'active', 'resolved'] as FilterState[]).map(s => (
            <FilterChip
              key={s}
              label={s.charAt(0).toUpperCase() + s.slice(1)}
              active={stateFilter === s}
              onClick={() => setStateFilter(s)}
            />
          ))}
          <span style={{ color: '#6b7f92', fontSize: 12, marginLeft: 6 }}>Severity:</span>
          {(['all', 'critical', 'warning', 'info'] as FilterSev[]).map(s => (
            <FilterChip
              key={s}
              label={s.charAt(0).toUpperCase() + s.slice(1)}
              active={sevFilter === s}
              onClick={() => setSevFilter(s)}
            />
          ))}
        </div>
      </Card>

      {/* Alert list */}
      <Card>
        <CardLabel>
          {filtered.length} alert{filtered.length !== 1 ? 's' : ''}{filtered.length < alerts.length ? ` of ${alerts.length}` : ''}
        </CardLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.length === 0 ? (
            <div style={{ color: '#6b7f92', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>
              No alerts match your filters.
            </div>
          ) : (
            filtered.map(a => <AlertRow key={a.id} alert={a} />)
          )}
        </div>
      </Card>

    </div>
  );
}

