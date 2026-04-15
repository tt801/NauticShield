import { SignUp } from '@clerk/clerk-react';
import { dark } from '@clerk/themes';
import { ShieldCheck } from 'lucide-react';

const ALLOWED_EXTERNAL_REDIRECT_HOSTS = new Set(['nauticshield.io', 'www.nauticshield.io']);

function getSafeRedirectUrl() {
  if (typeof window === 'undefined') {
    return '/';
  }

  const redirectParam = new URLSearchParams(window.location.search).get('redirect_url');
  if (!redirectParam) {
    return '/';
  }

  try {
    const parsed = new URL(redirectParam, window.location.origin);
    if (parsed.origin === window.location.origin) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }

    if (parsed.protocol === 'https:' && ALLOWED_EXTERNAL_REDIRECT_HOSTS.has(parsed.hostname)) {
      return parsed.toString();
    }

    return '/';
  } catch {
    return '/';
  }
}

export default function SignUpPage() {
  const redirectUrl = getSafeRedirectUrl();

  return (
    <div style={{
      minHeight: '100vh',
      background: '#080b10',
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
          background: 'rgba(212,168,71,0.12)',
          border: '1px solid rgba(212,168,71,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <ShieldCheck size={28} color="#d4a847" />
        </div>
        <div style={{ color: '#f0f4f8', fontSize: 22, fontWeight: 800, letterSpacing: 0.3 }}>
          NauticShield
        </div>
        <div style={{ color: '#4a5a6a', fontSize: 13, marginTop: 6 }}>
          Create your vessel security account
        </div>
      </div>

      <SignUp
        appearance={{
          baseTheme: dark,
          variables: {
            colorBackground:        '#0d1421',
            colorInputBackground:   '#0a0f18',
            colorInputText:         '#f0f4f8',
            colorText:              '#f0f4f8',
            colorTextSecondary:     '#6b7f92',
            colorPrimary:           '#d4a847',
            colorDanger:            '#ef4444',
            borderRadius:           '10px',
            fontFamily:             "'Inter', system-ui, sans-serif",
          },
          elements: {
            card:               { boxShadow: '0 8px 40px rgba(0,0,0,0.6)', border: '1px solid #1a2535' },
            headerTitle:        { color: '#f0f4f8' },
            headerSubtitle:     { color: '#6b7f92' },
            socialButtonsBlockButton: {
              background: '#0a0f18',
              border: '1px solid #1a2535',
              color: '#c8d6e2',
            },
            dividerLine:        { background: '#1a2535' },
            dividerText:        { color: '#4a5a6a' },
            formFieldLabel:     { color: '#8899aa' },
            footerActionLink:   { color: '#d4a847' },
          },
        }}
        fallbackRedirectUrl={redirectUrl}
        forceRedirectUrl={redirectUrl}
        signInUrl="/sign-in"
      />

      <div style={{
        maxWidth: 360,
        textAlign: 'center',
        color: '#2a3a50',
        fontSize: 11,
        lineHeight: 1.6,
      }}>
        Create your account first, then NauticShield will continue your selected onboarding and billing flow.
      </div>
    </div>
  );
}