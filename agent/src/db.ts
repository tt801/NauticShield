// node:sqlite is built into Node.js 22.5+ — no native addon compilation needed.
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import type { Device, Alert, InternetStatus, NetworkHealth } from './types';

const DB_PATH = process.env.DB_PATH ?? './data/vessel.db';

// Ensure the data directory exists
const dir = path.dirname(path.resolve(DB_PATH));
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL'); // better concurrent performance

// ── Schema ────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS devices (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    type         TEXT NOT NULL DEFAULT 'unknown',
    status       TEXT NOT NULL DEFAULT 'unknown',
    ip           TEXT NOT NULL,
    mac          TEXT NOT NULL UNIQUE,
    lastSeen     TEXT NOT NULL,
    manufacturer TEXT,
    location     TEXT,
    updatedAt    TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS alerts (
    id          TEXT PRIMARY KEY,
    severity    TEXT NOT NULL,
    title       TEXT NOT NULL,
    description TEXT NOT NULL,
    timestamp   TEXT NOT NULL,
    resolved    INTEGER NOT NULL DEFAULT 0,
    resolvedAt  TEXT
  );

  CREATE TABLE IF NOT EXISTS internet_status (
    id           INTEGER PRIMARY KEY CHECK (id = 1),
    status       TEXT NOT NULL DEFAULT 'down',
    provider     TEXT NOT NULL DEFAULT 'None',
    downloadMbps REAL NOT NULL DEFAULT 0,
    uploadMbps   REAL NOT NULL DEFAULT 0,
    latencyMs    REAL NOT NULL DEFAULT 0,
    uptime       TEXT NOT NULL DEFAULT '0%',
    updatedAt    TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS network_health (
    id             INTEGER PRIMARY KEY CHECK (id = 1),
    score          INTEGER NOT NULL DEFAULT 0,
    activeDevices  INTEGER NOT NULL DEFAULT 0,
    totalDevices   INTEGER NOT NULL DEFAULT 0,
    unknownDevices INTEGER NOT NULL DEFAULT 0,
    offlineDevices INTEGER NOT NULL DEFAULT 0,
    updatedAt      TEXT NOT NULL
  );
`);

// ── Devices ───────────────────────────────────────────────────────

export function getDevices(): Device[] {
  return db.prepare('SELECT * FROM devices ORDER BY name').all() as Device[];
}

export function getDeviceById(id: string): Device | undefined {
  return db.prepare('SELECT * FROM devices WHERE id = ?').get(id) as Device | undefined;
}

export function getDeviceByMac(mac: string): Device | undefined {
  return db.prepare('SELECT * FROM devices WHERE mac = ?').get(mac) as Device | undefined;
}

export function upsertDevice(device: Device): void {
  const now = new Date().toISOString();
  // node:sqlite doesn't accept undefined — coerce optional fields to null
  db.prepare(`
    INSERT INTO devices (id, name, type, status, ip, mac, lastSeen, manufacturer, location, updatedAt)
    VALUES (@id, @name, @type, @status, @ip, @mac, @lastSeen, @manufacturer, @location, @updatedAt)
    ON CONFLICT(mac) DO UPDATE SET
      ip        = excluded.ip,
      status    = excluded.status,
      lastSeen  = excluded.lastSeen,
      updatedAt = excluded.updatedAt
  `).run({
    ...device,
    manufacturer: device.manufacturer ?? null,
    location:     device.location     ?? null,
    updatedAt:    now,
  });
}

export function updateDeviceStatus(mac: string, status: DeviceStatus): Device | undefined {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE devices SET status = ?, lastSeen = ?, updatedAt = ? WHERE mac = ?
  `).run(status, now, now, mac);
  return getDeviceByMac(mac);
}

type DeviceStatus = Device['status'];

// ── Alerts ────────────────────────────────────────────────────────

export function getAlerts(): Alert[] {
  return db.prepare('SELECT * FROM alerts ORDER BY timestamp DESC').all().map((row: any) => ({
    ...row,
    resolved: Boolean(row.resolved),
  })) as Alert[];
}

export function addAlert(alert: Alert): void {
  db.prepare(`
    INSERT OR IGNORE INTO alerts (id, severity, title, description, timestamp, resolved)
    VALUES (@id, @severity, @title, @description, @timestamp, @resolved)
  `).run({ ...alert, resolved: alert.resolved ? 1 : 0 });
}

export function resolveAlert(id: string): void {
  db.prepare('UPDATE alerts SET resolved = 1, resolvedAt = ? WHERE id = ?')
    .run(new Date().toISOString(), id);
}

// ── Internet status ───────────────────────────────────────────────

export function getInternetStatus(): InternetStatus | undefined {
  return db.prepare('SELECT * FROM internet_status WHERE id = 1').get() as InternetStatus | undefined;
}

export function setInternetStatus(s: InternetStatus): void {
  db.prepare(`
    INSERT INTO internet_status (id, status, provider, downloadMbps, uploadMbps, latencyMs, uptime, updatedAt)
    VALUES (1, @status, @provider, @downloadMbps, @uploadMbps, @latencyMs, @uptime, @updatedAt)
    ON CONFLICT(id) DO UPDATE SET
      status       = excluded.status,
      provider     = excluded.provider,
      downloadMbps = excluded.downloadMbps,
      uploadMbps   = excluded.uploadMbps,
      latencyMs    = excluded.latencyMs,
      uptime       = excluded.uptime,
      updatedAt    = excluded.updatedAt
  `).run({ ...s, updatedAt: new Date().toISOString() });
}

// ── Network health ────────────────────────────────────────────────

export function getNetworkHealth(): NetworkHealth | undefined {
  return db.prepare('SELECT * FROM network_health WHERE id = 1').get() as NetworkHealth | undefined;
}

export function setNetworkHealth(h: NetworkHealth): void {
  db.prepare(`
    INSERT INTO network_health (id, score, activeDevices, totalDevices, unknownDevices, offlineDevices, updatedAt)
    VALUES (1, @score, @activeDevices, @totalDevices, @unknownDevices, @offlineDevices, @updatedAt)
    ON CONFLICT(id) DO UPDATE SET
      score          = excluded.score,
      activeDevices  = excluded.activeDevices,
      totalDevices   = excluded.totalDevices,
      unknownDevices = excluded.unknownDevices,
      offlineDevices = excluded.offlineDevices,
      updatedAt      = excluded.updatedAt
  `).run({ ...h, updatedAt: new Date().toISOString() });
}

// Recompute and persist network health from current device state
export function recomputeNetworkHealth(): NetworkHealth {
  const devices = getDevices();
  const active  = devices.filter(d => d.status === 'online').length;
  const offline = devices.filter(d => d.status === 'offline').length;
  const unknown = devices.filter(d => d.type === 'unknown').length;
  const total   = devices.length;

  const offlinePenalty = total > 0 ? (offline / total) * 40 : 0;
  const unknownPenalty = total > 0 ? (unknown / total) * 20 : 0;
  const score = Math.max(0, Math.round(100 - offlinePenalty - unknownPenalty));

  const health: NetworkHealth = { score, activeDevices: active, totalDevices: total, unknownDevices: unknown, offlineDevices: offline };
  setNetworkHealth(health);
  return health;
}
