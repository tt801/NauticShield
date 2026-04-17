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

export interface PenTestReportMeta {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
  bucket: string;
  path: string;
  downloadUrl: string | null;
}

export type ReportPeriod = 'live' | 'daily' | 'weekly' | 'monthly';
export type ReportCadence = 'daily' | 'weekly' | 'monthly';

export interface ReportSchedule {
  id: string;
  name: string;
  recipient: string;
  period: ReportPeriod;
  cadence: ReportCadence;
  sendTime: string;
  timeZone: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  active: boolean;
  lastSentAt: string | null;
  updatedAt: string;
}

export type GuestDeviceAccess = 'approved' | 'blocked' | 'pending';
export type GuestSplashType = 'tos' | 'click' | 'none';

export interface GuestNetworkSpeedResult {
  dl: number;
  ul: number;
  ping: number;
  testedAt: string;
}

export interface GuestNetworkSettings {
  wifiEnabled: boolean;
  portalEnabled: boolean;
  ssid: string;
  wifiPass: string;
  splashType: GuestSplashType;
  accessMap: Record<string, GuestDeviceAccess>;
  bandwidthMap: Record<string, string>;
  lastSpeedTest: GuestNetworkSpeedResult | null;
  updatedAt: string;
}

export interface CloudBootstrapBundle {
  vesselId: string;
  vesselName: string | null;
  cloudSyncUrl: string;
  cloudApiKey: string;
  relayUrl: string | null;
  relaySecret: string | null;
  provisionedAt: string;
}

// ── JWT token provider (set by AuthTokenBridge) ──────────────────
// Avoids importing Clerk hooks directly into this module (non-React file).

let _getToken: (() => Promise<string | null>) | null = null;
let _resolvedVesselId: string | null = null;
let _resolveVesselIdPromise: Promise<string | null> | null = null;

export function setTokenProvider(fn: () => Promise<string | null>) {
  _getToken = fn;
}

// ── Fetch with abort-based timeout + Bearer token ─────────────────

export async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(new DOMException('Request timed out', 'AbortError')), API_TIMEOUT);
  try {
    const token = _getToken ? await _getToken() : null;
    const headers: HeadersInit = {
      ...(init?.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    const res = await fetch(url, { ...init, headers, signal: controller.signal });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        if (body?.message) msg = body.message;
        else if (body?.error) msg = body.error;
      } catch {
        /* ignore */
      }
      throw new Error(msg);
    }
    return await res.json() as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw error;
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
const NO_CLOUD_VESSEL_MESSAGE = 'No cloud vessel is registered for this account. Go to Settings > Cloud Sync and register or re-register this vessel first.';

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

async function resolveCloudVesselId() {
  if (_resolvedVesselId) return _resolvedVesselId;
  if (_resolveVesselIdPromise) return _resolveVesselIdPromise;
  if (!CLOUD_API_URL) return null;

  _resolveVesselIdPromise = (async () => {
    try {
      const vessels = await fetchJSON<Array<{ id: string }>>(`${CLOUD_API_URL}/api/vessels`);
      const vesselId = VESSEL_ID && vessels.some(vessel => vessel.id === VESSEL_ID)
        ? VESSEL_ID
        : (vessels[0]?.id ?? null);
      _resolvedVesselId = vesselId;
      return vesselId;
    } catch {
      return null;
    } finally {
      _resolveVesselIdPromise = null;
    }
  })();

  return _resolveVesselIdPromise;
}

export async function getResolvedCloudVesselId() {
  return resolveCloudVesselId();
}

async function toCloudVesselPath(path: string) {
  const vesselId = await resolveCloudVesselId();
  if (!vesselId) {
    throw new Error(NO_CLOUD_VESSEL_MESSAGE);
  }
  return path.replace(/^\/api\//, `/api/vessels/${vesselId}/`);
}

/**
 * Like fetchJSON but automatically tries the local agent first,
 * then substitutes CLOUD_API_URL if the local agent is unreachable.
 * Pass a relative path like "/api/snapshot".
 */
export async function fetchWithFallback<T>(path: string, init?: RequestInit): Promise<T> {
  // If no local agent is configured, go straight to cloud
  if (!AGENT_URL) {
    if (!CLOUD_API_URL) { setMode('offline'); throw new Error('No agent or cloud URL configured'); }
    try {
      const cloudPath = await toCloudVesselPath(path);
      const result = await fetchJSON<T>(`${CLOUD_API_URL}${cloudPath}`, init);
      setMode('cloud');
      return result;
    } catch (error) {
      setMode('offline');
      throw error instanceof Error ? error : new Error('Cloud API unreachable');
    }
  }

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
      const cloudPath = await toCloudVesselPath(path);
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
    fetchWithFallback<VesselSnapshot>('/api/snapshot'),

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
      fetchWithFallback<VoyageEntry[]>('/api/voyage'),

    autofill: (date: string) =>
      fetchJSON<{ avgDownMbps: number; avgLatencyMs: number; uptimePct: number; provider: string; incidents: number; blocks: string; hasData: boolean }>(`${AGENT_URL}/api/voyage/autofill?date=${date}`),

    autofillRange: async (from: string, to: string) => {
      if (!AGENT_URL) {
        return {
          avgDownMbps: 0,
          avgLatencyMs: 0,
          uptimePct: 0,
          provider: '',
          incidents: 0,
          blocks: '[]',
          hasData: false,
        };
      }

      return fetchJSON<{ avgDownMbps: number; avgLatencyMs: number; uptimePct: number; provider: string; incidents: number; blocks: string; hasData: boolean }>(`${AGENT_URL}/api/voyage/autofill-range?from=${from}&to=${to}`);
    },

    add: async (entry: Omit<VoyageEntry, 'id' | 'createdAt'>) => {
      const init: RequestInit = {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(entry),
      };

      if (!AGENT_URL) {
        return fetchWithFallback<VoyageEntry>('/api/voyage', init);
      }

      try {
        const result = await fetchJSON<VoyageEntry>(`${AGENT_URL}/api/voyage`, init);
        setMode('local');
        return result;
      } catch (error) {
        const shouldRetryInCloud = error instanceof Error && CLOUD_API_URL && (
          /date and location are required/i.test(error.message) ||
          /date is required/i.test(error.message) ||
          /method not allowed/i.test(error.message) ||
          /http 4\d\d/i.test(error.message)
        );

        if (!shouldRetryInCloud) {
          throw error;
        }

        const cloudPath = await toCloudVesselPath('/api/voyage');
        const created = await fetchJSON<VoyageEntry>(`${CLOUD_API_URL}${cloudPath}`, init);
        setMode('cloud');
        return created;
      }
    },

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

    latestPenTestReport: () => {
      if (!CLOUD_API_URL) {
        return Promise.resolve(null as PenTestReportMeta | null);
      }
      return resolveCloudVesselId().then(vesselId => {
        if (!vesselId) return null;
        return fetchJSON<PenTestReportMeta | null>(`${CLOUD_API_URL}/api/vessels/${vesselId}/pen-test-report`);
      });
    },

    uploadPenTestReport: async (payload: { fileName: string; contentType: string; fileDataBase64: string }) => {
      if (!CLOUD_API_URL) {
        throw new Error('Cloud upload is not configured for this vessel.');
      }
      const vesselId = await resolveCloudVesselId();
      if (!vesselId) {
        throw new Error(NO_CLOUD_VESSEL_MESSAGE);
      }
      return fetchJSON<PenTestReportMeta>(`${CLOUD_API_URL}/api/vessels/${vesselId}/pen-test-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    },
  },

  reports: {
    listSchedules: async () => {
      if (!CLOUD_API_URL) {
        return Promise.resolve([] as ReportSchedule[]);
      }
      const vesselId = await resolveCloudVesselId();
      if (!vesselId) return [];
      return fetchJSON<ReportSchedule[]>(`${CLOUD_API_URL}/api/vessels/${vesselId}/report-schedules`);
    },

    saveSchedules: async (schedules: ReportSchedule[]) => {
      if (!CLOUD_API_URL) {
        return Promise.reject(new Error('Cloud report schedules are not configured for this vessel.'));
      }
      const vesselId = await resolveCloudVesselId();
      if (!vesselId) {
        return Promise.reject(new Error(NO_CLOUD_VESSEL_MESSAGE));
      }
      return fetchJSON<ReportSchedule[]>(`${CLOUD_API_URL}/api/vessels/${vesselId}/report-schedules`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedules }),
      });
    },
  },

  guestNetwork: {
    load: () =>
      fetchWithFallback<GuestNetworkSettings>('/api/guest-network'),

    save: (settings: Partial<GuestNetworkSettings>) =>
      fetchWithFallback<GuestNetworkSettings>('/api/guest-network', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      }),

    runSpeedTest: () =>
      fetchWithFallback<GuestNetworkSpeedResult>('/api/guest-network/speed-test', {
        method: 'POST',
      }),
  },

  cloud: {
    createBootstrapToken: async (vesselId: string) => {
      if (!CLOUD_API_URL) throw new Error('Cloud API URL is not configured.');
      return fetchJSON<{ vesselId: string; bootstrapToken: string; expiresAt: string }>(`${CLOUD_API_URL}/api/vessels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vesselId, issueBootstrapToken: true }),
      });
    },
  },
};
