import { AGENT_URL, API_TIMEOUT } from './config';
import type { Device, Alert, InternetStatus, NetworkHealth } from '@/data/mock';

export type { Device, Alert, InternetStatus, NetworkHealth };

// ── Voyage entry (mirrors agent db.VoyageEntry) ───────────────────

export interface VoyageEntry {
  id:           string;
  date:         string;
  location:     string;
  region:       string;
  avgDownMbps:  number;
  avgLatencyMs: number;
  uptimePct:    number;
  provider:     string;
  incidents:    number;
  blocks:       string; // JSON string of ('good'|'slow'|'down')[]
  notes:        string;
  createdAt:    string;
}

export interface VesselSnapshot {
  devices:        Device[];
  alerts:         Alert[];
  internetStatus: InternetStatus;
  networkHealth:  NetworkHealth;
  timestamp:      string;
}

// ── Fetch with abort-based timeout ────────────────────────────────

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), API_TIMEOUT);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json() as T;
  } finally {
    clearTimeout(timer);
  }
}

// ── Agent REST API ────────────────────────────────────────────────

export const agentApi = {
  health: () =>
    fetchJSON<{ status: string; uptime: number }>(`${AGENT_URL}/api/health`),

  snapshot: () =>
    fetchJSON<VesselSnapshot>(`${AGENT_URL}/api/snapshot`),

  devices: () =>
    fetchJSON<Device[]>(`${AGENT_URL}/api/devices`),

  alerts: () =>
    fetchJSON<Alert[]>(`${AGENT_URL}/api/alerts`),

  resolveAlert: (id: string) =>
    fetchJSON<{ success: boolean }>(`${AGENT_URL}/api/alerts/${id}/resolve`, { method: 'POST' }),

  renameDevice: (id: string, patch: { name?: string; type?: string; location?: string }) =>
    fetchJSON<Device>(`${AGENT_URL}/api/devices/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(patch),
    }),

  status: () =>
    fetchJSON<{ internetStatus: InternetStatus; networkHealth: NetworkHealth }>(
      `${AGENT_URL}/api/status`
    ),

  runAction: (action: string, payload?: Record<string, unknown>) =>
    fetchJSON<{ success: boolean; message: string }>(`${AGENT_URL}/api/actions/${action}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    payload ? JSON.stringify(payload) : undefined,
    }),

  voyage: {
    list: () =>
      fetchJSON<VoyageEntry[]>(`${AGENT_URL}/api/voyage`),

    add: (entry: Omit<VoyageEntry, 'id' | 'createdAt'>) =>
      fetchJSON<VoyageEntry>(`${AGENT_URL}/api/voyage`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(entry),
      }),

    update: (id: string, patch: Partial<Omit<VoyageEntry, 'id' | 'createdAt'>>) =>
      fetchJSON<VoyageEntry>(`${AGENT_URL}/api/voyage/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(patch),
      }),

    delete: (id: string) =>
      fetchJSON<{ ok: boolean }>(`${AGENT_URL}/api/voyage/${id}`, { method: 'DELETE' }),
  },
};
