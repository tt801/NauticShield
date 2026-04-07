// Shared types — mirrored structurally with the frontend @/data/mock types
// so the REST API response is drop-in compatible.

export type ConnectionStatus = 'good' | 'slow' | 'down';
export type DeviceStatus     = 'online' | 'offline' | 'unknown';
export type DeviceType       = 'phone' | 'laptop' | 'tv' | 'camera' | 'router' | 'unknown';
export type AlertSeverity    = 'critical' | 'warning' | 'info';

export interface Device {
  id:           string;
  name:         string;
  type:         DeviceType;
  status:       DeviceStatus;
  ip:           string;
  mac:          string;
  lastSeen:     string;
  manufacturer?: string;
  location?:    string;
  updatedAt?:   string;
}

export interface Alert {
  id:          string;
  severity:    AlertSeverity;
  title:       string;
  description: string;
  timestamp:   string;
  resolved:    boolean;
  resolvedAt?: string;
}

export interface InternetStatus {
  status:       ConnectionStatus;
  provider:     'Starlink' | 'LTE' | 'None';
  downloadMbps: number;
  uploadMbps:   number;
  latencyMs:    number;
  uptime:       string;
}

export interface NetworkHealth {
  score:          number;
  activeDevices:  number;
  totalDevices:   number;
  unknownDevices: number;
  offlineDevices: number;
}

export interface VesselSnapshot {
  devices:        Device[];
  alerts:         Alert[];
  internetStatus: InternetStatus;
  networkHealth:  NetworkHealth;
  timestamp:      string;
}

// ── WebSocket protocol ────────────────────────────────────────────

export type WsServerMessage =
  | { type: 'init';          data: VesselSnapshot }
  | { type: 'device:update'; data: Device }
  | { type: 'device:new';    data: Device }
  | { type: 'alert:new';     data: Alert }
  | { type: 'alert:resolve'; data: { id: string } }
  | { type: 'status:update'; data: { internetStatus: InternetStatus; networkHealth: NetworkHealth } }
  | { type: 'voyage:add';    data: unknown }
  | { type: 'voyage:update'; data: unknown }
  | { type: 'voyage:delete'; data: unknown }
  | { type: 'cyber:assessment'; data: unknown }
  | { type: 'cyber:finding'; data: unknown }
  | { type: 'pong' };

export type WsClientMessage =
  | { type: 'ping' }
  | { type: 'subscribe' };
