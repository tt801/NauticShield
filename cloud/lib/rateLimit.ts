/**
 * In-memory rate limiter for serverless functions.
 * Uses a sliding window counter keyed by IP.
 *
 * NOTE: Each Vercel function instance has its own memory, so this is
 * best-effort — it prevents accidental hammering but is not a hard cap.
 * For a hard cap, replace with a Redis/Upstash backed implementation later.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface Window { count: number; resetAt: number }
const store = new Map<string, Window>();

/**
 * Returns true (and sends 429) if the request exceeds the rate limit.
 * @param req       Vercel request
 * @param res       Vercel response
 * @param limit     Max requests per window (default 60)
 * @param windowMs  Window size in ms (default 60 000 — 1 minute)
 */
export function rateLimit(
  req: VercelRequest,
  res: VercelResponse,
  limit   = 60,
  windowMs = 60_000,
): boolean {
  const ip = (req.headers['x-forwarded-for'] as string | undefined)
    ?.split(',')[0].trim() ?? 'unknown';

  const now = Date.now();
  let win = store.get(ip);

  if (!win || now > win.resetAt) {
    win = { count: 1, resetAt: now + windowMs };
    store.set(ip, win);
    return false;
  }

  win.count++;
  if (win.count > limit) {
    res.setHeader('Retry-After', String(Math.ceil((win.resetAt - now) / 1000)));
    res.status(429).json({ error: 'Too many requests' });
    return true;
  }
  return false;
}
