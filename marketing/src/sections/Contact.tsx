import { useState } from 'react'
import { Send, CheckCircle } from 'lucide-react'

type FormState = { name: string; email: string; vessels: string; message: string }
type Status = 'idle' | 'sending' | 'sent' | 'error'

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#0a0f18',
  border: '1px solid #1a2535',
  borderRadius: 8,
  padding: '12px 16px',
  fontSize: 14,
  color: '#e8edf2',
  outline: 'none',
  transition: 'border-color 0.15s',
  fontFamily: 'inherit',
}

export default function Contact() {
  const [form, setForm] = useState<FormState>({ name: '', email: '', vessels: '', message: '' })
  const [status, setStatus] = useState<Status>('idle')
  const [focused, setFocused] = useState<string | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    // Encode and post to Formspree (user replaces FORM_ID) or just mailto fallback
    try {
      const res = await fetch('https://formspree.io/f/xnjokwed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setStatus('sent')
        setForm({ name: '', email: '', vessels: '', message: '' })
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  const fieldStyle = (name: string): React.CSSProperties => ({
    ...inputStyle,
    borderColor: focused === name ? '#0ea5e9' : '#1a2535',
    boxShadow: focused === name ? '0 0 0 3px #0ea5e912' : 'none',
  })

  return (
    <section id="contact" style={{ background: '#05080f', padding: '64px 24px', position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(circle, #0ea5e908 0%, transparent 70%)', pointerEvents: 'none',
      }} />

      <div style={{ maxWidth: 1100, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#0ea5e9', marginBottom: 16 }}>
            Contact
          </div>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.15, color: '#e8edf2', marginBottom: 16 }}>
            Request a private overview.
          </h2>
          <p style={{ fontSize: 16, color: '#9cb1c2', lineHeight: 1.7 }}>
            Tell us about your fleet and security requirements. Our team will respond within 24 hours
            with a tailored response plan.
          </p>
        </div>

        <div className="contact-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 360px) 1fr', gap: 22, alignItems: 'start' }}>
          <aside style={{
            background: '#09111b', border: '1px solid #173047', borderRadius: 16, padding: '24px 22px',
            display: 'flex', flexDirection: 'column', gap: 16,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7fb2d6' }}>
              What Happens Next
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { title: '1. Initial review', text: 'We assess your vessel profile, topology, and current security posture from your submission.' },
                { title: '2. Private overview call', text: 'A senior specialist walks you through likely risks, practical coverage options, and rollout timing.' },
                { title: '3. Tailored proposal', text: 'You receive a clear phased plan with commercial options and operational responsibilities.' },
              ].map(step => (
                <div key={step.title} style={{ borderLeft: '2px solid #1e4f73', paddingLeft: 10 }}>
                  <div style={{ fontSize: 13, color: '#d5e6f2', fontWeight: 700, marginBottom: 4 }}>{step.title}</div>
                  <div style={{ fontSize: 12, color: '#9cb1c2', lineHeight: 1.6 }}>{step.text}</div>
                </div>
              ))}
            </div>
            <div style={{ borderTop: '1px solid #173047', paddingTop: 14 }}>
              <div style={{ fontSize: 12, color: '#e8edf2', fontWeight: 700, marginBottom: 6 }}>Confidentiality by default</div>
              <p style={{ fontSize: 12, color: '#9cb1c2', lineHeight: 1.6 }}>
                Enquiries are handled under strict confidentiality, shared only with the core delivery team,
                and never used for external marketing or reference without explicit approval.
              </p>
            </div>
          </aside>

          {status === 'sent' ? (
            <div style={{
              background: '#0a1a10', border: '1px solid #22c55e30', borderRadius: 16, padding: '48px 32px',
              textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
            }}>
              <CheckCircle size={48} color="#22c55e" />
              <div style={{ fontSize: 20, fontWeight: 700, color: '#e8edf2' }}>Message received.</div>
              <p style={{ fontSize: 14, color: '#9cb1c2', maxWidth: 420 }}>
                A member of our security team will contact you within 24 hours via your preferred channel.
                All communications are handled in strict confidence.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{
              background: '#0a0f18', border: '1px solid #131e2d', borderRadius: 16, padding: '40px 36px',
              display: 'flex', flexDirection: 'column', gap: 20,
            }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#9cb1c2', letterSpacing: '0.05em' }}>Full Name *</label>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  onFocus={() => setFocused('name')}
                  onBlur={() => setFocused(null)}
                  placeholder="J. Smith"
                  required
                  style={fieldStyle('name')}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#9cb1c2', letterSpacing: '0.05em' }}>Email Address *</label>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  onFocus={() => setFocused('email')}
                  onBlur={() => setFocused(null)}
                  placeholder="you@family.office"
                  required
                  style={fieldStyle('email')}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#9cb1c2', letterSpacing: '0.05em' }}>Fleet Size</label>
              <select
                name="vessels"
                value={form.vessels}
                onChange={handleChange}
                onFocus={() => setFocused('vessels')}
                onBlur={() => setFocused(null)}
                style={{ ...fieldStyle('vessels'), appearance: 'none' as const }}
              >
                <option value="">Select number of vessels</option>
                <option value="1">1 vessel</option>
                <option value="2-3">2–3 vessels</option>
                <option value="4-10">4–10 vessels</option>
                <option value="10+">10+ vessels</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#9cb1c2', letterSpacing: '0.05em' }}>How can we help? *</label>
              <textarea
                name="message"
                value={form.message}
                onChange={handleChange}
                onFocus={() => setFocused('message')}
                onBlur={() => setFocused(null)}
                placeholder="Tell us about your vessels, current security setup, and what you're looking to improve..."
                required
                rows={5}
                style={{ ...fieldStyle('message'), resize: 'vertical', minHeight: 120 }}
              />
            </div>

            {status === 'error' && (
              <p style={{ fontSize: 13, color: '#ef4444', textAlign: 'center' }}>
                Something went wrong. Please email us directly at <a href="mailto:security@nauticshield.io" style={{ color: '#0ea5e9' }}>security@nauticshield.io</a>
              </p>
            )}

            <button
              type="submit"
              disabled={status === 'sending'}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '14px', borderRadius: 10,
                background: status === 'sending' ? '#0a1a24' : '#0ea5e9',
                color: status === 'sending' ? '#4a5568' : '#fff',
                fontWeight: 700, fontSize: 15, transition: 'all 0.2s',
                boxShadow: status === 'sending' ? 'none' : '0 0 30px #0ea5e930',
                cursor: status === 'sending' ? 'not-allowed' : 'pointer',
                border: 'none', fontFamily: 'inherit',
              }}
              onMouseEnter={e => { if (status !== 'sending') (e.currentTarget as HTMLElement).style.boxShadow = '0 0 50px #0ea5e960' }}
              onMouseLeave={e => { if (status !== 'sending') (e.currentTarget as HTMLElement).style.boxShadow = '0 0 30px #0ea5e930' }}
            >
              {status === 'sending' ? 'Sending…' : (<><Send size={15} /> Send Overview Request</>)}
            </button>

            <p style={{ fontSize: 12, color: '#7f95a8', textAlign: 'center' }}>
              All enquiries treated with strict confidence.
              We never share your details with third parties.
            </p>
            </form>
          )}
        </div>

        <style>{`@media (max-width: 860px){.contact-grid{grid-template-columns:1fr!important;}}`}</style>
      </div>
    </section>
  )
}
