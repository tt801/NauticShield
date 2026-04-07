export type DeviceType = 'router' | 'phone' | 'laptop' | 'tv' | 'camera' | 'terminal' | 'navigation' | 'ais' | 'tablet' | 'unknown';
export type DeviceStatus = 'online' | 'offline' | 'unknown';
export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  ip: string;
  status: DeviceStatus;
  lastSeen: string;
  macAddress: string;
}

export interface Alert {
  id: string;
  timestamp: string;
  severity: AlertSeverity;
  title: string;
  description: string;
}

export interface NetworkStatus {
  internetStatus: 'good' | 'slow' | 'down';
  downloadSpeed: number;
  uploadSpeed: number;
  healthScore: number;
  primaryConnection: string;
  backupConnection: string;
  backupStatus: string;
  latency: number;
}

const now = new Date();
const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000).toISOString();
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60 * 1000).toISOString();

export const devices: Device[] = [
  {
    id: 'd1',
    name: 'Main Router',
    type: 'router',
    ip: '192.168.1.1',
    status: 'online',
    lastSeen: minutesAgo(1),
    macAddress: 'A4:C3:F0:11:22:33',
  },
  {
    id: 'd2',
    name: 'Starlink Terminal',
    type: 'terminal',
    ip: '192.168.1.2',
    status: 'online',
    lastSeen: minutesAgo(2),
    macAddress: 'B8:27:EB:44:55:66',
  },
  {
    id: 'd3',
    name: "Captain's iPhone",
    type: 'phone',
    ip: '192.168.1.45',
    status: 'online',
    lastSeen: minutesAgo(5),
    macAddress: 'F0:18:98:77:88:99',
  },
  {
    id: 'd4',
    name: "Engineer's MacBook",
    type: 'laptop',
    ip: '192.168.1.67',
    status: 'online',
    lastSeen: minutesAgo(12),
    macAddress: '3C:06:30:AA:BB:CC',
  },
  {
    id: 'd5',
    name: 'Master Cabin TV',
    type: 'tv',
    ip: '192.168.1.89',
    status: 'online',
    lastSeen: hoursAgo(1),
    macAddress: '00:1A:2B:DD:EE:FF',
  },
  {
    id: 'd6',
    name: 'Guest Cabin 1 TV',
    type: 'tv',
    ip: '192.168.1.91',
    status: 'offline',
    lastSeen: hoursAgo(6),
    macAddress: '00:1A:2B:11:22:44',
  },
  {
    id: 'd7',
    name: 'Guest Cabin 2 TV',
    type: 'tv',
    ip: '192.168.1.92',
    status: 'online',
    lastSeen: minutesAgo(30),
    macAddress: '00:1A:2B:55:66:77',
  },
  {
    id: 'd8',
    name: 'iPad (Salon)',
    type: 'tablet',
    ip: '192.168.1.112',
    status: 'online',
    lastSeen: minutesAgo(45),
    macAddress: 'AC:BC:32:88:99:00',
  },
  {
    id: 'd9',
    name: 'Security Camera 1',
    type: 'camera',
    ip: '192.168.1.150',
    status: 'online',
    lastSeen: minutesAgo(3),
    macAddress: 'D4:38:9C:CC:DD:EE',
  },
  {
    id: 'd10',
    name: 'Security Camera 2',
    type: 'camera',
    ip: '192.168.1.151',
    status: 'offline',
    lastSeen: hoursAgo(3),
    macAddress: 'D4:38:9C:FF:00:11',
  },
  {
    id: 'd11',
    name: 'UNKNOWN DEVICE',
    type: 'unknown',
    ip: '192.168.1.200',
    status: 'unknown',
    lastSeen: hoursAgo(2),
    macAddress: '??:??:??:22:33:44',
  },
  {
    id: 'd12',
    name: 'UNKNOWN DEVICE',
    type: 'unknown',
    ip: '192.168.1.201',
    status: 'unknown',
    lastSeen: hoursAgo(1),
    macAddress: '??:??:??:55:66:77',
  },
  {
    id: 'd13',
    name: 'Navigation System',
    type: 'navigation',
    ip: '192.168.1.30',
    status: 'online',
    lastSeen: minutesAgo(2),
    macAddress: '00:50:C2:12:34:56',
  },
  {
    id: 'd14',
    name: 'AIS Transponder',
    type: 'ais',
    ip: '192.168.1.31',
    status: 'online',
    lastSeen: minutesAgo(1),
    macAddress: '00:50:C2:78:9A:BC',
  },
];

export const alerts: Alert[] = [
  {
    id: 'a1',
    timestamp: hoursAgo(1),
    severity: 'critical',
    title: 'Starlink Connection Lost',
    description: 'Primary internet connection via Starlink is down. Failover to LTE backup initiated automatically.',
  },
  {
    id: 'a2',
    timestamp: hoursAgo(2),
    severity: 'critical',
    title: 'Unknown Device Detected on Network',
    description: 'An unrecognized device (192.168.1.201) has connected to the vessel network. Immediate investigation recommended.',
  },
  {
    id: 'a3',
    timestamp: hoursAgo(5),
    severity: 'warning',
    title: 'Guest Cabin 1 TV Offline',
    description: 'Smart TV in Guest Cabin 1 (192.168.1.91) has gone offline. Guest experience may be affected.',
  },
  {
    id: 'a4',
    timestamp: hoursAgo(4),
    severity: 'warning',
    title: 'Internet Speed Degraded',
    description: 'Download speed has dropped below 10 Mbps threshold. Current speed: 4.2 Mbps. Starlink signal quality may be reduced.',
  },
  {
    id: 'a5',
    timestamp: hoursAgo(3),
    severity: 'warning',
    title: 'Security Camera 2 Offline',
    description: 'Security Camera 2 (192.168.1.151) is no longer transmitting. Blind spot in stern monitoring area.',
  },
  {
    id: 'a6',
    timestamp: minutesAgo(30),
    severity: 'info',
    title: 'Network Health Check Completed',
    description: 'Scheduled network health check completed successfully. Overall health score: 87%. All critical systems operational.',
  },
  {
    id: 'a7',
    timestamp: minutesAgo(45),
    severity: 'info',
    title: 'Starlink Connection Restored',
    description: 'Primary internet connection via Starlink has been restored. Failback from LTE completed. Speed nominal.',
  },
  {
    id: 'a8',
    timestamp: hoursAgo(7),
    severity: 'info',
    title: 'New Device Connected: iPad (Salon)',
    description: 'A new iPad has joined the network on 192.168.1.112. Device has been registered as iPad (Salon).',
  },
];

export const networkStatus: NetworkStatus = {
  internetStatus: 'good',
  downloadSpeed: 45.2,
  uploadSpeed: 18.7,
  healthScore: 87,
  primaryConnection: 'Starlink',
  backupConnection: 'LTE',
  backupStatus: 'Standby',
  latency: 38,
};
