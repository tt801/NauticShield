/**
 * POST /api/admin/shell-token — issue a short-lived relay auth token
 * Body: { vesselId: string }
 *
 * Returns an HMAC-signed token valid for ~30 seconds that the admin
 * browser uses to authenticate with the relay WebSocket server.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAdminJWT } from '../../lib/adminAuth';
import { cors }           from '../../lib/cors';
import crypto             from 'crypto';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const admin = await verifyAdminJWT(req);
  if (!admin) return res.status(401).json({ error: 'Admin access required' });

  const relaySecret = process.env.RELAY_SECRET;
  if (!relaySecret) return res.status(503).json({ error: 'Shell relay not configured' });

  const vesselId = (req.body as { vesselId?: string })?.vesselId;
  if (!vesselId) return res.status(400).json({ error: 'vesselId required' });

  const w     = Math.floor(Date.now() / 30000);
  const token = crypto
    .createHmac('sha256', relaySecret)
    .update(`${vesselId}:admin:${w}`)
    .digest('hex');

  return res.json({ token, vesselId, expiresIn: 30 });
}
