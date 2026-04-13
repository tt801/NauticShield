import { Shield, Wifi } from 'lucide-react'

const CLERK_SIGNUP_URL = 'https://accounts.nautic-shield.vercel.app/sign-up'

const S: Record<string, React.CSSProperties> = {
  section: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    overflow: 'hidden',
    padding: '100px 24px 0',
  },
  grid: {
    position: 'absolute',
    inset: 0,
    backgroundImage: `
      linear-gradient(to right, #0ea5e908 1px, transparent 1px),
      linear-gradient(to bottom, #0ea5e908 1px, transparent 1px)
    `,
    backgroundSize: '60px 60px',
    maskImage: 'radial-gradient(ellipse 80% 80% at 50% 40%, black 30%, transparent 100%)',
  },
  glow: {
    position: 'absolute',
    top: '20%',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 600,
    height: 600,
    borderRadius: '50%',
    background: 'radial-gradient(circle, #0ea5e912 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 16px',
    borderRadius: 100,
    border: '1px solid #0ea5e930',
    background: '#0ea5e908',
    color: '#0ea5e9',
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    marginBottom: 28,
  },
  headline: {
    fontSize: 'clamp(40px, 7vw, 76px)',
    fontWeight: 800,
    lineHeight: 1.08,
    letterSpacing: '-0.03em',
    textAlign: 'center',
    maxWidth: 860,
    marginBottom: 24,
  },
  accent: {
    background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  sub: {
    fontSize: 18,
    color: '#a8bed0',
    textAlign: 'center',
    maxWidth: 600,
    lineHeight: 1.7,
    marginBottom: 36,
    fontWeight: 400,
  },
  ctas: {
    display: 'flex',
    gap: 16,
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 44,
  },
  ctaPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '14px 28px',
    borderRadius: 10,
    background: '#0ea5e9',
    color: '#fff',
    fontWeight: 700,
    fontSize: 15,
    letterSpacing: '-0.01em',
    transition: 'all 0.2s',
    boxShadow: '0 0 30px #0ea5e930',
  },
  ctaSecondary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '14px 28px',
    borderRadius: 10,
    background: 'transparent',
    border: '1px solid #1e2d3d',
    color: '#a8bed0',
    fontWeight: 600,
    fontSize: 15,
    transition: 'all 0.2s',
  },
  statsRow: {
    display: 'flex',
    gap: 44,
    flexWrap: 'wrap',
    justifyContent: 'center',
    borderTop: '1px solid #0f1923',
    paddingTop: 28,
    paddingBottom: 28,
    marginTop: 0,
    width: '100%',
    maxWidth: 780,
  },
  stat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
  statNum: {
    fontSize: 32,
    fontWeight: 800,
    letterSpacing: '-0.04em',
    color: '#e8edf2',
  },
  statLabel: {
    fontSize: 13,
    color: '#7f95a8',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
}

export default function Hero() {
  return (
    <section id="home" style={S.section}>
      <div style={S.grid} />
      <div style={S.glow} />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={S.badge}>
          <Shield size={11} />
          Maritime endpoint and cyber defence
        </div>

        <h1 style={S.headline}>
          Protect what matters most
          <br />
          <span style={S.accent}>at sea.</span>
        </h1>

        <p style={S.sub}>
          NauticShield delivers discreet, always-on cybersecurity for private vessels and superyachts.
          Built for principals who demand absolute confidentiality, real-time threat intelligence,
          and direct control.
        </p>

        <div style={S.ctas}>
          <a
            href={CLERK_SIGNUP_URL}
            style={{ ...S.ctaPrimary }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 0 50px #0ea5e960'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 0 30px #0ea5e930'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)' }}
          >
            <img src="/logo.png" alt="" style={{ width: 16, height: 16, objectFit: 'contain' }} />
            Get Protected
          </a>
          <a
            href="#contact"
            style={S.ctaSecondary}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#0ea5e950'; (e.currentTarget as HTMLElement).style.color = '#e8edf2' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#1e2d3d'; (e.currentTarget as HTMLElement).style.color = '#a8bed0' }}
          >
            <Wifi size={15} />
            Request a Demo
          </a>
        </div>

        <div style={S.statsRow}>
          {[
            { num: '99.97%', label: 'Uptime SLA' },
            { num: '<4s', label: 'Threat Response' },
            { num: '256-bit', label: 'AES Encryption' },
            { num: 'Zero', label: 'Data Breaches' },
          ].map(({ num, label }) => (
            <div key={label} style={S.stat}>
              <span style={S.statNum}>{num}</span>
              <span style={S.statLabel}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
