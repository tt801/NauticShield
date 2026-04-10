import { useState, useEffect } from 'react'
import { adminApi, type AdminVessel } from '../api/client'
import { ExternalLink, PlusCircle } from 'lucide-react'

const PLAN_PRICE: Record<string, number> = {
  basic:      49,
  pro:        99,
  enterprise: 299,
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  active:   { bg: '#052e16', color: '#22c55e' },
  trialing: { bg: '#1c1917', color: '#f59e0b' },
  past_due: { bg: '#450a0a', color: '#f87171' },
  canceled: { bg: '#1a1a2e', color: '#6b7280' },
  unpaid:   { bg: '#450a0a', color: '#f87171' },
}

function Badge({ status }: { status: string }) {
  const { bg, color } = STATUS_COLORS[status] ?? { bg: '#1e293b', color: '#94a3b8' }
  return <span style={{ background: bg, color, padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{status}</span>
}

function StatCard({ label, value, sub, color = '#e8edf2' }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: '#0a0f18', border: '1px solid #131e2d', borderRadius: 12, padding: '20px 24px', flex: 1 }}>
      <div style={{ fontSize: 12, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color, marginBottom: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#6b7280' }}>{sub}</div>}
    </div>
  )
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function PaymentsDashboard() {
  const [vessels, setVessels] = useState<AdminVessel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Add vessel modal
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState({ org_id: '', name: '', plan: 'trial', subscription_status: 'trialing', trial_days: '14' })
  const [adding, setAdding] = useState(false)
  const [addMsg, setAddMsg] = useState('')

  async function load() {
    setLoading(true)
    try {
      const data = await adminApi.vessels.list()
      setVessels(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleAddVessel(e: React.FormEvent) {
    e.preventDefault()
    if (!addForm.org_id.trim() || !addForm.name.trim()) return
    setAdding(true)
    setAddMsg('')
    try {
      const trial_ends_at = new Date(Date.now() + Number(addForm.trial_days) * 86400_000).toISOString()
      await adminApi.vessels.create({
        org_id: addForm.org_id.trim(),
        name: addForm.name.trim(),
        plan: addForm.plan,
        subscription_status: addForm.subscription_status,
        trial_ends_at,
      })
      setAddMsg('Vessel created successfully')
      setAddForm({ org_id: '', name: '', plan: 'trial', subscription_status: 'trialing', trial_days: '14' })
      setTimeout(() => { setAddOpen(false); setAddMsg('') }, 1500)
      load()
    } catch (err) {
      setAddMsg(err instanceof Error ? err.message : 'Failed to create vessel')
    } finally {
      setAdding(false)
    }
  }

  const active    = vessels.filter(v => v.subscription_status === 'active')
  const trialing  = vessels.filter(v => v.subscription_status === 'trialing')
  const pastDue   = vessels.filter(v => ['past_due', 'unpaid'].includes(v.subscription_status ?? ''))
  const canceled  = vessels.filter(v => v.subscription_status === 'canceled')

  const mrr = active.reduce((sum, v) => sum + (PLAN_PRICE[v.plan ?? ''] ?? 0), 0)
  const trialMrr = trialing.reduce((sum, v) => sum + (PLAN_PRICE[v.plan ?? ''] ?? 0), 0)

  const groups = [
    { label: 'Past Due / Unpaid', vessels: pastDue, color: '#f87171' },
    { label: 'Active', vessels: active, color: '#22c55e' },
    { label: 'Trialing', vessels: trialing, color: '#f59e0b' },
    { label: 'Canceled', vessels: canceled, color: '#6b7280' },
  ].filter(g => g.vessels.length > 0)

  const STRIPE_DASHBOARD = 'https://dashboard.stripe.com'

  return (
    <div style={{ flex: 1 }}>
      {/* Add Test Vessel modal */}
      {addOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#0a0f18', border: '1px solid #1e2d3d', borderRadius: 14, padding: '32px', width: 420 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#e8edf2', marginBottom: 6 }}>Add Test Vessel</h2>
            <p style={{ fontSize: 12, color: '#4b5563', marginBottom: 20 }}>Create a vessel manually — no payment required. Use a Clerk user ID as the org_id.</p>
            <form onSubmit={handleAddVessel} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Clerk User ID (org_id)', key: 'org_id', placeholder: 'user_2abc123…' },
                { label: 'Vessel Name', key: 'name', placeholder: 'MY AURORA' },
              ].map(({ label, key, placeholder }) => (
                <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', letterSpacing: '0.05em' }}>{label}</label>
                  <input
                    required
                    placeholder={placeholder}
                    value={addForm[key as keyof typeof addForm]}
                    onChange={e => setAddForm(f => ({ ...f, [key]: e.target.value }))}
                    style={{ padding: '9px 13px', background: '#07090e', border: '1px solid #1e2d3d', borderRadius: 7, color: '#e8edf2', fontSize: 13, outline: 'none' }}
                  />
                </div>
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', letterSpacing: '0.05em' }}>Plan</label>
                  <select value={addForm.plan} onChange={e => setAddForm(f => ({ ...f, plan: e.target.value }))}
                    style={{ padding: '9px 10px', background: '#07090e', border: '1px solid #1e2d3d', borderRadius: 7, color: '#e8edf2', fontSize: 13, outline: 'none' }}>
                    <option value="trial">Trial</option>
                    <option value="coastal">Coastal</option>
                    <option value="superyacht">Superyacht</option>
                    <option value="fleet">Fleet</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', letterSpacing: '0.05em' }}>Status</label>
                  <select value={addForm.subscription_status} onChange={e => setAddForm(f => ({ ...f, subscription_status: e.target.value }))}
                    style={{ padding: '9px 10px', background: '#07090e', border: '1px solid #1e2d3d', borderRadius: 7, color: '#e8edf2', fontSize: 13, outline: 'none' }}>
                    <option value="trialing">Trialing</option>
                    <option value="active">Active</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', letterSpacing: '0.05em' }}>Trial days</label>
                  <input type="number" min={1} max={365} value={addForm.trial_days} onChange={e => setAddForm(f => ({ ...f, trial_days: e.target.value }))}
                    style={{ padding: '9px 10px', background: '#07090e', border: '1px solid #1e2d3d', borderRadius: 7, color: '#e8edf2', fontSize: 13, outline: 'none' }} />
                </div>
              </div>
              {addMsg && (
                <p style={{ fontSize: 13, color: addMsg.startsWith('Vessel') ? '#22c55e' : '#f87171' }}>{addMsg}</p>
              )}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="submit" disabled={adding} style={{ flex: 1, padding: '9px', borderRadius: 8, background: '#0ea5e9', color: '#fff', fontWeight: 600, fontSize: 13, border: 'none', cursor: 'pointer' }}>
                  {adding ? 'Creating…' : 'Create Vessel'}
                </button>
                <button type="button" onClick={() => { setAddOpen(false); setAddMsg('') }} style={{ padding: '9px 16px', borderRadius: 8, background: 'transparent', color: '#6b7280', fontWeight: 600, fontSize: 13, border: '1px solid #1e2d3d', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e8edf2', margin: 0 }}>Payments</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Subscription billing overview</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setAddOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 7, border: '1px solid #1e3a5f', background: '#0f2040', color: '#60a5fa', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
            <PlusCircle size={13} /> Add Test Vessel
          </button>
          <a
            href={STRIPE_DASHBOARD}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 7, border: '1px solid #1e3a5f', background: '#0f2040', color: '#60a5fa', fontSize: 12, fontWeight: 500, textDecoration: 'none' }}
          >
            <ExternalLink size={13} /> Stripe Dashboard
          </a>
          <button onClick={load} style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: '1px solid #1e3a5f', background: '#0f2040', color: '#60a5fa' }}>
            Refresh
          </button>
        </div>
      </div>

      {error && <div style={{ color: '#f87171', marginBottom: 16, fontSize: 13 }}>{error}</div>}

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 28, flexWrap: 'wrap' }}>
        <StatCard label="Monthly Recurring Revenue" value={`$${mrr.toLocaleString()}`} sub={`${active.length} active vessel${active.length !== 1 ? 's' : ''}`} color="#22c55e" />
        <StatCard label="Trial Pipeline" value={`$${trialMrr.toLocaleString()}`} sub={`${trialing.length} trialing`} color="#f59e0b" />
        <StatCard label="Total Vessels" value={vessels.length} sub="across all orgs" />
        <StatCard label="Needs Attention" value={pastDue.length} sub="past due or unpaid" color={pastDue.length > 0 ? '#f87171' : '#6b7280'} />
      </div>

      {loading ? (
        <div style={{ color: '#4b5563', textAlign: 'center', padding: 40 }}>Loading…</div>
      ) : (
        groups.map(group => (
          <div key={group.label} style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, color: group.color, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
              {group.label} ({group.vessels.length})
            </h2>
            <div style={{ background: '#0a0f18', border: '1px solid #131e2d', borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Vessel', 'Plan', 'Status', 'Renewal / Trial End', 'Stripe Customer', 'Stripe Sub'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid #131e2d', background: '#080c12' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.vessels.map(v => (
                    <tr key={v.id}>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: '#c9d4df', borderBottom: '1px solid #0d1420' }}>
                        <div style={{ fontWeight: 600, color: '#e8edf2' }}>{v.name}</div>
                        <div style={{ fontSize: 11, color: '#4b5563' }}>{v.org_id?.slice(0, 16)}…</div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: '#c9d4df', borderBottom: '1px solid #0d1420', textTransform: 'capitalize' }}>{v.plan ?? 'trial'}</td>
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid #0d1420' }}><Badge status={v.subscription_status ?? 'trialing'} /></td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#c9d4df', borderBottom: '1px solid #0d1420' }}>
                        {fmtDate(v.current_period_end ?? v.trial_ends_at)}
                      </td>
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid #0d1420' }}>
                        {v.stripe_customer_id ? (
                          <a
                            href={`${STRIPE_DASHBOARD}/customers/${v.stripe_customer_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#60a5fa', fontSize: 12, fontFamily: 'monospace', textDecoration: 'none' }}
                          >
                            {v.stripe_customer_id.slice(0, 18)}… ↗
                          </a>
                        ) : <span style={{ color: '#4b5563' }}>—</span>}
                      </td>
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid #0d1420' }}>
                        {v.stripe_subscription_id ? (
                          <a
                            href={`${STRIPE_DASHBOARD}/subscriptions/${v.stripe_subscription_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#60a5fa', fontSize: 12, fontFamily: 'monospace', textDecoration: 'none' }}
                          >
                            {v.stripe_subscription_id.slice(0, 18)}… ↗
                          </a>
                        ) : <span style={{ color: '#4b5563' }}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
