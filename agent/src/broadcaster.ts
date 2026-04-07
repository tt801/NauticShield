import { WebSocketServer, WebSocket } from 'ws';
import type { WsServerMessage } from './types';

let wss: WebSocketServer | null = null;

export function initBroadcaster(server: WebSocketServer): void {
  wss = server;
}

export function broadcast(message: WsServerMessage): void {
  if (!wss) return;
  const payload = JSON.stringify(message);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

export function connectedClients(): number {
  return wss ? wss.clients.size : 0;
}
