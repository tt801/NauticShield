import { createHash } from 'crypto';
import { createClerkClient, verifyToken } from '@clerk/backend';
import type { VercelRequest } from '@vercel/node';
import { supabase } from './supabase';

// ── API key hashing ────────────────────────────────────────────────
// Keys are stored as SHA-256 hashes — the plain key is never persisted.

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

// ── Clerk JWT verification ────────────────────────────────────────
// Used by frontend-facing endpoints (read/register).

export interface ClerkAuth {
  userId: string;
  orgId:  string | null;
}

export async function listAccessibleOrgIds(auth: ClerkAuth): Promise<string[]> {
  if (auth.orgId) {
    return [auth.orgId];
  }

  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) {
    return [auth.userId];
  }

  try {
    const clerk = createClerkClient({ secretKey: secret });
    const memberships = await clerk.users.getOrganizationMembershipList({ userId: auth.userId, limit: 100 });
    const orgIds = memberships.data
      .map(membership => membership.organization.id)
      .filter((value, index, array) => Boolean(value) && array.indexOf(value) === index);

    return orgIds.length > 0 ? orgIds : [auth.userId];
  } catch {
    return [auth.userId];
  }
}

export async function verifyClerkJWT(req: VercelRequest): Promise<ClerkAuth | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;

  const token = header.slice(7);
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) return null;

  try {
    const payload = await verifyToken(token, { secretKey: secret });
    return {
      userId: payload.sub,
      orgId:  (payload as Record<string, unknown>).org_id as string | null ?? null,
    };
  } catch {
    return null;
  }
}

// ── Vessel API key verification ───────────────────────────────────
// Used by POST /api/sync (vessel agent push).

export interface VesselRecord {
  id:             string;
  org_id:         string;
  name:           string | null;
  last_synced_at: string | null;
}

export async function verifyVesselApiKey(req: VercelRequest): Promise<VesselRecord | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;

  const key  = header.slice(7);
  const hash = hashApiKey(key);

  const { data, error } = await supabase
    .from('vessels')
    .select('id, org_id, name, last_synced_at')
    .eq('api_key_hash', hash)
    .single();

  if (error || !data) return null;
  return data as VesselRecord;
}

// ── Org ownership check ───────────────────────────────────────────
// Ensures the authenticated user's org owns the requested vessel.

export async function assertVesselOwnership(
  vesselId: string,
  auth: ClerkAuth,
): Promise<VesselRecord | null> {
  const orgIds = await listAccessibleOrgIds(auth);

  const { data, error } = await supabase
    .from('vessels')
    .select('id, org_id, name, last_synced_at')
    .eq('id', vesselId)
    .in('org_id', orgIds)
    .single();

  if (error || !data) return null;
  return data as VesselRecord;
}
