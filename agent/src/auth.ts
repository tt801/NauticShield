import type { Request, Response, NextFunction } from 'express';
import { createClerkClient, verifyToken } from '@clerk/backend';
import type { RateLimitRequestHandler } from 'express-rate-limit';

// ── Clerk client ──────────────────────────────────────────────────

const CLERK_SECRET = process.env.CLERK_SECRET_KEY;
const clerk = CLERK_SECRET ? createClerkClient({ secretKey: CLERK_SECRET }) : null;

// ── Extend Request to carry auth info ────────────────────────────

export interface AuthedRequest extends Request {
  auth?: {
    userId:  string;
    role:    string;
    orgId:   string | null;
    email:   string | null;
  };
}

// ── Map Clerk org role slug → internal role name ─────────────────

function mapRole(clerkRole: string | undefined): string {
  switch (clerkRole) {
    case 'org:admin':   return 'owner';
    case 'org:captain': return 'captain';
    case 'org:it_tech': return 'it_tech';
    case 'org:member':  return 'crew';
    default:            return 'crew';
  }
}

// ── JWT verification middleware ───────────────────────────────────
// When CLERK_SECRET_KEY is not set (dev mode), skips auth entirely.

export async function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Dev mode — no Clerk key configured
  if (!clerk) {
    req.auth = { userId: 'dev', role: 'owner', orgId: null, email: null };
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Bearer token' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = await verifyToken(token, { secretKey: CLERK_SECRET! });
    const memberships = await clerk.users.getOrganizationMembershipList({
      userId: payload.sub,
    });
    const orgId = (payload as Record<string, unknown>).org_id as string | null ?? null;
    const membership = memberships.data.find(m => m.organization.id === orgId);
    const role = mapRole(membership?.role);

    const user = await clerk.users.getUser(payload.sub);
    const email = user.emailAddresses[0]?.emailAddress ?? null;

    req.auth = { userId: payload.sub, role, orgId, email };
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ── Role guard factory ────────────────────────────────────────────

const ROLE_HIERARCHY: Record<string, number> = {
  owner: 4, captain: 3, it_tech: 2, crew: 1,
};

export function requireRole(...allowed: string[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    const role = req.auth?.role ?? 'crew';
    if (allowed.includes(role)) {
      next();
    } else {
      res.status(403).json({ error: `Role '${role}' is not permitted for this action` });
    }
  };
}

export function requireMinRole(minRole: string) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    const role       = req.auth?.role ?? 'crew';
    const userLevel  = ROLE_HIERARCHY[role]    ?? 0;
    const minLevel   = ROLE_HIERARCHY[minRole] ?? 99;
    if (userLevel >= minLevel) {
      next();
    } else {
      res.status(403).json({ error: `Requires at least '${minRole}' role` });
    }
  };
}

// ── Rate limiter factory (imported lazily to avoid hard dep) ─────

let _rateLimit: ((opts: Record<string, unknown>) => RateLimitRequestHandler) | null = null;

async function getRateLimiter() {
  if (!_rateLimit) {
    const mod = await import('express-rate-limit');
    _rateLimit = mod.default as unknown as typeof _rateLimit;
  }
  return _rateLimit!;
}

export async function makeRateLimiter(windowMs: number, max: number) {
  const rateLimit = await getRateLimiter();
  return rateLimit({ windowMs, max, standardHeaders: true, legacyHeaders: false });
}
