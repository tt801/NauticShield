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

const HIGH_LATENCY_MS = parseInt(process.env.HIGH_LATENCY_THRESHOLD_MS ?? '200', 10);
const OFFLINE_GRACE_S = parseInt(process.env.OFFLINE_GRACE_SECONDS      ?? '90',  10);

// ── Helper ────────────────────────────────────────────────────────

// Map fingerprint prefix → notification category
function categoryFromFingerprint(fp: string): NotificationCategory | null {
  if (fp.startsWith('internet:down'))         return 'internet_down';
  if (fp.startsWith('device:unknown'))        return 'new_device';
  if (fp.startsWith('network:port-scan'))     return 'port_scan';
  if (fp.startsWith('cyber:critical'))        return 'cyber_critical';
  if (fp.startsWith('network:device-spike'))  return 'device_spike';
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
  const existing = db.getOpenAlertByFingerprint(fingerprint);
  if (!existing) return;
  db.autoResolveByFingerprint(fingerprint);
  broadcast({ type: 'alert:resolve', data: { id: existing.id } });
  console.log(`[Alert] ✅ Resolved — ${reason}`);
}

// ── Checks ────────────────────────────────────────────────────────

export function checkInternetAlerts(status: InternetStatus): void {
  // 1. Internet down
  if (status.status === 'down') {
    fire(
      'internet:down',
      'critical',
      'Internet connection lost',
      `${status.provider} is unreachable. Vessel is offline.`,
    );
  } else {
    clear('internet:down', 'Internet restored');
  }

  // 2. High latency
  if (status.status !== 'down' && status.latencyMs > HIGH_LATENCY_MS) {
    fire(
      'internet:high-latency',
      'warning',
      `High internet latency — ${status.latencyMs} ms`,
      `Latency on ${status.provider} is above ${HIGH_LATENCY_MS} ms threshold. Streaming and VoIP may be affected.`,
    );
  } else {
    clear('internet:high-latency', `Latency normalised (${status.latencyMs} ms)`);
  }
}

export function checkDeviceAlerts(): void {
  const devices = db.getDevices();
  const graceISO = new Date(Date.now() - OFFLINE_GRACE_S * 1000).toISOString();

  for (const device of devices) {
    const offlineFp  = `device:offline:${device.mac}`;
    const unknownFp  = `device:unknown:${device.mac}`;

    // 3. Device offline (only after grace period — avoids spurious scan-gap alerts)
    if (device.status === 'offline' && device.lastSeen < graceISO) {
      fire(
        offlineFp,
        'warning',
        `${device.name} went offline`,
        `${device.name} (${device.ip}) has not been seen since ${new Date(device.lastSeen).toLocaleTimeString()}.`,
      );
    } else if (device.status === 'online') {
      clear(offlineFp, `${device.name} is back online`);
    }

    // 4. Unknown device on the network (never-before-classified)
    if (device.type === 'unknown') {
      fire(
        unknownFp,
        'critical',
        `Unknown device on network — ${device.ip}`,
        `Unrecognised device (MAC: ${device.mac}) detected on the vessel network. Identify and label it via the Devices page.`,
      );
    } else {
      // Once crew label the device type it's no longer unknown — clear the alert
      clear(unknownFp, `${device.name} has been identified`);
    }
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

export function runAlertEngine(internetStatus: InternetStatus): void {
  checkInternetAlerts(internetStatus);
  checkDeviceAlerts();
  checkNetworkHealthAlert();
}
