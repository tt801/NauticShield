import { useState, useEffect } from 'react';
import { useOrganizationList, useClerk } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { Anchor, ShieldCheck, AlertTriangle, ExternalLink } from 'lucide-react';
import { fetchJSON } from '@/api/client';
import { AGENT_URL, CLOUD_API_URL } from '@/api/config';

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh', background: '#080b10',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 24, fontFamily: "'Inter', system-ui, sans-serif",
  },
  card: {
    background: '#0d1421', border: '1px solid #1a2535',
    borderRadius: 16, padding: 40, width: '100%', maxWidth: 480,
  },
  logo: {
    display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32,
  },
  logoIcon: {
    width: 44, height: 44, borderRadius: 12,
    background: 'linear-gradient(135deg, #d4a847 0%, #b8922e 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  logoText: { color: '#f0f4f8', fontSize: 20, fontWeight: 800, letterSpacing: '-0.3px' },
  logoSub:  { color: '#4a5a6a', fontSize: 11, marginTop: 1 },
  heading:  { color: '#f0f4f8', fontSize: 22, fontWeight: 700, marginBottom: 8 },
  sub:      { color: '#4a5a6a', fontSize: 13, lineHeight: 1.6, marginBottom: 28 },
  label:    { color: '#8a9ab0', fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block' },
  input: {
    width: '100%', background: '#0a0f18', border: '1px solid #1a2535',
    borderRadius: 10, padding: '12px 14px', color: '#f0f4f8', fontSize: 14,
    outline: 'none', boxSizing: 'border-box' as const, marginBottom: 8,
  },
  hint: { color: '#4a5a6a', fontSize: 11, marginBottom: 24 },
  btn: {
    width: '100%', background: 'linear-gradient(135deg, #d4a847 0%, #b8922e 100%)',
    border: 'none', borderRadius: 10, padding: '13px 0',
    color: '#080b10', fontSize: 14, fontWeight: 700, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  btnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  error: {
    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 8, padding: '10px 14px', color: '#f87171', fontSize: 12, marginBottom: 16,
  },
  footer: {
    marginTop: 28, paddingTop: 20, borderTop: '1px solid #1a2535',
    color: '#4a5a6a', fontSize: 11, textAlign: 'center' as const, lineHeight: 1.6,
  },
};

export default function Onboarding() {
  const { setActive, userMemberships, isLoaded, createOrganization } = useOrganizationList({ userMemberships: true });
  const { signOut } = useClerk();
  const navigate = useNavigate();
  const [vesselName, setVesselName] = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [limitHit, setLimitHit]     = useState(false);

  // If Clerk already shows the user has a vessel (reused email, previous partial session, etc.),
  // silently activate it and redirect to dashboard.
  useEffect(() => {
    if (!isLoaded) return;
    const memberships = userMemberships?.data;
    if (memberships && memberships.length > 0 && setActive) {
      setActive({ organization: memberships[0].organization.id }).then(() => {
        navigate('/', { replace: true });
      });
    }
  }, [isLoaded, userMemberships?.data, setActive, navigate]);

  // If the user already has an org (e.g. from a previous session), just activate it
  async function activateExisting() {
    const existing = userMemberships?.data?.[0];
    if (existing && setActive) {
      await setActive({ organization: existing.organization.id });
    }
  }

  async function handleCreate() {
    const name = vesselName.trim();
    if (!name) return;
    setLoading(true);
    setError(null);
    try {
      const endpoints = Array.from(new Set([
        CLOUD_API_URL,
        'https://nautic-shield.vercel.app',
        AGENT_URL,
      ].filter(Boolean)));

      let result: { orgId: string; orgName: string; message?: string } | null = null;
      let lastErr: Error | null = null;

      for (const base of endpoints) {
        try {
          result = await fetchJSON<{ orgId: string; orgName: string; message?: string }>(
            `${base}/api/vessels`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name }),
            },
          );
          break;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          if (msg.includes('vessel_limit_reached') || msg.includes('plan allows')) {
            throw new Error(msg);
          }
          lastErr = err instanceof Error ? err : new Error(msg);
        }
      }

      if (!result) throw lastErr ?? new Error('Failed to create vessel. Please try again.');

      // Activate the newly created org in Clerk's client session
      await setActive!({ organization: result.orgId });
      navigate('/', { replace: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to create vessel. Please try again.';

      // Backward-compatibility fallback: if a stale cloud deployment returns 405,
      // create the organization client-side so onboarding is not blocked.
      if ((msg.includes('HTTP 405') || msg.includes('Failed to fetch') || msg.includes('NetworkError')) && createOrganization && setActive) {
        try {
          const org = await createOrganization({ name });
          await setActive({ organization: org.id });
          navigate('/', { replace: true });
          return;
        } catch {
          // Fall through to normal error handling below
        }
      }

      // 402 = vessel quota reached — show upgrade prompt instead of generic error
      if (msg.includes('vessel_limit_reached') || msg.includes('plan allows')) {
        setLimitHit(true);
      } else {
        setError(msg);
      }
      setLoading(false);
    }
  }

  // Don't render the form until memberships have loaded — avoids a flash
  // of the create form for users who already have a vessel (auto-redirected above).
  if (!isLoaded || (userMemberships?.data?.length ?? 0) > 0) {
    return <div style={{ ...S.page }}><div style={{ color: '#4a5a6a', fontSize: 13 }}>Loading…</div></div>;
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        {/* Logo */}
        <div style={S.logo}>
          <div style={S.logoIcon}>
            <Anchor size={22} color="#080b10" strokeWidth={2.5} />
          </div>
          <div>
            <div style={S.logoText}>NauticShield</div>
            <div style={S.logoSub}>Marine Cybersecurity Platform</div>
          </div>
        </div>

        <div style={S.heading}>Set up your vessel</div>
        <div style={S.sub}>
          Create a vessel profile to get started. You'll be able to invite your
          captain and crew from Settings once you're in.
        </div>

        {error && <div style={S.error}>{error}</div>}

        {/* Vessel limit reached — upgrade prompt */}
        {limitHit && (
          <div style={{
            background: 'rgba(212,168,71,0.08)',
            border: '1px solid rgba(212,168,71,0.35)',
            borderRadius: 12, padding: '18px 20px', marginBottom: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <AlertTriangle size={15} color="#d4a847" />
              <span style={{ color: '#d4a847', fontWeight: 700, fontSize: 13 }}>Vessel limit reached</span>
            </div>
            <p style={{ color: '#8899aa', fontSize: 12, lineHeight: 1.7, margin: '0 0 14px' }}>
              Your current plan only allows 1 vessel. Upgrade to <strong style={{ color: '#f0f4f8' }}>Pro</strong> (3 vessels)
              or <strong style={{ color: '#f0f4f8' }}>Enterprise</strong> (unlimited) to add more.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <a
                href="https://nauticshield.io/pricing"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: 'linear-gradient(135deg, #d4a847, #b8922f)',
                  color: '#080b10', borderRadius: 8,
                  padding: '8px 16px', fontSize: 12, fontWeight: 700, textDecoration: 'none',
                }}
              >
                View plans &amp; upgrade <ExternalLink size={11} />
              </a>
              {(userMemberships?.count ?? 0) > 0 && (
                <button
                  onClick={activateExisting}
                  style={{
                    background: 'rgba(255,255,255,0.05)', border: '1px solid #1a2535',
                    color: '#8899aa', borderRadius: 8,
                    padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Continue with existing vessel
                </button>
              )}
            </div>
          </div>
        )}

        <label style={S.label}>Vessel name</label>
        <input
          style={S.input}
          placeholder="e.g. M/Y Aurora"
          value={vesselName}
          onChange={e => setVesselName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !loading && handleCreate()}
          disabled={loading}
          autoFocus
        />
        <div style={S.hint}>This will identify your vessel across NauticShield.</div>

        <button
          style={{ ...S.btn, ...(loading || !vesselName.trim() ? S.btnDisabled : {}) }}
          onClick={handleCreate}
          disabled={loading || !vesselName.trim()}
        >
          <ShieldCheck size={16} />
          {loading ? 'Creating vessel…' : 'Create vessel & continue'}
        </button>

        <div style={S.footer}>
          Your vessel data stays on-board. Only identity information<br />
          is processed by Clerk's authentication service.
        </div>
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button
            onClick={() => signOut()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3a4a5a', fontSize: 12, textDecoration: 'underline' }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
