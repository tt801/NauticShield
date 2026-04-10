import { useState, useEffect, useCallback } from 'react'
import { adminApi, type AuditRow } from '../api/client'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const PAGE_SIZE = 50

const ACTION_COLORS: Record<string, string> = {
  'sync.push':       '#60a5fa',
  'vessel.register': '#22c55e',
  'vessel.update':   '#f59e0b',
  'user.login':      '#a78bfa',
  'admin.update':    '#f87171',
}

const S = {
  header:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 } as React.CSSProperties,
  h1:      { fontSize: 22, fontWeight: 700, color: '#e8edf2', margin: 0 } as React.CSSProperties,
  sub:     { fontSize: 13, color: '#6b7280', marginTop: 4 } as React.CSSProperties,
  card:    { background: '#0a0f18', border: '1px solid #131e2d', borderRadius: 12, overflow: 'hidden' } as React.CSSProperties,
  table:   { width: '100%', borderCollapse: 'collapse' as const },
  th:      { padding: '11px 16px', textAlign: 'left' as const, fontSize: 11, fontWeight: 600, color: '#4b5563', textTransform: 'uppercase' as const, letterSpacing: '0.08em', borderBottom: '1px solid #131e2d', background: '#080c12' },
  td:      { padding: '12px 16px', fontSize: 12, color: '#c9d4df', borderBottom: '1px solid #0d1420', verticalAlign: 'middle' as const },
  select:  { padding: '7px 10px', background: '#07090e', border: '1px solid #131e2d', borderRadius: 7, color: '#e8edf2', fontSize: 12 } as React.CSSProperties,
  pgbtn:   (disabled: boolean): React.CSSProperties => ({ padding: '5px 12px', borderRadius: 6, fontSize: 12, border: '1px solid #131e2d', background: disabled ? 'transparent' : '#0a0f18', color: disabled ? '#374151' : '#c9d4df', cursor: disabled ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 4 }),
}

function ActionBadge({ action }: { action: string }) {
  const color = ACTION_COLORS[action] ?? '#94a3b8'
  return <span style={{ color, fontFamily: 'monospace', fontSize: 11, fontWeight: 600 }}>{action}</span>
}

function MetaCell({ meta }: { meta: Record<string, unknown> }) {
  if (Object.keys(meta).length === 0) return <span style={{ color: '#4b5563' }}>—</span>
  return (
    <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#94a3b8', wordBreak: 'break-all' }}>
      {JSON.stringify(meta).slice(0, 80)}{JSON.stringify(meta).length > 80 ? '…' : ''}
    </span>
  )
}

export default function AuditLog() {
  const [entries, setEntries] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [actionFilter, setActionFilter] = useState('')

  const load = useCallback(async (p: number, action: string) => {
    setLoading(true)
    try {
      const result = await adminApi.audit.list({ limit: PAGE_SIZE, offset: p * PAGE_SIZE, action: action || undefined })
      setEntries(result.rows)
      setHasMore(result.rows.length === PAGE_SIZE)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load audit log')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(page, actionFilter) }, [load, page, actionFilter])

  function applyFilter(action: string) {
    setActionFilter(action)
    setPage(0)
  }

  return (
    <div style={{ flex: 1 }}>
      <div style={S.header}>
        <div>
          <h1 style={S.h1}>Audit Log</h1>
          <p style={S.sub}>System-wide activity trail</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            style={S.select}
            value={actionFilter}
            onChange={e => applyFilter(e.target.value)}
          >
            <option value="">All actions</option>
            <option value="sync.push">sync.push</option>
            <option value="vessel.register">vessel.register</option>
            <option value="vessel.update">vessel.update</option>
            <option value="admin.update">admin.update</option>
          </select>
          <button style={{ padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer', border: '1px solid #1e3a5f', background: '#0f2040', color: '#60a5fa' }} onClick={() => load(page, actionFilter)}>
            Refresh
          </button>
        </div>
      </div>

      {error && <div style={{ color: '#f87171', marginBottom: 16, fontSize: 13 }}>{error}</div>}

      <div style={S.card}>
        <table style={S.table}>
          <thead>
            <tr>
              {['Timestamp', 'Action', 'Actor', 'Resource', 'Org', 'IP', 'Metadata'].map(h => (
                <th key={h} style={S.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ ...S.td, textAlign: 'center', color: '#4b5563', padding: 40 }}>Loading…</td></tr>
            ) : entries.length === 0 ? (
              <tr><td colSpan={7} style={{ ...S.td, textAlign: 'center', color: '#4b5563', padding: 40 }}>No entries found</td></tr>
            ) : entries.map(e => (
              <tr key={e.id}>
                <td style={S.td}>
                  <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap' }}>
                    {new Date(e.created_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'medium' })}
                  </div>
                </td>
                <td style={S.td}><ActionBadge action={e.action} /></td>
                <td style={S.td}>
                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#94a3b8' }}>
                    {e.actor?.slice(0, 20) ?? '—'}
                  </span>
                </td>
                <td style={S.td}>
                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#c9d4df' }}>
                    {e.resource?.slice(0, 24) ?? '—'}
                  </span>
                </td>
                <td style={S.td}>
                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#60a5fa' }}>
                    {e.org_id?.slice(0, 16) ?? '—'}
                  </span>
                </td>
                <td style={S.td}>
                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#4b5563' }}>{e.ip ?? '—'}</span>
                </td>
                <td style={S.td}><MetaCell meta={e.metadata} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 16 }}>
        <span style={{ fontSize: 12, color: '#4b5563' }}>Page {page + 1}</span>
        <button style={S.pgbtn(page === 0)} disabled={page === 0} onClick={() => setPage(p => p - 1)}>
          <ChevronLeft size={14} /> Prev
        </button>
        <button style={S.pgbtn(!hasMore)} disabled={!hasMore} onClick={() => setPage(p => p + 1)}>
          Next <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}
