import { Shield, Eye, Cpu, Lock, ScanSearch, Zap, BarChart3, Globe } from 'lucide-react'

const FEATURES = [
  {
    icon: Shield,
    title: 'HNWI Protection',
    description:
      'Discrete, intelligence-led security tailored for principals and family offices. Your vessel\'s cyber posture is managed with the same rigour as your physical security detail.',
    color: '#0ea5e9',
  },
  {
    icon: Eye,
    title: 'Absolute Confidentiality',
    description:
      'Zero-logging architecture. Your operational data, routes, and communications are never stored on third-party infrastructure. Full sovereign data custody at all times.',
    color: '#38bdf8',
  },
  {
    icon: ScanSearch,
    title: 'Penetration Testing',
    description:
      'Scheduled and on-demand red-team exercises against every networked system aboard — navigation, automation, satcom, and crew devices — before adversaries find the gaps.',
    color: '#0284c7',
  },
  {
    icon: Cpu,
    title: 'Live Threat Intelligence',
    description:
      'Real-time feeds from maritime-specific threat actors, port authority advisories, and zero-day disclosures. Correlated against your vessel\'s exact equipment profile.',
    color: '#0ea5e9',
  },
  {
    icon: Lock,
    title: 'Self-Service Portal',
    description:
      'Your secure operations dashboard gives you — and only you — a live window into every vessel: device health, active alerts, voyage logs, and one-click incident response.',
    color: '#38bdf8',
  },
  {
    icon: Zap,
    title: 'Instant Incident Response',
    description:
      'Sub-4-second automated containment on detected intrusions. Network segmentation, device quarantine, and encrypted evidence capture happen before you can open the app.',
    color: '#0284c7',
  },
  {
    icon: BarChart3,
    title: 'Compliance & Reporting',
    description:
      'Automated reports aligned to IMO Maritime Cyber Risk Management guidelines, ISM Code requirements, and insurer audit formats. One-click export, signed and timestamped.',
    color: '#0ea5e9',
  },
  {
    icon: Globe,
    title: 'Global Satellite Coverage',
    description:
      'Protection follows your vessel anywhere. Our sensor network maintains encrypted telemetry whether you\'re in Monaco, the BVI, or mid-Pacific — with no geographic dead zones.',
    color: '#38bdf8',
  },
]

const S: Record<string, React.CSSProperties> = {
  section: {
    padding: '100px 24px',
    maxWidth: 1200,
    margin: '0 auto',
  },
  header: {
    textAlign: 'center',
    marginBottom: 64,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
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
    fontSize: 17,
    color: '#6b7f90',
    maxWidth: 520,
    margin: '0 auto',
    lineHeight: 1.7,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: 1,
    background: '#0d1520',
    border: '1px solid #0d1520',
    borderRadius: 16,
    overflow: 'hidden',
  },
  card: {
    padding: '32px 28px',
    background: '#080c12',
    transition: 'background 0.2s',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: '#e8edf2',
    marginBottom: 10,
    letterSpacing: '-0.01em',
  },
  cardDesc: {
    fontSize: 14,
    color: '#6b7f90',
    lineHeight: 1.65,
  },
}

export default function Features() {
  return (
    <section id="features" style={{ background: '#080c12', padding: '0 24px' }}>
      <div style={S.section}>
        <div style={S.header}>
          <div style={S.eyebrow}>Capabilities</div>
          <h2 style={S.h2}>Defence-grade protection.<br />Built for the water.</h2>
          <p style={S.subtext}>
            Every layer of NauticShield is engineered around the unique threat landscape
            facing private maritime principals — from nation-state actors to opportunistic ransomware crews.
          </p>
        </div>

        <div style={S.grid}>
          {FEATURES.map(({ icon: Icon, title, description, color }) => (
            <div
              key={title}
              style={S.card}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#0a1018' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#080c12' }}
            >
              <div style={{ ...S.iconWrap, background: `${color}15`, border: `1px solid ${color}25` }}>
                <Icon size={20} color={color} />
              </div>
              <div style={S.cardTitle}>{title}</div>
              <p style={S.cardDesc}>{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
