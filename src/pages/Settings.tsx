import { useState } from 'react';
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
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

// ── Plan definitions ─────────────────────────────────────────────

const PLANS = [
  {
    id:    'basic',
    name:  'Basic',
    price: '€149 / mo',
    color: '#6b7f92',
    icon:  ShieldCheck,
    features: [
      'Dashboard & real-time monitoring',
      'Alert management',
      'Device inventory',
      'Network zones',
      'Up to 3 users',
    ],
    locked: [
      'Guest Network management',
      'Voyage log',
      'Cyber CVE database',
      'Reports & PDF export',
      'Multi-vessel support',
    ],
  },
  {
    id:    'pro',
    name:  'Pro',
    price: '€349 / mo',
    color: '#0ea5e9',
    icon:  Zap,
    recommended: true,
    features: [
      'Everything in Basic',
      'Guest Network management',
      'Voyage log & history',
      'Reports & PDF export',
      'Up to 10 users',
    ],
    locked: [
      'Cyber CVE database & assessments',
      'Multi-vessel support',
      'Dedicated support SLA',
    ],
  },
  {
    id:    'enterprise',
    name:  'Enterprise',
    price: '€799 / mo',
    color: '#d4a847',
    icon:  Crown,
    features: [
      'Everything in Pro',
      'Cyber CVE database & assessments',
      'BIMCO / IMO compliance reports',
      'Multi-vessel fleet management',
      'Unlimited users',
      'Dedicated 24/7 support',
      'Custom SLA & on-site training',
    ],
    locked: [],
  },
] as const;

// Mocked current plan — in production this comes from your billing API
const CURRENT_PLAN_ID = 'enterprise';

// ── Helpers ──────────────────────────────────────────────────────

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
  const auth                         = useAuth();
  const { user }                     = useUser();
  const { organization, memberships } = useOrganization({ memberships: true });
  const { signOut, openUserProfile } = useClerk();

  const [activeTab, setActiveTab] = useState<'account' | 'users' | 'subscription' | 'security'>('account');

  const currentPlan = PLANS.find(p => p.id === CURRENT_PLAN_ID) ?? PLANS[2];

  const tabs: { id: typeof activeTab; label: string; icon: React.ElementType; require?: boolean }[] = [
    { id: 'account',      label: 'Account',      icon: ShieldCheck },
    { id: 'users',        label: 'Users & Roles', icon: Users,      require: auth.can('settings:manage_users') },
    { id: 'subscription', label: 'Subscription',  icon: CreditCard, require: auth.can('settings:manage_billing') },
    { id: 'security',     label: 'Security',      icon: Lock },
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
                onClick={() => openUserProfile()}
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
              <div style={{ color: '#4a5a6a', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <ExternalLink size={11} />
                Invite new users and manage roles in the{' '}
                <a
                  href="https://dashboard.clerk.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#d4a847', textDecoration: 'none' }}
                >
                  Clerk dashboard
                </a>
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
              const isCurrent = plan.id === CURRENT_PLAN_ID;
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
                    <button style={{
                      width: '100%', padding: '9px 0', borderRadius: 8, fontWeight: 700,
                      fontSize: 12, cursor: 'pointer', border: `1px solid ${plan.color}44`,
                      background: plan.color + '12', color: plan.color,
                    }}>
                      {plan.id === 'basic' ? 'Downgrade' : 'Upgrade'} to {plan.name}
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
            <SectionTitle icon={CreditCard} label="Billing" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Current plan',    value: `${currentPlan.name} — ${currentPlan.price}` },
                { label: 'Next renewal',    value: '1 May 2026' },
                { label: 'Payment method', value: 'Visa ending 4242' },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #1a2535' }}>
                  <span style={{ color: '#6b7f92', fontSize: 13 }}>{row.label}</span>
                  <span style={{ color: '#f0f4f8', fontSize: 13, fontWeight: 600 }}>{row.value}</span>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'rgba(212,168,71,0.1)', color: '#d4a847',
                  border: '1px solid rgba(212,168,71,0.3)', borderRadius: 9,
                  padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>
                  <FileText size={13} /> View Invoices
                </button>
                <button style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: '#0a0f18', color: '#8899aa',
                  border: '1px solid #1a2535', borderRadius: 9,
                  padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>
                  <CreditCard size={13} /> Update Payment
                </button>
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
                onClick={() => openUserProfile()}
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
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  background: '#0a0f18', color: '#8899aa',
                  border: '1px solid #1a2535', borderRadius: 9,
                  padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                <FileText size={13} /> View Full Audit Log
              </button>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
