import { useState, useEffect } from 'react';
import { useOrganizationList, useClerk, useAuth, useOrganization, useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { Anchor, ShieldCheck, AlertTriangle, ExternalLink } from 'lucide-react';
import { CLOUD_API_URL } from '@/api/config';

const ACTIVE_ORG_STORAGE_KEY = 'nauticshield.activeOrgId';
const ACTIVE_ORG_QUERY_KEY = 'ns_org';
type MembershipSummary = { organization: { id: string; name: string | null } };

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
  const { organization } = useOrganization();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [vesselName, setVesselName] = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [limitHit, setLimitHit]     = useState(false);
  const [preferredOrgId, setPreferredOrgId] = useState<string | null>(null);
  const [probedMemberships, setProbedMemberships] = useState<MembershipSummary[] | null>(null);
  const [membershipProbeComplete, setMembershipProbeComplete] = useState(false);

  function buildAppRedirect(orgId: string) {
    return `/?${ACTIVE_ORG_QUERY_KEY}=${encodeURIComponent(orgId)}`;
  }

  const memberships: MembershipSummary[] = ((userMemberships?.data?.length ?? 0) > 0
    ? userMemberships?.data?.map(membership => ({
        organization: {
          id: membership.organization.id,
          name: membership.organization.name ?? null,
        },
      }))
    : probedMemberships) ?? [];

  useEffect(() => {
    if (organization?.id) {
      window.localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, organization.id);
    }
  }, [organization?.id]);

  useEffect(() => {
    if (!isLoaded || !user) {
      return;
    }

    if ((userMemberships?.data?.length ?? 0) > 0) {
      setProbedMemberships(null);
      setMembershipProbeComplete(true);
      return;
    }

    let cancelled = false;

    void user.getOrganizationMemberships().then(result => {
      if (cancelled) return;
      setProbedMemberships(result.data.map(membership => ({
        organization: {
          id: membership.organization.id,
          name: membership.organization.name ?? null,
        },
      })));
      setMembershipProbeComplete(true);
    }).catch(() => {
      if (cancelled) return;
      setProbedMemberships([]);
      setMembershipProbeComplete(true);
    });

    return () => {
      cancelled = true;
    };
  }, [isLoaded, user, userMemberships?.data]);

  async function waitForMembership(orgId: string) {
    if (!user) return;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const result = await user.getOrganizationMemberships();
      const nextMemberships = result.data.map(membership => ({
        organization: {
          id: membership.organization.id,
          name: membership.organization.name ?? null,
        },
      }));

      setProbedMemberships(nextMemberships);
      setMembershipProbeComplete(true);
      await userMemberships.revalidate?.();

      if (nextMemberships.some(membership => membership.organization.id === orgId)) {
        return;
      }

      await new Promise(resolve => window.setTimeout(resolve, 250 * (attempt + 1)));
    }
  }

  async function activateOrgWithRetry(orgId: string) {
    if (!setActive) throw new Error('Organization activation unavailable. Please refresh and try again.');

    window.localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, orgId);

    try {
      await setActive({ organization: orgId });
      return;
    } catch {
      // One retry covers transient Clerk session/network blips.
      await setActive({ organization: orgId });
    }
  }

  // If we already have an active org, onboarding is complete.
  useEffect(() => {
    if (organization?.id) {
      navigate(buildAppRedirect(organization.id), { replace: true });
    }
  }, [organization?.id, navigate]);

  // If no active org yet but memberships exist, activate the best candidate and continue.
  useEffect(() => {
    if (!isLoaded || organization?.id) return;
    if (memberships && memberships.length > 0 && setActive) {
      const storedOrgId = window.localStorage.getItem(ACTIVE_ORG_STORAGE_KEY);
      const preferred =
        (preferredOrgId ? memberships.find(m => m.organization.id === preferredOrgId) : undefined)
        ?? (storedOrgId ? memberships.find(m => m.organization.id === storedOrgId) : undefined)
        ?? memberships.find(m => m.organization.name?.trim().toLowerCase() === vesselName.trim().toLowerCase())
        ?? memberships[memberships.length - 1];

      setActive({ organization: preferred.organization.id })
        .then(() => {
          window.localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, preferred.organization.id);
          navigate(buildAppRedirect(preferred.organization.id), { replace: true });
        })
        .catch(() => {
          setError('We found your vessel, but could not restore the session automatically. Use the button below to retry.');
        });
    }
  }, [isLoaded, organization?.id, memberships, preferredOrgId, vesselName, setActive, navigate]);

  // If the user already has an org (e.g. from a previous session), just activate it
  async function activateExisting(preferredName?: string, preferredId?: string) {
    const storedOrgId = window.localStorage.getItem(ACTIVE_ORG_STORAGE_KEY);
    const existing =
      (preferredId ? memberships.find(m => m.organization.id === preferredId) : undefined)
      ?? (storedOrgId ? memberships.find(m => m.organization.id === storedOrgId) : undefined)
      ?? (preferredName ? memberships.find(m => m.organization.name?.trim().toLowerCase() === preferredName.trim().toLowerCase()) : undefined)
      ?? memberships[memberships.length - 1];

    if (existing && setActive) {
      window.localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, existing.organization.id);
      await setActive({ organization: existing.organization.id });
    }
  }

  async function handleCreate() {
    const name = vesselName.trim();
    if (!name) return;
    setLoading(true);
    setError(null);
    try {
      if (!createOrganization || !setActive) {
        throw new Error('Onboarding service unavailable. Please refresh and try again.');
      }

      // Prefer direct Clerk creation for the fastest path.
      let orgId: string;
      try {
        const org = await createOrganization({ name });
        orgId = org.id;
        setPreferredOrgId(org.id);
        window.localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, org.id);
        await waitForMembership(org.id);
      } catch (primaryErr: unknown) {
        // Fallback: create vessel via cloud API if browser-side Clerk call fails.
        if (!CLOUD_API_URL) throw primaryErr;

        const token = await getToken();
        if (!token) throw primaryErr;

        const res = await fetch(`${CLOUD_API_URL}/api/vessels`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name }),
        });

        if (!res.ok) {
          let message = `HTTP ${res.status}`;
          try {
            const body = await res.json();
            message = body?.message || body?.error || message;
          } catch {
            // ignore JSON parsing errors
          }
          throw new Error(message);
        }

        const body = await res.json() as { orgId?: string };
        if (!body.orgId) {
          throw new Error('Vessel created but organization activation failed. Please refresh and try again.');
        }
        orgId = body.orgId;
        setPreferredOrgId(body.orgId);
        window.localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, body.orgId);
        await waitForMembership(body.orgId);
      }

      await activateOrgWithRetry(orgId);
      navigate(buildAppRedirect(orgId), { replace: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to create vessel. Please try again.';

      // 402 = vessel quota reached — show upgrade prompt instead of generic error
      if (msg.includes('vessel_limit_reached') || msg.includes('plan allows')) {
        setLimitHit(true);
      } else if (msg.toLowerCase().includes('failed to fetch')) {
        try {
          await activateExisting(name, preferredOrgId ?? undefined);
          const fallbackOrgId = preferredOrgId ?? window.localStorage.getItem(ACTIVE_ORG_STORAGE_KEY);
          navigate(fallbackOrgId ? buildAppRedirect(fallbackOrgId) : '/', { replace: true });
          return;
        } catch {
          setError('Network error while creating vessel. Please check your connection and try again.');
        }
      } else {
        setError(msg);
      }
      setLoading(false);
    }
  }

  if (!isLoaded) {
    return <div style={{ ...S.page }}><div style={{ color: '#4a5a6a', fontSize: 13 }}>Loading…</div></div>;
  }

  if (!membershipProbeComplete && (userMemberships?.data?.length ?? 0) === 0) {
    return <div style={{ ...S.page }}><div style={{ color: '#4a5a6a', fontSize: 13 }}>Checking vessel access…</div></div>;
  }

  const hasExistingVessel = memberships.length > 0;

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

        {hasExistingVessel && (
          <div style={{
            background: 'rgba(14,165,233,0.08)',
            border: '1px solid rgba(14,165,233,0.25)',
            borderRadius: 12,
            padding: '16px 18px',
            marginBottom: 20,
          }}>
            <div style={{ color: '#7dd3fc', fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
              Existing vessel found
            </div>
            <div style={{ color: '#9fb3c8', fontSize: 12, lineHeight: 1.6, marginBottom: 12 }}>
              Your account already has vessel access. If NauticShield did not restore it automatically, retry below instead of creating a new vessel.
            </div>
            <button
              onClick={() => activateExisting().then(() => {
                const orgId = window.localStorage.getItem(ACTIVE_ORG_STORAGE_KEY);
                navigate(orgId ? buildAppRedirect(orgId) : '/', { replace: true });
              }).catch(() => setError('Could not restore your existing vessel. Please sign out and back in, or try again.'))}
              style={{
                background: 'rgba(255,255,255,0.05)', border: '1px solid #1a2535',
                color: '#dce8f4', borderRadius: 8,
                padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Continue with existing vessel
            </button>
          </div>
        )}

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
                  onClick={() => activateExisting()}
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
          disabled={loading || hasExistingVessel}
          autoFocus
        />
        <div style={S.hint}>This will identify your vessel across NauticShield.</div>

        <button
          style={{ ...S.btn, ...(loading || !vesselName.trim() ? S.btnDisabled : {}) }}
          onClick={handleCreate}
          disabled={loading || !vesselName.trim() || hasExistingVessel}
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
