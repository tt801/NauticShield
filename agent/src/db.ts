/// <reference types="node" />
// node:sqlite is built into Node.js 22.5+ — no native addon compilation needed.
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
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

  CREATE TABLE IF NOT EXISTS perf_samples (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    sampledAt   TEXT NOT NULL,
    date        TEXT NOT NULL,
    hour        INTEGER NOT NULL,
    status      TEXT NOT NULL DEFAULT 'down',
    provider    TEXT NOT NULL DEFAULT 'None',
    downloadMbps REAL NOT NULL DEFAULT 0,
    latencyMs   REAL NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_perf_date ON perf_samples (date);
`);

// Safe migration: add fingerprint column to existing DBs that predate this schema version
try {
  db.exec(`ALTER TABLE alerts ADD COLUMN fingerprint TEXT`);
} catch { /* column already exists — safe to ignore */ }

// Safe migration: add country column to voyage_log
try {
  db.exec(`ALTER TABLE voyage_log ADD COLUMN country TEXT NOT NULL DEFAULT ''`);
} catch { /* column already exists — safe to ignore */ }

// Safe migrations: lifecycle and destination fields
for (const [col, def] of [
  ['locationTo',        "TEXT NOT NULL DEFAULT ''"],
  ['locationToCountry', "TEXT NOT NULL DEFAULT ''"],
  ['locationToRegion',  "TEXT NOT NULL DEFAULT ''"],
  ['eta',               "TEXT NOT NULL DEFAULT ''"],
  ['status',            "TEXT NOT NULL DEFAULT 'completed'"],
] as [string, string][]) {
  try { db.exec(`ALTER TABLE voyage_log ADD COLUMN ${col} ${def}`); } catch { /* exists */ }
}

// Keep perf_samples lean — drop anything older than 90 days on startup
try {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  db.exec(`DELETE FROM perf_samples WHERE date < '${cutoff}'`);
} catch { /* ignore */ }

// Close DB cleanly on process exit so the lock is always released
process.on('exit',    () => { try { db.close(); } catch { /* ignore */ } });
process.on('SIGINT',  () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

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
  id:                string;
  date:              string;
  location:          string;
  region:            string;
  country:           string;
  locationTo:        string;
  locationToCountry: string;
  locationToRegion:  string;
  eta:               string;
  status:            string; // 'in_port' | 'underway' | 'completed'
  avgDownMbps:       number;
  avgLatencyMs:      number;
  uptimePct:         number;
  provider:          string;
  incidents:         number;
  blocks:            string;
  notes:             string;
  createdAt:         string;
}

export function getVoyageLog(): VoyageEntry[] {
  return db.prepare('SELECT * FROM voyage_log ORDER BY date DESC, createdAt DESC').all() as unknown as VoyageEntry[];
}

export function addVoyageEntry(entry: Omit<VoyageEntry, 'createdAt'>): VoyageEntry {
  const createdAt = new Date().toISOString();
  db.prepare(`
    INSERT INTO voyage_log (id, date, location, region, country, locationTo, locationToCountry, locationToRegion, eta, status, avgDownMbps, avgLatencyMs, uptimePct, provider, incidents, blocks, notes, createdAt)
    VALUES (@id, @date, @location, @region, @country, @locationTo, @locationToCountry, @locationToRegion, @eta, @status, @avgDownMbps, @avgLatencyMs, @uptimePct, @provider, @incidents, @blocks, @notes, @createdAt)
  `).run({ ...entry, createdAt });
  return { ...entry, createdAt };
}

export function updateVoyageEntry(id: string, patch: Partial<Omit<VoyageEntry, 'id' | 'createdAt'>>): VoyageEntry | undefined {
  const existing = db.prepare('SELECT * FROM voyage_log WHERE id = ?').get(id) as unknown as VoyageEntry | undefined;
  if (!existing) return undefined;
  const merged = { ...existing, ...patch };
  db.prepare(`
    UPDATE voyage_log SET date=@date, location=@location, region=@region, country=@country,
      locationTo=@locationTo, locationToCountry=@locationToCountry, locationToRegion=@locationToRegion,
      eta=@eta, status=@status,
      avgDownMbps=@avgDownMbps, avgLatencyMs=@avgLatencyMs, uptimePct=@uptimePct, provider=@provider,
      incidents=@incidents, blocks=@blocks, notes=@notes WHERE id=@id
  `).run({ ...merged });
  return merged;
}

export function deleteVoyageEntry(id: string): boolean {
  const result = db.prepare('DELETE FROM voyage_log WHERE id = ?').run(id);
  return (result as any).changes > 0;
}

// ── Perf samples ─────────────────────────────────────────────────

export interface PerfSample {
  downloadMbps: number;
  latencyMs:    number;
  status:       string;
  provider:     string;
}

export function insertPerfSample(sample: PerfSample): void {
  const now  = new Date();
  const date = now.toISOString().slice(0, 10);
  const hour = now.getUTCHours();
  db.prepare(`
    INSERT INTO perf_samples (sampledAt, date, hour, status, provider, downloadMbps, latencyMs)
    VALUES (@sampledAt, @date, @hour, @status, @provider, @downloadMbps, @latencyMs)
  `).run({ sampledAt: now.toISOString(), date, hour, ...sample });
}

export interface AutofillResult {
  avgDownMbps:  number;
  avgLatencyMs: number;
  uptimePct:    number;
  provider:     string;
  incidents:    number;
  blocks:       string; // JSON ConnStatus[]
  hasData:      boolean;
}

export function getAutofillForDate(date: string): AutofillResult {
  type SampleRow = { status: string; provider: string; downloadMbps: number; latencyMs: number; hour: number };
  const rows = db.prepare(
    'SELECT status, provider, downloadMbps, latencyMs, hour FROM perf_samples WHERE date = ? ORDER BY hour'
  ).all(date) as unknown as SampleRow[];

  if (rows.length === 0) {
    return { avgDownMbps: 0, avgLatencyMs: 0, uptimePct: 100, provider: 'Starlink', incidents: 0, blocks: '[]', hasData: false };
  }

  const upRows  = rows.filter(r => r.status !== 'down');
  const avgDown = upRows.length ? upRows.reduce((s, r) => s + r.downloadMbps, 0) / upRows.length : 0;
  const avgLat  = upRows.length ? upRows.reduce((s, r) => s + r.latencyMs,    0) / upRows.length : 0;
  const uptimePct = +(rows.filter(r => r.status !== 'down').length / rows.length * 100).toFixed(1);

  // Most common provider
  const providerCounts: Record<string, number> = {};
  for (const r of rows) providerCounts[r.provider] = (providerCounts[r.provider] ?? 0) + 1;
  const provider = Object.entries(providerCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Starlink';

  // Incidents = distinct down→up transitions
  let incidents = 0;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i - 1].status === 'down' && rows[i].status !== 'down') incidents++;
  }
  if (rows[0].status === 'down') incidents++;

  // 24-hour block array (index = hour 0-23)
  const blockMap: Record<number, 'good' | 'slow' | 'down'> = {};
  for (const r of rows) {
    const s = r.status === 'down' ? 'down' : r.downloadMbps < 5 || r.latencyMs > 300 ? 'slow' : 'good';
    blockMap[r.hour] = s;
  }
  const blocks = Array.from({ length: 24 }, (_, h) => blockMap[h] ?? 'good');

  return {
    avgDownMbps:  Math.round(avgDown * 10) / 10,
    avgLatencyMs: Math.round(avgLat),
    uptimePct,
    provider,
    incidents,
    blocks: JSON.stringify(blocks),
    hasData: true,
  };
}

export function getAutofillForRange(from: string, to: string): Record<string, AutofillResult> {
  const result: Record<string, AutofillResult> = {};
  const start = new Date(from);
  const end   = new Date(to);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const date = d.toISOString().slice(0, 10);
    result[date] = getAutofillForDate(date);
  }
  return result;
}

// ── Cyber Assessments & Findings ─────────────────────────────────

// Safe schema creation for cyber tables
db.exec(`
  CREATE TABLE IF NOT EXISTS cyber_assessments (
    id       TEXT PRIMARY KEY,
    runAt    TEXT NOT NULL,
    score    INTEGER NOT NULL,
    checks   TEXT NOT NULL,
    cadence  TEXT NOT NULL DEFAULT 'manual'
  );

  CREATE TABLE IF NOT EXISTS cyber_findings (
    id            TEXT PRIMARY KEY,
    assessmentId  TEXT NOT NULL,
    category      TEXT NOT NULL,
    check_name    TEXT NOT NULL,
    status        TEXT NOT NULL,
    detail        TEXT NOT NULL DEFAULT '',
    weight        REAL NOT NULL DEFAULT 1,
    findingStatus TEXT NOT NULL DEFAULT 'open',
    remediatedAt  TEXT NOT NULL DEFAULT '',
    notes         TEXT NOT NULL DEFAULT '',
    createdAt     TEXT NOT NULL
  );
`);

export interface CyberAssessment {
  id:      string;
  runAt:   string;
  score:   number;
  checks:  string;
  cadence: string;
}

export interface CyberFinding {
  id:            string;
  assessmentId:  string;
  category:      string;
  check_name:    string;
  status:        string;
  detail:        string;
  weight:        number;
  findingStatus: string;
  remediatedAt:  string;
  notes:         string;
  createdAt:     string;
}

export function listAssessments(): CyberAssessment[] {
  return db.prepare('SELECT * FROM cyber_assessments ORDER BY runAt DESC').all() as unknown as CyberAssessment[];
}

export function addAssessment(a: CyberAssessment): CyberAssessment {
  db.prepare(`
    INSERT INTO cyber_assessments (id, runAt, score, checks, cadence)
    VALUES (@id, @runAt, @score, @checks, @cadence)
  `).run({ ...a });
  return a;
}

export function listFindings(): CyberFinding[] {
  return db.prepare('SELECT * FROM cyber_findings ORDER BY createdAt DESC').all() as unknown as CyberFinding[];
}

export function addFinding(f: CyberFinding): CyberFinding {
  db.prepare(`
    INSERT INTO cyber_findings
      (id, assessmentId, category, check_name, status, detail, weight, findingStatus, remediatedAt, notes, createdAt)
    VALUES
      (@id, @assessmentId, @category, @check_name, @status, @detail, @weight, @findingStatus, @remediatedAt, @notes, @createdAt)
  `).run({ ...f });
  return f;
}

export function updateFinding(id: string, patch: Partial<Pick<CyberFinding, 'findingStatus' | 'remediatedAt' | 'notes'>>): CyberFinding | undefined {
  const sets = Object.keys(patch).map(k => `${k} = @${k}`).join(', ');
  if (!sets) return undefined;
  db.prepare(`UPDATE cyber_findings SET ${sets} WHERE id = @id`).run({ ...patch, id });
  return db.prepare('SELECT * FROM cyber_findings WHERE id = ?').get(id) as unknown as CyberFinding | undefined;
}

// ── Audit Log ─────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS audit_log (
    id      TEXT PRIMARY KEY,
    ts      TEXT NOT NULL,
    userId  TEXT NOT NULL,
    role    TEXT NOT NULL,
    email   TEXT,
    method  TEXT NOT NULL,
    path    TEXT NOT NULL,
    status  INTEGER NOT NULL,
    ip      TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log (ts);
`);

export interface AuditEntry {
  userId: string;
  role:   string;
  email:  string | null;
  method: string;
  path:   string;
  status: number;
  ip:     string | null;
}

export function writeAuditLog(entry: AuditEntry): void {
  try {
    db.prepare(`
      INSERT INTO audit_log (id, ts, userId, role, email, method, path, status, ip)
      VALUES (@id, @ts, @userId, @role, @email, @method, @path, @status, @ip)
    `).run({
      id:     uuidv4(),
      ts:     new Date().toISOString(),
      ...entry,
    });
  } catch { /* non-fatal */ }
}

export function getAuditLog(limit = 200): unknown[] {
  return db.prepare('SELECT * FROM audit_log ORDER BY ts DESC LIMIT ?').all(limit);
}

// ── Notification Preferences ──────────────────────────────────────

// One row per vessel (singleton, id=1). Stores JSON for per-category toggles
// plus contact details for email and SMS.
db.exec(`
  CREATE TABLE IF NOT EXISTS notification_prefs (
    id          INTEGER PRIMARY KEY CHECK (id = 1),
    emailTo     TEXT NOT NULL DEFAULT '',
    phoneTo     TEXT NOT NULL DEFAULT '',
    categories  TEXT NOT NULL DEFAULT '{}'
  );
  INSERT OR IGNORE INTO notification_prefs (id, emailTo, phoneTo, categories)
  VALUES (1, '', '', '{}');
`);

export type NotificationCategory =
  | 'new_device'
  | 'port_scan'
  | 'internet_down'
  | 'cyber_critical'
  | 'device_spike';

export interface CategoryPref {
  email: boolean;
  sms:   boolean;
}

export interface NotificationPrefs {
  emailTo:    string;
  phoneTo:    string;
  categories: Record<NotificationCategory, CategoryPref>;
}

const DEFAULT_CATEGORIES: Record<NotificationCategory, CategoryPref> = {
  new_device:     { email: true,  sms: false },
  port_scan:      { email: true,  sms: true  },
  internet_down:  { email: true,  sms: true  },
  cyber_critical: { email: true,  sms: true  },
  device_spike:   { email: true,  sms: false },
};

export function getNotificationPrefs(): NotificationPrefs {
  const row = db.prepare('SELECT * FROM notification_prefs WHERE id = 1').get() as
    { emailTo: string; phoneTo: string; categories: string } | undefined;
  if (!row) return { emailTo: '', phoneTo: '', categories: DEFAULT_CATEGORIES };
  let categories: Record<NotificationCategory, CategoryPref>;
  try {
    categories = { ...DEFAULT_CATEGORIES, ...JSON.parse(row.categories) };
  } catch {
    categories = DEFAULT_CATEGORIES;
  }
  return { emailTo: row.emailTo, phoneTo: row.phoneTo, categories };
}

export function setNotificationPrefs(prefs: Partial<NotificationPrefs>): NotificationPrefs {
  const current = getNotificationPrefs();
  const next = {
    emailTo:    prefs.emailTo    ?? current.emailTo,
    phoneTo:    prefs.phoneTo    ?? current.phoneTo,
    categories: prefs.categories ?? current.categories,
  };
  db.prepare(`
    UPDATE notification_prefs SET emailTo = ?, phoneTo = ?, categories = ? WHERE id = 1
  `).run(next.emailTo, next.phoneTo, JSON.stringify(next.categories));
  return next;
}
