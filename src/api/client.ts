import { AGENT_URL, CLOUD_API_URL, VESSEL_ID, API_TIMEOUT } from './config';
import type { Device, Alert, InternetStatus, NetworkHealth } from '@/data/mock';

export type { Device, Alert, InternetStatus, NetworkHealth };

// ── Voyage entry (mirrors agent db.VoyageEntry) ───────────────────

export interface VoyageEntry {
  id:                string;
  date:              string;
  location:          string;
  region:            string;
  country:           string;
  locationTo:        string;
  locationToCountry: string;
  locationToRegion:  string;
  eta:               string;
  status:            string; // 'in_port' | 'underway' | 'completed'
  avgDownMbps:       number;
  avgLatencyMs:      number;
  uptimePct:         number;
  provider:          string;
  incidents:         number;
  blocks:            string;
  notes:             string;
  createdAt:         string;
}

export interface VesselSnapshot {
  devices:        Device[];
  alerts:         Alert[];
  internetStatus: InternetStatus;
  networkHealth:  NetworkHealth;
  timestamp:      string;
}

export interface CyberAssessment {
  id:      string;
  runAt:   string;
  score:   number;
  checks:  string; // JSON
  cadence: string;
}

export interface CyberFinding {
  id:           string;
  assessmentId: string;
  category:     string;
  check_name:   string;
  status:       string;
  detail:       string;
  weight:       number;
  findingStatus:string;
  remediatedAt: string;
  notes:        string;
  createdAt:    string;
}

// ── JWT token provider (set by AuthTokenBridge) ──────────────────
// Avoids importing Clerk hooks directly into this module (non-React file).

let _getToken: (() => Promise<string | null>) | null = null;

export function setTokenProvider(fn: () => Promise<string | null>) {
  _getToken = fn;
}

// ── Fetch with abort-based timeout + Bearer token ─────────────────

export async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), API_TIMEOUT);
  try {
    const token = _getToken ? await _getToken() : null;
    const headers: HeadersInit = {
      ...(init?.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    const res = await fetch(url, { ...init, headers, signal: controller.signal });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { const body = await res.json(); if (body?.message) msg = body.message; } catch { /* ignore */ }
      throw new Error(msg);
    }
    return await res.json() as T;
  } finally {
    clearTimeout(timer);
  }
}

// ── Connection mode ───────────────────────────────────────────────
// 'local'  = talking to the vessel mini PC directly
// 'cloud'  = local agent unreachable, falling back to cloud API
// 'offline' = both unreachable

export type ConnectionMode = 'local' | 'cloud' | 'offline';
let _connectionMode: ConnectionMode = 'local';
export const getConnectionMode = () => _connectionMode;

// Callbacks registered by the UI to react to mode changes
const _modeListeners: Array<(mode: ConnectionMode) => void> = [];
export function onConnectionModeChange(fn: (mode: ConnectionMode) => void) {
  _modeListeners.push(fn);
}
function setMode(m: ConnectionMode) {
  if (m !== _connectionMode) {
    _connectionMode = m;
    _modeListeners.forEach(fn => fn(m));
  }
}

/**
 * Like fetchJSON but automatically tries the local agent first,
 * then substitutes CLOUD_API_URL if the local agent is unreachable.
 * Pass a relative path like "/api/snapshot".
 */
export async function fetchWithFallback<T>(path: string, init?: RequestInit): Promise<T> {
  // Always try local agent first
  const localUrl = `${AGENT_URL}${path}`;
  try {
    const result = await fetchJSON<T>(localUrl, init);
    setMode('local');
    return result;
  } catch (localErr) {
    // Only try cloud fallback for network errors (not 4xx/5xx from the agent)
    const isNetworkError = localErr instanceof Error &&
      (localErr.name === 'AbortError' || localErr.message.startsWith('Failed to fetch') ||
       localErr.message.startsWith('NetworkError') || localErr.message.includes('fetch'));

    if (!isNetworkError || !CLOUD_API_URL) {
      setMode(_connectionMode === 'cloud' ? 'cloud' : 'offline');
      throw localErr;
    }

    // Try cloud fallback — map /api/foo → /api/vessels/:vesselId/foo
    try {
      const cloudPath = VESSEL_ID
        ? path.replace(/^\/api\//, `/api/vessels/${VESSEL_ID}/`)
        : path;
      const cloudUrl = `${CLOUD_API_URL}${cloudPath}`;
      const result = await fetchJSON<T>(cloudUrl, init);
      setMode('cloud');
      return result;
    } catch {
      setMode('offline');
      throw localErr; // surface the original local error
    }
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

    autofill: (date: string) =>
      fetchJSON<{ avgDownMbps: number; avgLatencyMs: number; uptimePct: number; provider: string; incidents: number; blocks: string; hasData: boolean }>(`${AGENT_URL}/api/voyage/autofill?date=${date}`),

    autofillRange: (from: string, to: string) =>
      fetchJSON<{ avgDownMbps: number; avgLatencyMs: number; uptimePct: number; provider: string; incidents: number; blocks: string; hasData: boolean }>(`${AGENT_URL}/api/voyage/autofill-range?from=${from}&to=${to}`),

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

  cyber: {
    listAssessments: () =>
      fetchJSON<CyberAssessment[]>(`${AGENT_URL}/api/cyber/assessments`),

    saveAssessment: (score: number, checks: string, cadence?: string) =>
      fetchJSON<CyberAssessment>(`${AGENT_URL}/api/cyber/assessments`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ score, checks, cadence: cadence ?? 'manual' }),
      }),

    listFindings: () =>
      fetchJSON<CyberFinding[]>(`${AGENT_URL}/api/cyber/findings`),

    updateFinding: (id: string, patch: { findingStatus?: string; notes?: string }) =>
      fetchJSON<CyberFinding>(`${AGENT_URL}/api/cyber/findings/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(patch),
      }),
  },
};
