import { useEffect, useRef, useState } from 'react'
import { Quote, ChevronLeft, ChevronRight } from 'lucide-react'

const TESTIMONIALS = [
  {
    quote:
      'We had a sophisticated intrusion attempt on our satcom array while anchored off Sardinia. NauticShield detected it in under two seconds and had the network segmented before our captain even saw the alert. That level of response is simply unmatched.',
    name: 'J.W.H.',
    title: 'Principal, 62m Motor Yacht',
    region: 'Mediterranean',
  },
  {
    quote:
      'The confidentiality aspect was non-negotiable for us. After an exhaustive vendor assessment, NauticShield was the only provider that could demonstrate true zero-logging. Our legal team signed off immediately.',
    name: 'Family Office Rep.',
    title: 'Multi-vessel Fleet, North Atlantic',
    region: 'North Atlantic',
  },
  {
    quote:
      'The quarterly penetration tests uncovered two critical vulnerabilities in our bridge automation systems — issues our previous vendor had been missing for years. The report quality alone justifies the investment.',
    name: 'D.A.',
    title: 'Captain, 80m Expedition Yacht',
    region: 'Pacific Circuit',
  },
  {
    quote:
      'Having a self-service dashboard where I can see every device on every vessel in real time — from my phone, from anywhere — is a completely different standard of visibility. I wouldn\'t leave port without it.',
    name: 'G.E.T.',
    title: 'Owner, 3-vessel Charter Fleet',
    region: 'Caribbean',
  },
]

const INTERVAL = 5000

export default function Testimonials() {
  const [active, setActive] = useState(0)
  const [fading, setFading] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  function goTo(index: number) {
    if (fading) return
    setFading(true)
    setTimeout(() => {
      setActive((index + TESTIMONIALS.length) % TESTIMONIALS.length)
      setFading(false)
    }, 280)
  }

  function resetTimer() {
    if (timer.current) clearInterval(timer.current)
    timer.current = setInterval(() => goTo(active + 1), INTERVAL)
  }

  useEffect(() => {
    timer.current = setInterval(() => {
      setFading(true)
      setTimeout(() => {
        setActive(prev => (prev + 1) % TESTIMONIALS.length)
        setFading(false)
      }, 280)
    }, INTERVAL)
    return () => { if (timer.current) clearInterval(timer.current) }
  }, [])

  function handlePrev() { resetTimer(); goTo(active - 1) }
  function handleNext() { resetTimer(); goTo(active + 1) }

  const t = TESTIMONIALS[active]

  return (
    <section id="testimonials" style={{ background: '#080c12', padding: '64px 24px', position: 'relative' }}>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(to right, #0ea5e905 1px, transparent 1px)',
        backgroundSize: '120px', pointerEvents: 'none',
      }} />

      <div style={{ maxWidth: 780, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: 44 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#0ea5e9', marginBottom: 16 }}>
            Testimonials
          </div>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.15, color: '#e8edf2' }}>
            Trusted by principals<br />who accept no compromise.
          </h2>
        </div>

        {/* Card */}
        <div style={{
          background: '#0a0f18',
          border: '1px solid #1a2c3d',
          borderRadius: 20,
          padding: '44px 48px',
          minHeight: 260,
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          opacity: fading ? 0 : 1,
          transform: fading ? 'translateY(6px)' : 'translateY(0)',
          transition: 'opacity 0.28s ease, transform 0.28s ease',
        }}>
          <Quote size={22} color="#0ea5e930" />
          <p style={{ fontSize: 16, lineHeight: 1.8, color: '#b8cfd e', fontStyle: 'italic', flex: 1 }}>
            "{t.quote}"
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 20, borderTop: '1px solid #0f1923' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'linear-gradient(135deg, #0ea5e920, #0ea5e940)',
                border: '1px solid #0ea5e930',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 700, color: '#0ea5e9', flexShrink: 0,
              }}>
                {t.name[0]}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#e8edf2' }}>{t.name}</div>
                <div style={{ fontSize: 12, color: '#8ea4b6' }}>{t.title}</div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: '#7b92a6', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {t.region}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 28 }}>
          <button
            onClick={handlePrev}
            aria-label="Previous"
            style={{
              width: 36, height: 36, borderRadius: '50%',
              border: '1px solid #1e2d3d', background: 'transparent',
              color: '#7b95a8', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#0ea5e9'; (e.currentTarget as HTMLElement).style.color = '#0ea5e9' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#1e2d3d'; (e.currentTarget as HTMLElement).style.color = '#7b95a8' }}
          >
            <ChevronLeft size={16} />
          </button>

          <div style={{ display: 'flex', gap: 8 }}>
            {TESTIMONIALS.map((_, i) => (
              <button
                key={i}
                onClick={() => { resetTimer(); goTo(i) }}
                aria-label={`Go to testimonial ${i + 1}`}
                style={{
                  width: i === active ? 24 : 8,
                  height: 8,
                  borderRadius: 999,
                  border: 'none',
                  background: i === active ? '#0ea5e9' : '#1e2d3d',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  padding: 0,
                }}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            aria-label="Next"
            style={{
              width: 36, height: 36, borderRadius: '50%',
              border: '1px solid #1e2d3d', background: 'transparent',
              color: '#7b95a8', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#0ea5e9'; (e.currentTarget as HTMLElement).style.color = '#0ea5e9' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#1e2d3d'; (e.currentTarget as HTMLElement).style.color = '#7b95a8' }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </section>
  )
}
