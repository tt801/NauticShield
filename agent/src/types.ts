import type { ScannerDiagnostics } from './scannerDiagnostics';
// Shared types — mirrored structurally with the frontend @/data/mock types
// so the REST API response is drop-in compatible.

export type ConnectionStatus = 'good' | 'slow' | 'down';
export type DeviceStatus     = 'online' | 'offline' | 'unknown';
export type DeviceType       = 
  // Network gear
  | 'router' 
  | 'access-point' 
  | 'switch'
  | 'firewall'
  
  // Cameras & CCTV
  | 'camera'           // IP camera
  | 'nvr'              // Network video recorder
  
  // Navigation/OT
  | 'chart-plotter'    // ECDIS or similar
  | 'radar'
  | 'ais-receiver'
  | 'engine-monitor'
  | 'autopilot'
  
  // AV / Control
  | 'av-control'       // Crestron, Savant, Control4
  | 'av-receiver'      // Denon, Yamaha
  | 'tv'
  | 'projector'
  | 'speaker'
  
  // Crew/Guest IT
  | 'phone'
  | 'tablet'
  | 'laptop'
  | 'desktop'
  
  // Other
  | 'printer'
  | 'nas'              // Network-attached storage
  | 'server'
  | 'unknown';
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
  blocked?:     boolean;           // If true, device is blocked at router
  blockedAt?:   string;            // Timestamp when block was applied
  blockedReason?: string;          // Why this device was blocked
  updatedAt?:   string;
  firstSeen?:   string;
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
  | { type: 'status:update'; data: { internetStatus: InternetStatus; networkHealth: NetworkHealth; scannerDiagnostics?: ScannerDiagnostics } }
  | { type: 'voyage:add';    data: unknown }
  | { type: 'voyage:update'; data: unknown }
  | { type: 'voyage:delete'; data: unknown }
  | { type: 'cyber:assessment'; data: unknown }
  | { type: 'cyber:finding'; data: unknown }
  | { type: 'pong' };

export type WsClientMessage =
  | { type: 'ping' }
  | { type: 'subscribe' };
