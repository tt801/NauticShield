'use strict';
/**
 * NauticShield Relay Server
 *
 * Proxies shell sessions between on-vessel agents and the admin portal browser.
 *
 * Two connection types via WebSocket query params:
 *   ?type=agent&vesselId=MY_AURORA&token=<HMAC>   — from the mini PC agent
 *   ?type=admin&vesselId=MY_AURORA&token=<HMAC>   — from the admin browser
 *
 * Auth: HMAC-SHA256(vesselId:type:windowIndex, RELAY_SECRET)
 *   windowIndex = floor(Date.now() / 30000)  — 30-second sliding windows
 *   Both current and previous window are accepted (60s grace total)
 *
 * Deploy to Railway: set RELAY_SECRET env var, Railway provides PORT automatically.
 */

const http   = require('http');
const crypto = require('crypto');
const { WebSocketServer, WebSocket } = require('ws');

const RELAY_SECRET = process.env.RELAY_SECRET;
if (!RELAY_SECRET) {
  console.error('[relay] RELAY_SECRET env var is required');
  process.exit(1);
}

// ── Token verification ────────────────────────────────────────────

function verifyToken(token, vesselId, type) {
  if (!/^[0-9a-f]{64}$/.test(token)) return false;
  const now = Math.floor(Date.now() / 30000);
  for (const w of [now, now - 1, now + 1]) {
    const expected = crypto
      .createHmac('sha256', RELAY_SECRET)
      .update(`${vesselId}:${type}:${w}`)
      .digest('hex');
    try {
      if (crypto.timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(expected, 'hex'))) return true;
    } catch { /* length mismatch */ }
  }
  return false;
}

// ── Session map: vesselId → { agent: WebSocket|null, admins: Set<WebSocket> } ──

const sessions = new Map();

function getSession(vesselId) {
  if (!sessions.has(vesselId)) sessions.set(vesselId, { agent: null, admins: new Set() });
  return sessions.get(vesselId);
}

function sendCtrl(ws, ctrl) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ __ctrl: ctrl }));
}

// ── HTTP + WebSocket server ───────────────────────────────────────

const server = http.createServer((req, res) => {
  if (req.url === '/health') { res.writeHead(200); res.end('ok'); return; }
  res.writeHead(200); res.end('NauticShield Relay');
});

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  const url      = new URL(req.url, 'http://localhost');
  const type     = url.searchParams.get('type');
  const vesselId = url.searchParams.get('vesselId');
  const token    = url.searchParams.get('token');

  if (!vesselId || !token || !type || !['agent', 'admin'].includes(type)) {
    ws.close(4001, 'missing or invalid params');
    return;
  }

  if (!verifyToken(token, vesselId, type)) {
    console.warn(`[relay] Auth failed — type=${type} vessel=${vesselId}`);
    ws.close(4003, 'auth failed');
    return;
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() ?? req.socket.remoteAddress;
  console.log(`[relay] ${type} connected — vessel=${vesselId} ip=${ip}`);

  const session = getSession(vesselId);

  if (type === 'agent') {
    // Replace any stale agent connection
    if (session.agent && session.agent.readyState === WebSocket.OPEN) {
      session.agent.close(4000, 'replaced by new agent connection');
    }
    session.agent = ws;

    // Notify waiting admins that agent is now online
    session.admins.forEach(adminWs => sendCtrl(adminWs, 'agent_online'));

    ws.on('message', data => {
      // Forward shell output to all connected admins
      session.admins.forEach(adminWs => {
        if (adminWs.readyState === WebSocket.OPEN) adminWs.send(data);
      });
    });

    ws.on('close', () => {
      console.log(`[relay] Agent disconnected — vessel=${vesselId}`);
      session.agent = null;
      session.admins.forEach(adminWs => sendCtrl(adminWs, 'agent_disconnected'));
    });

    ws.on('error', err => console.error(`[relay] Agent error vessel=${vesselId}:`, err.message));

  } else { // admin
    session.admins.add(ws);

    // Immediately tell admin whether agent is available
    if (!session.agent || session.agent.readyState !== WebSocket.OPEN) {
      sendCtrl(ws, 'agent_offline');
    } else {
      sendCtrl(ws, 'agent_online');
    }

    ws.on('message', data => {
      // Forward admin keystrokes to agent
      if (session.agent && session.agent.readyState === WebSocket.OPEN) {
        session.agent.send(data);
      }
    });

    ws.on('close', () => {
      session.admins.delete(ws);
      console.log(`[relay] Admin disconnected — vessel=${vesselId}`);
    });

    ws.on('error', err => console.error(`[relay] Admin error vessel=${vesselId}:`, err.message));
  }
});

const PORT = parseInt(process.env.PORT ?? '3001', 10);
server.listen(PORT, () => console.log(`[relay] Listening on :${PORT}`));
