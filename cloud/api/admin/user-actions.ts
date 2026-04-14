/**
 * /api/admin/user-actions — user management operations
 *
 * POST body: { action, ...params }
 *   action: 'invite'  — { email, role }
 *   action: 'delete'  — { userId }
 *   action: 'ban'     — { userId }
 *   action: 'unban'   — { userId }
 *   action: 'reset_password' — { userId }
 *
 * All require admin Clerk JWT.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAdminJWT } from '../../lib/adminAuth';
import { cors }           from '../../lib/cors';
import { writeAudit }     from '../../lib/audit';

type ActionBody =
  | { action: 'invite';         email: string; role: string }
  | { action: 'delete';         userId: string }
  | { action: 'ban';            userId: string }
  | { action: 'unban';          userId: string }
  | { action: 'reset_password'; userId: string };

async function clerkRequest(secretKey: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`https://api.clerk.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Clerk API error (${res.status}): ${text}`);
  }
  return res.status === 204 ? {} : res.json();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const admin = await verifyAdminJWT(req);
  if (!admin) return res.status(401).json({ error: 'Admin access required' });

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) return res.status(500).json({ error: 'Clerk not configured' });

  const body = req.body as ActionBody;
  if (!body?.action) return res.status(400).json({ error: 'action required' });

  try {
    switch (body.action) {

      case 'invite': {
        const { email, role } = body;
        if (!email) return res.status(400).json({ error: 'email required' });
        const validRoles = ['admin', 'support'];
        if (!validRoles.includes(role)) return res.status(400).json({ error: `role must be admin or support` });

        await clerkRequest(secretKey, 'POST', '/invitations', {
          email_address:   email,
          public_metadata: { role },
          redirect_url:    process.env.ADMIN_URL ?? 'https://admin.nauticshield.io',
        });

        await writeAudit({ actor: admin.userId, action: 'team.invite', resource: email, metadata: { role } }, req);
        return res.json({ ok: true, message: `Invitation sent to ${email}` });
      }

      case 'delete': {
        const { userId } = body;
        if (!userId) return res.status(400).json({ error: 'userId required' });
        if (userId === admin.userId) return res.status(400).json({ error: 'Cannot delete your own account' });

        await clerkRequest(secretKey, 'DELETE', `/users/${userId}`);
        await writeAudit({ actor: admin.userId, action: 'team.delete', resource: userId, metadata: {} }, req);
        return res.json({ ok: true });
      }

      case 'ban': {
        const { userId } = body;
        if (!userId) return res.status(400).json({ error: 'userId required' });
        if (userId === admin.userId) return res.status(400).json({ error: 'Cannot ban yourself' });

        await clerkRequest(secretKey, 'POST', `/users/${userId}/ban`);
        await writeAudit({ actor: admin.userId, action: 'team.ban', resource: userId, metadata: {} }, req);
        return res.json({ ok: true });
      }

      case 'unban': {
        const { userId } = body;
        if (!userId) return res.status(400).json({ error: 'userId required' });

        await clerkRequest(secretKey, 'POST', `/users/${userId}/unban`);
        await writeAudit({ actor: admin.userId, action: 'team.unban', resource: userId, metadata: {} }, req);
        return res.json({ ok: true });
      }

      case 'reset_password': {
        const { userId } = body;
        if (!userId) return res.status(400).json({ error: 'userId required' });

        // Create a sign-in token for password reset
        await clerkRequest(secretKey, 'POST', '/sign_in_tokens', { user_id: userId });
        await writeAudit({ actor: admin.userId, action: 'team.reset_password', resource: userId, metadata: {} }, req);
        return res.json({ ok: true, message: 'Password reset email sent' });
      }

      default:
        return res.status(400).json({ error: 'Unknown action' });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error';
    return res.status(502).json({ error: msg });
  }
}
