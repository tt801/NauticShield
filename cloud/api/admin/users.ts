/**
 * GET /api/admin/users — list all Clerk users with their org memberships
 *
 * Requires admin Clerk JWT.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAdminJWT } from '../../lib/adminAuth';
import { cors }           from '../../lib/cors';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const admin = await verifyAdminJWT(req);
  if (!admin) return res.status(401).json({ error: 'Admin access required' });

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) return res.status(500).json({ error: 'Clerk not configured' });

  const limit  = Math.min(Number(req.query.limit  ?? 100), 500);
  const offset = Number(req.query.offset ?? 0);

  const url = `https://api.clerk.com/v1/users?limit=${limit}&offset=${offset}&order_by=-created_at`;
  const clerkRes = await fetch(url, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });

  if (!clerkRes.ok) {
    const text = await clerkRes.text();
    return res.status(502).json({ error: `Clerk API error: ${text}` });
  }

  const users = await clerkRes.json() as Array<{
    id: string;
    email_addresses: Array<{ email_address: string }>;
    first_name:  string | null;
    last_name:   string | null;
    image_url:   string;
    public_metadata: Record<string, unknown>;
    created_at:  number;
    last_sign_in_at: number | null;
    banned:      boolean;
  }>;

  return res.json(
    users.map(u => ({
      id:          u.id,
      email:       u.email_addresses[0]?.email_address ?? '',
      name:        [u.first_name, u.last_name].filter(Boolean).join(' ') || null,
      imageUrl:    u.image_url,
      role:        (u.public_metadata?.role as string | undefined) ?? 'user',
      createdAt:   new Date(u.created_at).toISOString(),
      lastSignIn:  u.last_sign_in_at ? new Date(u.last_sign_in_at).toISOString() : null,
      banned:      u.banned ?? false,
    })),
  );
}
