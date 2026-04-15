import { useAuth as useClerkAuth, useOrganization, useOrganizationList } from '@clerk/clerk-react';
import { useEffect, useRef, useState } from 'react';
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
  const { isLoaded: orgLoaded, organization } = useOrganization();
  const {
    isLoaded: membershipsLoaded,
    setActive,
    userMemberships,
  } = useOrganizationList({ userMemberships: true });
  const auth = useAuth();
  const attemptedRestore = useRef(false);
  const [restoreFailed, setRestoreFailed] = useState(false);

  useEffect(() => {
    if (!isSignedIn || !isLoaded || !orgLoaded || !membershipsLoaded || organization?.id || attemptedRestore.current) {
      return;
    }

    attemptedRestore.current = true;

    const memberships = userMemberships?.data ?? [];
    const preferredMembership = memberships[memberships.length - 1];

    if (!preferredMembership || !setActive) {
      return;
    }

    void setActive({ organization: preferredMembership.organization.id }).catch(() => {
      attemptedRestore.current = false;
      setRestoreFailed(true);
    });
  }, [
    isSignedIn,
    isLoaded,
    orgLoaded,
    membershipsLoaded,
    organization?.id,
    setActive,
    userMemberships?.data,
  ]);

  if (!isLoaded || !orgLoaded || !membershipsLoaded) {
    return <LoadingScreen />;
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />;
  }

  if (!organization?.id) {
    if ((userMemberships?.data?.length ?? 0) > 0 && !restoreFailed) {
      return <LoadingScreen message="Restoring vessel session…" />;
    }

    return <Navigate to="/onboarding" replace />;
  }

  if (action && !auth.can(action)) {
    return <AccessDenied />;
  }

  return <>{children}</>;
}

function LoadingScreen({ message = 'Connecting to vessel…' }: { message?: string }) {
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
      {message}
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
