import { ClerkProvider, SignedIn, SignedOut, RedirectToSignIn, useOrganizationList } from '@clerk/clerk-react'
import { dark } from '@clerk/themes'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Component, type ReactNode } from 'react'
import { VesselDataProvider } from '@/context/VesselDataProvider'
import { AuthProvider }       from '@/context/AuthProvider'
import { AuthTokenBridge }    from '@/components/AuthTokenBridge'
import { ProtectedRoute }     from '@/components/ProtectedRoute'
import Layout       from '@/components/Layout'
import SignInPage   from '@/pages/SignIn'
import Onboarding   from '@/pages/Onboarding'
import Dashboard    from '@/pages/Dashboard'
import Devices      from '@/pages/Devices'
import Alerts       from '@/pages/Alerts'
import Zones        from '@/pages/Zones'
import Report       from '@/pages/Report'
import GuestNetwork from '@/pages/GuestNetwork'
import Voyage       from '@/pages/Voyage'
import Cyber        from '@/pages/Cyber'
import Settings     from '@/pages/Settings'

// ── Error Boundary ────────────────────────────────────────────────
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div style={{ minHeight: '100vh', background: '#080b10', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <div style={{ background: '#0d1421', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 14, padding: 32, maxWidth: 600, width: '100%' }}>
          <div style={{ color: '#ef4444', fontWeight: 700, fontSize: 16, marginBottom: 12 }}>Application Error</div>
          <pre style={{ color: '#f87171', fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
            {error.message}{'\n\n'}{(error as Error & { stack?: string }).stack}
          </pre>
          <button onClick={() => window.location.reload()} style={{ marginTop: 20, padding: '8px 18px', background: '#d4a847', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', color: '#080b10' }}>
            Reload
          </button>
        </div>
      </div>
    );
  }
}

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

if (!CLERK_KEY || CLERK_KEY === 'pk_test_REPLACE_ME') {
  console.warn(
    '[NauticShield] VITE_CLERK_PUBLISHABLE_KEY not set — auth is disabled. ' +
    'Set it in .env.local to enable login.'
  );
}

export default function App() {
  // If no Clerk key is configured, run in dev mode (no auth wall)
  if (!CLERK_KEY || CLERK_KEY === 'pk_test_REPLACE_ME') {
    return <ErrorBoundary><AppRoutes devMode /></ErrorBoundary>;
  }

  return (
    <ErrorBoundary>
      <ClerkProvider
        publishableKey={CLERK_KEY}
        appearance={{ baseTheme: dark }}
      >
        <AuthTokenBridge />
        <AuthProvider>
          <AppRoutes devMode={false} />
        </AuthProvider>
      </ClerkProvider>
    </ErrorBoundary>
  );
}

// Guards signed-in users who have no org → sends them to /onboarding
function OrgGate({ children }: { children: React.ReactNode }) {
  const { userMemberships, isLoaded } = useOrganizationList({ userMemberships: true });
  if (!isLoaded) return null;
  if ((userMemberships.count ?? 0) === 0) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function AppRoutes({ devMode }: { devMode: boolean }) {
  const Protect = devMode
    ? ({ children }: { children: React.ReactNode }) => <>{children}</>
    : ProtectedRoute;

  return (
    <VesselDataProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/sign-in" element={devMode ? <Dashboard /> : (
            <SignedOut><SignInPage /></SignedOut>
          )} />

          {/* Onboarding — signed-in but no org yet */}
          <Route path="/onboarding" element={
            devMode ? <Navigate to="/" replace /> : (
              <SignedIn><Onboarding /></SignedIn>
            )
          } />

          {/* Protected — wrapped in Layout */}
          <Route path="/*" element={
            devMode ? (
              <Layout>
                <Routes>
                  <Route path="/"              element={<Dashboard />} />
                  <Route path="/devices"       element={<Devices />} />
                  <Route path="/alerts"        element={<Alerts />} />
                  <Route path="/zones"         element={<Zones />} />
                  <Route path="/report"        element={<Report />} />
                  <Route path="/guest-network" element={<GuestNetwork />} />
                  <Route path="/voyage"        element={<Voyage />} />
                  <Route path="/cyber"         element={<Cyber />} />
                  <Route path="/settings"      element={<Settings />} />
                  <Route path="*"              element={<Dashboard />} />
                </Routes>
              </Layout>
            ) : (
              <>
              <SignedIn>
                <OrgGate>
                  <Layout>
                    <Routes>
                      <Route path="/"              element={<Protect><Dashboard /></Protect>} />
                      <Route path="/devices"       element={<Protect require="view:devices"><Devices /></Protect>} />
                      <Route path="/alerts"        element={<Protect require="view:alerts"><Alerts /></Protect>} />
                      <Route path="/zones"         element={<Protect require="view:zones"><Zones /></Protect>} />
                      <Route path="/report"        element={<Protect require="view:report"><Report /></Protect>} />
                      <Route path="/guest-network" element={<Protect require="view:guest_network"><GuestNetwork /></Protect>} />
                      <Route path="/voyage"        element={<Protect require="view:voyage"><Voyage /></Protect>} />
                      <Route path="/cyber"         element={<Protect require="view:cyber"><Cyber /></Protect>} />
                      <Route path="/settings"      element={<Protect require="view:settings"><Settings /></Protect>} />
                      <Route path="*"              element={<Dashboard />} />
                    </Routes>
                  </Layout>
                </OrgGate>
              </SignedIn>
              <SignedOut><RedirectToSignIn /></SignedOut>
              </>
            )
          } />
        </Routes>
      </BrowserRouter>
    </VesselDataProvider>
  );
}
