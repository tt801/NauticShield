/**
 * Admin-only guard for cloud API routes.
 *
 * To grant admin access, set `publicMetadata.role = "admin"` on a Clerk user
 * via the Clerk dashboard or backend API:
 *   https://dashboard.clerk.com → Users → select user → Metadata → publicMetadata
 *   { "role": "admin" }
 */
import { verifyToken } from '@clerk/backend';
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
    const payload = await verifyToken(token, { secretKey: secret });
    const meta    = (payload as Record<string, unknown>).public_metadata as Record<string, unknown> | undefined;
    const role    = (meta?.role as string | undefined) ?? '';

    if (role !== 'admin') return null;

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
