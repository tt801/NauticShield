import { useState, useEffect } from 'react'
import { adminApi, type AdminVessel } from '../api/client'

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  active:      { bg: '#052e16', color: '#22c55e' },
  trialing:    { bg: '#1c1917', color: '#f59e0b' },
  past_due:    { bg: '#450a0a', color: '#f87171' },
  canceled:    { bg: '#1a1a2e', color: '#6b7280' },
  unpaid:      { bg: '#450a0a', color: '#f87171' },
};

function Badge({ status }: { status: string }) {
  const { bg, color } = STATUS_COLORS[status] ?? { bg: '#1e293b', color: '#94a3b8' }
  return (
    <span style={{ background: bg, color, padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {status}
    </span>
  )
}

function timeAgo(iso: string | null) {
  if (!iso) return <span style={{ color: '#4b5563' }}>Never</span>
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return <span style={{ color: '#22c55e' }}>Just now</span>
  if (mins < 60) return <span style={{ color: '#22c55e' }}>{mins}m ago</span>
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return <span style={{ color: '#f59e0b' }}>{hrs}h ago</span>
  return <span style={{ color: '#ef4444' }}>{Math.floor(hrs / 24)}d ago</span>
}

const S = {
  header:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 } as React.CSSProperties,
  h1:       { fontSize: 22, fontWeight: 700, color: '#e8edf2', margin: 0 } as React.CSSProperties,
  sub:      { fontSize: 13, color: '#6b7280', marginTop: 4 } as React.CSSProperties,
  card:     { background: '#0a0f18', border: '1px solid #131e2d', borderRadius: 12, overflow: 'hidden' } as React.CSSProperties,
  table:    { width: '100%', borderCollapse: 'collapse' as const },
  th:       { padding: '11px 16px', textAlign: 'left' as const, fontSize: 11, fontWeight: 600, color: '#4b5563', textTransform: 'uppercase' as const, letterSpacing: '0.08em', borderBottom: '1px solid #131e2d', background: '#080c12' },
  td:       { padding: '13px 16px', fontSize: 13, color: '#c9d4df', borderBottom: '1px solid #0d1420', verticalAlign: 'middle' as const },
  btn:      { padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: '1px solid #1e3a5f', background: '#0f2040', color: '#60a5fa' } as React.CSSProperties,
  modal:    { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  mbox:     { background: '#0a0f18', border: '1px solid #1e3a5f', borderRadius: 14, padding: 28, width: 400, maxWidth: '90vw' },
  label:    { fontSize: 12, color: '#6b7280', marginBottom: 6, display: 'block' } as React.CSSProperties,
  select:   { width: '100%', padding: '8px 10px', background: '#07090e', border: '1px solid #1e3a5f', borderRadius: 7, color: '#e8edf2', fontSize: 13, marginBottom: 14 } as React.CSSProperties,
  savebtn:  { padding: '8px 20px', borderRadius: 7, border: 'none', background: '#0ea5e9', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' } as React.CSSProperties,
  cancelbtn:{ padding: '8px 16px', borderRadius: 7, border: '1px solid #1e3a5f', background: 'transparent', color: '#94a3b8', fontSize: 13, cursor: 'pointer', marginRight: 10 } as React.CSSProperties,
}

export default function FleetOverview() {
  const [vessels, setVessels] = useState<AdminVessel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<AdminVessel | null>(null)
  const [plan, setPlan] = useState('')
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const data = await adminApi.vessels.list()
      setVessels(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load vessels')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function openEdit(v: AdminVessel) {
    setEditing(v)
    setPlan(v.plan ?? 'trial')
    setStatus(v.subscription_status ?? 'trialing')
  }

  async function save() {
    if (!editing) return
    setSaving(true)
    try {
      await adminApi.vessels.update(editing.id, { plan, subscription_status: status })
      setEditing(null)
      await load()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ flex: 1 }}>
      <div style={S.header}>
        <div>
          <h1 style={S.h1}>Fleet Overview</h1>
          <p style={S.sub}>{loading ? '...' : `${vessels.length} vessel${vessels.length !== 1 ? 's' : ''} registered`}</p>
        </div>
        <button style={S.btn} onClick={load}>Refresh</button>
      </div>

      {error && <div style={{ color: '#f87171', marginBottom: 16, fontSize: 13 }}>{error}</div>}

      <div style={S.card}>
        <table style={S.table}>
          <thead>
            <tr>
              {['Vessel', 'Org ID', 'Plan', 'Subscription', 'Last Synced', 'Registered', 'Actions'].map(h => (
                <th key={h} style={S.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ ...S.td, textAlign: 'center', color: '#4b5563', padding: 40 }}>Loading…</td></tr>
            ) : vessels.length === 0 ? (
              <tr><td colSpan={7} style={{ ...S.td, textAlign: 'center', color: '#4b5563', padding: 40 }}>No vessels found</td></tr>
            ) : (vessels as AdminVessel[]).map(v => (
              <tr key={v.id} style={{ transition: 'background 0.1s' }}>
                <td style={S.td}>
                  <div style={{ fontWeight: 600, color: '#e8edf2' }}>{v.name}</div>
                  <div style={{ fontSize: 11, color: '#4b5563', fontFamily: 'monospace', marginTop: 2 }}>{v.id.slice(0, 8)}…</div>
                </td>
                <td style={S.td}><span style={{ fontFamily: 'monospace', fontSize: 12, color: '#60a5fa' }}>{v.org_id?.slice(0, 20) ?? '—'}</span></td>
                <td style={S.td}><span style={{ textTransform: 'capitalize' }}>{v.plan ?? 'trial'}</span></td>
                <td style={S.td}><Badge status={v.subscription_status ?? 'trialing'} /></td>
                <td style={S.td}>{timeAgo(v.last_synced_at)}</td>
                <td style={S.td}><span style={{ fontSize: 12, color: '#4b5563' }}>{v.created_at ? new Date(v.created_at).toLocaleDateString() : '—'}</span></td>
                <td style={S.td}>
                  <button style={S.btn} onClick={() => openEdit(v)}>Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div style={S.modal} onClick={e => { if (e.target === e.currentTarget) setEditing(null) }}>
          <div style={S.mbox}>
            <h2 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700, color: '#e8edf2' }}>Edit {editing.name}</h2>
            <label style={S.label}>Plan</label>
            <select style={S.select} value={plan} onChange={e => setPlan(e.target.value)}>
              <option value="trial">Trial</option>
              <option value="basic">Basic</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
            <label style={S.label}>Subscription Status</label>
            <select style={S.select} value={status} onChange={e => setStatus(e.target.value)}>
              <option value="trialing">Trialing</option>
              <option value="active">Active</option>
              <option value="past_due">Past Due</option>
              <option value="canceled">Canceled</option>
              <option value="unpaid">Unpaid</option>
            </select>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button style={S.cancelbtn} onClick={() => setEditing(null)}>Cancel</button>
              <button style={S.savebtn} onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
