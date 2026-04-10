import { useState, useEffect, useRef } from 'react'
import { useUser } from '@clerk/clerk-react'
import { adminApi, type AdminUser } from '../api/client'
import { Shield, UserCheck, UserPlus, Trash2, Ban, RefreshCw, ShieldOff, KeyRound, Search } from 'lucide-react'

const ROLE_META: Record<string, { label: string; color: string; bg: string; desc: string }> = {
  admin:   { label: 'Admin',   color: '#60a5fa', bg: '#1e3a5f', desc: 'Full access — fleet, customers, payments, team, shell' },
  support: { label: 'Support', color: '#f59e0b', bg: '#2d2006', desc: 'Read-only access to fleet, customers, and audit log' },
}

// ── Shared styles ──────────────────────────────────────────────────
const S = {
  header:  { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 } as React.CSSProperties,
  h1:      { fontSize: 22, fontWeight: 700, color: '#e8edf2', margin: 0 } as React.CSSProperties,
  sub:     { fontSize: 13, color: '#6b7280', marginTop: 4 } as React.CSSProperties,
  card:    { background: '#0a0f18', border: '1px solid #131e2d', borderRadius: 12, overflow: 'hidden', marginBottom: 28 } as React.CSSProperties,
  table:   { width: '100%', borderCollapse: 'collapse' as const },
  th:      { padding: '11px 16px', textAlign: 'left' as const, fontSize: 11, fontWeight: 600, color: '#4b5563', textTransform: 'uppercase' as const, letterSpacing: '0.08em', borderBottom: '1px solid #131e2d', background: '#080c12' },
  td:      { padding: '12px 16px', fontSize: 13, color: '#c9d4df', borderBottom: '1px solid #0d1420', verticalAlign: 'middle' as const },
  select:  { padding: '5px 8px', background: '#07090e', border: '1px solid #1e3a5f', borderRadius: 7, color: '#e8edf2', fontSize: 12, cursor: 'pointer' } as React.CSSProperties,
  input:   { width: '100%', padding: '8px 12px', background: '#07090e', border: '1px solid #1e3a5f', borderRadius: 8, color: '#e8edf2', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const } as React.CSSProperties,
  label:   { display: 'block', fontSize: 11, color: '#6b7280', marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '0.05em' } as React.CSSProperties,
  btn:     (variant: 'primary' | 'danger' | 'ghost' | 'warn') => ({
    padding: '5px 10px', borderRadius: 7, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 500,
    border:      variant === 'primary' ? '1px solid #1e4a8f' : variant === 'danger' ? '1px solid #7f1d1d' : variant === 'warn' ? '1px solid #78350f' : '1px solid #1e2a3a',
    background:  variant === 'primary' ? '#0f2040'          : variant === 'danger' ? '#2a0808'          : variant === 'warn' ? '#2a1500'          : '#07090e',
    color:       variant === 'primary' ? '#60a5fa'          : variant === 'danger' ? '#f87171'          : variant === 'warn' ? '#fbbf24'          : '#94a3b8',
  } as React.CSSProperties),
}

function RoleBadge({ role }: { role: string }) {
  const m = ROLE_META[role]
  if (!m) return <span style={{ color: '#4b5563', fontSize: 11 }}>—</span>
  return <span style={{ background: m.bg, color: m.color, padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{m.label}</span>
}

function BannedBadge() {
  return <span style={{ background: '#300', color: '#f87171', padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>Banned</span>
}

// ── Invite Modal ────────────────────────────────────────────────────
interface InviteModalProps { onClose(): void; onDone(): void }
function InviteModal({ onClose, onDone }: InviteModalProps) {
  const [email, setEmail] = useState('')
  const [role, setRole]   = useState<'admin' | 'support'>('support')
  const [busy, setBusy]   = useState(false)
  const [err, setErr]     = useState('')
  const [ok, setOk]       = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus() }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) { setErr('Email is required'); return }
    setBusy(true); setErr(''); setOk('')
    try {
      const res = await adminApi.team.invite(email.trim(), role)
      setOk(res.message ?? `Invitation sent to ${email}`)
      setTimeout(() => { onDone(); onClose() }, 1400)
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : 'Failed to send invitation')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#0a0f18', border: '1px solid #1e3a5f', borderRadius: 14, padding: 28, width: 400, maxWidth: '90vw' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: '#e8edf2' }}>Invite Team Member</span>
          <button style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 18, lineHeight: 1 }} onClick={onClose}>×</button>
        </div>
        <form onSubmit={submit}>
          <div style={{ marginBottom: 16 }}>
            <label style={S.label}>Email address</label>
            <input ref={inputRef} type="email" style={S.input} value={email} onChange={e => setEmail(e.target.value)} placeholder="alex@example.com" />
          </div>
          <div style={{ marginBottom: 22 }}>
            <label style={S.label}>Role</label>
            <select style={{ ...S.select, width: '100%', padding: '8px 12px' }} value={role} onChange={e => setRole(e.target.value as 'admin' | 'support')}>
              <option value="support">Support — read-only</option>
              <option value="admin">Admin — full access</option>
            </select>
          </div>
          {err && <div style={{ color: '#f87171', fontSize: 12, marginBottom: 12 }}>{err}</div>}
          {ok  && <div style={{ color: '#22c55e', fontSize: 12, marginBottom: 12 }}>{ok}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" style={S.btn('ghost')} onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" style={{ ...S.btn('primary'), opacity: busy ? 0.6 : 1 }} disabled={busy}>
              <UserPlus size={13} />{busy ? 'Sending…' : 'Send Invitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Confirm Dialog ──────────────────────────────────────────────────
interface ConfirmProps { title: string; message: string; danger?: boolean; onConfirm(): void; onClose(): void }
function ConfirmDialog({ title, message, danger, onConfirm, onClose }: ConfirmProps) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#0a0f18', border: '1px solid #1e3a5f', borderRadius: 14, padding: 28, width: 360, maxWidth: '90vw' }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#e8edf2', marginBottom: 10 }}>{title}</div>
        <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 24 }}>{message}</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button style={S.btn('ghost')} onClick={onClose}>Cancel</button>
          <button style={S.btn(danger ? 'danger' : 'primary')} onClick={() => { onConfirm(); onClose() }}>Confirm</button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────────────
type OwnAction = { type: string; userId: string }

export default function TeamAccess() {
  const { user: currentUser } = useUser()
  const [users, setUsers]       = useState<AdminUser[]>([])
  const [loading, setLoading]   = useState(true)
  const [busy, setBusy]         = useState<OwnAction | null>(null)
  const [toast, setToast]       = useState<{ msg: string; ok: boolean } | null>(null)
  const [showInvite, setShowInvite] = useState(false)
  const [confirm, setConfirm]   = useState<{ title: string; message: string; danger?: boolean; onConfirm(): void } | null>(null)
  const [search, setSearch]     = useState('')

  function notify(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  async function load() {
    setLoading(true)
    try {
      const data = await adminApi.users.list()
      const staff = data.filter(u => u.role === 'admin' || u.role === 'support')
      const rest  = data.filter(u => u.role !== 'admin' && u.role !== 'support')
      setUsers([...staff, ...rest])
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : 'Failed to load users', false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function doAction(type: string, userId: string, fn: () => Promise<unknown>) {
    setBusy({ type, userId })
    try {
      await fn()
      await load()
      notify(type === 'role' ? 'Role updated' : type === 'delete' ? 'User deleted' : type === 'ban' ? 'User banned' : type === 'unban' ? 'User unbanned' : 'Password reset email sent')
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : 'Action failed', false)
    } finally {
      setBusy(null)
    }
  }

  const isBusy = (type: string, userId: string) => busy?.type === type && busy.userId === userId
  const anyBusy = (userId: string) => busy?.userId === userId

  const staffCount = users.filter(u => u.role === 'admin' || u.role === 'support').length

  const filtered = users.filter(u => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return u.email.toLowerCase().includes(q) || (u.name ?? '').toLowerCase().includes(q)
  })

  return (
    <div style={{ flex: 1 }}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <h1 style={S.h1}>Team Access</h1>
          <p style={S.sub}>Internal NauticShield staff — {staffCount} member{staffCount !== 1 ? 's' : ''} with portal access</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={S.btn('ghost')} onClick={load} disabled={loading}>
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : undefined }} />
            Refresh
          </button>
          <button style={S.btn('primary')} onClick={() => setShowInvite(true)}>
            <UserPlus size={13} />
            Invite Member
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ color: toast.ok ? '#22c55e' : '#f87171', background: toast.ok ? '#052e1620' : '#450a0a20', border: `1px solid ${toast.ok ? '#052e16' : '#450a0a'}`, borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
          {toast.msg}
        </div>
      )}

      {/* Role legend */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {Object.entries(ROLE_META).map(([key, m]) => (
          <div key={key} style={{ background: '#0a0f18', border: `1px solid #1a2535`, borderRadius: 10, padding: '10px 14px', flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              {key === 'admin' ? <Shield size={13} color={m.color} /> : <UserCheck size={13} color={m.color} />}
              <span style={{ fontWeight: 700, color: m.color, fontSize: 12 }}>{m.label}</span>
            </div>
            <div style={{ fontSize: 11, color: '#4b5563' }}>{m.desc}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#4b5563', pointerEvents: 'none' }} />
        <input
          style={{ ...S.input, paddingLeft: 32, maxWidth: 320 }}
          placeholder="Search by name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div style={S.card}>
        <table style={S.table}>
          <thead>
            <tr>
              {['User', 'Status', 'Role', 'Change Role', 'Actions', 'Last Sign-in'].map(h => (
                <th key={h} style={S.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ ...S.td, textAlign: 'center', color: '#4b5563', padding: 40 }}>Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ ...S.td, textAlign: 'center', color: '#4b5563', padding: 40 }}>
                {search ? 'No users match your search' : 'No users found'}
              </td></tr>
            ) : filtered.map(u => {
              const isMe = u.id === currentUser?.id
              const disabled = anyBusy(u.id)
              return (
                <tr key={u.id} style={{ opacity: u.banned ? 0.75 : 1 }}>
                  {/* User */}
                  <td style={S.td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {u.imageUrl && (
                        <img src={u.imageUrl} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                      )}
                      <div>
                        <div style={{ fontWeight: 600, color: '#e8edf2', fontSize: 13 }}>
                          {u.name ?? '—'}
                          {isMe && <span style={{ marginLeft: 6, fontSize: 10, color: '#60a5fa', background: '#1e3a5f', padding: '1px 5px', borderRadius: 8 }}>you</span>}
                        </div>
                        <div style={{ fontSize: 11, color: '#4b5563' }}>{u.email}</div>
                      </div>
                    </div>
                  </td>

                  {/* Status */}
                  <td style={S.td}>
                    {u.banned ? <BannedBadge /> : <span style={{ color: '#22c55e', fontSize: 11 }}>Active</span>}
                  </td>

                  {/* Current role */}
                  <td style={S.td}><RoleBadge role={u.role} /></td>

                  {/* Change role */}
                  <td style={S.td}>
                    {isMe ? (
                      <span style={{ fontSize: 11, color: '#4b5563' }}>—</span>
                    ) : (
                      <select
                        style={{ ...S.select, opacity: disabled ? 0.5 : 1 }}
                        value={['admin', 'support'].includes(u.role) ? u.role : ''}
                        disabled={disabled}
                        onChange={e => {
                          if (e.target.value) doAction('role', u.id, () => adminApi.team.setRole(u.id, e.target.value))
                        }}
                      >
                        <option value="">— set role —</option>
                        <option value="admin">Admin</option>
                        <option value="support">Support</option>
                      </select>
                    )}
                    {isBusy('role', u.id) && <span style={{ marginLeft: 6, fontSize: 10, color: '#6b7280' }}>Saving…</span>}
                  </td>

                  {/* Actions */}
                  <td style={{ ...S.td, whiteSpace: 'nowrap' as const }}>
                    {isMe ? (
                      <span style={{ fontSize: 11, color: '#4b5563' }}>—</span>
                    ) : (
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {/* Ban / Unban */}
                        {u.banned ? (
                          <button
                            style={{ ...S.btn('warn'), opacity: disabled ? 0.5 : 1 }}
                            disabled={disabled}
                            title="Unban user"
                            onClick={() => doAction('unban', u.id, () => adminApi.team.unban(u.id))}
                          >
                            <ShieldOff size={12} />
                            {isBusy('unban', u.id) ? '…' : 'Unban'}
                          </button>
                        ) : (
                          <button
                            style={{ ...S.btn('warn'), opacity: disabled ? 0.5 : 1 }}
                            disabled={disabled}
                            title="Ban user"
                            onClick={() => setConfirm({
                              title: 'Ban user?',
                              message: `${u.name ?? u.email} will be immediately signed out and blocked from signing back in.`,
                              danger: true,
                              onConfirm: () => doAction('ban', u.id, () => adminApi.team.ban(u.id)),
                            })}
                          >
                            <Ban size={12} />
                            {isBusy('ban', u.id) ? '…' : 'Ban'}
                          </button>
                        )}

                        {/* Password reset */}
                        <button
                          style={{ ...S.btn('ghost'), opacity: disabled ? 0.5 : 1 }}
                          disabled={disabled}
                          title="Send password reset"
                          onClick={() => doAction('reset', u.id, () => adminApi.team.resetPassword(u.id))}
                        >
                          <KeyRound size={12} />
                          {isBusy('reset', u.id) ? '…' : 'Reset pwd'}
                        </button>

                        {/* Delete */}
                        <button
                          style={{ ...S.btn('danger'), opacity: disabled ? 0.5 : 1 }}
                          disabled={disabled}
                          title="Delete user"
                          onClick={() => setConfirm({
                            title: 'Delete user?',
                            message: `This will permanently delete ${u.name ?? u.email}'s account. This cannot be undone.`,
                            danger: true,
                            onConfirm: () => doAction('delete', u.id, () => adminApi.team.deleteUser(u.id)),
                          })}
                        >
                          <Trash2 size={12} />
                          {isBusy('delete', u.id) ? '…' : 'Delete'}
                        </button>
                      </div>
                    )}
                  </td>

                  {/* Last sign-in */}
                  <td style={S.td}>
                    <span style={{ fontSize: 12, color: '#4b5563' }}>
                      {u.lastSignIn
                        ? new Date(u.lastSignIn).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '—'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {showInvite && <InviteModal onClose={() => setShowInvite(false)} onDone={load} />}
      {confirm    && <ConfirmDialog {...confirm} onClose={() => setConfirm(null)} />}

      <style>{`@keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }`}</style>
    </div>
  )
}
