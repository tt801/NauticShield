import { Shield, Eye, Cpu, Lock, ScanSearch, Zap, BarChart3, Globe } from 'lucide-react'
import { useState } from 'react'

type Feature = {
  icon: typeof Shield
  title: string
  description: string
  color: string
}

const FEATURES: Feature[] = [
  {
    icon: Shield,
    title: 'HNWI Protection',
    description:
      'Discrete, intelligence-led security tailored for principals and family offices. Your vessel\'s cyber posture is managed with the same rigor as your physical security detail.',
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
      'Scheduled and on-demand red-team exercises against every networked system aboard before adversaries find the gaps.',
    color: '#0284c7',
  },
  {
    icon: Cpu,
    title: 'Live Threat Intelligence',
    description:
      'Real-time feeds from maritime-specific threat actors and zero-day disclosures correlated against your exact equipment profile.',
    color: '#0ea5e9',
  },
  {
    icon: Lock,
    title: 'Self-Service Portal',
    description:
      'Your secure operations dashboard gives you real-time oversight across device health, active alerts, voyage logs, and response controls.',
    color: '#38bdf8',
  },
  {
    icon: Zap,
    title: 'Instant Incident Response',
    description:
      'Automated containment on detected intrusions with network segmentation, device quarantine, and encrypted evidence capture.',
    color: '#0284c7',
  },
  {
    icon: BarChart3,
    title: 'Compliance & Reporting',
    description:
      'Automated reports aligned to IMO maritime cyber risk management, insurer audits, and internal governance standards.',
    color: '#0ea5e9',
  },
  {
    icon: Globe,
    title: 'Global Satellite Coverage',
    description:
      'Protection follows your vessel anywhere with encrypted telemetry and continuous monitoring from coastal to mid-ocean routes.',
    color: '#38bdf8',
  },
]

const KEY_CAPABILITIES = FEATURES.slice(0, 4)
const EXTENDED_CAPABILITIES = FEATURES.slice(4)

const FLOW_STEPS = [
  {
    title: 'Continuous\nMonitoring',
    color: '#0ea5e9',
    bg: 'linear-gradient(160deg, #0a1a2a, #0d2236)',
    border: '#1e5a85',
    info: 'Telemetry from onboard endpoints, satcom, guest network, and bridge systems is ingested continuously.',
  },
  {
    title: 'Threat\nDetection',
    color: '#f59e0b',
    bg: 'linear-gradient(160deg, #20180b, #2a1f0d)',
    border: '#7a5312',
    info: 'Behavioral rules and maritime threat intelligence flag anomalies, known CVEs, scans, and credential abuse.',
  },
  {
    title: 'Instant\nContainment',
    color: '#ef4444',
    bg: 'linear-gradient(160deg, #2a1010, #341515)',
    border: '#7e2323',
    info: 'Compromised zones are segmented in seconds, suspicious devices quarantined, and forensic evidence preserved.',
  },
  {
    title: 'Owner\nVisibility',
    color: '#22c55e',
    bg: 'linear-gradient(160deg, #0d1f14, #11261a)',
    border: '#2c6a44',
    info: 'Principals receive concise status and risk updates, with direct control paths for escalation and response.',
  },
]

const S: Record<string, React.CSSProperties> = {
  section: {
    padding: '0 24px',
    background: '#080c12',
  },
  inner: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '40px 0 64px',
  },
  header: {
    textAlign: 'center',
    marginBottom: 36,
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
    color: '#9cb1c2',
    maxWidth: 560,
    margin: '0 auto',
    lineHeight: 1.7,
  },
  stageHeading: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: '#87a2b7',
    marginBottom: 16,
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
    padding: '30px 26px',
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
    marginBottom: 18,
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
    color: '#97adc0',
    lineHeight: 1.65,
  },
  bridge: {
    margin: '26px 0',
    borderRadius: 16,
    border: '1px solid #173247',
    background: 'linear-gradient(170deg, #09131d, #0b1520)',
    padding: '24px 24px 30px',
  },
  bridgeTitle: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#89a8be',
    marginBottom: 18,
  },
  diagram: {
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr auto 1fr auto 1fr',
    alignItems: 'center',
    gap: 10,
  },
  node: {
    height: 84,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: 600,
    color: '#cae1f1',
    lineHeight: 1.3,
    padding: '0 8px',
  },
  pipe: {
    width: 100,
    height: 2,
    background: 'linear-gradient(90deg, #1b3d57, #3b8fbe)',
    borderRadius: 999,
  },
  flowCell: {
    position: 'relative',
  },
  popout: {
    position: 'absolute',
    left: '50%',
    top: 92,
    transform: 'translateX(-50%)',
    width: 220,
    background: '#0b1622',
    border: '1px solid #1f3850',
    borderRadius: 10,
    padding: '10px 12px',
    fontSize: 12,
    lineHeight: 1.5,
    color: '#b8cfde',
    boxShadow: '0 12px 28px rgba(0,0,0,0.4)',
    zIndex: 3,
  },
}

function Card({ icon: Icon, title, description, color }: Feature) {
  return (
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
  )
}

export default function Features() {
  const [hoveredStep, setHoveredStep] = useState<number | null>(null)
  const [activeStep, setActiveStep] = useState<number | null>(null)

  return (
    <section id="features" style={S.section}>
      <div style={S.inner}>
        <div style={S.header}>
          <div style={S.eyebrow}>Capabilities</div>
          <h2 style={S.h2}>Defence-grade protection.<br />Built for the water.</h2>
          <p style={S.subtext}>
            Every layer of NauticShield is engineered around the maritime threat landscape
            facing private principals and crews.
          </p>
        </div>

        <div style={S.stageHeading}>4 Core Capabilities</div>
        <div style={S.grid}>
          {KEY_CAPABILITIES.map(Card)}
        </div>

        <div style={S.bridge}>
          <div style={S.bridgeTitle}>How The Protection Stack Flows</div>
          <div style={S.diagram}>
            {FLOW_STEPS.map((step, index) => (
              <div key={step.title} style={{ display: 'contents' }}>
                <div
                  style={S.flowCell}
                  onMouseEnter={() => setHoveredStep(index)}
                  onMouseLeave={() => setHoveredStep(null)}
                  onClick={() => setActiveStep(prev => (prev === index ? null : index))}
                >
                  <div style={{ ...S.node, border: `1px solid ${step.border}`, background: step.bg, color: '#e8edf2', boxShadow: `0 0 24px ${step.color}25` }}>
                    {step.title.split('\n').map(part => <div key={part}>{part}</div>)}
                  </div>
                  {(hoveredStep === index || activeStep === index) && <div style={S.popout}>{step.info}</div>}
                </div>
                {index < FLOW_STEPS.length - 1 && <div key={`pipe-${step.title}`} style={{ ...S.pipe, background: `linear-gradient(90deg, ${step.color}55, ${FLOW_STEPS[index + 1].color}80)` }} />}
              </div>
            ))}
          </div>
        </div>

        <div style={S.stageHeading}>4 Extended Capabilities</div>
        <div style={S.grid}>
          {EXTENDED_CAPABILITIES.map(Card)}
        </div>
      </div>
    </section>
  )
}
