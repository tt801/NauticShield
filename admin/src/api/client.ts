const CLOUD_API_URL = (import.meta.env.VITE_CLOUD_API_URL as string | undefined) ?? '';

let _getToken: (() => Promise<string | null>) | null = null;
export function setTokenProvider(fn: () => Promise<string | null>) { _getToken = fn; }

export async function apiCall<T>(path: string, init?: RequestInit): Promise<T> {
  const token = _getToken ? await _getToken() : null;
  const res = await fetch(`${CLOUD_API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Types ─────────────────────────────────────────────────────────

export interface AdminVessel {
  id:                    string;
  org_id:                string;
  name:                  string | null;
  last_synced_at:        string | null;
  plan:                  string | null;
  subscription_status:   string | null;
  stripe_customer_id:    string | null;
  stripe_subscription_id:string | null;
  trial_ends_at:         string | null;
  current_period_end:    string | null;
  created_at:            string;
}

export interface AdminUser {
  id:         string;
  email:      string;
  name:       string | null;
  imageUrl:   string;
  role:       string;
  createdAt:  string;
  lastSignIn: string | null;
}

export interface AuditRow {
  id:         number;
  org_id:     string | null;
  actor:      string;
  action:     string;
  resource:   string | null;
  metadata:   Record<string, unknown>;
  ip:         string | null;
  created_at: string;
}

// ── API calls ─────────────────────────────────────────────────────

export const adminApi = {
  vessels: {
    list:   ()                                              => apiCall<AdminVessel[]>('/api/admin/vessels'),
    update: (id: string, patch: Partial<AdminVessel>)      => apiCall<{ ok: boolean }>(`/api/admin/vessels?id=${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  },
  users: {
    list: (limit = 100, offset = 0) => apiCall<AdminUser[]>(`/api/admin/users?limit=${limit}&offset=${offset}`),
  },
  audit: {
    list: (params?: { limit?: number; offset?: number; action?: string }) => {
      const qs = new URLSearchParams();
      if (params?.limit)  qs.set('limit',  String(params.limit));
      if (params?.offset) qs.set('offset', String(params.offset));
      if (params?.action) qs.set('action', params.action);
      return apiCall<{ total: number; rows: AuditRow[] }>(`/api/admin/audit?${qs}`);
    },
  },
};
