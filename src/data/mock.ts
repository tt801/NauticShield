export type ConnectionStatus = 'good' | 'slow' | 'down';
export type DeviceStatus = 'online' | 'offline' | 'unknown';
export type DeviceType = 'phone' | 'laptop' | 'tv' | 'camera' | 'router' | 'unknown';
export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface InternetStatus {
  status: ConnectionStatus;
  provider: 'Starlink' | 'LTE' | 'None';
  downloadMbps: number;
  uploadMbps: number;
  latencyMs: number;
  uptime: string;
}

export interface NetworkHealth {
  score: number; // 0–100
  activeDevices: number;
  totalDevices: number;
  unknownDevices: number;
  offlineDevices: number;
}

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  status: DeviceStatus;
  ip: string;
  mac: string;
  lastSeen: string;
  manufacturer?: string;
  location?: string;
}

export interface Alert {
  id: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  timestamp: string;
  resolved: boolean;
}

// ── Internet ────────────────────────────────────────────────────

export const internetStatus: InternetStatus = {
  status: 'good',
  provider: 'Starlink',
  downloadMbps: 142,
  uploadMbps: 31,
  latencyMs: 28,
  uptime: '99.7%',
};

// ── Network ─────────────────────────────────────────────────────

export const networkHealth: NetworkHealth = {
  score: 84,
  activeDevices: 23,
  totalDevices: 31,
  unknownDevices: 3,
  offlineDevices: 5,
};

// ── Devices ─────────────────────────────────────────────────────

export const devices: Device[] = [
  { id: '1',  name: "Captain's iPhone",    type: 'phone',   status: 'online',  ip: '192.168.1.101', mac: 'A4:C3:F0:11:22:33', lastSeen: '2 min ago',    location: 'Bridge' },
  { id: '2',  name: 'Chief Engineer Laptop', type: 'laptop', status: 'online', ip: '192.168.1.102', mac: 'B8:27:EB:44:55:66', lastSeen: '5 min ago',    location: 'Engine Room', manufacturer: 'Apple' },
  { id: '3',  name: 'Salon TV – Port',     type: 'tv',      status: 'online',  ip: '192.168.1.110', mac: 'C0:EE:FB:77:88:99', lastSeen: '1 min ago',    location: 'Main Salon', manufacturer: 'Samsung' },
  { id: '4',  name: 'Salon TV – Stbd',     type: 'tv',      status: 'offline', ip: '192.168.1.111', mac: 'D2:AF:4B:AA:BB:CC', lastSeen: '3 hrs ago',    location: 'Main Salon', manufacturer: 'Samsung' },
  { id: '5',  name: 'Guest Cabin 1 – TV',  type: 'tv',      status: 'online',  ip: '192.168.1.112', mac: 'E4:70:2C:DD:EE:FF', lastSeen: '12 min ago',   location: 'Guest Suite 1', manufacturer: 'LG' },
  { id: '6',  name: 'Guest Cabin 2 – TV',  type: 'tv',      status: 'online',  ip: '192.168.1.113', mac: 'F6:91:3D:10:21:32', lastSeen: '7 min ago',    location: 'Guest Suite 2', manufacturer: 'LG' },
  { id: '7',  name: 'Crew WiFi AP – Bow',  type: 'router',  status: 'online',  ip: '192.168.1.5',   mac: '02:B3:4E:43:54:65', lastSeen: 'Just now',     location: 'Bow Deck' },
  { id: '8',  name: 'Crew WiFi AP – Stern',type: 'router',  status: 'online',  ip: '192.168.1.6',   mac: '03:C4:5F:76:87:98', lastSeen: 'Just now',     location: 'Stern Deck' },
  { id: '9',  name: 'Deck Camera – Bridge',type: 'camera',  status: 'online',  ip: '192.168.1.201', mac: '04:D5:6A:A9:BA:CB', lastSeen: '1 min ago',    location: 'Bridge' },
  { id: '10', name: 'Deck Camera – Stern', type: 'camera',  status: 'offline', ip: '192.168.1.202', mac: '05:E6:7B:DC:ED:FE', lastSeen: '2 days ago',   location: 'Stern Deck' },
  { id: '11', name: 'Starlink Router',     type: 'router',  status: 'online',  ip: '192.168.100.1', mac: '06:F7:8C:EF:00:11', lastSeen: 'Just now',     location: 'Fly Bridge', manufacturer: 'SpaceX' },
  { id: '12', name: 'Unknown Device',      type: 'unknown', status: 'online',  ip: '192.168.1.188', mac: 'AA:BB:CC:DD:EE:01', lastSeen: '18 min ago' },
  { id: '13', name: 'Unknown Device',      type: 'unknown', status: 'online',  ip: '192.168.1.189', mac: 'AA:BB:CC:DD:EE:02', lastSeen: '44 min ago' },
  { id: '14', name: 'Unknown Device',      type: 'unknown', status: 'offline', ip: '192.168.1.190', mac: 'AA:BB:CC:DD:EE:03', lastSeen: '6 hrs ago' },
  { id: '15', name: 'Chief Stew iPad',     type: 'phone',   status: 'online',  ip: '192.168.1.103', mac: 'B1:22:33:44:55:C6', lastSeen: '3 min ago',    location: 'Main Salon', manufacturer: 'Apple' },
  { id: '16', name: 'Owner iPhone',        type: 'phone',   status: 'offline', ip: '192.168.1.104', mac: 'B2:33:44:55:66:D7', lastSeen: '2 days ago' },
  { id: '17', name: 'Engine Room Camera',  type: 'camera',  status: 'online',  ip: '192.168.1.203', mac: '07:08:9A:BC:DE:22', lastSeen: '1 min ago',    location: 'Engine Room' },
  { id: '18', name: 'Navigation PC',       type: 'laptop',  status: 'online',  ip: '192.168.1.120', mac: 'C3:44:55:66:77:E8', lastSeen: 'Just now',     location: 'Bridge', manufacturer: 'Panasonic' },
  { id: '19', name: 'Crew Member 1 Phone', type: 'phone',   status: 'online',  ip: '192.168.1.130', mac: 'D4:55:66:77:88:F9', lastSeen: '10 min ago',   location: 'Crew Quarters' },
  { id: '20', name: 'Crew Member 2 Phone', type: 'phone',   status: 'online',  ip: '192.168.1.131', mac: 'E5:66:77:88:99:0A', lastSeen: '22 min ago',   location: 'Crew Quarters' },
];

// ── Alerts ──────────────────────────────────────────────────────

export const alerts: Alert[] = [
  { id: '1', severity: 'critical', title: 'Stern Camera Offline',          description: 'Deck camera on stern has been unreachable for 48+ hours. Check power supply and cable connection.', timestamp: '2026-04-05T08:14:00Z', resolved: false },
  { id: '2', severity: 'critical', title: 'Salon TV (Stbd) Unreachable',   description: 'Starboard salon TV has not responded since 04:22. Guest experience may be impacted.', timestamp: '2026-04-07T04:22:00Z', resolved: false },
  { id: '3', severity: 'warning',  title: '3 Unknown Devices Detected',    description: 'Three devices with unrecognised MAC addresses are connected to the guest network. Review and identify.', timestamp: '2026-04-07T09:45:00Z', resolved: false },
  { id: '4', severity: 'warning',  title: 'High Latency Spike Detected',   description: 'Starlink latency spiked to 310 ms at 07:12 for approximately 4 minutes. Connection has since stabilised.', timestamp: '2026-04-07T07:12:00Z', resolved: true },
  { id: '5', severity: 'warning',  title: 'LTE Failover Activated',        description: 'Primary Starlink connection dropped for 6 minutes. LTE failover engaged automatically.', timestamp: '2026-04-06T22:03:00Z', resolved: true },
  { id: '6', severity: 'info',     title: 'Network Health Score Improved', description: 'Score improved from 71 to 84 after routing table update. All access points nominal.', timestamp: '2026-04-07T06:00:00Z', resolved: true },
  { id: '7', severity: 'info',     title: 'Starlink Firmware Updated',     description: 'Starlink dish firmware updated to version 2024.12.5. Reboot completed in 90 seconds.', timestamp: '2026-04-06T03:15:00Z', resolved: true },
  { id: '8', severity: 'info',     title: 'New Device Joined Network',     description: 'A new device (Samsung Galaxy S25) joined the guest Wi-Fi. MAC: AA:BB:CC:DD:EE:01.', timestamp: '2026-04-07T08:02:00Z', resolved: true },
];
