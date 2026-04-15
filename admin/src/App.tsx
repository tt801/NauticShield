import { ClerkProvider, SignedIn, SignedOut, RedirectToSignIn, useAuth, useUser, useClerk, UserButton } from '@clerk/clerk-react'
import { dark } from '@clerk/themes'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { setTokenProvider } from '@/api/client'
import Layout             from '@/components/Layout'
import SignInPage         from '@/pages/SignIn'
import FleetOverview      from '@/pages/FleetOverview'
import CustomerManagement from '@/pages/CustomerManagement'
import PaymentsDashboard  from '@/pages/PaymentsDashboard'
import AuditLog           from '@/pages/AuditLog'
import TeamAccess         from '@/pages/TeamAccess'
import Shell              from '@/pages/Shell'

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;
const ADMIN_PORTAL_URL = 'https://admin.nauticshield.io/fleet';
const ADMIN_USER_ID_ALLOWLIST = (import.meta.env.VITE_ADMIN_USER_ID_ALLOWLIST as string | undefined) ?? '';
const ADMIN_EMAIL_ALLOWLIST = (import.meta.env.VITE_ADMIN_EMAIL_ALLOWLIST as string | undefined) ?? '';

function isLocalDevHost() {
  if (typeof window === 'undefined') return false
  return ['localhost', '127.0.0.1'].includes(window.location.hostname)
}

function parseCsv(value: string): string[] {
  return value.split(',').map(v => v.trim()).filter(Boolean);
}

const BOOTSTRAP_ADMIN_IDS = parseCsv(ADMIN_USER_ID_ALLOWLIST);
const BOOTSTRAP_ADMIN_EMAILS = parseCsv(ADMIN_EMAIL_ALLOWLIST).map(v => v.toLowerCase());

// Sets the Clerk JWT as the Bearer token for all API calls
function TokenBridge() {
  const { getToken } = useAuth();
  useEffect(() => { setTokenProvider(() => getToken()); }, [getToken]);
  return null;
}

// Blocks access if the user doesn't have role="admin" in publicMetadata
function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  if (!isLoaded) return <Spinner />;
  const role = (user?.publicMetadata?.role as string | undefined) ?? '';
  const userId = user?.id ?? '';
  const userEmail = user?.primaryEmailAddress?.emailAddress?.toLowerCase() ?? '';
  const isBootstrapAdmin = BOOTSTRAP_ADMIN_IDS.includes(userId) || (userEmail !== '' && BOOTSTRAP_ADMIN_EMAILS.includes(userEmail));
  if (role !== 'admin' && !isBootstrapAdmin) {
    return (
      <div style={{ minHeight: '100vh', background: '#080c12', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#0d1421', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: 40, textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>🔒</div>
          <div style={{ color: '#ef4444', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Admin Access Required</div>
          <div style={{ color: '#6b7280', fontSize: 13, marginBottom: 16 }}>Your account does not have admin privileges.</div>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
            <UserButton appearance={{ elements: { avatarBox: { width: 32, height: 32 } } }} />
          </div>
          <button
            onClick={() => signOut({ redirectUrl: 'https://admin.nauticshield.io/sign-in' })}
            style={{
              background: '#131e2d',
              border: '1px solid #1f2d3d',
              color: '#cbd5e1',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Sign out and switch account
          </button>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

function Spinner() {
  return (
    <div style={{ minHeight: '100vh', background: '#080c12', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: '3px solid #1f2d3d', borderTopColor: '#0ea5e9', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function App() {
  if (isLocalDevHost() || !CLERK_KEY) {
    return (
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/"           element={<Navigate to="/fleet" replace />} />
            <Route path="/fleet"      element={<FleetOverview />} />
            <Route path="/customers"  element={<CustomerManagement />} />
            <Route path="/payments"   element={<PaymentsDashboard />} />
            <Route path="/audit"      element={<AuditLog />} />
            <Route path="/team"       element={<TeamAccess />} />
            <Route path="/shell"      element={<Shell />} />
            <Route path="*"           element={<Navigate to="/fleet" replace />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    )
  }

  return (
    <ClerkProvider
      publishableKey={CLERK_KEY}
      signInUrl="/sign-in"
      signInFallbackRedirectUrl={ADMIN_PORTAL_URL}
      signInForceRedirectUrl={ADMIN_PORTAL_URL}
      signUpFallbackRedirectUrl={ADMIN_PORTAL_URL}
      signUpForceRedirectUrl={ADMIN_PORTAL_URL}
      appearance={{ baseTheme: dark, variables: { colorPrimary: '#0ea5e9', colorBackground: '#080c12' } }}
    >
      <BrowserRouter>
        <RouteGuard />
        <SignedIn>
          <TokenBridge />
          <AdminGuard>
            <Layout>
              <Routes>
                <Route path="/"           element={<Navigate to="/fleet" replace />} />
                <Route path="/sign-in"    element={<Navigate to="/fleet" replace />} />
                <Route path="/fleet"      element={<FleetOverview />} />
                <Route path="/customers"  element={<CustomerManagement />} />
                <Route path="/payments"   element={<PaymentsDashboard />} />
                <Route path="/audit"      element={<AuditLog />} />
                <Route path="/team"       element={<TeamAccess />} />
                <Route path="/shell"      element={<Shell />} />
                <Route path="*"           element={<Navigate to="/fleet" replace />} />
              </Routes>
            </Layout>
          </AdminGuard>
        </SignedIn>
        <SignedOut>
          <Routes>
            <Route path="/sign-in" element={<SignInPage />} />
            <Route path="*" element={<RedirectToSignIn redirectUrl={ADMIN_PORTAL_URL} />} />
          </Routes>
        </SignedOut>
      </BrowserRouter>
    </ClerkProvider>
  );
}

function RouteGuard() {
  return null
}
