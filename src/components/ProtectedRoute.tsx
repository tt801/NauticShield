import { useAuth as useClerkAuth, useOrganization, useOrganizationList, useUser } from '@clerk/clerk-react';
import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import type { Action } from '@/context/AuthContext';

const ACTIVE_ORG_STORAGE_KEY = 'nauticshield.activeOrgId';
const ACTIVE_ORG_QUERY_KEY = 'ns_org';
const PENDING_ORG_STORAGE_KEY = 'nauticshield.pendingOrgId';
type MembershipSummary = { organization: { id: string; name: string | null } };
const MAX_RESTORE_ATTEMPTS = 8;

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
  const restoreTimerRef = useRef<number | null>(null);
  const [restoreAttemptCount, setRestoreAttemptCount] = useState(0);
  const [isRestoring, setIsRestoring] = useState(false);
  const [probedMemberships, setProbedMemberships] = useState<MembershipSummary[] | null>(null);
  const [membershipProbeComplete, setMembershipProbeComplete] = useState(false);
  const pendingOrgId = typeof window === 'undefined'
    ? null
    : new URLSearchParams(window.location.search).get(ACTIVE_ORG_QUERY_KEY)
      ?? window.sessionStorage.getItem(PENDING_ORG_STORAGE_KEY);
  const storedOrgId = typeof window === 'undefined' ? null : window.localStorage.getItem(ACTIVE_ORG_STORAGE_KEY);

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
      window.sessionStorage.setItem(PENDING_ORG_STORAGE_KEY, organization.id);
      setRestoreAttemptCount(0);
      setIsRestoring(false);

      const url = new URL(window.location.href);
      if (url.searchParams.has(ACTIVE_ORG_QUERY_KEY)) {
        url.searchParams.delete(ACTIVE_ORG_QUERY_KEY);
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
      }

      window.sessionStorage.removeItem(PENDING_ORG_STORAGE_KEY);
    }
  }, [organization?.id]);

  useEffect(() => {
    return () => {
      if (restoreTimerRef.current !== null) {
        window.clearTimeout(restoreTimerRef.current);
      }
    };
  }, []);

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
    if (!isSignedIn || !isLoaded || !orgLoaded || !membershipsLoaded || !membershipProbeComplete || organization?.id || isRestoring) {
      return;
    }

    if (memberships.length === 0 && !storedOrgId && !pendingOrgId) {
      return;
    }

    if (restoreAttemptCount >= MAX_RESTORE_ATTEMPTS) {
      return;
    }

    const preferredMembership =
      (pendingOrgId ? memberships.find(membership => membership.organization.id === pendingOrgId) : undefined)
      ?? (pendingOrgId ? { organization: { id: pendingOrgId, name: null } } : undefined)
      ??
      (storedOrgId ? memberships.find(membership => membership.organization.id === storedOrgId) : undefined)
      ?? memberships[memberships.length - 1];

    const targetOrgId = preferredMembership?.organization.id ?? pendingOrgId ?? storedOrgId;

    if (!targetOrgId || !setActive) {
      return;
    }

    setIsRestoring(true);

    void setActive({ organization: targetOrgId })
      .then(() => {
        window.localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, targetOrgId);
        window.sessionStorage.setItem(PENDING_ORG_STORAGE_KEY, targetOrgId);
        setRestoreAttemptCount(0);
        setIsRestoring(false);
      })
      .catch(() => {
        setIsRestoring(false);

        if (restoreTimerRef.current !== null) {
          window.clearTimeout(restoreTimerRef.current);
        }

        restoreTimerRef.current = window.setTimeout(() => {
          setRestoreAttemptCount(count => count + 1);
        }, 400);
      });
  }, [
    isSignedIn,
    isLoaded,
    orgLoaded,
    membershipsLoaded,
    membershipProbeComplete,
    organization?.id,
    memberships,
    pendingOrgId,
    storedOrgId,
    setActive,
    isRestoring,
    restoreAttemptCount,
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

    if (memberships.length > 0 || storedOrgId || pendingOrgId) {
      if (restoreAttemptCount < MAX_RESTORE_ATTEMPTS) {
        return <LoadingScreen message="Restoring vessel session…" />;
      }

      return <VesselRecoveryScreen storedOrgId={storedOrgId} pendingOrgId={pendingOrgId} membershipCount={memberships.length} />;
    }

    return <VesselRecoveryScreen storedOrgId={storedOrgId} pendingOrgId={pendingOrgId} membershipCount={memberships.length} />;
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

function VesselRecoveryScreen({ storedOrgId, pendingOrgId, membershipCount }: { storedOrgId: string | null; pendingOrgId: string | null; membershipCount: number }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', gap: 16, padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 520,
        background: '#0d1421', border: '1px solid #1a2535', borderRadius: 14,
        padding: 24,
      }}>
        <div style={{ color: '#f0f4f8', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
          Vessel session not restored
        </div>
        <div style={{ color: '#6b7f92', fontSize: 13, lineHeight: 1.7, marginBottom: 16 }}>
          NauticShield could not recover your active vessel session automatically. Your account is signed in, but Clerk is not returning an active organization for this app session.
        </div>

        <div style={{
          background: 'rgba(14,165,233,0.08)', border: '1px solid #0ea5e930', borderRadius: 10,
          padding: '12px 14px', color: '#7dd3fc', fontSize: 12, fontFamily: 'monospace', marginBottom: 18,
        }}>
          Pending org: {pendingOrgId ?? 'null'}<br />
          Stored org: {storedOrgId ?? 'null'}<br />
          Memberships seen: {membershipCount}
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: 'linear-gradient(135deg, #d4a847 0%, #b8922e 100%)',
              border: 'none', borderRadius: 8, padding: '10px 16px', cursor: 'pointer',
              color: '#080b10', fontSize: 13, fontWeight: 700,
            }}
          >
            Retry restore
          </button>
          <button
            onClick={() => {
              if (storedOrgId) {
                window.localStorage.removeItem(ACTIVE_ORG_STORAGE_KEY);
              }
              window.sessionStorage.removeItem(PENDING_ORG_STORAGE_KEY);
              window.location.assign('/onboarding');
            }}
            style={{
              background: 'transparent', border: '1px solid #2a3a50', borderRadius: 8, padding: '10px 16px', cursor: 'pointer',
              color: '#dce8f4', fontSize: 13, fontWeight: 600,
            }}
          >
            Go to vessel setup
          </button>
        </div>
      </div>
    </div>
  );
}
