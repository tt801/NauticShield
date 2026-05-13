import { ClerkProvider, SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react'
import { dark } from '@clerk/themes'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Component, type ReactNode } from 'react'
import { VesselDataProvider } from '@/context/VesselDataProvider'
import { AuthProvider }       from '@/context/AuthProvider'
import { AuthTokenBridge }    from '@/components/AuthTokenBridge'
import { ProtectedRoute }     from '@/components/ProtectedRoute'
import Layout       from '@/components/Layout'
import SignInPage   from '@/pages/SignIn'
import SignUpPage   from '@/pages/SignUp'
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
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error } as { error: Error }; }
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
const ADMIN_HOSTNAME = 'admin.nauticshield.io';
const ADMIN_FALLBACK_URL = 'https://nautic-shield-admin.vercel.app';

function isLocalDevHost() {
  if (typeof window === 'undefined') {
    return false;
  }

  return ['localhost', '127.0.0.1'].includes(window.location.hostname);
}

function redirectIfWrongHost() {
  if (typeof window === 'undefined') {
    return false;
  }

  if (window.location.hostname !== ADMIN_HOSTNAME) {
    return false;
  }

  const target = `${ADMIN_FALLBACK_URL}${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.replace(target);
  return true;
}

if (!CLERK_KEY || CLERK_KEY === 'pk_test_REPLACE_ME') {
  console.warn(
    '[NauticShield] VITE_CLERK_PUBLISHABLE_KEY not set — auth is disabled. ' +
    'Set it in .env.local to enable login.'
  );
}

export default function App() {
  if (redirectIfWrongHost()) {
    return null;
  }

  const useDevMode = !CLERK_KEY || CLERK_KEY === 'pk_test_REPLACE_ME' || isLocalDevHost();

  // If no Clerk key is configured, run in dev mode (no auth wall)
  if (useDevMode) {
    return <ErrorBoundary><AppRoutes devMode /></ErrorBoundary>;
  }

  return (
    <ErrorBoundary>
      <ClerkProvider
        publishableKey={CLERK_KEY}
        signInUrl="/sign-in"
        signUpUrl="/sign-up"
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

function AppRoutes({ devMode }: { devMode: boolean }) {
  const Protect = devMode
    ? ({ children }: { children: React.ReactNode }) => <>{children}</>
    : ProtectedRoute;

  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/sign-in" element={devMode ? <Navigate to="/" replace /> : (
          <SignedOut><SignInPage /></SignedOut>
        )} />

        <Route path="/sign-up" element={devMode ? <Navigate to="/" replace /> : (
          <SignedOut><SignUpPage /></SignedOut>
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
            <VesselDataProvider>
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
                  <Route path="*"              element={<Protect><Dashboard /></Protect>} />
                </Routes>
              </Layout>
            </VesselDataProvider>
          ) : (
            <>
            <SignedIn>
              <VesselDataProvider>
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
                    <Route path="*"              element={<Protect><Dashboard /></Protect>} />
                  </Routes>
                </Layout>
              </VesselDataProvider>
            </SignedIn>
            <SignedOut><RedirectToSignIn /></SignedOut>
            </>
          )
        } />
      </Routes>
    </BrowserRouter>
  );
}
