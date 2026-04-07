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
import devicesRouter    from './routes/devices';
import alertsRouter     from './routes/alerts';
import statusRouter     from './routes/status';
import actionsRouter    from './routes/actions';
import voyageRouter     from './routes/voyage';
import cyberRouter      from './routes/cyber';
import type { VesselSnapshot, WsClientMessage } from './types';

const PORT    = parseInt(process.env.PORT    ?? '3000', 10);
const SUBNET  =           process.env.SUBNET ?? '192.168.1';
const SCAN_MS = parseInt(process.env.SCAN_INTERVAL_MS ?? '30000', 10);

// ── Express ───────────────────────────────────────────────────────

const app    = express();
const server = createServer(app);

app.use(cors({ origin: true }));   // allow all origins (vessel LAN only)
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({
    status:  'ok',
    version: '1.0.0',
    vessel:  process.env.VESSEL_ID   ?? 'UNKNOWN',
    name:    process.env.VESSEL_NAME ?? 'My Vessel',
    uptime:  process.uptime(),
  });
});

app.use('/api/devices', devicesRouter);
app.use('/api/alerts',  alertsRouter);
app.use('/api/status',  statusRouter);
app.use('/api/actions', actionsRouter);
app.use('/api/voyage',  voyageRouter);
app.use('/api/cyber',   cyberRouter);

// Snapshot endpoint — returns everything the frontend needs in one call
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
