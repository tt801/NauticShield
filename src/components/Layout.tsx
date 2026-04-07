import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  MonitorSmartphone,
  BellRing,
  Map,
  FileText,
  Wifi,
  Navigation,
  ChevronLeft,
  ChevronRight,
  Settings,
  HelpCircle,
  ShieldCheck,
} from 'lucide-react';

const navItems = [
  { to: '/',              label: 'Dashboard',    icon: LayoutDashboard },
  { to: '/devices',       label: 'Devices',      icon: MonitorSmartphone },
  { to: '/alerts',        label: 'Alerts',       icon: BellRing },
  { to: '/guest-network', label: 'Guest Network',icon: Wifi },
];

const premiumNavItems = [
  { to: '/zones',  label: 'Vessel Zones', icon: Map         },
  { to: '/voyage', label: 'Voyage Log',   icon: Navigation  },
  { to: '/report', label: 'Reporting',    icon: FileText    },
  { to: '/cyber',  label: 'Cyber',        icon: ShieldCheck },
];

const bottomItems = [
  { label: 'Settings', icon: Settings },
  { label: 'Help',     icon: HelpCircle },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: '100vh', background: '#080b10' }}>

      {/* Sidebar */}
      <aside style={{
        background: '#0d1117',
        borderRight: '1px solid #1a2535',
        width: collapsed ? 64 : 220,
        minWidth: collapsed ? 64 : 220,
        transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1), min-width 0.22s cubic-bezier(0.4,0,0.2,1)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflowX: 'hidden',
      }}>

        {/* Logo */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '15px 0',
          justifyContent: 'center',
          borderBottom: '1px solid #1a2535',
          minHeight: 62,
          transition: 'padding 0.22s',
        }}>
          <img
            src="/icons.png"
            alt="NauticShield logo"
            style={{ width: 87, height: 87, borderRadius: 10, flexShrink: 0, objectFit: 'contain' }}
          />
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          style={{
            position: 'absolute',
            top: 20,
            right: -12,
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: '#1a2535',
            border: '1px solid #2a3a50',
            color: '#8899aa',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 10,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#223047')}
          onMouseLeave={e => (e.currentTarget.style.background = '#1a2535')}
        >
          {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
        </button>

        {/* Nav label */}
        {!collapsed && (
          <div style={{ padding: '14px 16px 6px', fontSize: 10, fontWeight: 600, letterSpacing: 1.2, color: '#3a4a5a', textTransform: 'uppercase' }}>
            Navigation
          </div>
        )}

        {/* Main nav */}
        <nav style={{ flex: 1, padding: collapsed ? '8px 8px 0' : '0 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              title={collapsed ? label : undefined}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: collapsed ? '10px 0' : '9px 12px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                textDecoration: 'none',
                color: isActive ? '#7dd3fc' : '#6b7f92',
                background: isActive ? 'rgba(14,165,233,0.12)' : 'transparent',
                transition: 'background 0.15s, color 0.15s',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              })}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                if (!el.style.background.includes('rgba(14')) {
                  el.style.background = 'rgba(255,255,255,0.04)';
                  el.style.color = '#a0b4c8';
                }
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement;
                if (!el.style.background.includes('rgba(14')) {
                  el.style.background = 'transparent';
                  el.style.color = '#6b7f92';
                }
              }}
            >
              {({ isActive }) => (
                <>
                  <Icon size={17} color={isActive ? '#0ea5e9' : '#6b7f92'} style={{ flexShrink: 0 }} />
                  {!collapsed && label}
                </>
              )}
            </NavLink>
          ))}

          {/* ── Premium separator ── */}
          <div style={{ margin: '10px 4px 6px', borderTop: '1px solid #1a2535' }} />
          {!collapsed && (
            <div style={{ padding: '0 4px 4px', fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: 'rgba(212,168,71,0.5)', textTransform: 'uppercase' }}>Premium</div>
          )}

          {premiumNavItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              title={collapsed ? label : undefined}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: collapsed ? '10px 0' : '9px 12px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                textDecoration: 'none',
                color: isActive ? '#d4a847' : '#a07830',
                background: isActive ? 'rgba(212,168,71,0.12)' : 'transparent',
                border: isActive ? '1px solid rgba(212,168,71,0.25)' : '1px solid transparent',
                transition: 'background 0.15s, color 0.15s, border-color 0.15s',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              })}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                if (!el.style.background.includes('rgba(212,168,71,0.12)')) {
                  el.style.background = 'rgba(212,168,71,0.06)';
                  el.style.color = '#d4a847';
                }
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement;
                if (!el.style.background.includes('rgba(212,168,71,0.12)')) {
                  el.style.background = 'transparent';
                  el.style.color = '#a07830';
                }
              }}
            >
              {({ isActive }) => (
                <>
                  <Icon size={17} color={isActive ? '#d4a847' : '#a07830'} style={{ flexShrink: 0 }} />
                  {!collapsed && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {label}
                      <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.5, background: 'rgba(212,168,71,0.15)', color: '#d4a847', borderRadius: 4, padding: '1px 5px' }}>✦</span>
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Divider */}
        <div style={{ margin: '6px 12px', borderTop: '1px solid #1a2535' }} />

        {/* Bottom nav */}
        <nav style={{ padding: collapsed ? '0 8px 8px' : '0 8px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {bottomItems.map(({ label, icon: Icon }) => (
            <button
              key={label}
              title={collapsed ? label : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: collapsed ? '10px 0' : '9px 12px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#6b7f92',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                width: '100%',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#a0b4c8'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6b7f92'; }}
            >
              <Icon size={17} color="#6b7f92" style={{ flexShrink: 0 }} />
              {!collapsed && label}
            </button>
          ))}
        </nav>

        {/* Vessel footer */}
        {!collapsed ? (
          <div style={{ padding: '12px 16px', borderTop: '1px solid #1a2535' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e', flexShrink: 0 }} />
              <div>
                <div style={{ color: '#f0f4f8', fontSize: 12, fontWeight: 600 }}>M/Y Aurora</div>
                <div style={{ color: '#3a4a5a', fontSize: 11, marginTop: 1 }}>Last sync: just now</div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: '12px 0', display: 'flex', justifyContent: 'center', borderTop: '1px solid #1a2535' }}>
            <div title="M/Y Aurora — connected" style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
          </div>
        )}
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
        {children}
      </main>
    </div>
  );
}
