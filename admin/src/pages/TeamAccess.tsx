import { useState, useEffect } from 'react'
import { useUser } from '@clerk/clerk-react'
import { adminApi, type AdminUser } from '../api/client'
import { Shield, UserCheck } from 'lucide-react'

const ROLE_META: Record<string, { label: string; color: string; bg: string; desc: string }> = {
  admin:   { label: 'Admin',   color: '#60a5fa', bg: '#1e3a5f', desc: 'Full access — fleet, customers, payments, team, shell' },
  support: { label: 'Support', color: '#f59e0b', bg: '#2d2006', desc: 'Read-only access to fleet, customers, and audit log' },
}

const S = {
  header:  { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 } as React.CSSProperties,
  h1:      { fontSize: 22, fontWeight: 700, color: '#e8edf2', margin: 0 } as React.CSSProperties,
  sub:     { fontSize: 13, color: '#6b7280', marginTop: 4 } as React.CSSProperties,
  card:    { background: '#0a0f18', border: '1px solid #131e2d', borderRadius: 12, overflow: 'hidden', marginBottom: 28 } as React.CSSProperties,
  table:   { width: '100%', borderCollapse: 'collapse' as const },
  th:      { padding: '11px 16px', textAlign: 'left' as const, fontSize: 11, fontWeight: 600, color: '#4b5563', textTransform: 'uppercase' as const, letterSpacing: '0.08em', borderBottom: '1px solid #131e2d', background: '#080c12' },
  td:      { padding: '14px 16px', fontSize: 13, color: '#c9d4df', borderBottom: '1px solid #0d1420', verticalAlign: 'middle' as const },
  select:  { padding: '6px 10px', background: '#07090e', border: '1px solid #1e3a5f', borderRadius: 7, color: '#e8edf2', fontSize: 12, cursor: 'pointer' } as React.CSSProperties,
  info:    { background: '#080c12', border: '1px solid #131e2d', borderRadius: 10, padding: '16px 20px' } as React.CSSProperties,
}

function RoleBadge({ role }: { role: string }) {
  const m = ROLE_META[role]
  if (!m) return <span style={{ color: '#4b5563', fontSize: 12 }}>—</span>
  return <span style={{ background: m.bg, color: m.color, padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{m.label}</span>
}

export default function TeamAccess() {
  const { user: currentUser } = useUser()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null) // userId being saved
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function load() {
    setLoading(true)
    try {
      const data = await adminApi.users.list()
      // Show only staff (role = admin or support), sorted by role then name
      const staff = data.filter(u => u.role === 'admin' || u.role === 'support')
      const rest  = data.filter(u => u.role !== 'admin' && u.role !== 'support')
      setUsers([...staff, ...rest])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function changeRole(userId: string, role: string) {
    setSaving(userId)
    setError('')
    setSuccess('')
    try {
      await adminApi.team.setRole(userId, role)
      setSuccess('Role updated successfully')
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update role')
    } finally {
      setSaving(null)
    }
  }

  const staffCount = users.filter(u => u.role === 'admin' || u.role === 'support').length

  return (
    <div style={{ flex: 1 }}>
      <div style={S.header}>
        <div>
          <h1 style={S.h1}>Team Access</h1>
          <p style={S.sub}>Internal NauticShield staff — {staffCount} member{staffCount !== 1 ? 's' : ''} with portal access</p>
        </div>
        <button
          style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid #1e3a5f', background: '#0f2040', color: '#60a5fa', fontSize: 12, cursor: 'pointer' }}
          onClick={load}
        >
          Refresh
        </button>
      </div>

      {error   && <div style={{ color: '#f87171', background: '#450a0a20', border: '1px solid #450a0a', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>{error}</div>}
      {success && <div style={{ color: '#22c55e', background: '#052e1620', border: '1px solid #052e16', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>{success}</div>}

      {/* Role legend */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {Object.entries(ROLE_META).map(([key, m]) => (
          <div key={key} style={{ background: '#0a0f18', border: `1px solid ${m.bg}`, borderRadius: 10, padding: '12px 16px', flex: 1, minWidth: 220 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              {key === 'admin' ? <Shield size={14} color={m.color} /> : <UserCheck size={14} color={m.color} />}
              <span style={{ fontWeight: 700, color: m.color, fontSize: 13 }}>{m.label}</span>
            </div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>{m.desc}</div>
          </div>
        ))}
      </div>

      <div style={S.card}>
        <table style={S.table}>
          <thead>
            <tr>
              {['User', 'Email', 'Current Role', 'Change Role', 'Last Sign-in'].map(h => (
                <th key={h} style={S.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ ...S.td, textAlign: 'center', color: '#4b5563', padding: 40 }}>Loading…</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={5} style={{ ...S.td, textAlign: 'center', color: '#4b5563', padding: 40 }}>No users found</td></tr>
            ) : users.map(u => {
              const isCurrentUser = u.id === currentUser?.id
              const isSaving = saving === u.id
              return (
                <tr key={u.id}>
                  <td style={S.td}>
                    <div style={{ fontWeight: 600, color: '#e8edf2' }}>
                      {u.name ?? '—'}
                      {isCurrentUser && <span style={{ marginLeft: 8, fontSize: 10, color: '#60a5fa', background: '#1e3a5f', padding: '1px 6px', borderRadius: 10 }}>you</span>}
                    </div>
                    <div style={{ fontSize: 11, color: '#4b5563', fontFamily: 'monospace' }}>{u.id.slice(0, 18)}…</div>
                  </td>
                  <td style={S.td}><span style={{ color: '#60a5fa' }}>{u.email}</span></td>
                  <td style={S.td}><RoleBadge role={u.role} /></td>
                  <td style={S.td}>
                    {isCurrentUser ? (
                      <span style={{ fontSize: 12, color: '#4b5563' }}>Cannot change own role</span>
                    ) : (
                      <select
                        style={{ ...S.select, opacity: isSaving ? 0.5 : 1 }}
                        value={u.role === 'admin' || u.role === 'support' ? u.role : ''}
                        disabled={isSaving}
                        onChange={e => { if (e.target.value) changeRole(u.id, e.target.value) }}
                      >
                        <option value="">— set role —</option>
                        <option value="admin">Admin</option>
                        <option value="support">Support</option>
                      </select>
                    )}
                    {isSaving && <span style={{ marginLeft: 8, fontSize: 11, color: '#6b7280' }}>Saving…</span>}
                  </td>
                  <td style={S.td}>
                    <span style={{ fontSize: 12, color: '#4b5563' }}>
                      {u.lastSignIn ? new Date(u.lastSignIn).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Note about invite flow */}
      <div style={S.info}>
        <div style={{ fontSize: 12, color: '#6b7280', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <span style={{ color: '#f59e0b', flexShrink: 0 }}>ℹ</span>
          <span>
            To invite new team members, add them via the{' '}
            <a href="https://dashboard.clerk.com" target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa' }}>Clerk Dashboard</a>,
            then set their role here. Users without a role will see "Access Denied" when they visit the admin portal.
          </span>
        </div>
      </div>
    </div>
  )
}
