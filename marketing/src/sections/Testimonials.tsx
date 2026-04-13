import { Quote } from 'lucide-react'

const TESTIMONIALS = [
  {
    quote:
      "We had a sophisticated intrusion attempt on our satcom array while anchored off Sardinia. NauticShield detected it in under two seconds and had the network segmented before our captain even saw the alert. That level of response is simply unmatched.",
    name: 'J.W.H.',
    title: 'Principal, 62m Motor Yacht',
    region: 'Mediterranean',
  },
  {
    quote:
      "The confidentiality aspect was non-negotiable for us. After an exhaustive vendor assessment, NauticShield was the only provider that could demonstrate true zero-logging. Our legal team signed off immediately.",
    name: 'Family Office Representative',
    title: 'Multi-vessel Fleet, North Atlantic',
    region: 'North Atlantic',
  },
  {
    quote:
      "The quarterly penetration tests have already uncovered two critical vulnerabilities in our bridge automation systems — issues that our previous security vendor had been missing for years. The report quality alone justifies the investment.",
    name: 'D.A.',
    title: 'Captain, 80m Expedition Yacht',
    region: 'Pacific Circuit',
  },
  {
    quote:
      "Having a self-service dashboard where I can see every device on every vessel in real time — from my phone, from anywhere — is a completely different standard of visibility. I wouldn't leave port without it.",
    name: 'G.E.T.',
    title: 'Owner, 3-vessel Charter Fleet',
    region: 'Caribbean',
  },
]

const S: Record<string, React.CSSProperties> = {
  section: {
    padding: '100px 24px',
    background: '#080c12',
    position: 'relative',
  },
  lines: {
    position: 'absolute',
    inset: 0,
    backgroundImage: 'linear-gradient(to right, #0ea5e905 1px, transparent 1px)',
    backgroundSize: '120px',
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
    color: '#e8edf2',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))',
    gap: 24,
  },
  card: {
    background: '#0a0f18',
    border: '1px solid #131e2d',
    borderRadius: 16,
    padding: '32px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 20,
    transition: 'border-color 0.2s',
  },
  quoteText: {
    fontSize: 15,
    lineHeight: 1.75,
    color: '#a8bed0',
    fontStyle: 'italic',
    flex: 1,
  },
  attribution: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    paddingTop: 20,
    borderTop: '1px solid #0f1923',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #0ea5e920, #0ea5e940)',
    border: '1px solid #0ea5e930',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    fontWeight: 700,
    color: '#0ea5e9',
    flexShrink: 0,
  },
}

export default function Testimonials() {
  return (
    <section id="testimonials" style={S.section}>
      <div style={S.lines} />
      <div style={S.inner}>
        <div style={S.header}>
          <div style={S.eyebrow}>Testimonials</div>
          <h2 style={S.h2}>Trusted by principals<br />who accept no compromise.</h2>
        </div>

        <div style={S.grid}>
          {TESTIMONIALS.map(({ quote, name, title, region }) => (
            <div
              key={name}
              style={S.card}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#0ea5e930' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#131e2d' }}
            >
              <Quote size={20} color="#0ea5e925" />
              <p style={S.quoteText}>"{quote}"</p>
              <div style={S.attribution}>
                <div style={S.avatar}>{name[0]}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#e8edf2' }}>{name}</div>
                  <div style={{ fontSize: 12, color: '#8ea4b6' }}>{title}</div>
                </div>
                <div style={{ marginLeft: 'auto', fontSize: 11, color: '#7b92a6', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  {region}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
