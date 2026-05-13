/// <reference types="node" />
/**
 * alertEngine.ts
 * Called after every scan cycle. Checks for alarm conditions and
 * inserts / auto-resolves alerts with deduplication via fingerprints.
 *
 * Fingerprint format: <category>:<subkey>
 * e.g.  device:offline:AA:BB:CC:DD:EE:FF
 *       internet:down
 *       internet:high-latency
 *       device:unknown:AA:BB:CC:DD:EE:FF
 */

import { v4 as uuidv4 } from 'uuid';
import type { Alert, InternetStatus } from './types';
import * as db from './db';
import { broadcast } from './broadcaster';
import { notify } from './notifier';
import type { NotificationCategory } from './db';
import { formatPlaybookForAlert, recommendedActionsForFinding } from './cyberPlaybooks';

const HIGH_LATENCY_MS = parseInt(process.env.HIGH_LATENCY_THRESHOLD_MS ?? '200', 10);
const OFFLINE_GRACE_S = parseInt(process.env.OFFLINE_GRACE_SECONDS      ?? '90',  10);
const UNKNOWN_ALERT_COOLDOWN_MS = parseInt(process.env.UNKNOWN_ALERT_COOLDOWN_MINUTES ?? '30', 10) * 60_000;
const OFFLINE_ALERT_REOPEN_MS = parseInt(process.env.OFFLINE_ALERT_REOPEN_MINUTES ?? '10', 10) * 60_000;
const UNKNOWN_DEVICE_SPIKE_THRESHOLD = parseInt(process.env.UNKNOWN_DEVICE_SPIKE_THRESHOLD ?? '3', 10);
const ALERT_MIN_OPEN_MS = parseInt(process.env.ALERT_MIN_OPEN_SECONDS ?? '90', 10) * 1000;
const INTERNET_DOWN_TRIGGER_CYCLES = parseInt(process.env.INTERNET_DOWN_TRIGGER_CYCLES ?? '2', 10);
const INTERNET_DOWN_CLEAR_CYCLES = parseInt(process.env.INTERNET_DOWN_CLEAR_CYCLES ?? '2', 10);
const HIGH_LATENCY_TRIGGER_CYCLES = parseInt(process.env.HIGH_LATENCY_TRIGGER_CYCLES ?? '2', 10);
const HIGH_LATENCY_CLEAR_CYCLES = parseInt(process.env.HIGH_LATENCY_CLEAR_CYCLES ?? '2', 10);
const DEVICE_OFFLINE_TRIGGER_CYCLES = parseInt(process.env.DEVICE_OFFLINE_TRIGGER_CYCLES ?? '2', 10);
const DEVICE_ONLINE_CLEAR_CYCLES = parseInt(process.env.DEVICE_ONLINE_CLEAR_CYCLES ?? '2', 10);

let internetDownStreak = 0;
let internetUpStreak = 0;
let highLatencyStreak = 0;
let normalLatencyStreak = 0;

const deviceOfflineStreak = new Map<string, number>();
const deviceOnlineStreak = new Map<string, number>();

// ── Helper ────────────────────────────────────────────────────────

// Map fingerprint prefix → notification category
function categoryFromFingerprint(fp: string): NotificationCategory | null {
  if (fp.startsWith('internet:down'))         return 'internet_down';
  if (fp.startsWith('device:unknown'))        return 'new_device';
  if (fp.startsWith('network:port-scan'))     return 'port_scan';
  if (fp.startsWith('cyber:critical'))        return 'cyber_critical';
  if (fp.startsWith('network:device-spike'))  return 'device_spike';
  if (fp.startsWith('network:unknown-spike')) return 'device_spike';
  return null;
}

function fire(
  fingerprint: string,
  severity: Alert['severity'],
  title: string,
  description: string,
): void {
  // Don't open a duplicate for an already-open alert
  if (db.getOpenAlertByFingerprint(fingerprint)) return;

  const alert: Alert & { fingerprint: string } = {
    id:          uuidv4(),
    severity,
    title,
    description,
    timestamp:   new Date().toISOString(),
    resolved:    false,
    fingerprint,
  };
  db.addAlert(alert);
  broadcast({ type: 'alert:new', data: alert });
  console.log(`[Alert] 🔔 ${severity.toUpperCase()} — ${title}`);

  // Send notification (non-blocking, non-fatal)
  const category = categoryFromFingerprint(fingerprint);
  if (category) {
    notify({ category, subject: `NauticShield Alert: ${title}`, body: description })
      .catch(() => { /* already logged inside notifier */ });
  }
}

function clear(fingerprint: string, reason: string): void {
  clearWithOptions(fingerprint, reason);
}

function clearWithOptions(
  fingerprint: string,
  reason: string,
  options: { minOpenMs?: number } = {},
): void {
  const existing = db.getOpenAlertByFingerprint(fingerprint);
  if (!existing) return;

  const minOpenMs = options.minOpenMs ?? ALERT_MIN_OPEN_MS;
  const openedAtMs = Date.parse(existing.timestamp);
  if (!Number.isNaN(openedAtMs) && Date.now() - openedAtMs < minOpenMs) {
    return;
  }

  db.autoResolveByFingerprint(fingerprint);
  broadcast({ type: 'alert:resolve', data: { id: existing.id } });
  console.log(`[Alert] ✅ Resolved — ${reason}`);
}

function shouldThrottleByFingerprint(fingerprint: string, cooldownMs: number): boolean {
  const last = db.getLatestAlertTimestampByFingerprint(fingerprint);
  if (!last) return false;
  const lastMs = Date.parse(last);
  if (Number.isNaN(lastMs)) return false;
  return Date.now() - lastMs < cooldownMs;
}

// ── Checks ────────────────────────────────────────────────────────

export function checkInternetAlerts(status: InternetStatus): void {
  const isDown = status.status === 'down';
  const isHighLatency = status.status !== 'down' && status.latencyMs > HIGH_LATENCY_MS;

  if (isDown) {
    internetDownStreak += 1;
    internetUpStreak = 0;
  } else {
    internetUpStreak += 1;
    internetDownStreak = 0;
  }

  if (isHighLatency) {
    highLatencyStreak += 1;
    normalLatencyStreak = 0;
  } else {
    normalLatencyStreak += 1;
    highLatencyStreak = 0;
  }

  // 1. Internet down
  if (internetDownStreak >= INTERNET_DOWN_TRIGGER_CYCLES) {
    fire(
      'internet:down',
      'critical',
      'Internet connection lost',
      `${status.provider} is unreachable. Vessel is offline.`,
    );
  } else if (internetUpStreak >= INTERNET_DOWN_CLEAR_CYCLES) {
    clearWithOptions('internet:down', 'Internet restored');
  }

  // 2. High latency
  if (highLatencyStreak >= HIGH_LATENCY_TRIGGER_CYCLES) {
    fire(
      'internet:high-latency',
      'warning',
      `High internet latency — ${status.latencyMs} ms`,
      `Latency on ${status.provider} is above ${HIGH_LATENCY_MS} ms threshold. Streaming and VoIP may be affected.`,
    );
  } else if (normalLatencyStreak >= HIGH_LATENCY_CLEAR_CYCLES) {
    clearWithOptions('internet:high-latency', `Latency normalised (${status.latencyMs} ms)`);
  }
}

function ipInSubnet(ip: string, subnet: string): boolean {
  return ip.startsWith(`${subnet}.`);
}

export function checkDeviceAlerts(scope?: { mode?: 'auto' | 'fixed' | 'all'; activeSubnet?: string }): void {
  const devices = db.getDevices();
  const graceISO = new Date(Date.now() - OFFLINE_GRACE_S * 1000).toISOString();
  const activeSubnet = scope?.activeSubnet;
  const isScopedMode = scope?.mode === 'auto' || scope?.mode === 'fixed';
  const unknownDevices = devices.filter(d => d.type === 'unknown' && (!activeSubnet || ipInSubnet(d.ip, activeSubnet)));

  for (const device of devices) {
    if (isScopedMode && activeSubnet && !ipInSubnet(device.ip, activeSubnet)) {
      continue;
    }

    const offlineFp  = `device:offline:${device.mac}`;
    const unknownFp  = `device:unknown:${device.mac}`;

    // 3. Device offline (only after grace period — avoids spurious scan-gap alerts)
    if (device.status === 'offline' && device.lastSeen < graceISO) {
      const current = (deviceOfflineStreak.get(device.mac) ?? 0) + 1;
      deviceOfflineStreak.set(device.mac, current);
      deviceOnlineStreak.set(device.mac, 0);

      if (current >= DEVICE_OFFLINE_TRIGGER_CYCLES && !shouldThrottleByFingerprint(offlineFp, OFFLINE_ALERT_REOPEN_MS)) {
        fire(
          offlineFp,
          'warning',
          `${device.name} went offline`,
          `${device.name} (${device.ip}) has not been seen since ${new Date(device.lastSeen).toLocaleTimeString()}.`,
        );
      }
    } else if (device.status === 'online') {
      const current = (deviceOnlineStreak.get(device.mac) ?? 0) + 1;
      deviceOnlineStreak.set(device.mac, current);
      deviceOfflineStreak.set(device.mac, 0);

      if (current >= DEVICE_ONLINE_CLEAR_CYCLES) {
        clearWithOptions(offlineFp, `${device.name} is back online`);
      }
    } else {
      deviceOnlineStreak.set(device.mac, 0);
      deviceOfflineStreak.set(device.mac, 0);
    }

    // 4. Unknown device on the network (never-before-classified)
    if (device.type === 'unknown') {
      if (!shouldThrottleByFingerprint(unknownFp, UNKNOWN_ALERT_COOLDOWN_MS)) {
        const firstSeen = !db.getLatestAlertTimestampByFingerprint(unknownFp);
        fire(
          unknownFp,
          firstSeen ? 'critical' : 'warning',
          `Unknown device on network — ${device.ip}`,
          `Unrecognised device (MAC: ${device.mac}) detected on the vessel network. Identify and label it via the Devices page.`,
        );
      }
    } else {
      // Once crew label the device type it's no longer unknown — clear the alert
      clear(unknownFp, `${device.name} has been identified`);
    }
  }

  // 5. Aggregate unknown-device spike for quick operator awareness
  const unknownSpikeFp = 'network:unknown-spike';
  if (unknownDevices.length >= UNKNOWN_DEVICE_SPIKE_THRESHOLD) {
    fire(
      unknownSpikeFp,
      'warning',
      `Unknown-device spike — ${unknownDevices.length} active`,
      `There are currently ${unknownDevices.length} unidentified devices on the network. Review and label or isolate from the Devices page.`,
    );
  } else {
    clear(unknownSpikeFp, `Unknown-device count normal (${unknownDevices.length})`);
  }
}

export function checkNetworkHealthAlert(): void {
  const health = db.getNetworkHealth();
  if (!health) return;

  const fp = 'network:low-score';
  if (health.score < 60) {
    fire(
      fp,
      'warning',
      `Network health is degraded — score ${health.score}/100`,
      `${health.offlineDevices} of ${health.totalDevices} devices are offline and ${health.unknownDevices} are unidentified.`,
    );
  } else {
    clear(fp, `Network health recovered (${health.score}/100)`);
  }
}

// ── Main entry point ──────────────────────────────────────────────

export function runAlertEngine(
  internetStatus: InternetStatus,
  scope?: { mode?: 'auto' | 'fixed' | 'all'; activeSubnet?: string },
): void {
  checkInternetAlerts(internetStatus);
  checkDeviceAlerts(scope);
  checkNetworkHealthAlert();
}

// ── Cyber findings alerts ─────────────────────────────────────────

/**
 * Called after any cyber assessment completes or a finding is updated.
 * Fires a cyber:critical alert for every unresolved 'fail' finding,
 * and clears the alert immediately when the finding is remediated.
 */
export function checkCyberFindings(findings: db.CyberFinding[]): void {
  for (const f of findings) {
    const fp = `cyber:critical:${f.id}`;
    const isActive = ['open', 'investigating', 'in_progress'].includes(f.findingStatus);
    if (f.status === 'fail' && isActive) {
      const actions = recommendedActionsForFinding(f);
      fire(
        fp,
        'critical',
        `Critical cyber risk — ${f.check_name}`,
        `${f.detail} Immediate actions: ${formatPlaybookForAlert(actions)} Open the Cyber page for full remediation notes.`,
      );
    } else if (f.findingStatus === 'remediated' || f.findingStatus === 'accepted_risk') {
      clearWithOptions(fp, `${f.check_name} has been remediated`, { minOpenMs: 0 });
    }
  }
}
