/**
 * POST /api/vessels  — create a new vessel (Clerk org) for the authenticated user.
 *
 * Quota enforcement:
 *   - Source of truth:  user.publicMetadata.maxVessels  (written only by this server)
 *   - Default:          1  (covers Basic plan / first vessel)
 *   - Plans:            Basic=1, Pro=3, Enterprise=unlimited (999)
 *   - Stripe webhook will call PATCH /api/vessels/quota to update maxVessels when subscriptions change.
 *
 * Why server-side?
 *   The frontend previously called Clerk's createOrganization() directly, which means any
 *   user could create unlimited orgs by bypassing the UI.  By routing creation through here
 *   we can enforce the quota before any org is created, and the check cannot be bypassed.
 */

import { Router }       from 'express';
import { createClerkClient } from '@clerk/backend';
import type { AuthedRequest } from '../auth';

const router = Router();

// ── helpers ──────────────────────────────────────────────────────

function getClerk() {
  const key = process.env.CLERK_SECRET_KEY;
  if (!key) throw new Error('CLERK_SECRET_KEY not set');
  return createClerkClient({ secretKey: key });
}

/** Max vessels allowed for a given plan slug. */
function maxVesselsForPlan(plan: string): number {
  switch (plan) {
    case 'pro':        return 3;
    case 'enterprise': return 999;
    default:           return 1;   // 'basic' or unset
  }
}

// ── POST /api/vessels ─────────────────────────────────────────────

/**
 * Body: { name: string }
 * Creates a new Clerk org named `name`, adds the calling user as admin,
 * and returns { orgId, orgName, maxVessels, currentVessels }.
 */
router.post('/', async (req: AuthedRequest, res) => {
  const userId = req.auth?.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthenticated' });

  const name = (req.body?.name ?? '').trim();
  if (!name) return res.status(400).json({ error: 'Vessel name is required' });

  const clerk = getClerk();

  // 1. Fetch user to read publicMetadata (quota + plan)
  const user = await clerk.users.getUser(userId);
  const meta = (user.publicMetadata ?? {}) as Record<string, unknown>;
  const plan  = typeof meta.plan === 'string' ? meta.plan : 'basic';
  const maxVessels = typeof meta.maxVessels === 'number'
    ? meta.maxVessels
    : maxVesselsForPlan(plan);

  // 2. Count current org memberships
  const { data: memberships } = await clerk.users.getOrganizationMembershipList({ userId });
  const currentVessels = memberships.length;

  if (currentVessels >= maxVessels) {
    return res.status(402).json({
      error: 'vessel_limit_reached',
      message: `Your ${plan} plan allows ${maxVessels} vessel${maxVessels === 1 ? '' : 's'}. Upgrade your plan to add more.`,
      currentVessels,
      maxVessels,
      plan,
    });
  }

  // 3. Create the org
  const org = await clerk.organizations.createOrganization({
    name,
    createdBy: userId,
  });

  return res.status(201).json({
    orgId:          org.id,
    orgName:        org.name,
    currentVessels: currentVessels + 1,
    maxVessels,
    plan,
  });
});

// ── GET /api/vessels/quota ────────────────────────────────────────

/** Returns the calling user's current vessel count and limit — used by the UI. */
router.get('/quota', async (req: AuthedRequest, res) => {
  const userId = req.auth?.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthenticated' });

  const clerk = getClerk();
  const user  = await clerk.users.getUser(userId);
  const meta  = (user.publicMetadata ?? {}) as Record<string, unknown>;
  const plan  = typeof meta.plan === 'string' ? meta.plan : 'basic';
  const maxVessels = typeof meta.maxVessels === 'number'
    ? meta.maxVessels
    : maxVesselsForPlan(plan);

  const { data: memberships } = await clerk.users.getOrganizationMembershipList({ userId });

  return res.json({
    plan,
    currentVessels: memberships.length,
    maxVessels,
  });
});

// ── PATCH /api/vessels/quota ──────────────────────────────────────

/**
 * Called by Stripe webhook (or admin tools) to update a user's plan quota.
 * Body: { userId: string, plan: string, maxVessels?: number }
 * Requires a shared webhook secret in the Authorization header.
 */
router.patch('/quota', async (req, res) => {
  const secret = process.env.QUOTA_WEBHOOK_SECRET;
  if (secret) {
    const auth = req.headers['authorization'] ?? '';
    if (auth !== `Bearer ${secret}`) {
      return res.status(401).json({ error: 'Invalid webhook secret' });
    }
  }

  const { userId, plan, maxVessels } = req.body as {
    userId?: string; plan?: string; maxVessels?: number;
  };
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const clerk = getClerk();
  await clerk.users.updateUser(userId, {
    publicMetadata: {
      plan:        plan        ?? 'basic',
      maxVessels:  maxVessels  ?? maxVesselsForPlan(plan ?? 'basic'),
    },
  });

  return res.json({ ok: true });
});

export default router;
