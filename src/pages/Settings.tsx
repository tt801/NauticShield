import { useState, useEffect } from 'react';
import { useOrganization, useUser, useClerk, UserButton } from '@clerk/clerk-react';
import {
  ShieldCheck,
  Users,
  CreditCard,
  Clock,
  FileText,
  ChevronRight,
  Crown,
  Zap,
  Building2,
  CheckCircle2,
  Lock,
  AlertTriangle,
  Send,
  Bell,
  Mail,
  MessageSquare,
  Cloud,
  Copy,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { fetchJSON } from '@/api/client';
import { AGENT_URL, CLOUD_API_URL, VESSEL_ID } from '@/api/config';

// ── Plan definitions ─────────────────────────────────────────────

type PlanId = 'coastal' | 'superyacht' | 'fleet';

const PLANS = [
  {
    id:    'coastal',
    name:  'Coastal',
    price: 'GBP 200 / mo',
    color: '#6b7f92',
    icon:  ShieldCheck,
    features: [
      'Dashboard & real-time monitoring',
      'Alert management',
      'Device inventory',
      'Secure remote access',
      'Single-vessel deployment',
    ],
    locked: [
      'Fleet-wide oversight',
      'Dedicated account support',
    ],
  },
  {
    id:    'superyacht',
    name:  'Superyacht',
    price: 'GBP 800 / mo',
    color: '#0ea5e9',
    icon:  Zap,
    recommended: true,
    features: [
      'Everything in Coastal',
      'Enhanced monitoring & workflows',
      'Priority support',
      'Larger operational teams',
    ],
    locked: [
      'Fleet commercial terms',
      'Custom deployment design',
    ],
  },
  {
    id:    'fleet',
    name:  'Fleet',
    price: 'Custom',
    color: '#d4a847',
    icon:  Crown,
    features: [
      'Multi-vessel fleet oversight',
      'Commercial invoicing and procurement support',
      'Custom onboarding and operating model',
      'Dedicated success team',
    ],
    locked: [],
  },
] as const;

const LEGACY_PLAN_MAP: Record<string, PlanId> = {
  starter: 'coastal',
  basic: 'coastal',
  coastal: 'coastal',
  pro: 'superyacht',
  superyacht: 'superyacht',
  enterprise: 'fleet',
  fleet: 'fleet',
};

const NOTIFICATION_CATEGORIES: { key: string; label: string; desc: string }[] = [
  { key: 'new_device', label: 'New Device Detected', desc: 'Unknown device joins the network' },
  { key: 'port_scan', label: 'Port Scan Detected', desc: 'Active port scanning detected' },
  { key: 'internet_down', label: 'Internet Connectivity', desc: 'Internet connection lost or restored' },
  { key: 'cyber_critical', label: 'Cyber Critical', desc: 'High-severity vulnerability or threat' },
  { key: 'device_spike', label: 'Device Spike', desc: 'Unusual surge in connected devices' },
];

// ── Helpers ──────────────────────────────────────────────────────

function normalizePlanId(plan?: string | null): PlanId {
  return LEGACY_PLAN_MAP[plan ?? ''] ?? 'coastal';
}

function formatDate(value?: string | null) {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleDateString('en-GB');
}

function formatPaymentMethod(paymentMethod?: {
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
} | null) {
  if (!paymentMethod?.brand || !paymentMethod.last4) {
    return 'No saved payment method';
  }

  const brand = paymentMethod.brand.charAt(0).toUpperCase() + paymentMethod.brand.slice(1);
  const expiry = paymentMethod.expMonth && paymentMethod.expYear
    ? ` · expires ${String(paymentMethod.expMonth).padStart(2, '0')}/${String(paymentMethod.expYear).slice(-2)}`
    : '';

  return `${brand} ending ${paymentMethod.last4}${expiry}`;
}

function getPlanActionLabel(planId: PlanId) {
  return planId === 'fleet' ? 'Contact Sales' : 'Choose Plan';
}

function getSubscriptionStatusLabel(status?: string | null, cancelAtPeriodEnd?: boolean) {
  if (cancelAtPeriodEnd) return 'Cancels at period end';
  if (!status) return 'Not started';

  const label = status.replace(/_/g, ' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: '#0d1421', border: '1px solid #1a2535', borderRadius: 14, padding: 24, ...style }}>
      {children}
    </div>
  );
}

function SectionTitle({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 20 }}>
      <Icon size={16} color="#d4a847" />
      <span style={{ color: '#f0f4f8', fontSize: 15, fontWeight: 700 }}>{label}</span>
    </div>
  );
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner', captain: 'Captain', it_tech: 'IT Tech', crew: 'Crew',
};
const ROLE_COLORS: Record<string, string> = {
  owner: '#d4a847', captain: '#0ea5e9', it_tech: '#8b5cf6', crew: '#6b7f92',
};

// ── Page ─────────────────────────────────────────────────────────

export default function Settings() {
  const auth                          = useAuth();
  const { user }                      = useUser();
  const { organization, memberships, invitations } = useOrganization({ memberships: true, invitations: true });
  const { signOut, openUserProfile }  = useClerk();

  const [activeTab, setActiveTab]     = useState<'account' | 'users' | 'subscription' | 'security' | 'notifications' | 'cloud'>('account');
  type AccountInfo = {
    profile: { fullName: string | null; email: string | null };
    billing: {
      customerId: string | null;
      name: string | null;
      email: string | null;
      phone: string | null;
      taxExempt: string | null;
      address: {
        line1: string | null;
        line2: string | null;
        city: string | null;
        state: string | null;
        postalCode: string | null;
        country: string | null;
      } | null;
    } | null;
    subscription: {
      plan: string | null;
      status: string | null;
      currentPeriodEnd: string | null;
      trialEnd: string | null;
      cancelAtPeriodEnd: boolean;
      paymentMethod: {
        brand: string | null;
        last4: string | null;
        expMonth: number | null;
        expYear: number | null;
      } | null;
      customerPortalAvailable: boolean;
    };
  };
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [accountLoading, setAccountLoading] = useState(Boolean(CLOUD_API_URL));

  // ── Notification prefs ────────────────────────────────────────
  type CategoryPref = { email: boolean; sms: boolean };
  type NotifPrefs = { emailTo: string; phoneTo: string; categories: Record<string, CategoryPref> };
  const [notifPrefs, setNotifPrefs]   = useState<NotifPrefs | null>(null);
  const [notifLoading, setNotifLoading] = useState(true);
  const [notifLoadError, setNotifLoadError] = useState<string | null>(null);
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifMsg,    setNotifMsg]    = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // ── Vessel quota ─────────────────────────────────────────────────
  type VesselQuota = { plan: string; currentVessels: number; maxVessels: number };
  const [vesselQuota, setVesselQuota] = useState<VesselQuota | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(true);
  const [quotaError, setQuotaError] = useState<string | null>(null);

  // ── Subscription cancellation ───────────────────────────────────
  const [cancelingSub, setCancelingSub] = useState(false);
  const [billingMsg, setBillingMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [portalLoading, setPortalLoading] = useState<'invoices' | 'payment' | null>(null);
  const [planActionLoading, setPlanActionLoading] = useState<PlanId | null>(null);

  type AuditEntry = {
    actor?: string;
    action?: string;
    resource?: string | null;
    created_at?: string;
    timestamp?: string;
  };
  const [auditEntries, setAuditEntries] = useState<AuditEntry[] | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  async function loadNotifPrefs() {
    setNotifLoading(true);
    setNotifLoadError(null);
    try {
      const prefs = await fetchJSON<NotifPrefs>(`${AGENT_URL}/api/notifications`);
      setNotifPrefs(prefs);
    } catch (error) {
      setNotifPrefs(null);
      setNotifLoadError(error instanceof Error ? error.message : 'Unable to reach the vessel agent');
    } finally {
      setNotifLoading(false);
    }
  }

  async function loadVesselQuota() {
    setQuotaLoading(true);
    setQuotaError(null);
    try {
      const quota = await fetchJSON<VesselQuota>(`${AGENT_URL}/api/vessels/quota`);
      setVesselQuota(quota);
    } catch (error) {
      setVesselQuota(null);
      setQuotaError(error instanceof Error ? error.message : 'Unable to load vessel quota');
    } finally {
      setQuotaLoading(false);
    }
  }

  async function loadAuditEntries() {
    setAuditLoading(true);
    setAuditError(null);
    try {
      const entries = await fetchJSON<AuditEntry[]>(`${AGENT_URL}/api/audit`);
      setAuditEntries(entries);
    } catch (error) {
      setAuditEntries(null);
      setAuditError(error instanceof Error ? error.message : 'Unable to load audit log');
    } finally {
      setAuditLoading(false);
    }
  }

  useEffect(() => {
    void loadNotifPrefs();
    void loadVesselQuota();
  }, []);

  useEffect(() => {
    if (!CLOUD_API_URL) {
      setAccountLoading(false);
      return;
    }

    setAccountLoading(true);
    fetchJSON<AccountInfo>(`${CLOUD_API_URL}/api/account`)
      .then(setAccountInfo)
      .catch(() => setAccountInfo(null))
      .finally(() => setAccountLoading(false));
  }, []);

  const currentPlanId = normalizePlanId(accountInfo?.subscription.plan ?? vesselQuota?.plan);
  const currentPlan = PLANS.find(plan => plan.id === currentPlanId) ?? PLANS[0];
  const subscriptionInfo = accountInfo?.subscription ?? null;
  const renewalDate = formatDate(subscriptionInfo?.trialEnd ?? subscriptionInfo?.currentPeriodEnd);
  const subscriptionStatus = getSubscriptionStatusLabel(subscriptionInfo?.status, subscriptionInfo?.cancelAtPeriodEnd);

  async function handleOpenBillingPortal(target: 'invoices' | 'payment') {
    if (!CLOUD_API_URL) {
      setBillingMsg({ type: 'err', text: 'Cloud billing API is not configured.' });
      return;
    }

    setPortalLoading(target);
    setBillingMsg(null);
    try {
      const result = await fetchJSON<{ url: string }>(`${CLOUD_API_URL}/api/stripe/portal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnUrl: window.location.href }),
      });
      window.location.assign(result.url);
    } catch (error) {
      setBillingMsg({ type: 'err', text: error instanceof Error ? error.message : 'Unable to open billing portal' });
    } finally {
      setPortalLoading(null);
    }
  }

  async function handlePlanChange(planId: PlanId) {
    if (planId === 'fleet') {
      window.open('https://www.nauticshield.io/#contact', '_blank', 'noopener,noreferrer');
      return;
    }

    if (!CLOUD_API_URL) {
      setBillingMsg({ type: 'err', text: 'Cloud billing API is not configured.' });
      return;
    }

    setPlanActionLoading(planId);
    setBillingMsg(null);
    try {
      const result = await fetchJSON<{ url: string }>(`${CLOUD_API_URL}/api/stripe/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: planId,
          successUrl: `${window.location.origin}/settings?billing=success`,
          cancelUrl: `${window.location.origin}/settings?billing=canceled`,
        }),
      });
      window.location.assign(result.url);
    } catch (error) {
      setBillingMsg({ type: 'err', text: error instanceof Error ? error.message : 'Unable to start checkout' });
    } finally {
      setPlanActionLoading(null);
    }
  }

  async function handleCancelSubscription() {
    if (!CLOUD_API_URL) {
      setBillingMsg({ type: 'err', text: 'Cloud billing API is not configured.' });
      return;
    }

    setCancelingSub(true);
    setBillingMsg(null);
    try {
      const result = await fetchJSON<{ ok: boolean; message: string; currentPeriodEnd?: string | null; trialEnd?: string | null }>(
        `${CLOUD_API_URL}/api/stripe/cancel`,
        { method: 'POST' },
      );
      const endDate = result.trialEnd ?? result.currentPeriodEnd;
      const suffix = endDate ? ` Access remains until ${new Date(endDate).toLocaleDateString('en-GB')}.` : '';
      setBillingMsg({ type: 'ok', text: `${result.message}${suffix}` });
      setShowCancelConfirm(false);
    } catch (e: unknown) {
      setBillingMsg({ type: 'err', text: e instanceof Error ? e.message : 'Failed to cancel subscription' });
    } finally {
      setCancelingSub(false);
    }
  }
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole]   = useState('org:member');
  const [inviting, setInviting]       = useState(false);
  const [inviteMsg, setInviteMsg]     = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  async function handleInvite() {
    const email = inviteEmail.trim();
    if (!email || !organization) return;
    setInviting(true);
    setInviteMsg(null);
    try {
      await organization.inviteMember({ emailAddress: email, role: inviteRole });
      setInviteMsg({ type: 'ok', text: `Invite sent to ${email}` });
      setInviteEmail('');
    } catch (e: unknown) {
      setInviteMsg({ type: 'err', text: e instanceof Error ? e.message : 'Failed to send invite' });
    } finally {
      setInviting(false);
    }
  }

  // ── Cloud Sync ────────────────────────────────────────────────────
  const [cloudVesselId,    setCloudVesselId]    = useState(VESSEL_ID);
  const [cloudName,        setCloudName]        = useState('');
  const [cloudApiKey,      setCloudApiKey]      = useState('');
  const [cloudRegistering, setCloudRegistering] = useState(false);
  const [cloudMsg,         setCloudMsg]         = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [cloudVessels,     setCloudVessels]     = useState<Array<{ id: string; name: string; last_synced_at: string | null }> | null>(null);
  const [cloudCopied,      setCloudCopied]      = useState(false);

  useEffect(() => {
    if (activeTab !== 'cloud' || !CLOUD_API_URL) return;
    fetchJSON<Array<{ id: string; name: string; last_synced_at: string | null }>>(`${CLOUD_API_URL}/api/vessels`)
      .then(setCloudVessels)
      .catch(() => setCloudVessels([]));
  }, [activeTab]);

  async function handleRegisterVessel() {
    if (!cloudVesselId.trim() || !CLOUD_API_URL) return;
    setCloudRegistering(true);
    setCloudMsg(null);
    setCloudApiKey('');
    try {
      const result = await fetchJSON<{ vesselId: string; apiKey: string }>(
        `${CLOUD_API_URL}/api/vessels`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vesselId: cloudVesselId.trim(), name: cloudName.trim() || cloudVesselId.trim() }) },
      );
      setCloudApiKey(result.apiKey);
      setCloudMsg({ type: 'ok', text: 'Vessel registered! Copy the API key below to your mini PC .env.' });
      // refresh list
      fetchJSON<Array<{ id: string; name: string; last_synced_at: string | null }>>(`${CLOUD_API_URL}/api/vessels`)
        .then(setCloudVessels).catch(() => {});
    } catch (e: unknown) {
      setCloudMsg({ type: 'err', text: e instanceof Error ? e.message : 'Registration failed' });
    } finally {
      setCloudRegistering(false);
    }
  }

  function copyApiKey() {
    if (!cloudApiKey) return;
    navigator.clipboard.writeText(cloudApiKey);
    setCloudCopied(true);
    setTimeout(() => setCloudCopied(false), 2000);
  }

  const tabs: { id: typeof activeTab; label: string; icon: React.ElementType; require?: boolean }[] = [
    { id: 'account',       label: 'Account',       icon: ShieldCheck },
    { id: 'users',         label: 'Users & Roles',  icon: Users,      require: auth.can('settings:manage_users') },
    { id: 'subscription',  label: 'Subscription',   icon: CreditCard, require: auth.can('settings:manage_billing') },
    { id: 'security',      label: 'Security',       icon: Lock },
    { id: 'notifications', label: 'Notifications',  icon: Bell },
    { id: 'cloud',         label: 'Cloud Sync',     icon: Cloud },
  ];

  return (
    <div style={{ padding: 28, maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div>
        <div style={{ color: '#f0f4f8', fontSize: 20, fontWeight: 800, letterSpacing: 0.2 }}>Settings</div>
        <div style={{ color: '#6b7f92', fontSize: 13, marginTop: 4 }}>
          {organization?.name ?? 'Vessel'} · {ROLE_LABELS[auth.role] ?? auth.role}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid #1a2535', paddingBottom: 0 }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '10px 16px', borderRadius: '10px 10px 0 0',
              border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: activeTab === tab.id ? '#0d1421' : 'transparent',
              color:      activeTab === tab.id ? '#f0f4f8'  : '#4a5a6a',
              borderBottom: activeTab === tab.id ? '2px solid #d4a847' : '2px solid transparent',
            }}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Account tab ─────────────────────────────────────────── */}
      {activeTab === 'account' && (
        <>
          <Card>
            <SectionTitle icon={ShieldCheck} label="Your Profile" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              <UserButton
                appearance={{
                  elements: { avatarBox: { width: 52, height: 52 } },
                }}
              />
              <div>
                <div style={{ color: '#f0f4f8', fontSize: 15, fontWeight: 700 }}>
                  {user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? 'Unknown'}
                </div>
                <div style={{ color: '#6b7f92', fontSize: 12, marginTop: 3 }}>
                  {user?.primaryEmailAddress?.emailAddress}
                </div>
                <div style={{ marginTop: 6 }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    background: (ROLE_COLORS[auth.role] ?? '#6b7f92') + '15',
                    color:       ROLE_COLORS[auth.role] ?? '#6b7f92',
                    border:     `1px solid ${(ROLE_COLORS[auth.role] ?? '#6b7f92')}33`,
                    borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700,
                  }}>
                    {ROLE_LABELS[auth.role] ?? auth.role}
                  </span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => openUserProfile({ __experimental_startPath: '/security' })}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  background: 'rgba(212,168,71,0.1)', color: '#d4a847',
                  border: '1px solid rgba(212,168,71,0.3)', borderRadius: 9,
                  padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                <ExternalLink size={13} /> Manage Profile & MFA
              </button>
              <button
                onClick={() => signOut()}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  background: 'rgba(239,68,68,0.08)', color: '#ef4444',
                  border: '1px solid rgba(239,68,68,0.2)', borderRadius: 9,
                  padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Sign Out
              </button>
            </div>
          </Card>

          <Card>
            <SectionTitle icon={Building2} label="Vessel / Organisation" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: 'rgba(212,168,71,0.1)', border: '1px solid rgba(212,168,71,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Building2 size={20} color="#d4a847" />
              </div>
              <div>
                <div style={{ color: '#f0f4f8', fontSize: 14, fontWeight: 700 }}>
                  {organization?.name ?? '—'}
                </div>
                <div style={{ color: '#6b7f92', fontSize: 12, marginTop: 2 }}>
                  {memberships?.count ?? 0} member{(memberships?.count ?? 0) !== 1 ? 's' : ''}
                </div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{
                  background: currentPlan.color + '18', color: currentPlan.color,
                  border: `1px solid ${currentPlan.color}33`,
                  borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700,
                }}>
                  {currentPlan.name} Plan
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <SectionTitle icon={CreditCard} label="Account Information" />
            {accountLoading ? (
              <div style={{ color: '#6b7f92', fontSize: 13 }}>Loading account information…</div>
            ) : accountInfo?.billing ? (
              <div style={{ display: 'grid', gap: 12 }}>
                {[
                  { label: 'Billing name', value: accountInfo.billing.name ?? '—' },
                  { label: 'Billing email', value: accountInfo.billing.email ?? '—' },
                  { label: 'Billing phone', value: accountInfo.billing.phone ?? '—' },
                  { label: 'Stripe customer', value: accountInfo.billing.customerId ?? '—' },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #1a2535' }}>
                    <span style={{ color: '#6b7f92', fontSize: 13 }}>{row.label}</span>
                    <span style={{ color: '#f0f4f8', fontSize: 13, fontWeight: 600, textAlign: 'right' }}>{row.value}</span>
                  </div>
                ))}
                <div style={{ paddingTop: 4 }}>
                  <div style={{ color: '#6b7f92', fontSize: 13, marginBottom: 6 }}>Billing address</div>
                  <div style={{ color: '#f0f4f8', fontSize: 13, lineHeight: 1.7 }}>
                    {[
                      accountInfo.billing.address?.line1,
                      accountInfo.billing.address?.line2,
                      [accountInfo.billing.address?.city, accountInfo.billing.address?.state, accountInfo.billing.address?.postalCode].filter(Boolean).join(', '),
                      accountInfo.billing.address?.country,
                    ].filter(Boolean).join('\n') || 'No billing address captured yet.'}
                  </div>
                </div>
                <div style={{ color: '#6b7f92', fontSize: 12, lineHeight: 1.6 }}>
                  Billing details are captured in Stripe Checkout and managed through the customer portal.
                </div>
              </div>
            ) : (
              <div style={{ color: '#6b7f92', fontSize: 13, lineHeight: 1.7 }}>
                Billing information will appear here after the first successful Stripe checkout.
              </div>
            )}
          </Card>
        </>
      )}

      {/* ── Users tab ────────────────────────────────────────────── */}
      {activeTab === 'users' && (
        <Card>
          <SectionTitle icon={Users} label="Team Members" />
          {!auth.can('settings:manage_users') ? (
            <div style={{ color: '#4a5a6a', fontSize: 13 }}>Only the vessel owner can manage users.</div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {(memberships?.data ?? []).map(m => {
                  const roleKey = m.role.replace('org:', '');
                  const roleColor = ROLE_COLORS[roleKey] ?? '#6b7f92';
                  return (
                    <div key={m.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      background: '#0a0f18', border: '1px solid #1a2535', borderRadius: 10, padding: '12px 16px',
                    }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: '#1a2535', border: '1px solid #2a3a50',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#6b7f92', fontSize: 14, fontWeight: 700,
                      }}>
                        {(m.publicUserData?.firstName?.[0] ?? m.publicUserData?.identifier?.[0] ?? '?').toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: '#f0f4f8', fontSize: 13, fontWeight: 600 }}>
                          {m.publicUserData?.firstName
                            ? `${m.publicUserData.firstName} ${m.publicUserData.lastName ?? ''}`.trim()
                            : m.publicUserData?.identifier ?? 'Unknown'}
                        </div>
                        <div style={{ color: '#4a5a6a', fontSize: 11, marginTop: 2 }}>
                          {m.publicUserData?.identifier}
                        </div>
                      </div>
                      <span style={{
                        background: roleColor + '15', color: roleColor,
                        border: `1px solid ${roleColor}33`,
                        borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700,
                      }}>
                        {ROLE_LABELS[roleKey] ?? roleKey}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div style={{ borderTop: '1px solid #1a2535', paddingTop: 20, marginTop: 4 }}>
                <SectionTitle icon={Send} label="Invite a crew member" />

                {inviteMsg && (
                  <div style={{
                    background: inviteMsg.type === 'ok' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                    border: `1px solid ${inviteMsg.type === 'ok' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                    borderRadius: 8, padding: '8px 14px',
                    color: inviteMsg.type === 'ok' ? '#4ade80' : '#f87171',
                    fontSize: 12, marginBottom: 14,
                  }}>{inviteMsg.text}</div>
                )}

                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input
                    type="email"
                    placeholder="crew@vessel.com"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !inviting && handleInvite()}
                    disabled={inviting}
                    style={{
                      flex: 1, background: '#0a0f18', border: '1px solid #1a2535',
                      borderRadius: 8, padding: '10px 12px', color: '#f0f4f8',
                      fontSize: 13, outline: 'none',
                    }}
                  />
                  <select
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value)}
                    disabled={inviting}
                    style={{
                      background: '#0a0f18', border: '1px solid #1a2535',
                      borderRadius: 8, padding: '10px 12px', color: '#f0f4f8',
                      fontSize: 13, outline: 'none', cursor: 'pointer',
                    }}
                  >
                    <option value="org:admin">Owner</option>
                    <option value="org:captain">Captain</option>
                    <option value="org:it_tech">IT Tech</option>
                    <option value="org:member">Crew</option>
                  </select>
                  <button
                    onClick={handleInvite}
                    disabled={inviting || !inviteEmail.trim()}
                    style={{
                      background: inviting || !inviteEmail.trim() ? '#1a2535' : '#d4a847',
                      border: 'none', borderRadius: 8, padding: '10px 16px',
                      color: inviting || !inviteEmail.trim() ? '#4a5a6a' : '#080b10',
                      fontSize: 13, fontWeight: 700, cursor: inviting || !inviteEmail.trim() ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap' as const,
                    }}
                  >
                    {inviting ? 'Sending…' : 'Send invite'}
                  </button>
                </div>

                {/* Pending invitations */}
                {(invitations?.data?.length ?? 0) > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ color: '#4a5a6a', fontSize: 11, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Pending invitations
                    </div>
                    {(invitations?.data ?? []).map(inv => (
                      <div key={inv.id} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        background: '#0a0f18', border: '1px solid #1a2535',
                        borderRadius: 8, padding: '10px 14px', marginBottom: 6,
                      }}>
                        <div style={{ flex: 1, color: '#8a9ab0', fontSize: 12 }}>{inv.emailAddress}</div>
                        <span style={{
                          background: '#1a2535', color: '#4a5a6a',
                          borderRadius: 20, padding: '2px 10px', fontSize: 11,
                        }}>
                          {ROLE_LABELS[inv.role.replace('org:', '')] ?? inv.role} · pending
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </Card>
      )}

      {/* ── Subscription tab ─────────────────────────────────────── */}
      {activeTab === 'subscription' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {PLANS.map(plan => {
              const PlanIcon  = plan.icon;
              const isCurrent = plan.id === currentPlanId;
              return (
                <div key={plan.id} style={{
                  background: '#0d1421',
                  border: `1px solid ${isCurrent ? plan.color + '55' : '#1a2535'}`,
                  borderRadius: 14, padding: 20,
                  position: 'relative',
                  boxShadow: isCurrent ? `0 0 24px ${plan.color}18` : undefined,
                }}>
                  {'recommended' in plan && plan.recommended && !isCurrent && (
                    <div style={{
                      position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                      background: '#0ea5e9', color: '#fff', borderRadius: 20,
                      padding: '2px 12px', fontSize: 10, fontWeight: 700,
                    }}>
                      POPULAR
                    </div>
                  )}
                  {isCurrent && (
                    <div style={{
                      position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                      background: plan.color, color: '#080b10', borderRadius: 20,
                      padding: '2px 12px', fontSize: 10, fontWeight: 700,
                    }}>
                      CURRENT PLAN
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{ background: plan.color + '18', borderRadius: 8, padding: 8 }}>
                      <PlanIcon size={18} color={plan.color} />
                    </div>
                    <div>
                      <div style={{ color: '#f0f4f8', fontSize: 15, fontWeight: 800 }}>{plan.name}</div>
                      <div style={{ color: plan.color, fontSize: 12, fontWeight: 700, marginTop: 1 }}>{plan.price}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                    {plan.features.map(f => (
                      <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                        <CheckCircle2 size={12} color="#22c55e" style={{ marginTop: 2, flexShrink: 0 }} />
                        <span style={{ color: '#8899aa', fontSize: 12 }}>{f}</span>
                      </div>
                    ))}
                    {plan.locked.map(f => (
                      <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, opacity: 0.4 }}>
                        <Lock size={12} color="#4a5a6a" style={{ marginTop: 2, flexShrink: 0 }} />
                        <span style={{ color: '#4a5a6a', fontSize: 12 }}>{f}</span>
                      </div>
                    ))}
                  </div>

                  {!isCurrent && (
                    <button
                      onClick={() => handlePlanChange(plan.id)}
                      disabled={planActionLoading === plan.id}
                      style={{
                      width: '100%', padding: '9px 0', borderRadius: 8, fontWeight: 700,
                      fontSize: 12, cursor: 'pointer', border: `1px solid ${plan.color}44`,
                      background: plan.color + '12', color: plan.color,
                      opacity: planActionLoading === plan.id ? 0.7 : 1,
                    }}
                    >
                      {planActionLoading === plan.id ? 'Opening…' : getPlanActionLabel(plan.id)}
                    </button>
                  )}
                  {isCurrent && (
                    <div style={{
                      width: '100%', padding: '9px 0', borderRadius: 8, fontWeight: 700,
                      fontSize: 12, textAlign: 'center',
                      background: plan.color + '18', color: plan.color,
                    }}>
                      ✓ Active Plan
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <Card>
            <SectionTitle icon={Building2} label="Vessel Quota" />
            {vesselQuota ? (() => {
              const { currentVessels, maxVessels, plan } = vesselQuota;
              const normalizedPlan = normalizePlanId(plan);
              const planLabel = PLANS.find(item => item.id === normalizedPlan)?.name ?? plan;
              const atLimit = currentVessels >= maxVessels;
              const pct     = Math.min(100, Math.round((currentVessels / maxVessels) * 100));
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ color: '#8899aa', fontSize: 13 }}>
                      Vessels used
                    </span>
                    <span style={{ color: '#f0f4f8', fontSize: 13, fontWeight: 700 }}>
                      {currentVessels} / {maxVessels === 999 ? '∞' : maxVessels}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div style={{ height: 6, background: '#1a2535', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 3,
                      width: `${maxVessels === 999 ? 10 : pct}%`,
                      background: atLimit ? '#ef4444' : '#d4a847',
                      transition: 'width 0.4s',
                    }} />
                  </div>
                  {atLimit && normalizedPlan !== 'fleet' && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: 'rgba(212,168,71,0.08)', border: '1px solid rgba(212,168,71,0.25)',
                      borderRadius: 10, padding: '12px 16px',
                    }}>
                      <AlertTriangle size={14} color="#d4a847" style={{ flexShrink: 0 }} />
                      <div style={{ fontSize: 12, color: '#8899aa', lineHeight: 1.6 }}>
                        You've reached the <strong style={{ color: '#d4a847' }}>{planLabel}</strong> plan vessel limit.
                        Upgrade to add more vessels to your account.
                      </div>
                    </div>
                  )}
                </div>
              );
            })() : (
              <div style={{ color: '#4a5a6a', fontSize: 13 }}>
                {quotaLoading ? 'Loading…' : quotaError ?? 'Vessel quota unavailable'}
              </div>
            )}
          </Card>

          <Card>
            <SectionTitle icon={CreditCard} label="Billing" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Current plan',    value: `${currentPlan.name} — ${currentPlan.price}` },
                { label: 'Subscription status', value: subscriptionStatus },
                { label: 'Next renewal',    value: renewalDate },
                { label: 'Payment method', value: formatPaymentMethod(subscriptionInfo?.paymentMethod) },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #1a2535' }}>
                  <span style={{ color: '#6b7f92', fontSize: 13 }}>{row.label}</span>
                  <span style={{ color: '#f0f4f8', fontSize: 13, fontWeight: 600 }}>{row.value}</span>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  onClick={() => handleOpenBillingPortal('invoices')}
                  disabled={portalLoading !== null || !subscriptionInfo?.customerPortalAvailable}
                  style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'rgba(212,168,71,0.1)', color: '#d4a847',
                  border: '1px solid rgba(212,168,71,0.3)', borderRadius: 9,
                  padding: '8px 16px', fontSize: 13, fontWeight: 600,
                  cursor: portalLoading !== null || !subscriptionInfo?.customerPortalAvailable ? 'not-allowed' : 'pointer',
                  opacity: portalLoading === 'payment' || !subscriptionInfo?.customerPortalAvailable ? 0.65 : 1,
                }}
                >
                  <FileText size={13} /> {portalLoading === 'invoices' ? 'Opening…' : 'View Invoices'}
                </button>
                <button
                  onClick={() => handleOpenBillingPortal('payment')}
                  disabled={portalLoading !== null || !subscriptionInfo?.customerPortalAvailable}
                  style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: '#0a0f18', color: '#8899aa',
                  border: '1px solid #1a2535', borderRadius: 9,
                  padding: '8px 16px', fontSize: 13, fontWeight: 600,
                  cursor: portalLoading !== null || !subscriptionInfo?.customerPortalAvailable ? 'not-allowed' : 'pointer',
                  opacity: portalLoading === 'invoices' || !subscriptionInfo?.customerPortalAvailable ? 0.65 : 1,
                }}
                >
                  <CreditCard size={13} /> {portalLoading === 'payment' ? 'Opening…' : 'Update Payment'}
                </button>
                <button
                  onClick={() => setShowCancelConfirm(current => !current)}
                  disabled={cancelingSub || !subscriptionInfo?.status || subscriptionInfo.cancelAtPeriodEnd}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: 'rgba(239,68,68,0.08)', color: '#ef4444',
                    border: '1px solid rgba(239,68,68,0.25)', borderRadius: 9,
                    padding: '8px 16px', fontSize: 13, fontWeight: 600,
                    cursor: cancelingSub || !subscriptionInfo?.status || subscriptionInfo.cancelAtPeriodEnd ? 'not-allowed' : 'pointer',
                    opacity: cancelingSub || !subscriptionInfo?.status || subscriptionInfo.cancelAtPeriodEnd ? 0.65 : 1,
                  }}
                >
                  {subscriptionInfo?.cancelAtPeriodEnd ? 'Cancellation Scheduled' : 'Cancel Subscription'}
                </button>
              </div>
              {showCancelConfirm && !subscriptionInfo?.cancelAtPeriodEnd && (
                <div style={{
                  marginTop: 8,
                  padding: '12px 14px',
                  borderRadius: 8,
                  border: '1px solid rgba(239,68,68,0.25)',
                  background: 'rgba(239,68,68,0.06)',
                  color: '#fca5a5',
                  fontSize: 12,
                  lineHeight: 1.6,
                }}>
                  Cancel at period end? Trial cancellations stay free. Paid plans keep access until the current billing period ends.
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button
                      onClick={handleCancelSubscription}
                      disabled={cancelingSub}
                      style={{
                        background: '#ef4444',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 8,
                        padding: '8px 14px',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: cancelingSub ? 'wait' : 'pointer',
                        opacity: cancelingSub ? 0.75 : 1,
                      }}
                    >
                      {cancelingSub ? 'Confirming…' : 'Confirm Cancellation'}
                    </button>
                    <button
                      onClick={() => setShowCancelConfirm(false)}
                      disabled={cancelingSub}
                      style={{
                        background: 'transparent',
                        color: '#8899aa',
                        border: '1px solid #1a2535',
                        borderRadius: 8,
                        padding: '8px 14px',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: cancelingSub ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Keep Subscription
                    </button>
                  </div>
                </div>
              )}
              {billingMsg && (
                <div style={{
                  marginTop: 8,
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: billingMsg.type === 'ok' ? '1px solid rgba(34,197,94,0.35)' : '1px solid rgba(239,68,68,0.35)',
                  background: billingMsg.type === 'ok' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                  color: billingMsg.type === 'ok' ? '#22c55e' : '#f87171',
                  fontSize: 12,
                  lineHeight: 1.5,
                }}>
                  {billingMsg.text}
                </div>
              )}
              <div style={{ color: '#6b7f92', fontSize: 12, lineHeight: 1.7, marginTop: 6 }}>
                Trial cancellation within the first 14 days is free of charge.
                Paid subscriptions can be canceled anytime and remain active until the current 30-day billing period ends.
              </div>
            </div>
          </Card>
        </>
      )}

      {/* ── Security tab ─────────────────────────────────────────── */}
      {activeTab === 'security' && (
        <>
          <Card>
            <SectionTitle icon={Lock} label="Multi-Factor Authentication" />
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <div style={{ color: '#f0f4f8', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  MFA Status
                </div>
                <div style={{ color: '#6b7f92', fontSize: 12, lineHeight: 1.6, maxWidth: 440 }}>
                  Multi-factor authentication protects access to this system.
                  Given the sensitive nature of vessel and passenger data, MFA is strongly recommended for all users.
                </div>
                {user?.twoFactorEnabled ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, color: '#22c55e', fontSize: 12, fontWeight: 700 }}>
                    <CheckCircle2 size={14} /> MFA is enabled on your account
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, color: '#f59e0b', fontSize: 12, fontWeight: 700 }}>
                    <AlertTriangle size={14} /> MFA is not enabled — your account is at risk
                  </div>
                )}
              </div>
              <button
                onClick={() => openUserProfile({ __experimental_startPath: '/security' })}
                style={{
                  flexShrink: 0, display: 'flex', alignItems: 'center', gap: 7,
                  background: 'rgba(212,168,71,0.1)', color: '#d4a847',
                  border: '1px solid rgba(212,168,71,0.3)', borderRadius: 9,
                  padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                {user?.twoFactorEnabled ? 'Manage MFA' : 'Enable MFA'} <ChevronRight size={14} />
              </button>
            </div>
          </Card>

          <Card>
            <SectionTitle icon={Clock} label="Session Policy" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { role: 'Owner',   timeout: '30 minutes' },
                { role: 'Captain', timeout: '30 minutes' },
                { role: 'IT Tech', timeout: '20 minutes' },
                { role: 'Crew',    timeout: '10 minutes' },
              ].map(row => (
                <div key={row.role} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #1a2535' }}>
                  <span style={{ color: '#8899aa', fontSize: 13 }}>{row.role}</span>
                  <span style={{ color: '#f0f4f8', fontSize: 13, fontFamily: 'monospace' }}>
                    Auto-logout after {row.timeout} inactivity
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionTitle icon={FileText} label="Audit Log" />
            <div style={{ color: '#6b7f92', fontSize: 13, marginBottom: 14, lineHeight: 1.6 }}>
              Every API action taken in this system is recorded with user, role, timestamp, and IP address.
              {!auth.can('settings:manage_users') && (
                <span style={{ color: '#4a5a6a' }}> Full audit log access is restricted to Owner and Captain roles.</span>
              )}
            </div>
            {auth.can('settings:manage_users') && (
              <button
                onClick={() => void loadAuditEntries()}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  background: '#0a0f18', color: '#8899aa',
                  border: '1px solid #1a2535', borderRadius: 9,
                  padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                <FileText size={13} /> {auditLoading ? 'Loading Audit Log…' : 'View Recent Audit Log'}
              </button>
            )}
            {auditError && (
              <div style={{ color: '#f87171', fontSize: 12, marginTop: 12 }}>{auditError}</div>
            )}
            {auditEntries?.length ? (
              <div style={{ marginTop: 16, display: 'grid', gap: 8 }}>
                {auditEntries.slice(0, 12).map((entry, index) => (
                  <div
                    key={`${entry.timestamp ?? entry.created_at ?? 'audit'}-${index}`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '140px 1fr auto',
                      gap: 12,
                      background: '#0a0f18',
                      border: '1px solid #1a2535',
                      borderRadius: 10,
                      padding: '10px 12px',
                    }}
                  >
                    <div style={{ color: '#6b7f92', fontSize: 12 }}>{formatDate(entry.timestamp ?? entry.created_at)}</div>
                    <div style={{ color: '#f0f4f8', fontSize: 12, fontWeight: 600 }}>{entry.action ?? 'Unknown action'}</div>
                    <div style={{ color: '#4a5a6a', fontSize: 12 }}>{entry.actor ?? entry.resource ?? 'system'}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </Card>
        </>
      )}

      {/* ─── Notifications ───────────────────────────────────────── */}
      {activeTab === 'notifications' && notifPrefs && (() => {
        function toggleCat(key: string, channel: 'email' | 'sms') {
          setNotifPrefs(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              categories: {
                ...prev.categories,
                [key]: { ...prev.categories[key], [channel]: !prev.categories[key][channel] },
              },
            };
          });
        }

        async function saveNotifPrefs() {
          if (!notifPrefs) return;
          setNotifSaving(true);
          setNotifMsg(null);
          try {
            const updated = await fetchJSON<NotifPrefs>(`${AGENT_URL}/api/notifications`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(notifPrefs),
            });
            setNotifPrefs(updated);
            setNotifMsg({ type: 'ok', text: 'Notification preferences saved.' });
          } catch (error) {
            setNotifMsg({ type: 'err', text: error instanceof Error ? error.message : 'Failed to save preferences.' });
          } finally {
            setNotifSaving(false);
          }
        }

        return (
          <>
            {/* Contact details */}
            <Card>
              <SectionTitle icon={Bell} label="Notification Contacts" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#8899aa', fontSize: 12, fontWeight: 600, marginBottom: 8, letterSpacing: 0.5 }}>
                    <Mail size={13} color="#d4a847" /> Email Address
                  </label>
                  <input
                    type="email"
                    value={notifPrefs.emailTo}
                    onChange={e => setNotifPrefs(p => p ? { ...p, emailTo: e.target.value } : p)}
                    placeholder="alerts@example.com"
                    style={{
                      width: '100%', background: '#0a0f18', border: '1px solid #1a2535',
                      borderRadius: 9, padding: '10px 14px', color: '#f0f4f8', fontSize: 14,
                      outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#8899aa', fontSize: 12, fontWeight: 600, marginBottom: 8, letterSpacing: 0.5 }}>
                    <MessageSquare size={13} color="#d4a847" /> SMS Phone Number
                  </label>
                  <input
                    type="tel"
                    value={notifPrefs.phoneTo}
                    onChange={e => setNotifPrefs(p => p ? { ...p, phoneTo: e.target.value } : p)}
                    placeholder="+1 555 000 0000"
                    style={{
                      width: '100%', background: '#0a0f18', border: '1px solid #1a2535',
                      borderRadius: 9, padding: '10px 14px', color: '#f0f4f8', fontSize: 14,
                      outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ color: '#4a5a6a', fontSize: 11, marginTop: 6 }}>
                    E.164 format recommended, e.g. +447911123456
                  </div>
                </div>
              </div>
            </Card>

            {/* Per-category toggles */}
            <Card>
              <SectionTitle icon={Bell} label="Alert Channels" />
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', color: '#4a5a6a', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, paddingBottom: 12, textTransform: 'uppercase' }}>Alert Type</th>
                      <th style={{ textAlign: 'center', color: '#4a5a6a', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, paddingBottom: 12, textTransform: 'uppercase', width: 80 }}>
                        <Mail size={12} style={{ verticalAlign: 'middle' }} /> Email
                      </th>
                      <th style={{ textAlign: 'center', color: '#4a5a6a', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, paddingBottom: 12, textTransform: 'uppercase', width: 80 }}>
                        <MessageSquare size={12} style={{ verticalAlign: 'middle' }} /> SMS
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {NOTIFICATION_CATEGORIES.map((cat, i) => {
                      const pref = notifPrefs.categories[cat.key] ?? { email: false, sms: false };
                      return (
                        <tr key={cat.key} style={{ borderTop: i > 0 ? '1px solid #1a2535' : undefined }}>
                          <td style={{ padding: '13px 0' }}>
                            <div style={{ color: '#f0f4f8', fontSize: 13, fontWeight: 600 }}>{cat.label}</div>
                            <div style={{ color: '#4a5a6a', fontSize: 11, marginTop: 2 }}>{cat.desc}</div>
                          </td>
                          {(['email', 'sms'] as const).map(ch => (
                            <td key={ch} style={{ textAlign: 'center' }}>
                              <button
                                onClick={() => toggleCat(cat.key, ch)}
                                style={{
                                  width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
                                  background: pref[ch] ? '#d4a847' : '#1a2535',
                                  position: 'relative', transition: 'background 0.2s',
                                }}
                                title={pref[ch] ? 'Enabled' : 'Disabled'}
                              >
                                <span style={{
                                  position: 'absolute', top: 3, left: pref[ch] ? 21 : 3,
                                  width: 16, height: 16, borderRadius: '50%',
                                  background: '#f0f4f8', transition: 'left 0.2s', display: 'block',
                                }} />
                              </button>
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Save */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button
                onClick={saveNotifPrefs}
                disabled={notifSaving}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'linear-gradient(135deg, #d4a847, #b8922f)',
                  color: '#080b10', border: 'none', borderRadius: 10,
                  padding: '11px 22px', fontSize: 13, fontWeight: 700, cursor: notifSaving ? 'not-allowed' : 'pointer',
                  opacity: notifSaving ? 0.7 : 1,
                }}
              >
                <Send size={14} /> {notifSaving ? 'Saving…' : 'Save Preferences'}
              </button>
              {notifMsg && (
                <span style={{ fontSize: 13, color: notifMsg.type === 'ok' ? '#22c55e' : '#ef4444' }}>
                  {notifMsg.text}
                </span>
              )}
            </div>
          </>
        );
      })()}

      {/* show spinner if notifications tab but prefs not yet loaded */}
      {activeTab === 'notifications' && notifLoading && (
        <div style={{ color: '#4a5a6a', fontSize: 13, padding: 40, textAlign: 'center' }}>
          Loading notification preferences…
        </div>
      )}

      {activeTab === 'notifications' && !notifLoading && !notifPrefs && (
        <Card>
          <SectionTitle icon={Bell} label="Notifications Unavailable" />
          <div style={{ color: '#6b7f92', fontSize: 13, lineHeight: 1.7, marginBottom: 14 }}>
            {notifLoadError ?? 'The vessel agent is not reachable, so notification preferences cannot be loaded right now.'}
          </div>
          <button
            onClick={() => void loadNotifPrefs()}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: '#0a0f18', color: '#f0f4f8',
              border: '1px solid #1a2535', borderRadius: 9,
              padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <RefreshCw size={13} /> Retry
          </button>
        </Card>
      )}

      {/* ── Cloud Sync tab ──────────────────────────────────────── */}
      {activeTab === 'cloud' && (
        <>
          {!CLOUD_API_URL && (
            <Card>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <AlertTriangle size={20} color="#d4a847" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ color: '#f0f4f8', fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
                    Cloud API not configured
                  </div>
                  <div style={{ color: '#6b7f92', fontSize: 13, lineHeight: 1.7 }}>
                    Add <code style={{ background: '#1a2535', padding: '1px 6px', borderRadius: 4 }}>VITE_CLOUD_API_URL=https://your-app.vercel.app</code> and{' '}
                    <code style={{ background: '#1a2535', padding: '1px 6px', borderRadius: 4 }}>VITE_VESSEL_ID=MY_VESSEL</code> to your <code style={{ background: '#1a2535', padding: '1px 6px', borderRadius: 4 }}>.env.local</code> then restart the dev server.
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Register vessel */}
          <Card>
            <SectionTitle icon={Cloud} label="Register Vessel with Cloud" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ color: '#6b7f92', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                    Vessel ID (matches VITE_VESSEL_ID on mini PC)
                  </label>
                  <input
                    value={cloudVesselId}
                    onChange={e => setCloudVesselId(e.target.value)}
                    placeholder="e.g. MY_AURORA"
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      background: '#111827', border: '1px solid #1a2535', borderRadius: 8,
                      color: '#f0f4f8', padding: '10px 12px', fontSize: 13,
                    }}
                  />
                </div>
                <div>
                  <label style={{ color: '#6b7f92', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                    Display Name (optional)
                  </label>
                  <input
                    value={cloudName}
                    onChange={e => setCloudName(e.target.value)}
                    placeholder="e.g. M/Y Aurora"
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      background: '#111827', border: '1px solid #1a2535', borderRadius: 8,
                      color: '#f0f4f8', padding: '10px 12px', fontSize: 13,
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <button
                  onClick={handleRegisterVessel}
                  disabled={!cloudVesselId.trim() || !CLOUD_API_URL || cloudRegistering}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: 'linear-gradient(135deg, #d4a847, #b8922f)',
                    color: '#080b10', border: 'none', borderRadius: 10,
                    padding: '11px 22px', fontSize: 13, fontWeight: 700,
                    cursor: (!cloudVesselId.trim() || !CLOUD_API_URL || cloudRegistering) ? 'not-allowed' : 'pointer',
                    opacity: (!cloudVesselId.trim() || !CLOUD_API_URL || cloudRegistering) ? 0.6 : 1,
                  }}
                >
                  <RefreshCw size={14} /> {cloudRegistering ? 'Registering…' : 'Register / Re-register Vessel'}
                </button>
                {cloudMsg && (
                  <span style={{ fontSize: 13, color: cloudMsg.type === 'ok' ? '#22c55e' : '#ef4444' }}>
                    {cloudMsg.text}
                  </span>
                )}
              </div>

              {cloudApiKey && (
                <div style={{ background: '#050912', border: '1px solid #22c55e33', borderRadius: 10, padding: 16 }}>
                  <div style={{ color: '#22c55e', fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
                    API key — copy this now, it will not be shown again
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <code style={{
                      flex: 1, fontFamily: 'monospace', fontSize: 13, color: '#f0f4f8',
                      background: '#0d1421', padding: '10px 14px', borderRadius: 8,
                      wordBreak: 'break-all',
                    }}>
                      {cloudApiKey}
                    </code>
                    <button
                      onClick={copyApiKey}
                      style={{
                        flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
                        background: cloudCopied ? '#22c55e22' : '#1a2535',
                        color: cloudCopied ? '#22c55e' : '#f0f4f8',
                        border: 'none', borderRadius: 8, padding: '10px 14px',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      <Copy size={13} /> {cloudCopied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div style={{ color: '#4a5a6a', fontSize: 12, marginTop: 10, lineHeight: 1.7 }}>
                    On your mini PC, add to <code style={{ background: '#1a2535', padding: '1px 5px', borderRadius: 3 }}>agent/.env</code>:
                    <br />
                    <code style={{ color: '#d4a847' }}>CLOUD_API_KEY={cloudApiKey}</code>
                    <br />
                    <code style={{ color: '#d4a847' }}>CLOUD_SYNC_URL={CLOUD_API_URL}</code>
                    <br />
                    Then run <code style={{ background: '#1a2535', padding: '1px 5px', borderRadius: 3 }}>docker compose up -d</code> to apply.
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Registered vessels */}
          <Card>
            <SectionTitle icon={Cloud} label="Registered Vessels" />
            {cloudVessels === null && CLOUD_API_URL ? (
              <div style={{ color: '#4a5a6a', fontSize: 13 }}>Loading…</div>
            ) : !cloudVessels?.length ? (
              <div style={{ color: '#4a5a6a', fontSize: 13 }}>No vessels registered yet.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {(['Vessel ID', 'Name', 'Last Synced'] as const).map(h => (
                      <th key={h} style={{ textAlign: 'left', color: '#4a5a6a', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, paddingBottom: 12, textTransform: 'uppercase' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cloudVessels.map((v, i) => (
                    <tr key={v.id} style={{ borderTop: i > 0 ? '1px solid #1a2535' : undefined }}>
                      <td style={{ padding: '12px 0' }}>
                        <code style={{ color: '#d4a847', fontSize: 13 }}>{v.id}</code>
                      </td>
                      <td style={{ padding: '12px 0', color: '#f0f4f8', fontSize: 13 }}>{v.name}</td>
                      <td style={{ padding: '12px 0', color: '#6b7f92', fontSize: 12 }}>
                        {v.last_synced_at
                          ? new Date(v.last_synced_at).toLocaleString()
                          : <span style={{ color: '#4a5a6a' }}>Never</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
