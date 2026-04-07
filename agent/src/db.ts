/// <reference types="node" />
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
    resolvedAt  TEXT,
    fingerprint TEXT
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

  CREATE TABLE IF NOT EXISTS voyage_log (
    id           TEXT PRIMARY KEY,
    date         TEXT NOT NULL,
    location     TEXT NOT NULL,
    region       TEXT NOT NULL DEFAULT '',
    avgDownMbps  REAL NOT NULL DEFAULT 0,
    avgLatencyMs REAL NOT NULL DEFAULT 0,
    uptimePct    REAL NOT NULL DEFAULT 100,
    provider     TEXT NOT NULL DEFAULT 'Starlink',
    incidents    INTEGER NOT NULL DEFAULT 0,
    blocks       TEXT NOT NULL DEFAULT '[]',
    notes        TEXT NOT NULL DEFAULT '',
    createdAt    TEXT NOT NULL
  );
`);

// Safe migration: add fingerprint column to existing DBs that predate this schema version
try {
  db.exec(`ALTER TABLE alerts ADD COLUMN fingerprint TEXT`);
} catch { /* column already exists — safe to ignore */ }

// ── Devices ───────────────────────────────────────────────────────

export function getDevices(): Device[] {
  return db.prepare('SELECT * FROM devices ORDER BY name').all() as unknown as Device[];
}

export function getDeviceById(id: string): Device | undefined {
  return db.prepare('SELECT * FROM devices WHERE id = ?').get(id) as unknown as Device | undefined;
}

export function getDeviceByMac(mac: string): Device | undefined {
  return db.prepare('SELECT * FROM devices WHERE mac = ?').get(mac) as unknown as Device | undefined;
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

export function renameDevice(id: string, name: string, type?: string, location?: string): Device | undefined {
  const now = new Date().toISOString();
  if (type !== undefined && location !== undefined) {
    db.prepare(`UPDATE devices SET name = ?, type = ?, location = ?, updatedAt = ? WHERE id = ?`).run(name, type, location, now, id);
  } else if (type !== undefined) {
    db.prepare(`UPDATE devices SET name = ?, type = ?, updatedAt = ? WHERE id = ?`).run(name, type, now, id);
  } else if (location !== undefined) {
    db.prepare(`UPDATE devices SET name = ?, location = ?, updatedAt = ? WHERE id = ?`).run(name, location, now, id);
  } else {
    db.prepare(`UPDATE devices SET name = ?, updatedAt = ? WHERE id = ?`).run(name, now, id);
  }
  return getDeviceById(id);
}

type DeviceStatus = Device['status'];

// ── Alerts ────────────────────────────────────────────────────────

export function getAlerts(): Alert[] {
  return db.prepare('SELECT * FROM alerts ORDER BY timestamp DESC').all().map((row: any) => ({
    ...row,
    resolved: Boolean(row.resolved),
  })) as unknown as Alert[];
}

export function addAlert(alert: Alert & { fingerprint?: string }): void {
  db.prepare(`
    INSERT OR IGNORE INTO alerts (id, severity, title, description, timestamp, resolved, fingerprint)
    VALUES (@id, @severity, @title, @description, @timestamp, @resolved, @fingerprint)
  `).run({ ...alert, resolved: alert.resolved ? 1 : 0, fingerprint: alert.fingerprint ?? null });
}

/** Returns the open (unresolved) alert for a given fingerprint, or undefined. */
export function getOpenAlertByFingerprint(fingerprint: string): Alert | undefined {
  const row = db.prepare(
    `SELECT * FROM alerts WHERE fingerprint = ? AND resolved = 0 LIMIT 1`
  ).get(fingerprint) as unknown as (Alert & { fingerprint: string }) | undefined;
  if (!row) return undefined;
  return { ...row, resolved: Boolean((row as any).resolved) };
}

/** Auto-resolve all open alerts matching a fingerprint. */
export function autoResolveByFingerprint(fingerprint: string): void {
  db.prepare(`UPDATE alerts SET resolved = 1, resolvedAt = ? WHERE fingerprint = ? AND resolved = 0`)
    .run(new Date().toISOString(), fingerprint);
}

export function resolveAlert(id: string): void {
  db.prepare('UPDATE alerts SET resolved = 1, resolvedAt = ? WHERE id = ?')
    .run(new Date().toISOString(), id);
}

// ── Internet status ───────────────────────────────────────────────

export function getInternetStatus(): InternetStatus | undefined {
  return db.prepare('SELECT * FROM internet_status WHERE id = 1').get() as unknown as InternetStatus | undefined;
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
  return db.prepare('SELECT * FROM network_health WHERE id = 1').get() as unknown as NetworkHealth | undefined;
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

// ── Voyage Log ────────────────────────────────────────────────────

export interface VoyageEntry {
  id:           string;
  date:         string;
  location:     string;
  region:       string;
  avgDownMbps:  number;
  avgLatencyMs: number;
  uptimePct:    number;
  provider:     string;
  incidents:    number;
  blocks:       string; // JSON string of ConnStatus[]
  notes:        string;
  createdAt:    string;
}

export function getVoyageLog(): VoyageEntry[] {
  return db.prepare('SELECT * FROM voyage_log ORDER BY date DESC, createdAt DESC').all() as unknown as VoyageEntry[];
}

export function addVoyageEntry(entry: Omit<VoyageEntry, 'createdAt'>): VoyageEntry {
  const createdAt = new Date().toISOString();
  db.prepare(`
    INSERT INTO voyage_log (id, date, location, region, avgDownMbps, avgLatencyMs, uptimePct, provider, incidents, blocks, notes, createdAt)
    VALUES (@id, @date, @location, @region, @avgDownMbps, @avgLatencyMs, @uptimePct, @provider, @incidents, @blocks, @notes, @createdAt)
  `).run({ ...entry, createdAt });
  return { ...entry, createdAt };
}

export function updateVoyageEntry(id: string, patch: Partial<Omit<VoyageEntry, 'id' | 'createdAt'>>): VoyageEntry | undefined {
  const existing = db.prepare('SELECT * FROM voyage_log WHERE id = ?').get(id) as unknown as VoyageEntry | undefined;
  if (!existing) return undefined;
  const merged = { ...existing, ...patch };
  db.prepare(`
    UPDATE voyage_log SET date=@date, location=@location, region=@region, avgDownMbps=@avgDownMbps,
      avgLatencyMs=@avgLatencyMs, uptimePct=@uptimePct, provider=@provider, incidents=@incidents,
      blocks=@blocks, notes=@notes WHERE id=@id
  `).run({ ...merged });
  return merged;
}

export function deleteVoyageEntry(id: string): boolean {
  const result = db.prepare('DELETE FROM voyage_log WHERE id = ?').run(id);
  return (result as any).changes > 0;
}
