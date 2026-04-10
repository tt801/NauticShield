/**
 * Admin-only guard for cloud API routes.
 *
 * To grant admin access, set `publicMetadata.role = "admin"` on a Clerk user
 * via the Clerk dashboard or backend API:
 *   https://dashboard.clerk.com → Users → select user → Metadata → publicMetadata
 *   { "role": "admin" }
 */
import { verifyToken, createClerkClient } from '@clerk/backend';
import type { VercelRequest } from '@vercel/node';

export interface AdminAuth {
  userId: string;
  orgId:  string | null;
  role:   string;
}

export async function verifyAdminJWT(req: VercelRequest): Promise<AdminAuth | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;

  const token  = header.slice(7);
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) return null;

  try {
    // Verify the JWT signature and expiry
    const payload = await verifyToken(token, { secretKey: secret });

    // Fetch the user's public metadata directly from Clerk (not from JWT claims)
    // so it works regardless of session token template configuration.
    const clerk  = createClerkClient({ secretKey: secret });
    const user   = await clerk.users.getUser(payload.sub);
    const role   = (user.publicMetadata?.role as string | undefined) ?? '';

    if (role !== 'admin') {
      console.warn(`[adminAuth] user ${payload.sub} denied — role="${role}"`);
      return null;
    }

    return {
      userId: payload.sub,
      orgId:  (payload as Record<string, unknown>).org_id as string | null ?? null,
      role,
    };
  } catch (err) {
    console.error('[adminAuth] verifyToken failed:', (err as Error).message);
    return null;
  }
}
