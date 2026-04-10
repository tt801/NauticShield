/**
 * GET /api/admin/audit — paginated audit log
 *
 * Query params: limit (default 50), offset (default 0), action (filter), org_id (filter)
 * Requires admin Clerk JWT.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase }       from '../../lib/supabase';
import { verifyAdminJWT } from '../../lib/adminAuth';
import { cors }           from '../../lib/cors';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const admin = await verifyAdminJWT(req);
  if (!admin) return res.status(401).json({ error: 'Admin access required' });

  const limit  = Math.min(Number(req.query.limit  ?? 50), 200);
  const offset = Number(req.query.offset ?? 0);

  let query = supabase
    .from('audit_log')
    .select('id, org_id, actor, action, resource, metadata, ip, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (req.query.action) query = query.eq('action',  req.query.action as string);
  if (req.query.org_id) query = query.eq('org_id',  req.query.org_id as string);

  const { data, error, count } = await query;
  if (error) return res.status(500).json({ error: error.message });

  return res.json({ total: count ?? 0, rows: data ?? [] });
}
