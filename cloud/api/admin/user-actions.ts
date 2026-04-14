/**
 * /api/admin/user-actions — user management operations
 *
 * POST body: { action, ...params }
 *   action: 'invite'  — { email, role }
 *   action: 'add'     — { email, role, password, firstName?, lastName? }
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
  | { action: 'add';            email: string; role: string; password: string; firstName?: string; lastName?: string }
  | { action: 'delete';         userId: string }
  | { action: 'ban';            userId: string }
  | { action: 'unban';          userId: string }
  | { action: 'reset_password'; userId: string };

type ClerkUser = {
  id: string;
  public_metadata?: Record<string, unknown>;
};

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

function getRole(user: ClerkUser): string {
  return (user.public_metadata?.role as string | undefined) ?? 'user';
}

async function getClerkUser(secretKey: string, userId: string): Promise<ClerkUser> {
  return await clerkRequest(secretKey, 'GET', `/users/${userId}`) as ClerkUser;
}

async function countAdmins(secretKey: string): Promise<number> {
  const users = await clerkRequest(secretKey, 'GET', '/users?limit=500') as ClerkUser[];
  return users.filter(u => getRole(u) === 'admin').length;
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
        const validRoles = ['admin', 'support', 'user'];
        if (!validRoles.includes(role)) return res.status(400).json({ error: `role must be admin, support, or user` });

        await clerkRequest(secretKey, 'POST', '/invitations', {
          email_address:   email,
          public_metadata: { role },
          redirect_url:    process.env.ADMIN_URL ?? 'https://admin.nauticshield.io',
        });

        await writeAudit({ actor: admin.userId, action: 'team.invite', resource: email, metadata: { role } }, req);
        return res.json({ ok: true, message: `Invitation sent to ${email}` });
      }

      case 'add': {
        const { email, role, password, firstName, lastName } = body;
        if (!email) return res.status(400).json({ error: 'email required' });
        if (!password || password.length < 8) return res.status(400).json({ error: 'password must be at least 8 characters' });

        const validRoles = ['admin', 'support', 'user'];
        if (!validRoles.includes(role)) return res.status(400).json({ error: `role must be admin, support, or user` });

        const created = await clerkRequest(secretKey, 'POST', '/users', {
          email_address: [email],
          password,
          first_name: firstName?.trim() || undefined,
          last_name:  lastName?.trim()  || undefined,
          public_metadata: { role },
        }) as { id: string; email_addresses?: Array<{ email_address: string }> };

        await writeAudit({
          actor: admin.userId,
          action: 'team.add',
          resource: created.id,
          metadata: { email, role },
        }, req);

        return res.status(201).json({ ok: true, userId: created.id, message: `User created: ${email}` });
      }

      case 'delete': {
        const { userId } = body;
        if (!userId) return res.status(400).json({ error: 'userId required' });
        if (userId === admin.userId) return res.status(400).json({ error: 'Cannot delete your own account' });

        const target = await getClerkUser(secretKey, userId);
        if (getRole(target) === 'admin') {
          const adminCount = await countAdmins(secretKey);
          if (adminCount <= 1) {
            return res.status(400).json({ error: 'Cannot delete the last admin account' });
          }
        }

        await clerkRequest(secretKey, 'DELETE', `/users/${userId}`);
        await writeAudit({ actor: admin.userId, action: 'team.delete', resource: userId, metadata: {} }, req);
        return res.json({ ok: true });
      }

      case 'ban': {
        const { userId } = body;
        if (!userId) return res.status(400).json({ error: 'userId required' });
        if (userId === admin.userId) return res.status(400).json({ error: 'Cannot ban yourself' });

        const target = await getClerkUser(secretKey, userId);
        if (getRole(target) === 'admin') {
          const adminCount = await countAdmins(secretKey);
          if (adminCount <= 1) {
            return res.status(400).json({ error: 'Cannot pause the last admin account' });
          }
        }

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
