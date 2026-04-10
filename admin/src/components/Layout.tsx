import { useUser, UserButton } from '@clerk/clerk-react'
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Users, CreditCard, ScrollText, ShieldCheck, Terminal, Anchor } from 'lucide-react'

const NAV = [
  { to: '/fleet',     icon: LayoutDashboard, label: 'Fleet' },
  { to: '/customers', icon: Users,           label: 'Customers' },
  { to: '/payments',  icon: CreditCard,      label: 'Payments' },
  { to: '/audit',     icon: ScrollText,      label: 'Audit Log' },
  { to: '/team',      icon: ShieldCheck,     label: 'Team Access' },
  { to: '/shell',     icon: Terminal,        label: 'Remote Shell' },
];

const S = {
  shell:   { display: 'flex', height: '100vh', background: '#080c12' } as React.CSSProperties,
  sidebar: { width: 220, background: '#0a0f18', borderRight: '1px solid #131e2d', display: 'flex', flexDirection: 'column' as const, flexShrink: 0 },
  logo:    { padding: '20px 20px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #131e2d' },
  nav:     { padding: '12px 8px', flex: 1 },
  link:    (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8,
    color: active ? '#e8edf2' : '#6b7280', background: active ? '#131e2d' : 'transparent',
    fontWeight: active ? 600 : 400, fontSize: 13, marginBottom: 2, transition: 'all 0.15s',
  }),
  footer:  { padding: 16, borderTop: '1px solid #131e2d', display: 'flex', alignItems: 'center', gap: 10 },
  main:    { flex: 1, overflow: 'auto', padding: 28 },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  return (
    <div style={S.shell}>
      <aside style={S.sidebar}>
        <div style={S.logo}>
          <Anchor size={20} color="#0ea5e9" />
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#e8edf2' }}>NauticShield</div>
            <div style={{ fontSize: 10, color: '#6b7280', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Admin Portal</div>
          </div>
        </div>
        <nav style={S.nav}>
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} style={({ isActive }) => S.link(isActive)}>
              <Icon size={15} /> {label}
            </NavLink>
          ))}
        </nav>
        <div style={S.footer}>
          <UserButton appearance={{ elements: { avatarBox: { width: 28, height: 28 } } }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#e8edf2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.firstName ?? user?.emailAddresses[0]?.emailAddress ?? 'Admin'}
            </div>
            <div style={{ fontSize: 11, color: '#22c55e' }}>Admin</div>
          </div>
        </div>
      </aside>
      <main style={S.main}>{children}</main>
    </div>
  );
}
