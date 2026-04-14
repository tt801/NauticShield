import { useState, useEffect } from 'react'
import { Menu, X } from 'lucide-react'
import Hero from './sections/Hero'
import Features from './sections/Features'
import Screenshots from './sections/Screenshots'
import Pricing from './sections/Pricing'
import Testimonials from './sections/Testimonials'
import Contact from './sections/Contact'

const SIGN_IN_URL = 'https://app.nauticshield.io/sign-in'
const GET_STARTED_URL = '#pricing'

const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#platform', label: 'Platform' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#testimonials', label: 'Testimonials' },
  { href: '#contact', label: 'Contact' },
]

function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const bar: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    padding: '0 24px',
    height: 64,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    transition: 'box-shadow 0.3s',
    background: 'rgba(3, 8, 18, 0.97)',
    borderBottom: '1px solid #0d1f35',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    boxShadow: scrolled
      ? '0 2px 32px rgba(0,0,0,0.55)'
      : '0 1px 16px rgba(0,0,0,0.35)',
  }

  return (
    <>
      <nav style={bar}>
        <a href="#home" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', alignSelf: 'flex-start', paddingTop: 16 }}>
          <img src="/icons.png" alt="NauticShield" style={{ height: 72, width: 'auto', objectFit: 'contain' }} />
        </a>

        {/* Nav links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          {NAV_LINKS.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              style={{ fontSize: 13, fontWeight: 500, color: '#96adbf', transition: 'color 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#e8edf2' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#96adbf' }}
            >
              {label}
            </a>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a
            href={SIGN_IN_URL}
            style={{
              padding: '8px 14px', borderRadius: 8,
              border: '1px solid #1f3347', color: '#a8bed0',
              fontWeight: 600, fontSize: 13, transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement
              el.style.borderColor = '#0ea5e950'
              el.style.color = '#e8edf2'
              el.style.background = 'rgba(14,165,233,0.08)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement
              el.style.borderColor = '#1f3347'
              el.style.color = '#a8bed0'
              el.style.background = 'transparent'
            }}
          >
            Sign In
          </a>
          <a
            href={GET_STARTED_URL}
            style={{
              padding: '8px 18px', borderRadius: 8,
              background: '#0ea5e9', color: '#fff',
              fontWeight: 700, fontSize: 13, transition: 'all 0.2s',
              boxShadow: '0 0 20px #0ea5e925',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 0 32px #0ea5e960' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 0 20px #0ea5e925' }}
          >
            Get Started
          </a>

          {/* Mobile hamburger */}
          <button
            onClick={() => setOpen(v => !v)}
            aria-label="Toggle menu"
            style={{ padding: 6, color: '#6b7f90', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      {open && (
        <div style={{
          position: 'fixed', top: 64, left: 0, right: 0, zIndex: 99,
          background: 'rgba(8,12,18,0.98)', borderBottom: '1px solid #131e2d',
          backdropFilter: 'blur(16px)', padding: '16px 24px 24px',
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          {NAV_LINKS.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              style={{
                display: 'block', padding: '12px 0', fontSize: 15, fontWeight: 500,
                color: '#8899aa', borderBottom: '1px solid #0f1923',
              }}
            >
              {label}
            </a>
          ))}
        </div>
      )}
    </>
  )
}

function Footer() {
  return (
    <footer style={{ background: '#03060b', borderTop: '1px solid #1e3145', padding: '56px 24px 36px', boxShadow: 'inset 0 18px 40px rgba(0,0,0,0.35)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 32, marginBottom: 48 }}>
          <div style={{ maxWidth: 280 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
              <img src="/icons.png" alt="NauticShield" style={{ height: 60, width: 'auto', objectFit: 'contain' }} />
            </div>
            <p style={{ fontSize: 13, color: '#91a7b8', lineHeight: 1.65 }}>
              Enterprise maritime cybersecurity for principals who demand absolute protection,
              confidentiality, and control.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 56, flexWrap: 'wrap' }}>
            {[
              { heading: 'Product', links: [{ label: 'Features', href: '#features' }, { label: 'Pricing', href: '#pricing' }, { label: 'Security', href: '#features' }] },
              { heading: 'Company', links: [{ label: 'Contact', href: '#contact' }, { label: 'Privacy', href: '#' }, { label: 'Terms', href: '#' }] },
            ].map(({ heading, links }) => (
              <div key={heading}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7a95aa', marginBottom: 14 }}>
                  {heading}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {links.map(({ label, href }) => (
                    <a
                      key={label}
                      href={href}
                      style={{ fontSize: 13, color: '#91a7b8', transition: 'color 0.15s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#d5e4ef' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#91a7b8' }}
                    >
                      {label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ borderTop: '1px solid #1a2a3b', paddingTop: 24, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <span style={{ fontSize: 12, color: '#7a95aa' }}>
            © {new Date().getFullYear()} NauticShield Ltd. All rights reserved.
          </span>
          <span style={{ fontSize: 12, color: '#7a95aa' }}>
            ISO 27001 aligned · IMO MSC-FAL.1/Circ.3 compliant
          </span>
        </div>
      </div>
    </footer>
  )
}

export default function App() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Features />
        <Screenshots />
        <Pricing />
        <Testimonials />
        <Contact />
      </main>
      <Footer />
    </>
  )
}
