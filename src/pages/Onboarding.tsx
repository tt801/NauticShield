import { useState } from 'react';
import { useOrganizationList } from '@clerk/clerk-react';
import { Anchor, ShieldCheck } from 'lucide-react';

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
  const { createOrganization, setActive } = useOrganizationList();
  const [vesselName, setVesselName] = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);

  async function handleCreate() {
    const name = vesselName.trim();
    if (!name) return;
    setLoading(true);
    setError(null);
    try {
      const org = await createOrganization!({ name });
      await setActive!({ organization: org.id });
      // Page will re-render via OrgGate and route to dashboard
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create vessel. Please try again.');
      setLoading(false);
    }
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
      </div>
    </div>
  );
}
