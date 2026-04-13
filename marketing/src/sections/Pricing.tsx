import { useState } from 'react'
import { Check } from 'lucide-react'

const CLOUD_API = 'https://nautic-shield.vercel.app'

async function startCheckout(plan: string) {
  try {
    const res = await fetch(`${CLOUD_API}/api/stripe/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    })
    const data = await res.json() as { url?: string; error?: string }
    if (data.url) {
      window.location.href = data.url
    } else {
      alert(data.error ?? 'Could not start checkout. Please try again.')
    }
  } catch {
    alert('Connection error. Please try again.')
  }
}

const PLANS = [
  {
    name: 'Coastal',
    checkoutPlan: 'coastal',
    tagline: 'For day-sailers & coastal cruisers',
    price: '2,400',
    period: '/year',
    vessels: '1 vessel',
    highlight: false,
    features: [
      '14-day free trial included',
      'Continuous network monitoring',
      'Automated threat alerts',
      'Monthly vulnerability scan',
      'Self-service dashboard',
      'IMO compliance reports',
      'Email support (48h SLA)',
    ],
    cta: 'Start Coastal',
  },
  {
    name: 'Superyacht',
    checkoutPlan: 'superyacht',
    tagline: 'For private superyachts & expedition vessels',
    price: '9,600',
    period: '/year',
    vessels: 'Up to 3 vessels',
    highlight: true,
    features: [
      'Everything in Coastal',
      'Quarterly penetration testing',
      'Dedicated security analyst',
      'Encrypted remote shell access',
      'Zero-log architecture guarantee',
      '24/7 incident response hotline',
      'Priority patch deployment',
      'Annual on-site assessment',
    ],
    cta: 'Start Superyacht',
  },
  {
    name: 'Fleet',
    checkoutPlan: null,
    tagline: 'For family offices, fleets & charter ops',
    price: 'Custom',
    period: '',
    vessels: 'Unlimited vessels',
    highlight: false,
    features: [
      'Everything in Superyacht',
      'White-glove onboarding',
      'Custom threat intelligence feeds',
      'Multi-vessel unified dashboard',
      'Legal-hold evidence preservation',
      'Integration with physical security ops',
      'Dedicated account director',
      'Bespoke SLAs & retainer options',
    ],
    cta: 'Contact Sales',
  },
] as const

const S: Record<string, React.CSSProperties> = {
  section: {
    padding: '100px 24px',
    background: '#05080f',
    position: 'relative',
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    bottom: '-100px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 800,
    height: 400,
    borderRadius: '50%',
    background: 'radial-gradient(ellipse, #0ea5e90a 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  inner: {
    maxWidth: 1100,
    margin: '0 auto',
    position: 'relative',
    zIndex: 1,
  },
  header: {
    textAlign: 'center',
    marginBottom: 64,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.15em',
    textTransform: 'uppercase' as const,
    color: '#0ea5e9',
    marginBottom: 16,
  },
  h2: {
    fontSize: 'clamp(28px, 4vw, 44px)',
    fontWeight: 800,
    letterSpacing: '-0.03em',
    lineHeight: 1.15,
    marginBottom: 16,
    color: '#e8edf2',
  },
  subtext: {
    fontSize: 16,
    color: '#6b7f90',
    maxWidth: 460,
    margin: '0 auto',
    lineHeight: 1.7,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: 24,
  },
}

function PlanCard({ plan }: { plan: typeof PLANS[number] }) {
  const [loading, setLoading] = useState(false)

  async function handleCta() {
    if (plan.checkoutPlan === null) {
      window.location.href = '#contact'
      return
    }
    setLoading(true)
    await startCheckout(plan.checkoutPlan)
    setLoading(false)
  }

  const card: React.CSSProperties = {
    borderRadius: 16,
    padding: '36px 32px',
    display: 'flex',
    flexDirection: 'column',
    background: plan.highlight ? 'linear-gradient(160deg, #0a1a2a 0%, #06121e 100%)' : '#0a0f18',
    border: plan.highlight ? '1px solid #0ea5e940' : '1px solid #131e2d',
    boxShadow: plan.highlight ? '0 0 60px #0ea5e912, inset 0 1px 0 #0ea5e920' : 'none',
    position: 'relative',
  }

  return (
    <div style={card}>
      {plan.highlight && (
        <div style={{
          position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)',
          background: '#0ea5e9', color: '#fff', fontSize: 10, fontWeight: 700,
          letterSpacing: '0.1em', textTransform: 'uppercase', padding: '4px 16px', borderRadius: '0 0 8px 8px',
        }}>
          Most Popular
        </div>
      )}

      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <img src="/logo.png" alt="" style={{ width: 14, height: 14, objectFit: 'contain', opacity: plan.highlight ? 1 : 0.4 }} />
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em', color: plan.highlight ? '#0ea5e9' : '#6b7f90', textTransform: 'uppercase' }}>
            {plan.name}
          </span>
        </div>
        <p style={{ fontSize: 13, color: '#4a5568', marginBottom: 24 }}>{plan.tagline}</p>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
          {plan.price !== 'Custom' && <span style={{ fontSize: 16, color: '#6b7f90', fontWeight: 500 }}>£</span>}
          <span style={{ fontSize: plan.price === 'Custom' ? 34 : 42, fontWeight: 800, letterSpacing: '-0.04em', color: '#e8edf2' }}>
            {plan.price}
          </span>
          {plan.period && <span style={{ fontSize: 14, color: '#4a5568' }}>{plan.period}</span>}
        </div>
        <div style={{ fontSize: 12, color: '#4a5568', marginBottom: 32 }}>{plan.vessels}</div>
      </div>

      <ul style={{ listStyle: 'none', flex: 1, marginBottom: 32 }}>
        {plan.features.map(f => (
          <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: '#8899aa', lineHeight: 1.5, marginBottom: 10 }}>
            <Check size={14} color='#0ea5e9' style={{ flexShrink: 0, marginTop: 2 }} />
            {f}
          </li>
        ))}
      </ul>

      <button
        onClick={handleCta}
        disabled={loading}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'center',
          padding: '13px 0',
          borderRadius: 10,
          fontWeight: 700,
          fontSize: 14,
          transition: 'all 0.2s',
          background: plan.highlight ? '#0ea5e9' : 'transparent',
          color: plan.highlight ? '#fff' : '#6b7f90',
          border: plan.highlight ? '1px solid transparent' : '1px solid #1e2d3d',
          boxShadow: plan.highlight ? '0 0 24px #0ea5e930' : 'none',
          cursor: loading ? 'wait' : 'pointer',
          opacity: loading ? 0.7 : 1,
          fontFamily: 'inherit',
        }}
        onMouseEnter={e => {
          if (loading) return
          const el = e.currentTarget as HTMLElement
          if (plan.highlight) { el.style.boxShadow = '0 0 40px #0ea5e960'; el.style.transform = 'translateY(-1px)' }
          else { el.style.borderColor = '#0ea5e950'; el.style.color = '#e8edf2' }
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement
          if (plan.highlight) { el.style.boxShadow = '0 0 24px #0ea5e930'; el.style.transform = 'translateY(0)' }
          else { el.style.borderColor = '#1e2d3d'; el.style.color = '#6b7f90' }
        }}
      >
        {loading ? 'Redirecting…' : plan.cta}
      </button>
    </div>
  )
}

export default function Pricing() {
  return (
    <section id="pricing" style={S.section}>
      <div style={S.glow} />
      <div style={S.inner}>
        <div style={S.header}>
          <div style={S.eyebrow}>Pricing</div>
          <h2 style={S.h2}>Transparent, tier-based protection.</h2>
          <p style={S.subtext}>
            No hidden fees. No long-term lock-in. Choose the coverage level that matches your fleet —
            and scale up the moment you need more.
          </p>
        </div>

        <div style={S.grid}>
          {PLANS.map(plan => <PlanCard key={plan.name} plan={plan} />)}
        </div>

        <p style={{ textAlign: 'center', fontSize: 13, color: '#354555', marginTop: 32 }}>
          All prices in GBP. Annual subscription. VAT may apply. Fleet pricing available on request.
        </p>
      </div>
    </section>
  )
}
