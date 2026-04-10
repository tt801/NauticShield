/**
 * PATCH /api/admin/team — change a team member's role
 * Body: { userId: string, role: 'admin' | 'support' }
 *
 * Requires admin Clerk JWT. Cannot change your own role.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAdminJWT } from '../../lib/adminAuth';
import { cors }           from '../../lib/cors';
import { writeAudit }     from '../../lib/audit';

const VALID_ROLES = ['admin', 'support'] as const;
type Role = typeof VALID_ROLES[number];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' });

  const admin = await verifyAdminJWT(req);
  if (!admin) return res.status(401).json({ error: 'Admin access required' });

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) return res.status(500).json({ error: 'Clerk not configured' });

  const { userId, role } = req.body as { userId?: string; role?: string };
  if (!userId || !role) return res.status(400).json({ error: 'userId and role required' });
  if (!(VALID_ROLES as readonly string[]).includes(role)) {
    return res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` });
  }
  if (userId === admin.userId) {
    return res.status(400).json({ error: 'Cannot change your own role' });
  }

  const clerkRes = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ public_metadata: { role: role as Role } }),
  });

  if (!clerkRes.ok) {
    const text = await clerkRes.text();
    return res.status(502).json({ error: `Clerk API error: ${text}` });
  }

  await writeAudit({
    actor:    admin.userId,
    action:   'team.role_change',
    resource: userId,
    metadata: { newRole: role },
  }, req);

  return res.json({ ok: true });
}
