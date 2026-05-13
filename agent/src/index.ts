/// <reference types="node" />
import 'dotenv/config';
import express        from 'express';
import cors           from 'cors';
import { createServer }         from 'http';
import { WebSocketServer, WebSocket } from 'ws';

import { broadcast, initBroadcaster } from './broadcaster';
import { scanNetworkWithOptions, checkInternetConnectivity, updateInternetStatus } from './scanner';
import { runAlertEngine } from './alertEngine';
import * as db          from './db';
import { requireAuth, makeRateLimiter } from './auth';
import type { AuthedRequest } from './auth';
import devicesRouter       from './routes/devices';
import alertsRouter        from './routes/alerts';
import statusRouter        from './routes/status';
import actionsRouter       from './routes/actions';
import voyageRouter        from './routes/voyage';
import cyberRouter         from './routes/cyber';
import notificationsRouter from './routes/notifications';
import guestNetworkRouter  from './routes/guestNetwork';
import vesselsRouter       from './routes/vessels';
import { startCloudSync, getLastSyncAt } from './sync';
import { startShellRelay } from './shellRelay';
import { bootstrapAgent } from './bootstrap';
import type { VesselSnapshot, WsClientMessage } from './types';
import { getScannerDiagnostics, setScannerDiagnostics } from './scannerDiagnostics';
import { getScannerRuntimeConfig } from './scannerRuntimeConfig';

const PORT    = parseInt(process.env.PORT    ?? '3000', 10);
const SCAN_MS = parseInt(process.env.SCAN_INTERVAL_MS ?? '30000', 10);
let configuredSubnetMissStreak = 0;
let scannerConfigSignature = '';

const initialScannerConfig = getScannerRuntimeConfig();
setScannerDiagnostics({
  scanMode: initialScannerConfig.scanMode,
  configuredSubnet: initialScannerConfig.subnet,
  allowedSubnets: initialScannerConfig.allowedSubnets,
  warnAfterCycles: initialScannerConfig.warnAfterCycles,
  configuredSubnetMissStreak: 0,
});

// ── Express ───────────────────────────────────────────────────────

const app    = express();
const server = createServer(app);

// CORS — allow any localhost port in dev; in production restrict to explicit origins
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : null; // null = dev mode, allow all localhost
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // same-origin / curl
    if (!allowedOrigins) {
      // Dev: allow any localhost/127.0.0.1 origin regardless of port
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return cb(null, true);
    } else {
      if (allowedOrigins.includes(origin)) return cb(null, true);
    }
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json());

// Security headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

// Rate limiter: 200 req / minute per IP on all API routes
makeRateLimiter(60_000, 200).then(limiter => app.use('/api', limiter));

// ── Semantic audit action labels ──────────────────────────────────
function semanticAction(method: string, path: string): string {
  if (method === 'POST'   && /^\/devices\/[^/]+\/block$/.test(path))    return 'Blocked device';
  if (method === 'POST'   && /^\/devices\/[^/]+\/unblock$/.test(path))  return 'Unblocked device';
  if (method === 'PATCH'  && /^\/devices\/[^/]+$/.test(path))           return 'Updated device';
  if (method === 'DELETE' && /^\/devices\/[^/]+$/.test(path))           return 'Removed device';
  if (method === 'POST'   && path === '/cyber/assessments')              return 'Ran cyber assessment';
  if (method === 'PATCH'  && /^\/cyber\/findings\/[^/]+$/.test(path))   return 'Updated cyber finding';
  if (method === 'POST'   && path === '/guest-network')                  return 'Created guest network';
  if (method === 'PATCH'  && /^\/guest-network\/[^/]+$/.test(path))     return 'Updated guest network';
  if (method === 'DELETE' && /^\/guest-network\/[^/]+$/.test(path))     return 'Deleted guest network';
  if (method === 'POST'   && /^\/alerts\/[^/]+\/resolve$/.test(path))   return 'Resolved alert';
  if (method === 'POST'   && path === '/status/scanner-config')          return 'Updated scanner config';
  if (method === 'POST'   && /^\/voyage/.test(path))                     return 'Updated voyage log';
  if (method === 'GET')                                                   return `Viewed ${path.split('/')[1] ?? 'resource'}`;
  return `${method} ${path}`;
}

// Audit logging middleware — runs after auth so req.auth is populated
app.use('/api', (req: AuthedRequest, res, next) => {
  res.on('finish', () => {
    db.writeAuditLog({
      userId: req.auth?.userId ?? 'anonymous',
      role:   req.auth?.role   ?? 'unknown',
      email:  req.auth?.email  ?? null,
      method: req.method,
      path:   req.path,
      status: res.statusCode,
      ip:     (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim()
              ?? req.socket.remoteAddress
              ?? null,
      action: semanticAction(req.method, req.path),
    });
  });
  next();
});

// Public endpoint — no auth required
app.get('/api/health', (_req, res) => {
  res.json({
    status:      'ok',
    version:     '1.0.0',
    vessel:      process.env.VESSEL_ID   ?? 'UNKNOWN',
    name:        process.env.VESSEL_NAME ?? 'My Vessel',
    uptime:      process.uptime(),
    lastSyncAt:  getLastSyncAt(),
  });
});

// All other API routes require a valid JWT
app.use('/api', requireAuth);

app.use('/api/devices',       devicesRouter);
app.use('/api/alerts',        alertsRouter);
app.use('/api/status',        statusRouter);
app.use('/api/actions',       actionsRouter);
app.use('/api/voyage',        voyageRouter);
app.use('/api/cyber',         cyberRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/guest-network', guestNetworkRouter);
app.use('/api/vessels',       vesselsRouter);

// Snapshot endpoint
app.get('/api/snapshot', (_req, res) => {
  const snapshot: VesselSnapshot = {
    devices:       db.getDevices(),
    alerts:        db.getAlerts(),
    internetStatus: db.getInternetStatus()!,
    networkHealth:  db.getNetworkHealth()!,
    timestamp:      new Date().toISOString(),
  };
  res.json(snapshot);
});

// Audit log endpoint — owner/captain only (checked inline since routes not yet refactored)
app.get('/api/audit', (req: AuthedRequest, res) => {
  const role = req.auth?.role ?? 'crew';
  if (!['owner', 'captain'].includes(role)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  res.json(db.getAuditLog(500));
});

// Delta report endpoint — returns what changed in the last N hours (default 24)
app.get('/api/report/delta', (req: AuthedRequest, res) => {
  const hours = Math.min(Math.max(parseInt((req.query.hours as string) ?? '24', 10), 1), 168);
  const cutoff = new Date(Date.now() - hours * 3_600_000).toISOString();
  res.json({
    windowHours:         hours,
    since:               cutoff,
    newDevices:          db.getDevicesFirstSeenSince(cutoff),
    newAlerts:           db.getAlertsCreatedSince(cutoff),
    resolvedAlerts:      db.getAlertsResolvedSince(cutoff),
    newFindings:         db.getFindingsCreatedSince(cutoff),
    remediatedFindings:  db.getFindingsRemediatedSince(cutoff),
    blockedDevices:      db.getDevicesBlockedSince(cutoff),
    recentActions:       db.getAuditLog(50),
  });
});

// ── WebSocket ─────────────────────────────────────────────────────

const wss = new WebSocketServer({ server });
initBroadcaster(wss);

wss.on('connection', ws => {
  console.log('[WS] Client connected');

  // Send a full snapshot immediately on connect
  const snapshot: VesselSnapshot = {
    devices:        db.getDevices(),
    alerts:         db.getAlerts(),
    internetStatus: db.getInternetStatus()!,
    networkHealth:  db.getNetworkHealth()!,
    timestamp:      new Date().toISOString(),
  };
  ws.send(JSON.stringify({ type: 'init', data: snapshot }));

  ws.on('message', raw => {
    try {
      const msg = JSON.parse(raw.toString()) as WsClientMessage;
      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch {
      // ignore malformed frames
    }
  });

  ws.on('close', () => console.log('[WS] Client disconnected'));
});

// ── Monitoring loop ───────────────────────────────────────────────

async function runCycle(): Promise<void> {
  try {
    const scannerConfig = getScannerRuntimeConfig();
    const signature = JSON.stringify(scannerConfig);
    if (signature !== scannerConfigSignature) {
      scannerConfigSignature = signature;
      configuredSubnetMissStreak = 0;
      setScannerDiagnostics({
        scanMode: scannerConfig.scanMode,
        configuredSubnet: scannerConfig.subnet,
        allowedSubnets: scannerConfig.allowedSubnets,
        warnAfterCycles: scannerConfig.warnAfterCycles,
        configuredSubnetMissStreak: 0,
        lastWarning: undefined,
      });
      console.log('[Monitor] Scanner configuration updated at runtime.');
    }

    // 1. Internet check
    const { reachable, latencyMs } = await checkInternetConnectivity();
    const internetStatus = updateInternetStatus(reachable, latencyMs);

    // Log a perf sample for voyage auto-fill
    db.insertPerfSample({
      status:       internetStatus.status,
      provider:     internetStatus.provider,
      downloadMbps: internetStatus.downloadMbps,
      latencyMs:    latencyMs ?? 0,
    });

    // 2. Network scan — returns changed devices
    const { newDevices, updatedDevices, activeSubnet, configuredSubnetSeen } = await scanNetworkWithOptions({
      mode: scannerConfig.scanMode,
      subnet: scannerConfig.subnet,
      allowedSubnets: scannerConfig.allowedSubnets,
    });

    let warningMessage: string | undefined;
    if (activeSubnet) {
      console.log(`[Monitor] Subnet in use: ${activeSubnet}.0/24`);
    }

    if (scannerConfig.scanMode === 'fixed' && scannerConfig.subnet) {
      if (configuredSubnetSeen) {
        if (configuredSubnetMissStreak >= scannerConfig.warnAfterCycles) {
          console.log(`[Monitor] Configured subnet ${scannerConfig.subnet}.0/24 is visible in ARP again after ${configuredSubnetMissStreak} missed cycle(s).`);
        }
        configuredSubnetMissStreak = 0;
      } else {
        configuredSubnetMissStreak += 1;
        if (configuredSubnetMissStreak === scannerConfig.warnAfterCycles || configuredSubnetMissStreak % scannerConfig.warnAfterCycles === 0) {
          warningMessage =
            `Configured subnet ${scannerConfig.subnet}.0/24 has not appeared in ARP for ${configuredSubnetMissStreak} consecutive cycle(s). ` +
            `Check vessel LAN segment or adjust SUBNET/SCAN_SUBNET_MODE.`;
          console.warn(`[Monitor] ${warningMessage}`);
        }
      }
    }

    setScannerDiagnostics({
      scanMode: scannerConfig.scanMode,
      configuredSubnet: scannerConfig.subnet,
      allowedSubnets: scannerConfig.allowedSubnets,
      warnAfterCycles: scannerConfig.warnAfterCycles,
      activeSubnet,
      configuredSubnetSeen,
      configuredSubnetMissStreak,
      lastWarning: warningMessage,
    });

    // 3. Run alert engine — fires / clears alerts based on current state
    runAlertEngine(internetStatus, {
      mode: scannerConfig.scanMode,
      activeSubnet,
    });

    // 4. Broadcast changes over WebSocket
    for (const d of newDevices)     broadcast({ type: 'device:new',    data: d });
    for (const d of updatedDevices) broadcast({ type: 'device:update', data: d });

    const networkHealth = db.getNetworkHealth();
    if (networkHealth) {
      broadcast({
        type: 'status:update',
        data: {
          internetStatus,
          networkHealth,
          scannerDiagnostics: getScannerDiagnostics(),
        },
      });
    }
  } catch (err) {
    console.error('[Monitor] Cycle error:', err);
  }
}

// ── Start ─────────────────────────────────────────────────────────

server.listen(PORT, async () => {
  const scannerConfig = getScannerRuntimeConfig();
  console.log('\n🚢  NauticShield Agent');
  console.log(`    REST  → http://localhost:${PORT}/api`);
  console.log(`    WS   → ws://localhost:${PORT}`);
  console.log(`    Scan mode: ${scannerConfig.scanMode}${scannerConfig.subnet ? `   Subnet override: ${scannerConfig.subnet}.0/24` : ''}${scannerConfig.allowedSubnets.length ? `   Allowed: ${scannerConfig.allowedSubnets.join(', ')}` : ''}`);
  if (scannerConfig.subnet) {
    console.log(`    Subnet miss warning: ${scannerConfig.warnAfterCycles} cycle(s)`);
  }
  console.log(`    Interval: ${SCAN_MS / 1000}s\n`);

  await bootstrapAgent();

  // Start cloud sync timer (no-op if env vars not set)
  startCloudSync();

  // Start shell relay (no-op if RELAY_URL / RELAY_SECRET not set)
  startShellRelay();

  // Run monitoring immediately, then on interval
  runCycle();
  setInterval(() => runCycle(), SCAN_MS);
});
