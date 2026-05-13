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
import type { ScannerDiagnostics } from '@/api/client';
import type { ScannerConfig } from '@/api/client';

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
  scannerDiagnostics: ScannerDiagnostics | null;
  agentStatus:    AgentStatus;
  lastSync:       Date | null;
  isLive:         boolean;
  resolveAlert:   (id: string) => Promise<void>;
  renameDevice:   (id: string, patch: { name?: string; type?: string; location?: string }) => Promise<void>;
  blockDevice:    (mac: string) => Promise<void>;
  unblockDevice:  (mac: string) => Promise<void>;
  runAction:      (action: string, payload?: Record<string, unknown>) => Promise<{ success: boolean; message?: string }>;
  updateScannerConfig: (patch: Partial<ScannerConfig>) => Promise<void>;
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
  | { type: 'status:update'; data: { internetStatus: InternetStatus; networkHealth: NetworkHealth; scannerDiagnostics?: ScannerDiagnostics } }
  | { type: 'pong' };

const WS_RECONNECT_BASE_MS = 1000;
const WS_RECONNECT_MAX_MS = 20000;
const WS_RECONNECT_JITTER_MS = 400;
const WS_OFFLINE_DEBOUNCE_MS = 3000;

// ── Provider ──────────────────────────────────────────────────────

export function VesselDataProvider({ children }: { children: React.ReactNode }) {
  // Seed with mock data so the UI is never empty
  const [devices,        setDevices]        = useState<Device[]>(mockDevices);
  const [alerts,         setAlerts]         = useState<Alert[]>(mockAlerts);
  const [internetStatus, setInternetStatus] = useState<InternetStatus>(mockInternetStatus);
  const [networkHealth,  setNetworkHealth]  = useState<NetworkHealth>(mockNetworkHealth);
  const [scannerDiagnostics, setScannerDiagnostics] = useState<ScannerDiagnostics | null>(null);
  const [agentStatus,    setAgentStatus]    = useState<AgentStatus>('connecting');
  const [lastSync,       setLastSync]       = useState<Date | null>(null);
  const [isLive,         setIsLive]         = useState(false);

  const wsRef        = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const offlineRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const unmountingRef = useRef(false);
  const reconnectPausedRef = useRef(false);

  // ── WebSocket ────────────────────────────────────────────────

  const connectWebSocket = useCallback(() => {
    if (unmountingRef.current) return;

    if (!AGENT_WS_URL) {
      setAgentStatus(getConnectionMode() === 'cloud' ? 'cloud' : 'offline');
      return;
    }

    // Prevent duplicate connections
    if (wsRef.current?.readyState === WebSocket.CONNECTING ||
        wsRef.current?.readyState === WebSocket.OPEN) return;

    let ws: WebSocket;
    try {
      setAgentStatus('connecting');
      ws = new WebSocket(AGENT_WS_URL);
    } catch {
      setAgentStatus(getConnectionMode() === 'cloud' ? 'cloud' : 'offline');
      return;
    }
    wsRef.current = ws;

    const scheduleReconnect = () => {
      if (unmountingRef.current) return;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);

      // Avoid noisy reconnect loops while the browser tab is backgrounded.
      if (typeof document !== 'undefined' && document.hidden) {
        reconnectPausedRef.current = true;
        return;
      }

      const attempt = reconnectAttemptRef.current + 1;
      reconnectAttemptRef.current = attempt;
      const expDelay = Math.min(WS_RECONNECT_MAX_MS, WS_RECONNECT_BASE_MS * (2 ** (attempt - 1)));
      const jitter = Math.floor(Math.random() * WS_RECONNECT_JITTER_MS);
      const delayMs = expDelay + jitter;

      console.log(`[VesselData] WS closed — reconnect attempt ${attempt} in ${delayMs}ms`);
      reconnectRef.current = setTimeout(connectWebSocket, delayMs);
    };

    ws.onopen = () => {
      console.log('[VesselData] WS connected');
      reconnectPausedRef.current = false;
      setAgentStatus('online');
      reconnectAttemptRef.current = 0;
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
      if (offlineRef.current) {
        clearTimeout(offlineRef.current);
        offlineRef.current = null;
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
            if (msg.data.scannerDiagnostics) {
              setScannerDiagnostics(msg.data.scannerDiagnostics);
            }
            setLastSync(new Date());
            break;
        }
      } catch {
        // ignore malformed frames
      }
    };

    ws.onclose = () => {
      if (unmountingRef.current) return;
      wsRef.current = null;

      // Keep UI in connecting state briefly to avoid fast online/offline flicker.
      setAgentStatus('connecting');
      if (offlineRef.current) clearTimeout(offlineRef.current);
      offlineRef.current = setTimeout(() => {
        const mode = getConnectionMode();
        setAgentStatus(mode === 'cloud' ? 'cloud' : 'offline');
        setIsLive(mode !== 'offline');
      }, WS_OFFLINE_DEBOUNCE_MS);

      scheduleReconnect();
    };

    ws.onerror = () => {
      // Let the browser/socket lifecycle emit onclose naturally.
    };
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

      // Scanner diagnostics live behind /api/status and are optional in cloud mode.
      try {
        const status = await agentApi.status();
        if (status?.scannerDiagnostics) {
          setScannerDiagnostics(status.scannerDiagnostics);
        }
      } catch {
        // status endpoint can be unavailable in offline/cloud fallback scenarios
      }
    } catch {
      setIsLive(false);
      setAgentStatus(getConnectionMode() === 'cloud' ? 'cloud' : 'offline');
    }
  }, []);

  // ── Mount / unmount ──────────────────────────────────────────

  useEffect(() => {
    unmountingRef.current = false;
    fetchSnapshot();
    connectWebSocket();

    const onVisibilityChange = () => {
      if (typeof document === 'undefined') return;
      if (!document.hidden && reconnectPausedRef.current) {
        reconnectPausedRef.current = false;
        connectWebSocket();
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }

    // WS keepalive ping every 30 s
    pingRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({ type: 'ping' }));
        } catch {
          // ignore transient send failures while socket is closing
        }
      }
    }, 30_000);

    return () => {
      unmountingRef.current = true;
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
      if (pingRef.current)      clearInterval(pingRef.current);
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (offlineRef.current)   clearTimeout(offlineRef.current);
      if (wsRef.current) {
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onerror = null;
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
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

  const blockDevice = useCallback(async (mac: string) => {
    const result = await agentApi.devices.blockDevice(mac);
    if (result?.device) {
      setDevices(prev => prev.map(d => d.mac === mac ? { ...d, ...result.device } : d));
    }
  }, []);

  const unblockDevice = useCallback(async (mac: string) => {
    const result = await agentApi.devices.unblockDevice(mac);
    if (result?.device) {
      setDevices(prev => prev.map(d => d.mac === mac ? { ...d, ...result.device } : d));
    }
  }, []);

  const runAction = useCallback(async (action: string, payload?: Record<string, unknown>) => {
    try {
      return await agentApi.runAction(action, payload);
    } catch {
      return { success: false, message: 'Agent offline — action could not be executed.' };
    }
  }, []);

  const updateScannerConfig = useCallback(async (patch: Partial<ScannerConfig>) => {
    const result = await agentApi.updateScannerConfig(patch);
    if (result.scannerDiagnostics) {
      setScannerDiagnostics(result.scannerDiagnostics);
    } else {
      const status = await agentApi.status();
      if (status.scannerDiagnostics) {
        setScannerDiagnostics(status.scannerDiagnostics);
      }
    }
  }, []);

  return (
    <VesselContext.Provider value={{
      devices, alerts, internetStatus, networkHealth,
      scannerDiagnostics,
      agentStatus, lastSync, isLive,
      resolveAlert, renameDevice, blockDevice, unblockDevice, runAction, updateScannerConfig,
    }}>
      {children}
    </VesselContext.Provider>
  );
}
