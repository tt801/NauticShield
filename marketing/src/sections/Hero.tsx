import { Shield, Wifi, Lock, Activity, Globe } from 'lucide-react'

const CLERK_SIGNUP_URL = 'https://accounts.nautic-shield.vercel.app/sign-up'

const S: Record<string, React.CSSProperties> = {
  section: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    overflow: 'hidden',
    background: 'linear-gradient(180deg, #071423 0%, #06101c 55%, #05080f 100%)',
    borderBottom: '1px solid #0f2237',
    padding: '100px 24px 0',
  },
  inner: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    maxWidth: 1180,
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.02fr) minmax(380px, 0.98fr)',
    gap: 48,
    alignItems: 'start',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
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
    textAlign: 'left',
    maxWidth: 660,
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
    textAlign: 'left',
    maxWidth: 560,
    lineHeight: 1.7,
    marginBottom: 36,
    fontWeight: 400,
  },
  ctas: {
    display: 'flex',
    gap: 16,
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    marginBottom: 44,
  },
  ctaPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 0,
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
    justifyContent: 'space-between',
    borderTop: '1px solid #0f1923',
    paddingTop: 28,
    paddingBottom: 28,
    marginTop: 24,
    width: '100%',
    maxWidth: 1180,
  },
  stat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
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
  visualWrap: {
    position: 'relative',
    minHeight: 420,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: 8,
  },
  visualHalo: {
    position: 'absolute',
    inset: '10% 8% auto',
    height: 320,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(14,165,233,0.22) 0%, rgba(14,165,233,0.08) 28%, transparent 72%)',
    filter: 'blur(18px)',
    pointerEvents: 'none',
  },
  visualPanel: {
    position: 'relative',
    width: '100%',
    maxWidth: 470,
    minHeight: 420,
    borderRadius: 28,
    border: '1px solid rgba(42, 80, 113, 0.7)',
    background: 'linear-gradient(180deg, rgba(8,18,30,0.96) 0%, rgba(7,14,24,0.98) 100%)',
    boxShadow: '0 28px 70px rgba(0, 0, 0, 0.52), inset 0 1px 0 rgba(110, 180, 225, 0.08)',
    overflow: 'hidden',
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 18px',
    borderBottom: '1px solid rgba(26, 44, 61, 0.9)',
    background: 'linear-gradient(180deg, rgba(10, 20, 32, 0.98), rgba(8, 16, 26, 0.96))',
  },
  panelBody: {
    position: 'relative',
    padding: '20px 18px 18px',
    minHeight: 364,
    backgroundImage: 'linear-gradient(to right, rgba(14,165,233,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(14,165,233,0.05) 1px, transparent 1px)',
    backgroundSize: '42px 42px',
  },
  metricRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 10,
    marginBottom: 18,
  },
  metricCard: {
    borderRadius: 14,
    border: '1px solid rgba(28, 51, 72, 0.95)',
    background: 'linear-gradient(180deg, rgba(11, 20, 31, 0.98), rgba(9, 16, 26, 0.98))',
    padding: '12px 12px 11px',
  },
  vesselCanvas: {
    position: 'relative',
    height: 215,
    borderRadius: 24,
    border: '1px solid rgba(25, 47, 67, 0.9)',
    background: 'radial-gradient(circle at 50% 22%, rgba(56,189,248,0.12), transparent 34%), linear-gradient(180deg, rgba(10,17,28,0.95), rgba(7,13,22,0.98))',
    overflow: 'hidden',
  },
  vesselOverlayCard: {
    position: 'absolute',
    borderRadius: 14,
    border: '1px solid rgba(31, 65, 94, 0.95)',
    background: 'rgba(10, 18, 28, 0.92)',
    backdropFilter: 'blur(10px)',
    boxShadow: '0 14px 30px rgba(0,0,0,0.35)',
    padding: '12px 14px',
  },
  noteLabel: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
}

function HeroVisual() {
  return (
    <div style={S.visualWrap}>
      <div style={S.visualHalo} />
      <div style={S.visualPanel}>
        <div style={S.panelHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {['#ef4444', '#f59e0b', '#22c55e'].map(color => (
              <div key={color} style={{ width: 8, height: 8, borderRadius: '50%', background: color, opacity: 0.82 }} />
            ))}
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#cfe5f3' }}>
            Vessel Cyber Command
          </div>
          <div style={{ fontSize: 10, color: '#7fb2d6', fontWeight: 700 }}>Satcom linked</div>
        </div>

        <div style={S.panelBody}>
          <div style={S.metricRow}>
            <div style={S.metricCard}>
              <div style={{ ...S.noteLabel, color: '#f97316' }}>Threats Blocked</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#eef7ff', lineHeight: 1 }}>12</div>
              <div style={{ fontSize: 11, color: '#7f95a8', marginTop: 4 }}>Past 24 hours</div>
            </div>
            <div style={S.metricCard}>
              <div style={{ ...S.noteLabel, color: '#38bdf8' }}>Endpoints</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#eef7ff', lineHeight: 1 }}>17</div>
              <div style={{ fontSize: 11, color: '#7f95a8', marginTop: 4 }}>On-board assets</div>
            </div>
            <div style={S.metricCard}>
              <div style={{ ...S.noteLabel, color: '#22c55e' }}>Status</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#eef7ff', lineHeight: 1 }}>Secure</div>
              <div style={{ fontSize: 11, color: '#7f95a8', marginTop: 4 }}>Cloud + local</div>
            </div>
          </div>

          <div style={S.vesselCanvas}>
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 50%, rgba(14,165,233,0.08) 0%, transparent 45%)' }} />
            <svg viewBox="0 0 520 260" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} aria-hidden="true">
              <defs>
                <linearGradient id="shipStroke" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#6dd3ff" />
                  <stop offset="100%" stopColor="#0ea5e9" />
                </linearGradient>
                <linearGradient id="seaGlow" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="rgba(14,165,233,0)" />
                  <stop offset="50%" stopColor="rgba(14,165,233,0.45)" />
                  <stop offset="100%" stopColor="rgba(14,165,233,0)" />
                </linearGradient>
              </defs>

              <circle cx="260" cy="118" r="92" fill="none" stroke="rgba(56,189,248,0.16)" strokeWidth="1" />
              <circle cx="260" cy="118" r="130" fill="none" stroke="rgba(56,189,248,0.1)" strokeWidth="1" strokeDasharray="6 7" />

              <path d="M84 194 C132 190 164 170 194 150 L298 150 C336 150 375 170 432 194" fill="none" stroke="url(#seaGlow)" strokeWidth="3" />
              <path d="M120 178 L188 178 L218 146 L293 146 L333 174 L402 174 L438 196 L111 196 L95 186 Z" fill="rgba(6,16,26,0.85)" stroke="url(#shipStroke)" strokeWidth="3" strokeLinejoin="round" />
              <path d="M206 146 L224 116 L280 116 L304 146" fill="none" stroke="url(#shipStroke)" strokeWidth="3" strokeLinejoin="round" />
              <path d="M234 116 L234 92 L272 92 L284 116" fill="none" stroke="url(#shipStroke)" strokeWidth="3" strokeLinejoin="round" />
              <path d="M197 164 L175 112" fill="none" stroke="rgba(109,211,255,0.75)" strokeWidth="2" strokeDasharray="4 5" />
              <path d="M323 162 L356 108" fill="none" stroke="rgba(109,211,255,0.75)" strokeWidth="2" strokeDasharray="4 5" />
              <path d="M259 92 L259 54" fill="none" stroke="rgba(109,211,255,0.8)" strokeWidth="2" strokeDasharray="4 5" />

              {[
                { x: 175, y: 112, fill: '#ef4444' },
                { x: 356, y: 108, fill: '#22c55e' },
                { x: 259, y: 54, fill: '#38bdf8' },
              ].map(node => (
                <g key={`${node.x}-${node.y}`}>
                  <circle cx={node.x} cy={node.y} r="18" fill="rgba(8,18,30,0.94)" stroke={node.fill} strokeWidth="2" />
                  <circle cx={node.x} cy={node.y} r="5" fill={node.fill} />
                </g>
              ))}
            </svg>

            <div style={{ ...S.vesselOverlayCard, top: 16, right: 16, width: 154 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Lock size={14} color="#22c55e" />
                <span style={{ fontSize: 11, color: '#d9edf8', fontWeight: 700 }}>Isolation Ready</span>
              </div>
              <div style={{ fontSize: 11, color: '#8ea4b6', lineHeight: 1.5 }}>Critical bridge systems and guest network can be segmented instantly.</div>
            </div>

            <div style={{ ...S.vesselOverlayCard, left: 16, bottom: 18, width: 158 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Activity size={14} color="#ef4444" />
                <span style={{ fontSize: 11, color: '#d9edf8', fontWeight: 700 }}>Live Alerting</span>
              </div>
              <div style={{ fontSize: 11, color: '#8ea4b6', lineHeight: 1.5 }}>Rogue device attempt blocked on guest VLAN 3.8s after detection.</div>
            </div>

            <div style={{ ...S.vesselOverlayCard, right: 22, bottom: 20, width: 166 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Globe size={14} color="#38bdf8" />
                <span style={{ fontSize: 11, color: '#d9edf8', fontWeight: 700 }}>Cloud + On-board</span>
              </div>
              <div style={{ fontSize: 11, color: '#8ea4b6', lineHeight: 1.5 }}>Telemetry continues locally even if external connectivity drops offshore.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Hero() {
  return (
    <section id="home" style={S.section}>
      <div style={S.grid} />
      <div style={S.glow} />

      <div style={S.inner} className="hero-layout">
        <div style={S.content}>
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

        </div>

        <HeroVisual />
      </div>

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 1180 }}>
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

      <style>{`
        @media (max-width: 920px) {
          .hero-layout {
            grid-template-columns: 1fr !important;
            gap: 30px !important;
          }
        }
      `}</style>
    </section>
  )
}
