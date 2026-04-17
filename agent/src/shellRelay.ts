/**
 * Shell Relay Client — runs on the vessel agent
 *
 * On startup (if RELAY_URL + RELAY_SECRET are set), connects to the relay
 * server and spawns a PTY shell session. Shell output is streamed to the relay;
 * keystrokes from the admin browser are written to the shell stdin.
 *
 * Reconnects automatically on disconnect (10 second backoff).
 */
import crypto from 'crypto';
import * as pty from 'node-pty';
import WebSocket from 'ws';
import { getAgentConfig } from './config';

function makeAgentToken(): string {
  const config = getAgentConfig();
  const w = Math.floor(Date.now() / 30000);
  return crypto
    .createHmac('sha256', config.relaySecret)
    .update(`${config.vesselId}:agent:${w}`)
    .digest('hex');
}

let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function connect(): void {
  const config = getAgentConfig();
  const token = makeAgentToken();
  const url   = `${config.relayUrl}/ws?type=agent&vesselId=${encodeURIComponent(config.vesselId)}&token=${token}`;

  const ws = new WebSocket(url);
  let shell: pty.IPty | null = null;

  ws.on('open', () => {
    console.log('[shell-relay] Connected to relay');

    shell = pty.spawn('/bin/bash', [], {
      name: 'xterm-256color',
      cols: 220,
      rows: 50,
      env:  { ...process.env as Record<string, string> },
    });

    shell.onData((data: string) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(Buffer.from(data, 'binary'));
    });

    shell.onExit(({ exitCode }: { exitCode: number }) => {
      console.log(`[shell-relay] Shell exited (code ${exitCode})`);
      ws.close();
    });
  });

  ws.on('message', (data: Buffer | string) => {
    // Control messages are JSON strings; raw terminal input is binary
    if (typeof data === 'string') {
      try {
        const msg = JSON.parse(data) as { __ctrl?: string };
        if (msg.__ctrl) return; // ignore relay control frames
      } catch { /* not JSON — fall through */ }
      shell?.write(data);
      return;
    }
    if (shell) {
      shell.write(data.toString('binary'));
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
    if (!err.message.includes('ECONNREFUSED')) {
      console.error('[shell-relay] Error:', err.message);
    }
  });
}

export function startShellRelay(): void {
  const config = getAgentConfig();
  if (!config.relayUrl || !config.relaySecret) {
    console.log('[shell-relay] RELAY_URL or RELAY_SECRET not set — shell relay disabled');
    return;
  }
  console.log(`[shell-relay] Connecting to ${config.relayUrl} as vessel ${config.vesselId}`);
  connect();
}
