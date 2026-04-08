import { useAuth as useClerkAuth, useOrganization } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import type { Action } from '@/context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** If provided, user must have this permission — else show 403 */
  require?: Action;
}

export function ProtectedRoute({ children, require: action }: ProtectedRouteProps) {
  const { isSignedIn, isLoaded } = useClerkAuth();
  const { isLoaded: orgLoaded }  = useOrganization();
  const auth                     = useAuth();

  if (!isLoaded || !orgLoaded) {
    return <LoadingScreen />;
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />;
  }

  if (action && !auth.can(action)) {
    return <AccessDenied />;
  }

  return <>{children}</>;
}

function LoadingScreen() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '60vh', color: '#4a5a6a', fontSize: 13,
      flexDirection: 'column', gap: 14,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        border: '2px solid #1a2535', borderTopColor: '#d4a847',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      Connecting to vessel…
    </div>
  );
}

function AccessDenied() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '60vh', gap: 12,
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22,
      }}>
        🔒
      </div>
      <div style={{ color: '#f0f4f8', fontSize: 16, fontWeight: 700 }}>Access Restricted</div>
      <div style={{ color: '#4a5a6a', fontSize: 13, textAlign: 'center', maxWidth: 300 }}>
        Your role does not have permission to view this page.
        Contact the vessel owner or captain.
      </div>
    </div>
  );
}
