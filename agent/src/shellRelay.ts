/**
 * Shell Relay Client — runs on the vessel agent
 *
 * On startup (if RELAY_URL + RELAY_SECRET are set), connects to the relay
 * server and spawns a /bin/sh session. Shell output is streamed to the relay;
 * keystrokes from the admin browser are written to the shell stdin.
 *
 * Reconnects automatically on disconnect (10 second backoff).
 */
import crypto from 'crypto';
import { spawn } from 'child_process';
import type { ChildProcessWithoutNullStreams } from 'child_process';
import WebSocket from 'ws';

const RELAY_URL    = process.env.RELAY_URL;
const VESSEL_ID    = process.env.VESSEL_ID ?? 'UNKNOWN';
const RELAY_SECRET = process.env.RELAY_SECRET;

function makeAgentToken(): string {
  const w = Math.floor(Date.now() / 30000);
  return crypto
    .createHmac('sha256', RELAY_SECRET!)
    .update(`${VESSEL_ID}:agent:${w}`)
    .digest('hex');
}

let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function connect(): void {
  const token = makeAgentToken();
  const url   = `${RELAY_URL}/ws?type=agent&vesselId=${encodeURIComponent(VESSEL_ID)}&token=${token}`;

  const ws = new WebSocket(url);
  let shell: ChildProcessWithoutNullStreams | null = null;

  ws.on('open', () => {
    console.log('[shell-relay] Connected to relay');

    // Use /bin/sh — always available on Alpine/Linux Docker images
    shell = spawn('/bin/sh', [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env:   { ...process.env, TERM: 'xterm-256color', PS1: '$ ' },
    });

    shell.stdout.on('data', (data: Buffer) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(data);
    });
    shell.stderr.on('data', (data: Buffer) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(data);
    });

    shell.on('close', code => {
      console.log(`[shell-relay] Shell exited (code ${code})`);
      ws.close();
    });
  });

  ws.on('message', (data: Buffer | string) => {
    // Control messages are JSON strings; raw terminal input is binary
    if (typeof data === 'string' || (data instanceof Buffer && data[0] === 0x7b)) {
      try {
        const msg = JSON.parse(data.toString()) as { __ctrl?: string };
        if (msg.__ctrl) return; // ignore relay control frames
      } catch { /* not JSON — fall through to write to shell */ }
    }
    if (shell && !shell.killed) {
      shell.stdin.write(data);
    }
  });

  ws.on('close', () => {
    console.log('[shell-relay] Disconnected — reconnecting in 10s');
    shell?.kill();
    shell = null;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connect, 10_000);
  });

  ws.on('error', (err: Error) => {
    // Don't log ECONNREFUSED spam — relay may not be deployed yet
    if (!err.message.includes('ECONNREFUSED')) {
      console.error('[shell-relay] Error:', err.message);
    }
  });
}

export function startShellRelay(): void {
  if (!RELAY_URL || !RELAY_SECRET) {
    console.log('[shell-relay] RELAY_URL or RELAY_SECRET not set — shell relay disabled');
    return;
  }
  console.log(`[shell-relay] Connecting to ${RELAY_URL} as vessel ${VESSEL_ID}`);
  connect();
}
