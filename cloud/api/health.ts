import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.json({
    status:  'ok',
    service: 'nauticshield-cloud-api',
    version: '1.0.1',
    ts:      new Date().toISOString(),
  });
}
