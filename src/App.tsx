import { ClerkProvider, SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react'
import { dark } from '@clerk/themes'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { VesselDataProvider } from '@/context/VesselDataProvider'
import { AuthProvider }       from '@/context/AuthProvider'
import { AuthTokenBridge }    from '@/components/AuthTokenBridge'
import { ProtectedRoute }     from '@/components/ProtectedRoute'
import Layout       from '@/components/Layout'
import SignInPage   from '@/pages/SignIn'
import Dashboard    from '@/pages/Dashboard'
import Devices      from '@/pages/Devices'
import Alerts       from '@/pages/Alerts'
import Zones        from '@/pages/Zones'
import Report       from '@/pages/Report'
import GuestNetwork from '@/pages/GuestNetwork'
import Voyage       from '@/pages/Voyage'
import Cyber        from '@/pages/Cyber'
import Settings     from '@/pages/Settings'

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
    return <AppRoutes devMode />;
  }

  return (
    <ClerkProvider
      publishableKey={CLERK_KEY}
      appearance={{ baseTheme: dark }}
    >
      <AuthTokenBridge />
      <AuthProvider>
        <AppRoutes devMode={false} />
      </AuthProvider>
    </ClerkProvider>
  );
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
              <SignedIn>
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
              </SignedIn>
              <SignedOut><RedirectToSignIn /></SignedOut>
            )
          } />
        </Routes>
      </BrowserRouter>
    </VesselDataProvider>
  );
}
