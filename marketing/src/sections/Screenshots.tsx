import { useState, useRef } from 'react'
import { ChevronLeft, ChevronRight, Bell, ShieldCheck, Wifi } from 'lucide-react'

const SLIDES = [
  {
    src: '/screenshots/alert-dashboard.png',
    tag: 'Real-Time Alerting',
    tagColor: '#ef4444',
    Icon: Bell,
    headline: 'Threats surfaced in under 4 seconds',
    detail: 'Anomalous traffic, brute-force attempts, and rogue device connections flagged instantly with full packet context.',
  },
  {
    src: '/screenshots/pentest-report.png',
    tag: 'Penetration Testing',
    tagColor: '#f59e0b',
    Icon: ShieldCheck,
    headline: 'Quarterly pen test findings in one view',
    detail: 'CVSS-scored vulnerabilities, remediation steps, and proof-of-concept evidence — executive-ready or technical depth, your choice.',
  },
  {
    src: '/screenshots/vessel-posture.png',
    tag: 'Vessel Endpoint Posture',
    tagColor: '#0ea5e9',
    Icon: Wifi,
    headline: 'Every device on board, accounted for',
    detail: 'Live inventory of connected endpoints across navigation, comms, and guest networks with patch status and risk score.',
  },
]

export default function Screenshots() {
  const [active, setActive] = useState(0)
  const touchStartX = useRef<number | null>(null)

  const prev = () => setActive(i => (i - 1 + SLIDES.length) % SLIDES.length)
  const next = () => setActive(i => (i + 1) % SLIDES.length)

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const delta = e.changedTouches[0].clientX - touchStartX.current
    if (delta < -40) next()
    else if (delta > 40) prev()
    touchStartX.current = null
  }

  return (
    <section style={{ background: '#060c18', padding: '80px 24px', borderTop: '1px solid #0a1929', borderBottom: '1px solid #0a1929' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#0ea5e9', marginBottom: 14 }}>
            Platform In Action
          </div>
          <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 40px)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.15, color: '#e8edf2', marginBottom: 14 }}>
            See exactly what your security team sees
          </h2>
          <p style={{ fontSize: 16, color: '#8aa4b8', maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>
            Every alert, test result, and vessel posture report — in a dashboard built for principals who want clarity without noise.
          </p>
        </div>

        {/* Desktop grid — 3 columns */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 24,
        }} className="screenshots-desktop">
          {SLIDES.map((s, i) => (
            <ScreenshotCard key={i} slide={s} />
          ))}
        </div>

        {/* Mobile carousel */}
        <div
          style={{ display: 'none' }}
          className="screenshots-mobile"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div style={{ position: 'relative' }}>
            <ScreenshotCard slide={SLIDES[active]} />
            {/* Prev/Next */}
            <button
              onClick={prev}
              aria-label="Previous"
              style={{
                position: 'absolute', left: -12, top: '40%',
                background: '#0d1f35', border: '1px solid #1e3350',
                borderRadius: '50%', width: 36, height: 36,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: '#7fb2d6',
              }}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={next}
              aria-label="Next"
              style={{
                position: 'absolute', right: -12, top: '40%',
                background: '#0d1f35', border: '1px solid #1e3350',
                borderRadius: '50%', width: 36, height: 36,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: '#7fb2d6',
              }}
            >
              <ChevronRight size={18} />
            </button>
          </div>
          {/* Dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 24 }}>
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                aria-label={`Go to slide ${i + 1}`}
                style={{
                  width: active === i ? 22 : 7,
                  height: 7,
                  borderRadius: 4,
                  background: active === i ? '#0ea5e9' : '#1e3350',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'width 0.25s',
                  padding: 0,
                }}
              />
            ))}
          </div>
        </div>

      </div>

      {/* Responsive style injection */}
      <style>{`
        @media (max-width: 700px) {
          .screenshots-desktop { display: none !important; }
          .screenshots-mobile { display: block !important; }
        }
      `}</style>
    </section>
  )
}

function ScreenshotCard({ slide }: { slide: typeof SLIDES[number] }) {
  const [loaded, setLoaded] = useState(false)
  const [errored, setErrored] = useState(false)
  const { src, tag, tagColor, Icon, headline, detail } = slide

  return (
    <div style={{
      borderRadius: 14,
      overflow: 'hidden',
      background: '#08111e',
      border: '1px solid #0f2035',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Image / placeholder area */}
      <div style={{
        position: 'relative',
        aspectRatio: '16/10',
        background: '#060e1a',
        overflow: 'hidden',
        borderBottom: '1px solid #0d1f33',
      }}>
        {/* Actual screenshot — hidden until loaded, hidden if errored */}
        {!errored && (
          <img
            src={src}
            alt={headline}
            onLoad={() => setLoaded(true)}
            onError={() => setErrored(true)}
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              objectFit: 'cover',
              opacity: loaded ? 1 : 0,
              transition: 'opacity 0.4s',
            }}
          />
        )}

        {/* Placeholder shown when image is missing */}
        {(!loaded || errored) && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 12,
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: `${tagColor}18`,
              border: `1px solid ${tagColor}30`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon size={22} color={tagColor} />
            </div>
            <span style={{ fontSize: 11, color: '#3a5570', letterSpacing: '0.06em', fontFamily: 'monospace' }}>
              {src}
            </span>
          </div>
        )}

        {/* Tag badge */}
        <div style={{
          position: 'absolute', top: 12, left: 12,
          background: `${tagColor}22`,
          border: `1px solid ${tagColor}50`,
          color: tagColor,
          fontSize: 10, fontWeight: 700,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          padding: '4px 10px', borderRadius: 6,
        }}>
          {tag}
        </div>
      </div>

      {/* Caption */}
      <div style={{ padding: '20px 22px 24px' }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#d4e4f0', lineHeight: 1.4, marginBottom: 8 }}>
          {headline}
        </p>
        <p style={{ fontSize: 13, color: '#6a8aa0', lineHeight: 1.6 }}>
          {detail}
        </p>
      </div>
    </div>
  )
}
