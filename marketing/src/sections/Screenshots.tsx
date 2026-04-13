import { useState, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// ─── Mockup: Alert Dashboard ──────────────────────────────────────────────────

function AlertMockup() {
  const alerts = [
    { sev: 'critical', color: '#ef4444', device: 'Unknown Device', ip: '192.168.0.138', type: 'Rogue Device', time: '4 min ago', resolved: false },
    { sev: 'high',     color: '#f59e0b', device: 'Guest MacBook Pro', ip: '192.168.0.77', type: 'Port Scan Detected', time: '48 min ago', resolved: false },
    { sev: 'medium',   color: '#f59e0b', device: 'Samsung Smart TV', ip: '192.168.0.42', type: 'Telemetry Beacon', time: '22 min ago', resolved: false },
    { sev: 'critical', color: '#ef4444', device: 'IP Camera #3', ip: '192.168.0.91', type: 'Known CVE-2023-1', time: '2 hrs ago', resolved: true },
    { sev: 'high',     color: '#f59e0b', device: 'Starlink Router', ip: '192.168.0.1', type: 'Default Credentials', time: '3 hrs ago', resolved: true },
  ]
  return (
    <div style={{ background: '#080e1a', borderRadius: 8, overflow: 'hidden', fontFamily: 'Inter, sans-serif', fontSize: 11 }}>
      {/* Top bar */}
      <div style={{ background: '#0a1020', borderBottom: '1px solid #151f30', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 700, color: '#c8dae8', letterSpacing: '0.04em', fontSize: 11 }}>ACTIVE ALERTS</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {['All','Critical','Warning','Info'].map((f, i) => (
            <span key={f} style={{ padding: '2px 8px', borderRadius: 5, fontSize: 10, fontWeight: 600, background: i === 0 ? 'rgba(14,165,233,0.15)' : 'transparent', color: i === 0 ? '#7dd3fc' : '#4a5a6a', border: i === 0 ? '1px solid rgba(14,165,233,0.3)' : '1px solid #151f30' }}>{f}</span>
          ))}
        </div>
        <span style={{ fontSize: 10, color: '#4a5a6a' }}>Live · 2 unresolved</span>
      </div>
      {/* Alert rows */}
      <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        {alerts.map((a, i) => (
          <div key={i} style={{ background: a.resolved ? '#08101a' : '#0a1220', border: `1px solid ${a.resolved ? '#131e2d' : a.color + '40'}`, borderLeft: `3px solid ${a.resolved ? '#1a2535' : a.color}`, borderRadius: 7, padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, background: `${a.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={a.color} strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ background: `${a.color}20`, color: a.color, border: `1px solid ${a.color}40`, borderRadius: 10, padding: '1px 6px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase' }}>{a.sev}</span>
                <span style={{ color: '#c8dae8', fontWeight: 600, fontSize: 11 }}>{a.type}</span>
                {a.resolved && <span style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', borderRadius: 10, padding: '1px 6px', fontSize: 9, fontWeight: 600 }}>Resolved</span>}
              </div>
              <div style={{ color: '#4a6070', fontSize: 10 }}>{a.device} · {a.ip}</div>
            </div>
            <span style={{ color: '#3a5060', fontSize: 10, flexShrink: 0 }}>{a.time}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Mockup: Pen Test Report ──────────────────────────────────────────────────

function PenTestMockup() {
  const findings = [
    { sev: 'Critical', color: '#ef4444', title: 'Unauthenticated RCE — Hikvision Cam', cvss: '9.8', remediated: false },
    { sev: 'Critical', color: '#ef4444', title: 'Default Credentials on Starlink Admin', cvss: '9.1', remediated: true },
    { sev: 'High',     color: '#f59e0b', title: 'Telnet Exposed on Navigation System', cvss: '7.5', remediated: false },
    { sev: 'High',     color: '#f59e0b', title: 'SMB Share Accessible on Guest VLAN', cvss: '7.2', remediated: true },
    { sev: 'Medium',   color: '#d4a847', title: 'Self-Signed TLS on Bridge Console', cvss: '5.3', remediated: false },
  ]
  return (
    <div style={{ background: '#080e1a', borderRadius: 8, overflow: 'hidden', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#0a1020', borderBottom: '1px solid #151f30', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontWeight: 700, color: '#c8dae8', fontSize: 11 }}>PENETRATION TEST — Q1 2026</span>
          <div style={{ color: '#3a5060', fontSize: 10, marginTop: 1 }}>Conducted by NauticShield Red Team · 14 Mar 2026</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {[['2','Critical','#ef4444'],['2','High','#f59e0b'],['1','Medium','#d4a847']].map(([n,l,c]) => (
            <div key={l} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: c as string }}>{n}</div>
              <div style={{ fontSize: 9, color: '#3a5060', fontWeight: 600 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
      {/* Score bar */}
      <div style={{ padding: '8px 12px 4px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 10, color: '#4a6070', flexShrink: 0 }}>Security Score</span>
        <div style={{ flex: 1, height: 5, background: '#151f30', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: '62%', height: '100%', background: 'linear-gradient(90deg, #ef4444, #f59e0b)', borderRadius: 3 }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', flexShrink: 0 }}>62 / 100</span>
      </div>
      {/* Findings */}
      <div style={{ padding: '4px 8px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {findings.map((f, i) => (
          <div key={i} style={{ background: '#0a1220', border: `1px solid ${f.color}30`, borderLeft: `3px solid ${f.color}`, borderRadius: 6, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ background: `${f.color}20`, color: f.color, borderRadius: 4, padding: '1px 5px', fontSize: 9, fontWeight: 700, flexShrink: 0 }}>{f.sev}</span>
            <span style={{ flex: 1, color: f.remediated ? '#3a5060' : '#b8cfe0', fontSize: 10, fontWeight: 500, textDecoration: f.remediated ? 'line-through' : 'none' }}>{f.title}</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: '#4a6070', flexShrink: 0 }}>CVSS {f.cvss}</span>
            {f.remediated
              ? <span style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', borderRadius: 4, padding: '1px 6px', fontSize: 9, fontWeight: 600 }}>Fixed</span>
              : <span style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: 4, padding: '1px 6px', fontSize: 9, fontWeight: 600 }}>Open</span>
            }
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Mockup: Vessel Endpoint Posture ─────────────────────────────────────────

function PostureMockup() {
  const devices = [
    { name: 'Starlink Router', type: 'Router / AP', ip: '192.168.0.1', status: 'online', statusColor: '#22c55e', risk: 'high', riskColor: '#ef4444', ports: 4 },
    { name: 'IP Camera #3',    type: 'Camera',      ip: '192.168.0.91', status: 'online', statusColor: '#22c55e', risk: 'critical', riskColor: '#ef4444', ports: 3 },
    { name: 'Bridge MacBook',  type: 'Laptop / PC', ip: '192.168.0.12', status: 'online', statusColor: '#22c55e', risk: 'low', riskColor: '#22c55e', ports: 0 },
    { name: 'Samsung Smart TV',type: 'TV / Display',ip: '192.168.0.42', status: 'online', statusColor: '#22c55e', risk: 'medium', riskColor: '#f59e0b', ports: 2 },
    { name: 'Unknown Device',  type: 'Unknown',     ip: '192.168.0.138',status: 'online', statusColor: '#22c55e', risk: 'critical', riskColor: '#ef4444', ports: 3 },
    { name: "Owner's iPhone",  type: 'Phone',       ip: '192.168.0.55', status: 'offline',statusColor: '#4a5060', risk: 'low', riskColor: '#22c55e', ports: 1 },
  ]
  return (
    <div style={{ background: '#080e1a', borderRadius: 8, overflow: 'hidden', fontFamily: 'Inter, sans-serif' }}>
      {/* Top bar */}
      <div style={{ background: '#0a1020', borderBottom: '1px solid #151f30', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 700, color: '#c8dae8', fontSize: 11 }}>VESSEL ENDPOINT INVENTORY</span>
        <div style={{ display: 'flex', gap: 12 }}>
          {[['17','Total','#c8dae8'],['14','Online','#22c55e'],['3','At Risk','#ef4444']].map(([n,l,c]) => (
            <div key={l} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: c as string, lineHeight: 1 }}>{n}</div>
              <div style={{ fontSize: 9, color: '#3a5060' }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
      {/* Column headers */}
      <div style={{ padding: '5px 10px 2px', display: 'grid', gridTemplateColumns: '1fr 90px 70px 50px 48px', gap: 6 }}>
        {['Device','IP','Status','Ports','Risk'].map(h => <span key={h} style={{ fontSize: 9, color: '#2a3a4a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</span>)}
      </div>
      {/* Rows */}
      <div style={{ padding: '0 8px 8px', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {devices.map((d, i) => (
          <div key={i} style={{ background: '#0a1220', border: '1px solid #121c2a', borderRadius: 6, padding: '6px 8px', display: 'grid', gridTemplateColumns: '1fr 90px 70px 50px 48px', gap: 6, alignItems: 'center' }}>
            <div>
              <div style={{ color: '#b8cfe0', fontSize: 10, fontWeight: 600 }}>{d.name}</div>
              <div style={{ color: '#3a5060', fontSize: 9 }}>{d.type}</div>
            </div>
            <span style={{ color: '#3a6070', fontSize: 10, fontFamily: 'monospace' }}>{d.ip}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: d.statusColor, boxShadow: `0 0 4px ${d.statusColor}` }} />
              <span style={{ color: d.statusColor, fontSize: 9, fontWeight: 600 }}>{d.status}</span>
            </div>
            <span style={{ color: d.ports > 0 ? '#f59e0b' : '#2a3a4a', fontSize: 10, fontWeight: 600, textAlign: 'center' }}>{d.ports > 0 ? d.ports : '—'}</span>
            <span style={{ background: `${d.riskColor}18`, color: d.riskColor, borderRadius: 4, padding: '1px 5px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', textAlign: 'center' }}>{d.risk}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Browser chrome wrapper ───────────────────────────────────────────────────

function BrowserFrame({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#060c18', borderRadius: 10, border: '1px solid #151f30', overflow: 'hidden', boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}>
      {/* Chrome bar */}
      <div style={{ background: '#0a1020', borderBottom: '1px solid #151f30', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {['#ef4444','#f59e0b','#22c55e'].map(c => <div key={c} style={{ width: 8, height: 8, borderRadius: '50%', background: c, opacity: 0.7 }} />)}
        </div>
        <div style={{ flex: 1, background: '#060c18', borderRadius: 5, padding: '3px 10px', fontSize: 10, color: '#2a4050', fontFamily: 'monospace', border: '1px solid #101825' }}>
          {url}
        </div>
      </div>
      {/* Sidebar + content */}
      <div style={{ display: 'flex' }}>
        {/* Mini sidebar */}
        <div style={{ width: 36, background: '#060c18', borderRight: '1px solid #101825', padding: '10px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(14,165,233,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          {['#3a5060','#3a5060','#3a5060','#3a5060'].map((c, i) => (
            <div key={i} style={{ width: 14, height: 3, borderRadius: 2, background: c }} />
          ))}
        </div>
        {/* Main content */}
        <div style={{ flex: 1, padding: 8 }}>{children}</div>
      </div>
    </div>
  )
}

// ─── Slide definitions ────────────────────────────────────────────────────────

const SLIDES = [
  {
    tag: 'Real-Time Alerting', tagColor: '#ef4444',
    headline: 'Threats surfaced in under 4 seconds',
    detail: 'Anomalous traffic, rogue devices, and brute-force attempts flagged instantly with full context — severity, device identity, and timestamp.',
    url: 'app.nauticshield.com/alerts',
    Mockup: AlertMockup,
  },
  {
    tag: 'Penetration Testing', tagColor: '#f59e0b',
    headline: 'Quarterly pen test findings, executive-ready',
    detail: 'CVSS-scored vulnerabilities, remediation status, and proof-of-concept evidence — drill down to technical detail or stay at the summary.',
    url: 'app.nauticshield.com/cyber/pentest',
    Mockup: PenTestMockup,
  },
  {
    tag: 'Vessel Endpoint Posture', tagColor: '#0ea5e9',
    headline: 'Every device on board, continuously accounted for',
    detail: 'Live inventory across navigation, comms, and guest networks — with patch status, open ports, and individual risk scores per device.',
    url: 'app.nauticshield.com/devices',
    Mockup: PostureMockup,
  },
]

// ─── Main section ─────────────────────────────────────────────────────────────

export default function Screenshots() {
  const [active, setActive] = useState(0)
  const touchStartX = useRef<number | null>(null)

  const prev = () => setActive(i => (i - 1 + SLIDES.length) % SLIDES.length)
  const next = () => setActive(i => (i + 1) % SLIDES.length)

  return (
    <section id="platform" style={{ background: '#060c18', padding: '80px 24px', borderTop: '1px solid #0a1929', borderBottom: '1px solid #0a1929' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#0ea5e9', marginBottom: 14 }}>
            Platform In Action
          </div>
          <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 40px)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.15, color: '#e8edf2', marginBottom: 14 }}>
            See exactly what your security team sees
          </h2>
          <p style={{ fontSize: 16, color: '#8aa4b8', maxWidth: 520, margin: '0 auto', lineHeight: 1.7 }}>
            Every alert, pen test finding, and vessel posture report — in a dashboard built for principals who demand clarity without noise.
          </p>
        </div>

        {/* Desktop: 3-column grid */}
        <div className="ss-desktop" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 28, alignItems: 'start' }}>
          {SLIDES.map(({ tag, tagColor, headline, detail, url, Mockup }, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <BrowserFrame url={url}><Mockup /></BrowserFrame>
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: `${tagColor}15`, border: `1px solid ${tagColor}35`, color: tagColor, borderRadius: 6, padding: '3px 10px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                  {tag}
                </div>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#d4e4f0', lineHeight: 1.4, marginBottom: 7 }}>{headline}</p>
                <p style={{ fontSize: 13, color: '#5a7a8e', lineHeight: 1.6 }}>{detail}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Mobile: carousel */}
        <div
          className="ss-mobile"
          style={{ display: 'none' }}
          onTouchStart={(e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX }}
          onTouchEnd={(e: React.TouchEvent) => {
            if (touchStartX.current === null) return
            const d = e.changedTouches[0].clientX - touchStartX.current
            if (d < -40) next(); else if (d > 40) prev()
            touchStartX.current = null
          }}
        >
          {(() => {
            const { tag, tagColor, headline, detail, url, Mockup } = SLIDES[active]
            return (
              <div style={{ position: 'relative' }}>
                <BrowserFrame url={url}><Mockup /></BrowserFrame>
                <button onClick={prev} aria-label="Previous" style={{ position: 'absolute', left: -14, top: '35%', background: '#0d1f35', border: '1px solid #1e3350', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#7fb2d6' }}>
                  <ChevronLeft size={16} />
                </button>
                <button onClick={next} aria-label="Next" style={{ position: 'absolute', right: -14, top: '35%', background: '#0d1f35', border: '1px solid #1e3350', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#7fb2d6' }}>
                  <ChevronRight size={16} />
                </button>
                <div style={{ marginTop: 18 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', background: `${tagColor}15`, border: `1px solid ${tagColor}35`, color: tagColor, borderRadius: 6, padding: '3px 10px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>{tag}</div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#d4e4f0', lineHeight: 1.4, marginBottom: 7 }}>{headline}</p>
                  <p style={{ fontSize: 13, color: '#5a7a8e', lineHeight: 1.6 }}>{detail}</p>
                </div>
              </div>
            )
          })()}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 7, marginTop: 22 }}>
            {SLIDES.map((_, i) => (
              <button key={i} onClick={() => setActive(i)} aria-label={`Slide ${i + 1}`} style={{ width: active === i ? 22 : 7, height: 7, borderRadius: 4, background: active === i ? '#0ea5e9' : '#1e3350', border: 'none', cursor: 'pointer', transition: 'width 0.25s', padding: 0 }} />
            ))}
          </div>
        </div>

      </div>
      <style>{`@media(max-width:700px){.ss-desktop{display:none!important}.ss-mobile{display:block!important}}`}</style>
    </section>
  )
}
