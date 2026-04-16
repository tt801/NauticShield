import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { AGENT_WS_URL } from '@/api/config';
import { agentApi, getConnectionMode }     from '@/api/client';

import {
  devices        as mockDevices,
  alerts         as mockAlerts,
  internetStatus as mockInternetStatus,
  networkHealth  as mockNetworkHealth,
} from '@/data/mock';
import type { Device, Alert, InternetStatus, NetworkHealth } from '@/data/mock';

// ── Public types ─────────────────────────────────────────────────

export type AgentStatus = 'connecting' | 'online' | 'cloud' | 'offline';

export interface VesselContextValue {
  devices:        Device[];
  alerts:         Alert[];
  internetStatus: InternetStatus;
  networkHealth:  NetworkHealth;
  agentStatus:    AgentStatus;
  lastSync:       Date | null;
  isLive:         boolean;
  resolveAlert:   (id: string) => Promise<void>;
  renameDevice:   (id: string, patch: { name?: string; type?: string; location?: string }) => Promise<void>;
  runAction:      (action: string, payload?: Record<string, unknown>) => Promise<{ success: boolean; message?: string }>;
}

// ── Context ───────────────────────────────────────────────────────

const VesselContext = createContext<VesselContextValue | null>(null);

export function useVesselData(): VesselContextValue {
  const ctx = useContext(VesselContext);
  if (!ctx) throw new Error('useVesselData must be used inside <VesselDataProvider>');
  return ctx;
}

// ── WS message shape (mirrors agent/src/types.ts) ────────────────

type WsMsg =
  | { type: 'init';          data: { devices: Device[]; alerts: Alert[]; internetStatus: InternetStatus; networkHealth: NetworkHealth } }
  | { type: 'device:update'; data: Device }
  | { type: 'device:new';    data: Device }
  | { type: 'alert:new';     data: Alert }
  | { type: 'alert:resolve'; data: { id: string } }
  | { type: 'status:update'; data: { internetStatus: InternetStatus; networkHealth: NetworkHealth } }
  | { type: 'pong' };

// ── Provider ──────────────────────────────────────────────────────

export function VesselDataProvider({ children }: { children: React.ReactNode }) {
  // Seed with mock data so the UI is never empty
  const [devices,        setDevices]        = useState<Device[]>(mockDevices);
  const [alerts,         setAlerts]         = useState<Alert[]>(mockAlerts);
  const [internetStatus, setInternetStatus] = useState<InternetStatus>(mockInternetStatus);
  const [networkHealth,  setNetworkHealth]  = useState<NetworkHealth>(mockNetworkHealth);
  const [agentStatus,    setAgentStatus]    = useState<AgentStatus>('connecting');
  const [lastSync,       setLastSync]       = useState<Date | null>(null);
  const [isLive,         setIsLive]         = useState(false);

  const wsRef        = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingRef      = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── WebSocket ────────────────────────────────────────────────

  const connectWebSocket = useCallback(() => {
    // Prevent duplicate connections
    if (wsRef.current?.readyState === WebSocket.CONNECTING ||
        wsRef.current?.readyState === WebSocket.OPEN) return;

    let ws: WebSocket;
    try {
      ws = new WebSocket(AGENT_WS_URL);
    } catch {
      setAgentStatus(getConnectionMode() === 'cloud' ? 'cloud' : 'offline');
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[VesselData] WS connected');
      setAgentStatus('online');
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
    };

    ws.onmessage = ev => {
      try {
        const msg = JSON.parse(ev.data as string) as WsMsg;
        switch (msg.type) {
          case 'init':
            setDevices(msg.data.devices);
            setAlerts(msg.data.alerts);
            setInternetStatus(msg.data.internetStatus);
            setNetworkHealth(msg.data.networkHealth);
            setIsLive(true);
            setAgentStatus('online');
            setLastSync(new Date());
            break;
          case 'device:update':
            setDevices(prev =>
              prev.map(d => d.id === msg.data.id ? msg.data : d)
            );
            setLastSync(new Date());
            break;
          case 'device:new':
            setDevices(prev => [...prev, msg.data]);
            setLastSync(new Date());
            break;
          case 'alert:new':
            setAlerts(prev => [msg.data, ...prev]);
            setLastSync(new Date());
            if (msg.data.severity === 'critical' && typeof Notification !== 'undefined') {
              if (Notification.permission === 'granted') {
                new Notification('NauticShield Alert', { body: msg.data.title, icon: '/favicon.ico' });
              } else if (Notification.permission === 'default') {
                Notification.requestPermission().then(perm => {
                  if (perm === 'granted')
                    new Notification('NauticShield Alert', { body: msg.data.title, icon: '/favicon.ico' });
                });
              }
            }
            break;
          case 'alert:resolve':
            setAlerts(prev =>
              prev.map(a => a.id === msg.data.id ? { ...a, resolved: true } : a)
            );
            break;
          case 'status:update':
            setInternetStatus(msg.data.internetStatus);
            setNetworkHealth(msg.data.networkHealth);
            setLastSync(new Date());
            break;
        }
      } catch {
        // ignore malformed frames
      }
    };

    ws.onclose = () => {
      console.log('[VesselData] WS closed — retrying in 5 s');
      const mode = getConnectionMode();
      setAgentStatus(mode === 'cloud' ? 'cloud' : 'offline');
      setIsLive(mode !== 'offline');
      reconnectRef.current = setTimeout(connectWebSocket, 5_000);
    };

    ws.onerror = () => ws.close();
  }, []);

  // ── Initial REST snapshot ───────────────────────────────────

  const fetchSnapshot = useCallback(async () => {
    try {
      const snap = await agentApi.snapshot();
      const mode = getConnectionMode();
      setDevices(snap.devices);
      setAlerts(snap.alerts);
      setInternetStatus(snap.internetStatus);
      setNetworkHealth(snap.networkHealth);
      setIsLive(mode !== 'offline');
      setAgentStatus(mode === 'cloud' ? 'cloud' : 'online');
      setLastSync(new Date());
    } catch {
      setIsLive(false);
      setAgentStatus(getConnectionMode() === 'cloud' ? 'cloud' : 'offline');
    }
  }, []);

  // ── Mount / unmount ──────────────────────────────────────────

  useEffect(() => {
    fetchSnapshot();
    connectWebSocket();

    // WS keepalive ping every 30 s
    pingRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30_000);

    return () => {
      if (pingRef.current)      clearInterval(pingRef.current);
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [fetchSnapshot, connectWebSocket]);

  // ── Actions ──────────────────────────────────────────────────

  const resolveAlert = useCallback(async (id: string) => {
    // Optimistic update first
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, resolved: true } : a));
    try { await agentApi.resolveAlert(id); } catch { /* agent might be offline */ }
  }, []);

  const renameDevice = useCallback(async (id: string, patch: { name?: string; type?: string; location?: string }) => {
    // Optimistic update
    setDevices(prev => prev.map(d => d.id === id ? { ...d, ...patch } as typeof d : d));
    try { await agentApi.renameDevice(id, patch); } catch { /* agent offline — update stays locally until next sync */ }
  }, []);

  const runAction = useCallback(async (action: string, payload?: Record<string, unknown>) => {
    try {
      return await agentApi.runAction(action, payload);
    } catch {
      return { success: false, message: 'Agent offline — action could not be executed.' };
    }
  }, []);

  return (
    <VesselContext.Provider value={{
      devices, alerts, internetStatus, networkHealth,
      agentStatus, lastSync, isLive,
      resolveAlert, renameDevice, runAction,
    }}>
      {children}
    </VesselContext.Provider>
  );
}
