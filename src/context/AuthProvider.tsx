import { useUser, useOrganization } from '@clerk/clerk-react';
import { useMemo } from 'react';
import { AuthContext, can } from './AuthContext';
import type { VesselRole, Action } from './AuthContext';

// Map Clerk org role slugs → our internal VesselRole
function mapClerkRole(clerkRole: string | undefined | null): VesselRole {
  switch (clerkRole) {
    case 'org:admin':    return 'owner';
    case 'org:captain':  return 'captain';
    case 'org:it_tech':  return 'it_tech';
    case 'org:member':   return 'crew';
    default:             return 'crew'; // least privilege if unknown
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoaded: userLoaded }            = useUser();
  const { membership, organization, isLoaded: orgLoaded } = useOrganization();

  const value = useMemo(() => {
    // While Clerk is loading, default to minimum access
    if (!userLoaded || !orgLoaded) {
      return {
        role:       'crew' as VesselRole,
        userId:     null,
        email:      null,
        vesselName: null,
        can:        (_action: Action) => false,
      };
    }

    const role = mapClerkRole(membership?.role);
    return {
      role,
      userId:     user?.id ?? null,
      email:      user?.primaryEmailAddress?.emailAddress ?? null,
      vesselName: organization?.name ?? null,
      can:        (action: Action) => can(role, action),
    };
  }, [userLoaded, orgLoaded, user, membership, organization]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
