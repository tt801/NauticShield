import { useAuth as useClerkAuth, useOrganization, useOrganizationList, useUser } from '@clerk/clerk-react';
import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import type { Action } from '@/context/AuthContext';

const ACTIVE_ORG_STORAGE_KEY = 'nauticshield.activeOrgId';
type MembershipSummary = { organization: { id: string; name: string | null } };

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** If provided, user must have this permission — else show 403 */
  require?: Action;
}

export function ProtectedRoute({ children, require: action }: ProtectedRouteProps) {
  const { isSignedIn, isLoaded } = useClerkAuth();
  const { user } = useUser();
  const { isLoaded: orgLoaded, organization } = useOrganization();
  const {
    isLoaded: membershipsLoaded,
    setActive,
    userMemberships,
  } = useOrganizationList({ userMemberships: true });
  const auth = useAuth();
  const attemptedRestore = useRef(false);
  const [restoreFailed, setRestoreFailed] = useState(false);
  const [probedMemberships, setProbedMemberships] = useState<MembershipSummary[] | null>(null);
  const [membershipProbeComplete, setMembershipProbeComplete] = useState(false);

  const memberships: MembershipSummary[] = ((userMemberships?.data?.length ?? 0) > 0
    ? userMemberships?.data?.map(membership => ({
        organization: {
          id: membership.organization.id,
          name: membership.organization.name ?? null,
        },
      }))
    : probedMemberships) ?? [];

  useEffect(() => {
    if (organization?.id) {
      window.localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, organization.id);
    }
  }, [organization?.id]);

  useEffect(() => {
    if (!isSignedIn || !isLoaded || !membershipsLoaded || !user) {
      return;
    }

    if ((userMemberships?.data?.length ?? 0) > 0) {
      setProbedMemberships(null);
      setMembershipProbeComplete(true);
      return;
    }

    let cancelled = false;

    void user.getOrganizationMemberships().then(result => {
      if (cancelled) return;
      setProbedMemberships(result.data.map(membership => ({
        organization: {
          id: membership.organization.id,
          name: membership.organization.name ?? null,
        },
      })));
      setMembershipProbeComplete(true);
    }).catch(() => {
      if (cancelled) return;
      setProbedMemberships([]);
      setMembershipProbeComplete(true);
    });

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, isLoaded, membershipsLoaded, user, userMemberships?.data]);

  useEffect(() => {
    if (!isSignedIn || !isLoaded || !orgLoaded || !membershipsLoaded || organization?.id || attemptedRestore.current) {
      return;
    }

    attemptedRestore.current = true;

    const storedOrgId = window.localStorage.getItem(ACTIVE_ORG_STORAGE_KEY);
    const preferredMembership =
      (storedOrgId ? memberships.find(membership => membership.organization.id === storedOrgId) : undefined)
      ?? memberships[memberships.length - 1];

    if (!preferredMembership || !setActive) {
      return;
    }

    void setActive({ organization: preferredMembership.organization.id })
      .then(() => {
        window.localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, preferredMembership.organization.id);
        setRestoreFailed(false);
      })
      .catch(() => {
        attemptedRestore.current = false;
        setRestoreFailed(true);
      });
  }, [
    isSignedIn,
    isLoaded,
    orgLoaded,
    membershipsLoaded,
    membershipProbeComplete,
    organization?.id,
    memberships,
    setActive,
  ]);

  if (!isLoaded || !orgLoaded || !membershipsLoaded) {
    return <LoadingScreen />;
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />;
  }

  if (!organization?.id) {
    if (!membershipProbeComplete) {
      return <LoadingScreen message="Checking vessel access…" />;
    }

    if (memberships.length > 0 && !restoreFailed) {
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
