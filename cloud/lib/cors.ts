import type { VercelRequest, VercelResponse } from '@vercel/node';

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:5174',
  'https://nautic-shield.vercel.app',
  'https://nautic-shield-app.vercel.app',
  'https://nautic-shield-admin.vercel.app',
  // Marketing site — add exact Vercel URL and custom domain when known
  'https://nautic-shield-marketing.vercel.app',
  'https://nauticshield.com',
  'https://www.nauticshield.com',
];

// Allow any Vercel preview deployment for the NauticShield org
const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/nautic-shield[a-z0-9-]*\.vercel\.app$/,
];

/**
 * Sets CORS headers and handles preflight OPTIONS requests.
 * Returns true if the request was a preflight (caller should return immediately).
 */
export function cors(req: VercelRequest, res: VercelResponse): boolean {
  const origin = req.headers.origin ?? '';
  const isAllowed = ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGIN_PATTERNS.some(p => p.test(origin));
  const allow = isAllowed ? origin : ALLOWED_ORIGINS[0];

  res.setHeader('Access-Control-Allow-Origin',  allow);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age',       '86400');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}
