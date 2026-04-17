/**
 * Cloud sync — pushes a vessel snapshot to the NauticShield cloud API
 * whenever internet connectivity is available.
 *
 * Enabled by setting CLOUD_SYNC_URL and CLOUD_API_KEY in the agent .env.
 * Safe to leave unset — all sync calls are no-ops when unconfigured.
 *
 * Sync payload:  full snapshot of devices, alerts, internet_status,
 *                network_health, and recent voyage_log entries.
 *
 * Retry behaviour:
 *   - Runs on a timer (SYNC_INTERVAL_MS, default 5 min)
 *   - If a push fails (no internet), it silently retries on the next tick
 *   - No data is lost — the local SQLite is always the source of truth
 */

import * as db from './db';
import { getAgentConfig } from './config';
import { applyGuestNetworkSettings } from './routerController';

const SYNC_MS    = parseInt(process.env.SYNC_INTERVAL_MS ?? '300000', 10); // 5 min default

// Track whether we've ever synced — used to log on first success
let lastSyncAt: string | null = null;
let consecutiveFailures = 0;

/** Build the full snapshot payload from SQLite. */
function buildPayload() {
  const config = getAgentConfig();
  return {
    vesselId:       config.vesselId,
    syncedAt:       new Date().toISOString(),
    devices:        db.getDevices(),
    alerts:         db.getAlerts(),
    internetStatus: db.getInternetStatus() ?? null,
    networkHealth:  db.getNetworkHealth()  ?? null,
    voyageLog:      db.getVoyageLog(),
    cyberAssessments: db.listAssessments(),
    cyberFindings:    db.listFindings(),
  };
}

/** Push one snapshot to the cloud. Throws on failure. */
async function pushSnapshot(): Promise<void> {
  const config = getAgentConfig();
  const cloudUrl = config.cloudSyncUrl.replace(/\/$/, '');
  const cloudKey = config.cloudApiKey;
  if (!cloudUrl || !cloudKey) return; // sync not configured

  const payload = buildPayload();

  const res = await fetch(`${cloudUrl}/api/sync`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${cloudKey}`,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000), // 15s timeout
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Cloud sync HTTP ${res.status}: ${text.slice(0, 120)}`);
  }

  lastSyncAt = new Date().toISOString();
  consecutiveFailures = 0;
  console.log(`[sync] pushed snapshot to cloud at ${lastSyncAt}`);
}

async function pullCloudConfig(): Promise<void> {
  const config = getAgentConfig();
  const cloudUrl = config.cloudSyncUrl.replace(/\/$/, '');
  const cloudKey = config.cloudApiKey;
  if (!cloudUrl || !cloudKey) return;

  const res = await fetch(`${cloudUrl}/api/agent/config`, {
    headers: { Authorization: `Bearer ${cloudKey}` },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Cloud config HTTP ${res.status}: ${text.slice(0, 120)}`);
  }

  const payload = await res.json() as { guestNetwork?: db.GuestNetworkSettings | null };
  if (!payload.guestNetwork) return;

  const local = db.getGuestNetworkSettings();
  if ((payload.guestNetwork.updatedAt ?? '') <= (local.updatedAt ?? '')) return;

  const saved = db.setGuestNetworkSettings(payload.guestNetwork);
  await applyGuestNetworkSettings(saved, db.getDevices()).catch(err => {
    console.warn('[sync] guest network reconcile failed:', (err as Error).message);
  });
  console.log('[sync] pulled newer guest-network configuration from cloud');
}

/** Run one sync attempt, logging failures without crashing. */
async function syncOnce(): Promise<void> {
  try {
    await pushSnapshot();
    await pullCloudConfig();
  } catch (err) {
    consecutiveFailures++;
    // Only log the first failure and every 12th after that (i.e. every hour at 5-min intervals)
    // to avoid flooding logs when the vessel is offline for a long time.
    if (consecutiveFailures === 1 || consecutiveFailures % 12 === 0) {
      console.warn(`[sync] cloud push failed (attempt ${consecutiveFailures}):`, (err as Error).message);
    }
  }
}

/** Start the background sync timer. Call once on agent startup. */
export function startCloudSync(): void {
  const config = getAgentConfig();
  if (!config.cloudSyncUrl || !config.cloudApiKey) {
    console.log('[sync] CLOUD_SYNC_URL / CLOUD_API_KEY not set — cloud sync disabled');
    return;
  }

  console.log(`[sync] cloud sync enabled → ${config.cloudSyncUrl} every ${SYNC_MS / 1000}s`);

  // Push immediately on startup, then on interval
  syncOnce();
  setInterval(syncOnce, SYNC_MS);
}

/** Returns the last successful sync time (for the /api/health endpoint). */
export function getLastSyncAt(): string | null {
  return lastSyncAt;
}
