import { createContext, useContext } from 'react';

// ── Role hierarchy ────────────────────────────────────────────────
// Roles are stored as Clerk Organization memberships with the role slug.
// Fallback when Clerk is not configured: 'owner' (full access in dev).

export type VesselRole = 'owner' | 'captain' | 'it_tech' | 'crew';

export interface AuthContextValue {
  role:       VesselRole;
  userId:     string | null;
  email:      string | null;
  vesselName: string | null;  // Clerk org name
  can:        (action: Action) => boolean;
}

// ── Permission table ──────────────────────────────────────────────

export type Action =
  | 'view:dashboard'
  | 'view:alerts'
  | 'view:devices'
  | 'view:zones'
  | 'view:guest_network'
  | 'view:voyage'
  | 'view:cyber'
  | 'view:report'
  | 'view:settings'
  | 'action:isolate_device'
  | 'action:run_scan'
  | 'action:resolve_alert'
  | 'action:rename_device'
  | 'action:manage_zones'
  | 'action:manage_portal'
  | 'action:download_report'
  | 'settings:manage_users'
  | 'settings:manage_billing';

const PERMISSIONS: Record<VesselRole, Action[]> = {
  owner: [
    'view:dashboard', 'view:alerts', 'view:devices', 'view:zones',
    'view:guest_network', 'view:voyage', 'view:cyber', 'view:report', 'view:settings',
    'action:isolate_device', 'action:run_scan', 'action:resolve_alert',
    'action:rename_device', 'action:manage_zones', 'action:manage_portal',
    'action:download_report',
    'settings:manage_users', 'settings:manage_billing',
  ],
  captain: [
    'view:dashboard', 'view:alerts', 'view:devices', 'view:zones',
    'view:guest_network', 'view:voyage', 'view:cyber', 'view:report',
    'action:isolate_device', 'action:run_scan', 'action:resolve_alert',
    'action:rename_device', 'action:manage_zones', 'action:manage_portal',
    'action:download_report',
  ],
  it_tech: [
    'view:dashboard', 'view:alerts', 'view:devices', 'view:zones',
    'view:guest_network', 'view:cyber', 'view:report',
    'action:isolate_device', 'action:run_scan', 'action:resolve_alert',
    'action:rename_device', 'action:manage_zones', 'action:manage_portal',
    'action:download_report',
  ],
  crew: [
    'view:dashboard', 'view:alerts',
  ],
};

export function can(role: VesselRole, action: Action): boolean {
  return PERMISSIONS[role].includes(action);
}

// ── Context ───────────────────────────────────────────────────────

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

// Returns null when called outside AuthProvider (dev mode / no Clerk key)
export function useAuthOptional(): AuthContextValue | null {
  return useContext(AuthContext);
}
