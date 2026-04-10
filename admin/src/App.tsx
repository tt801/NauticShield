import { ClerkProvider, SignedIn, SignedOut, RedirectToSignIn, useAuth, useUser } from '@clerk/clerk-react'
import { dark } from '@clerk/themes'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { setTokenProvider } from '@/api/client'
import Layout            from '@/components/Layout'
import FleetOverview     from '@/pages/FleetOverview'
import CustomerManagement from '@/pages/CustomerManagement'
import PaymentsDashboard from '@/pages/PaymentsDashboard'
import AuditLog          from '@/pages/AuditLog'

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

// Sets the Clerk JWT as the Bearer token for all API calls
function TokenBridge() {
  const { getToken } = useAuth();
  useEffect(() => { setTokenProvider(() => getToken()); }, [getToken]);
  return null;
}

// Blocks access if the user doesn't have role="admin" in publicMetadata
function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  if (!isLoaded) return <Spinner />;
  const role = (user?.publicMetadata?.role as string | undefined) ?? '';
  if (role !== 'admin') {
    return (
      <div style={{ minHeight: '100vh', background: '#080c12', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#0d1421', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: 40, textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>🔒</div>
          <div style={{ color: '#ef4444', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Admin Access Required</div>
          <div style={{ color: '#6b7280', fontSize: 13 }}>Your account does not have admin privileges.</div>
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
  return (
    <ClerkProvider publishableKey={CLERK_KEY} appearance={{ baseTheme: dark, variables: { colorPrimary: '#0ea5e9', colorBackground: '#080c12' } }}>
      <BrowserRouter>
        <SignedIn>
          <TokenBridge />
          <AdminGuard>
            <Layout>
              <Routes>
                <Route path="/"           element={<Navigate to="/fleet" replace />} />
                <Route path="/fleet"      element={<FleetOverview />} />
                <Route path="/customers"  element={<CustomerManagement />} />
                <Route path="/payments"   element={<PaymentsDashboard />} />
                <Route path="/audit"      element={<AuditLog />} />
                <Route path="*"           element={<Navigate to="/fleet" replace />} />
              </Routes>
            </Layout>
          </AdminGuard>
        </SignedIn>
        <SignedOut>
          <RedirectToSignIn />
        </SignedOut>
      </BrowserRouter>
    </ClerkProvider>
  );
}
