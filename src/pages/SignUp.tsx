import { useMemo, useState } from 'react';
import { SignUp } from '@clerk/clerk-react';
import { dark } from '@clerk/themes';
import { ArrowLeft, Building2, ShieldCheck } from 'lucide-react';

const ALLOWED_EXTERNAL_REDIRECT_HOSTS = new Set(['nauticshield.io', 'www.nauticshield.io']);

type BillingProfile = {
  contactFirstName: string;
  contactLastName: string;
  businessName: string;
  billingEmail: string;
  billingPhone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  taxId: string;
};

const DEFAULT_PROFILE: BillingProfile = {
  contactFirstName: '',
  contactLastName: '',
  businessName: '',
  billingEmail: '',
  billingPhone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  region: '',
  postalCode: '',
  country: '',
  taxId: '',
};

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
  const [step, setStep] = useState<'details' | 'account'>('details');
  const [profile, setProfile] = useState<BillingProfile>(DEFAULT_PROFILE);

  const isDetailsValid = useMemo(() => {
    return [
      profile.contactFirstName,
      profile.contactLastName,
      profile.businessName,
      profile.billingEmail,
      profile.billingPhone,
      profile.addressLine1,
      profile.city,
      profile.postalCode,
      profile.country,
    ].every(value => value.trim().length > 0);
  }, [profile]);

  function updateProfile<K extends keyof BillingProfile>(key: K, value: BillingProfile[K]) {
    setProfile(current => ({ ...current, [key]: value }));
  }

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

      {step === 'details' ? (
        <div style={{ width: '100%', maxWidth: 760, background: '#0d1421', border: '1px solid #1a2535', borderRadius: 16, padding: 28, boxShadow: '0 8px 40px rgba(0,0,0,0.45)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <Building2 size={18} color="#d4a847" />
            <div style={{ color: '#f0f4f8', fontSize: 18, fontWeight: 700 }}>Billing details</div>
          </div>
          <p style={{ margin: '0 0 24px', color: '#6b7f92', fontSize: 13, lineHeight: 1.6 }}>
            Capture the account holder and business details now so invoices and Stripe customer records are set up correctly from the first payment.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 14 }}>
            <Field label="First name" value={profile.contactFirstName} onChange={value => updateProfile('contactFirstName', value)} required />
            <Field label="Last name" value={profile.contactLastName} onChange={value => updateProfile('contactLastName', value)} required />
            <Field label="Business / ownership entity" value={profile.businessName} onChange={value => updateProfile('businessName', value)} required />
            <Field label="Billing email" type="email" value={profile.billingEmail} onChange={value => updateProfile('billingEmail', value)} required />
            <Field label="Billing phone" type="tel" value={profile.billingPhone} onChange={value => updateProfile('billingPhone', value)} required />
            <Field label="VAT / tax ID" value={profile.taxId} onChange={value => updateProfile('taxId', value)} />
          </div>

          <div style={{ display: 'grid', gap: 14, marginBottom: 22 }}>
            <Field label="Billing address line 1" value={profile.addressLine1} onChange={value => updateProfile('addressLine1', value)} required />
            <Field label="Billing address line 2" value={profile.addressLine2} onChange={value => updateProfile('addressLine2', value)} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
              <Field label="City" value={profile.city} onChange={value => updateProfile('city', value)} required />
              <Field label="County / state / region" value={profile.region} onChange={value => updateProfile('region', value)} />
              <Field label="Postcode" value={profile.postalCode} onChange={value => updateProfile('postalCode', value)} required />
              <Field label="Country" value={profile.country} onChange={value => updateProfile('country', value)} required placeholder="United Kingdom" />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setStep('account')}
            disabled={!isDetailsValid}
            style={{
              width: '100%',
              border: 'none',
              borderRadius: 10,
              padding: '14px 18px',
              background: isDetailsValid ? 'linear-gradient(135deg, #d4a847 0%, #b8922e 100%)' : '#243243',
              color: isDetailsValid ? '#080b10' : '#7f8ea2',
              fontSize: 14,
              fontWeight: 800,
              cursor: isDetailsValid ? 'pointer' : 'not-allowed',
            }}
          >
            Continue to account creation
          </button>
        </div>
      ) : (
        <div style={{ width: '100%', maxWidth: 520 }}>
          <button
            type="button"
            onClick={() => setStep('details')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 16, background: 'none', border: 'none', color: '#8ea4b6', fontSize: 13, cursor: 'pointer' }}
          >
            <ArrowLeft size={14} />
            Back to billing details
          </button>

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
            unsafeMetadata={{ billingProfile: profile }}
          />
        </div>
      )}

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

function Field({
  label,
  value,
  onChange,
  required = false,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  type?: 'text' | 'email' | 'tel';
}) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <span style={{ color: '#9cb1c2', fontSize: 12, fontWeight: 600 }}>
        {label}{required ? ' *' : ''}
      </span>
      <input
        type={type}
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          background: '#0a0f18',
          border: '1px solid #1a2535',
          borderRadius: 10,
          padding: '12px 14px',
          color: '#f0f4f8',
          fontSize: 14,
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
    </label>
  )
}