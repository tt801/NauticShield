import { SignIn } from '@clerk/clerk-react'
import { ShieldCheck } from 'lucide-react'

function getSafeRedirectUrl() {
  if (typeof window === 'undefined') {
    return '/fleet'
  }

  const redirectParam = new URLSearchParams(window.location.search).get('redirect_url')
  if (!redirectParam) {
    return '/fleet'
  }

  try {
    const parsed = new URL(redirectParam, window.location.origin)
    if (parsed.origin !== window.location.origin) {
      return '/fleet'
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}` || '/fleet'
  } catch {
    return '/fleet'
  }
}

export default function SignInPage() {
  const redirectUrl = getSafeRedirectUrl()

  return (
    <div style={{
      minHeight: '100vh',
      background: '#080c12',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 40,
      padding: 24,
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16, margin: '0 auto 16px',
          background: 'rgba(14,165,233,0.12)',
          border: '1px solid rgba(14,165,233,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <ShieldCheck size={28} color="#0ea5e9" />
        </div>
        <div style={{ color: '#f0f4f8', fontSize: 22, fontWeight: 800, letterSpacing: 0.3 }}>
          NauticShield Admin
        </div>
        <div style={{ color: '#4a5a6a', fontSize: 13, marginTop: 6 }}>
          Administrator access only
        </div>
      </div>

      <SignIn
        appearance={{
          variables: {
            colorBackground: '#0d1421',
            colorInputBackground: '#0a0f18',
            colorInputText: '#f0f4f8',
            colorText: '#f0f4f8',
            colorTextSecondary: '#6b7f92',
            colorPrimary: '#0ea5e9',
            colorDanger: '#ef4444',
            borderRadius: '10px',
            fontFamily: "'Inter', system-ui, sans-serif",
          },
          elements: {
            card: { boxShadow: '0 8px 40px rgba(0,0,0,0.6)', border: '1px solid #1a2535', background: '#0d1421' },
            headerTitle: { color: '#f0f4f8' },
            headerSubtitle: { color: '#6b7f92' },
            socialButtonsBlockButton: {
              background: '#0a0f18',
              border: '1px solid #1a2535',
              color: '#c8d6e2',
            },
            dividerLine: { background: '#1a2535' },
            dividerText: { color: '#4a5a6a' },
            formFieldLabel: { color: '#8899aa' },
            footerActionLink: { color: '#0ea5e9' },
          },
        }}
        fallbackRedirectUrl={redirectUrl}
        forceRedirectUrl={redirectUrl}
      />
    </div>
  )
}