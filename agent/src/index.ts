/// <reference types="node" />
import 'dotenv/config';
import express        from 'express';
import cors           from 'cors';
import { createServer }         from 'http';
import { WebSocketServer, WebSocket } from 'ws';

import { broadcast, initBroadcaster } from './broadcaster';
import { scanNetwork, checkInternetConnectivity, updateInternetStatus } from './scanner';
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
import type { VesselSnapshot, WsClientMessage } from './types';

const PORT    = parseInt(process.env.PORT    ?? '3000', 10);
const SUBNET  =           process.env.SUBNET ?? '192.168.1';
const SCAN_MS = parseInt(process.env.SCAN_INTERVAL_MS ?? '30000', 10);

// ── Express ───────────────────────────────────────────────────────

const app    = express();
const server = createServer(app);

// CORS — vessel LAN origins from env, fallback to localhost in dev
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176').split(',');
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
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
    });
  });
  next();
});

// Public endpoint — no auth required
app.get('/api/health', (_req, res) => {
  res.json({
    status:  'ok',
    version: '1.0.0',
    vessel:  process.env.VESSEL_ID   ?? 'UNKNOWN',
    name:    process.env.VESSEL_NAME ?? 'My Vessel',
    uptime:  process.uptime(),
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
    const { newDevices, updatedDevices } = await scanNetwork(SUBNET);

    // 3. Run alert engine — fires / clears alerts based on current state
    runAlertEngine(internetStatus);

    // 4. Broadcast changes over WebSocket
    for (const d of newDevices)     broadcast({ type: 'device:new',    data: d });
    for (const d of updatedDevices) broadcast({ type: 'device:update', data: d });

    const networkHealth = db.getNetworkHealth();
    if (networkHealth) {
      broadcast({ type: 'status:update', data: { internetStatus, networkHealth } });
    }
  } catch (err) {
    console.error('[Monitor] Cycle error:', err);
  }
}

// ── Cloud sync (optional) ─────────────────────────────────────────
// When CLOUD_SYNC_URL and CLOUD_API_KEY are set, push a snapshot
// after each successful scan cycle.

async function syncToCloud(): Promise<void> {
  const { CLOUD_SYNC_URL, CLOUD_API_KEY, VESSEL_ID } = process.env;
  if (!CLOUD_SYNC_URL || !CLOUD_API_KEY || !VESSEL_ID) return;

  const snapshot: VesselSnapshot = {
    devices:        db.getDevices(),
    alerts:         db.getAlerts(),
    internetStatus: db.getInternetStatus()!,
    networkHealth:  db.getNetworkHealth()!,
    timestamp:      new Date().toISOString(),
  };

  try {
    const resp = await fetch(`${CLOUD_SYNC_URL}/v1/vessels/${VESSEL_ID}/sync`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${CLOUD_API_KEY}`,
      },
      body: JSON.stringify(snapshot),
    });
    if (!resp.ok) {
      console.warn(`[Sync] Cloud sync failed: HTTP ${resp.status}`);
    }
  } catch (err) {
    console.warn('[Sync] Could not reach cloud endpoint:', (err as Error).message);
  }
}

// ── Start ─────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log('\n🚢  NauticShield Agent');
  console.log(`    REST  → http://localhost:${PORT}/api`);
  console.log(`    WS   → ws://localhost:${PORT}`);
  console.log(`    Subnet: ${SUBNET}.0/24   Interval: ${SCAN_MS / 1000}s\n`);

  // Run immediately, then on interval
  runCycle().then(() => syncToCloud());
  setInterval(() => runCycle().then(() => syncToCloud()), SCAN_MS);
});
