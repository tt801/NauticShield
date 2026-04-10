import { useState, useEffect } from 'react'
import { adminApi, type AdminUser } from '../api/client'

const S = {
  header:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 } as React.CSSProperties,
  h1:      { fontSize: 22, fontWeight: 700, color: '#e8edf2', margin: 0 } as React.CSSProperties,
  sub:     { fontSize: 13, color: '#6b7280', marginTop: 4 } as React.CSSProperties,
  card:    { background: '#0a0f18', border: '1px solid #131e2d', borderRadius: 12, overflow: 'hidden' } as React.CSSProperties,
  table:   { width: '100%', borderCollapse: 'collapse' as const },
  th:      { padding: '11px 16px', textAlign: 'left' as const, fontSize: 11, fontWeight: 600, color: '#4b5563', textTransform: 'uppercase' as const, letterSpacing: '0.08em', borderBottom: '1px solid #131e2d', background: '#080c12' },
  td:      { padding: '13px 16px', fontSize: 13, color: '#c9d4df', borderBottom: '1px solid #0d1420', verticalAlign: 'middle' as const },
  btn:     { padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: '1px solid #1e3a5f', background: '#0f2040', color: '#60a5fa' } as React.CSSProperties,
  search:  { padding: '8px 14px', background: '#07090e', border: '1px solid #131e2d', borderRadius: 8, color: '#e8edf2', fontSize: 13, width: 260 } as React.CSSProperties,
  avatar:  { width: 30, height: 30, borderRadius: '50%', background: '#131e2d', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa', fontSize: 12, fontWeight: 700, flexShrink: 0 } as React.CSSProperties,
}

function Avatar({ user }: { user: AdminUser }) {
  const initials = (user.name ?? user.email)[0].toUpperCase()
  return (
    <div style={S.avatar}>
      {user.imageUrl
        ? <img src={user.imageUrl} alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover' }} />
        : initials}
    </div>
  )
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function CustomerManagement() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  async function load() {
    setLoading(true)
    try {
      const data = await adminApi.users.list()
      setUsers(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = users.filter(u => {
    const q = query.toLowerCase()
    return !q ||
      u.email.toLowerCase().includes(q) ||
      (u.name ?? '').toLowerCase().includes(q)
  })

  return (
    <div style={{ flex: 1 }}>
      <div style={S.header}>
        <div>
          <h1 style={S.h1}>Customers</h1>
          <p style={S.sub}>{loading ? '...' : `${users.length} user${users.length !== 1 ? 's' : ''}`}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            style={S.search}
            placeholder="Search by name or email…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <button style={S.btn} onClick={load}>Refresh</button>
        </div>
      </div>

      {error && <div style={{ color: '#f87171', marginBottom: 16, fontSize: 13 }}>{error}</div>}

      <div style={S.card}>
        <table style={S.table}>
          <thead>
            <tr>
              {['User', 'Email', 'Role', 'Last Sign-in', 'Joined'].map(h => (
                <th key={h} style={S.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ ...S.td, textAlign: 'center', color: '#4b5563', padding: 40 }}>Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} style={{ ...S.td, textAlign: 'center', color: '#4b5563', padding: 40 }}>No users found</td></tr>
            ) : filtered.map(u => (
              <tr key={u.id}>
                <td style={S.td}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar user={u} />
                    <div>
                      <div style={{ fontWeight: 600, color: '#e8edf2' }}>{u.name ?? '—'}</div>
                      <div style={{ fontSize: 11, color: '#4b5563', fontFamily: 'monospace' }}>{u.id.slice(0, 16)}…</div>
                    </div>
                  </div>
                </td>
                <td style={S.td}><span style={{ color: '#60a5fa' }}>{u.email}</span></td>
                <td style={S.td}>
                  {u.role === 'admin'
                    ? <span style={{ background: '#1e3a5f', color: '#60a5fa', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>ADMIN</span>
                    : <span style={{ background: '#1e293b', color: '#94a3b8', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>USER</span>
                  }
                </td>
                <td style={S.td}><span style={{ fontSize: 12 }}>{fmtDate(u.lastSignIn)}</span></td>
                <td style={S.td}><span style={{ fontSize: 12 }}>{fmtDate(u.createdAt)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

