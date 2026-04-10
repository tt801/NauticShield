import { useState, useEffect } from 'react'
import { Anchor, Menu, X } from 'lucide-react'
import Hero from './sections/Hero'
import Features from './sections/Features'
import Pricing from './sections/Pricing'
import Testimonials from './sections/Testimonials'
import Contact from './sections/Contact'

const CLERK_SIGNUP_URL = 'https://accounts.nautic-shield.vercel.app/sign-up'

const NAV_LINKS = [
  { href: '#features', label: 'Features' },
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
    transition: 'background 0.3s, border-color 0.3s, backdrop-filter 0.3s',
    background: scrolled ? 'rgba(8,12,18,0.92)' : 'transparent',
    borderBottom: scrolled ? '1px solid #131e2d' : '1px solid transparent',
    backdropFilter: scrolled ? 'blur(12px)' : 'none',
  }

  return (
    <>
      <nav style={bar}>
        <a href="#home" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}>
          <Anchor size={18} color="#0ea5e9" />
          <span style={{ fontWeight: 800, fontSize: 15, color: '#e8edf2', letterSpacing: '-0.02em' }}>
            NauticShield
          </span>
        </a>

        {/* Nav links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          {NAV_LINKS.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              style={{ fontSize: 13, fontWeight: 500, color: '#6b7f90', transition: 'color 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#e8edf2' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#6b7f90' }}
            >
              {label}
            </a>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a
            href={CLERK_SIGNUP_URL}
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
    <footer style={{ background: '#05080f', borderTop: '1px solid #0d1520', padding: '48px 24px 32px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 32, marginBottom: 48 }}>
          <div style={{ maxWidth: 280 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
              <Anchor size={16} color="#0ea5e9" />
              <span style={{ fontWeight: 800, fontSize: 14, color: '#e8edf2' }}>NauticShield</span>
            </div>
            <p style={{ fontSize: 13, color: '#4a5568', lineHeight: 1.65 }}>
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
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#354555', marginBottom: 14 }}>
                  {heading}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {links.map(({ label, href }) => (
                    <a
                      key={label}
                      href={href}
                      style={{ fontSize: 13, color: '#4a5568', transition: 'color 0.15s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#8899aa' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#4a5568' }}
                    >
                      {label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ borderTop: '1px solid #0d1520', paddingTop: 24, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <span style={{ fontSize: 12, color: '#354555' }}>
            © {new Date().getFullYear()} NauticShield Ltd. All rights reserved.
          </span>
          <span style={{ fontSize: 12, color: '#354555' }}>
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
        <Pricing />
        <Testimonials />
        <Contact />
      </main>
      <Footer />
    </>
  )
}
