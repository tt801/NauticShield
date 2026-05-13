import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import { promisify } from 'util';
import { exec } from 'child_process';
import { reverse } from 'dns/promises';
import net from 'net';
import { v4 as uuidv4 } from 'uuid';
import type { Device, DeviceType, InternetStatus } from './types';
import * as db from './db';

const execAsync = promisify(exec);
const ENABLE_PORT_CLASSIFICATION = process.env.ENABLE_PORT_CLASSIFICATION !== '0';
const PORT_SCAN_TIMEOUT_MS = parseInt(process.env.PORT_SCAN_TIMEOUT_MS ?? '300', 10);
const ENABLE_HOSTNAME_ENRICHMENT = process.env.ENABLE_HOSTNAME_ENRICHMENT !== '0';
const ENABLE_MDNS_ENRICHMENT = process.env.ENABLE_MDNS_ENRICHMENT !== '0';
const HOSTNAME_LOOKUP_TIMEOUT_MS = parseInt(process.env.HOSTNAME_LOOKUP_TIMEOUT_MS ?? '800', 10);

// ── OUI lookup (MAC prefix → manufacturer) ────────────────────────
// Extended for superyacht baseline tech stack: routers, cameras, navigation, AV, crew devices.
// Add more as you discover device MACs in the field.

const OUI_MAP: Record<string, string> = {
  // ═══ PHONES & TABLETS ═══════════════════════════════════════════
  'A4:C3:F0': 'Apple',      'B8:E8:56': 'Apple',      'F0:18:98': 'Apple',
  'AC:DE:48': 'Apple',      '00:19:E0': 'HTC',        '00:1B:63': 'Nokia',
  '00:21:47': 'BlackBerry', 'F4:F1:5A': 'Samsung Mobile',
  
  // ═══ LAPTOPS & DESKTOPS ════════════════════════════════════════
  'B8:27:EB': 'Raspberry Pi', 'DC:A6:32': 'Raspberry Pi',
  '00:50:F2': 'Microsoft',    'B8:85:84': 'Intel',
  '00:11:43': 'Intel NUC',    '52:54:00': 'QEMU/KVM',
  
  // ═══ ROUTERS & ACCESS POINTS ═══════════════════════════════════
  'B0:BE:76': 'Ubiquiti',   '78:8A:20': 'Ubiquiti',      '24:A4:3C': 'Ubiquiti',
  '80:2A:A8': 'Ubiquiti',   'C0:51:79': 'Ubiquiti UniFi',
  '04:18:D6': 'Cisco',      '00:1A:8E': 'Cisco Linksys',
  'D8:84:6F': 'TP-Link',    '98:DE:D0': 'TP-Link',
  '5C:95:AE': 'Netgear',    'E0:55:3D': 'Netgear',
  '06:F7:8C': 'SpaceX Starlink',
  'B0:95:75': 'Zyxel',      '8C:2C:02': 'Mikrotik',
  
  // ═══ NETWORK SWITCHES & MANAGED DEVICES ═════════════════════════
  '00:11:88': 'Extreme Networks',
  '00:1A:A2': 'Arista',
  'F4:90:EA': 'Arista',
  
  // ═══ CAMERAS (IP CCTV) ══════════════════════════════════════════
  '00:40:8C': 'Axis Communications',
  'AC:CC:8E': 'Axis Communications',
  '00:0A:95': 'Hikvision',  'AC:E2:D3': 'Hikvision',
  '00:0D:4C': 'Hikvision',
  '90:A2:DA': 'Avigilon',   '00:1B:71': 'Avigilon',
  '00:1A:80': 'Bosch Security',
  'B0:C4:DE': 'DJI (drone/camera)',
  
  // ═══ NETWORK VIDEO RECORDERS (NVRs) ═════════════════════════════
  '00:1A:95': 'Hikvision NVR',
  
  // ═══ TELEVISIONS & DISPLAYS ═════════════════════════════════════
  'E0:65:31': 'Samsung TV',    'C0:EE:FB': 'Samsung TV',
  'D2:AF:4B': 'Samsung SmartTV',
  'F6:91:3D': 'LG TV',         'E4:70:2C': 'LG TV',
  '00:E0:4C': 'LG Display',
  '44:65:0D': 'Sony',
  'AA:BB:CC': 'Apple TV',      '64:A1:C3': 'Chromecast',
  
  // ═══ AV RECEIVERS & AUDIO ═══════════════════════════════════════
  '00:04:20': 'Denon',         'B0:68:E6': 'Yamaha',
  '1C:BD:B9': 'Sonos',         'B8:A9:8B': 'Bose',
  '00:11:F3': 'Harman Kardon', '78:32:1B': 'Bang & Olufsen',
  
  // ═══ AV CONTROL SYSTEMS ══════════════════════════════════════════
  'D0:A6:37': 'Crestron',      'F0:BD:E4': 'Crestron DM',
  '00:30:71': 'AMX Control',   '00:0D:57': 'Savant',
  '00:50:52': 'Control4',      'AC:00:D0': 'Control4',
  
  // ═══ PRINTERS & OFFICE ══════════════════════════════════════════
  '08:00:69': 'Xerox',         'B0:5A:DA': 'HP LaserJet',
  '00:11:22': 'Canon',
  '5C:C5:D4': 'Ricoh',
  
  // ═══ NAVIGATION & MARINE (OT) ═══════════════════════════════════
  '00:0C:F3': 'Furuno',        '00:0A:72': 'Navico',
  '00:1D:F7': 'Simrad',        '00:0B:E4': 'Garmin marine',
  '00:1A:E0': 'Raymarine',     '00:25:86': 'FLIR',
  
  // ═══ STORAGE & NAS ══════════════════════════════════════════════
  '00:11:32': 'QNAP NAS',      '00:08:55': 'Buffalo NAS',
  '54:04:A6': 'Synology NAS',  '00:23:6C': 'Seagate NAS',
  
  // ═══ GUEST & MISC DEVICES ═══════════════════════════════════════
  '1C:87:2C': 'Google Home',   '50:F5:DA': 'Alexa',
  'EC:1A:59': 'Nest/Google',   '64:30:5E': 'iRobot',
  'C8:3A:35': 'Ubiquiti Protect (NVR)',
};

export function getManufacturer(mac: string): string | undefined {
  return OUI_MAP[mac.slice(0, 8).toUpperCase()];
}

export function guessDeviceType(mac: string): DeviceType {
  const manufacturer = getManufacturer(mac) ?? '';
  
  // ROUTERS & NETWORK
  if (manufacturer.includes('Ubiquiti'))  return 'router';
  if (manufacturer.includes('Cisco'))     return 'router';
  if (manufacturer.includes('TP-Link'))   return 'router';
  if (manufacturer.includes('Netgear'))   return 'router';
  if (manufacturer.includes('Zyxel'))     return 'router';
  if (manufacturer.includes('Mikrotik'))  return 'router';
  if (manufacturer.includes('Arista'))    return 'switch';
  if (manufacturer.includes('Extreme'))   return 'switch';
  
  // CAMERAS & CCTV
  if (manufacturer.includes('Axis'))      return 'camera';
  if (manufacturer.includes('Hikvision')) return 'camera';
  if (manufacturer.includes('Avigilon'))  return 'camera';
  if (manufacturer.includes('Bosch'))     return 'camera';
  if (manufacturer.includes('Uniview'))   return 'nvr';
  if (manufacturer.includes('QNAP'))      return 'nas';
  
  // NAVIGATION & OT
  if (manufacturer.includes('Furuno'))    return 'chart-plotter';
  if (manufacturer.includes('Navico'))    return 'chart-plotter';
  if (manufacturer.includes('Simrad'))    return 'chart-plotter';
  if (manufacturer.includes('Garmin'))    return 'chart-plotter';
  if (manufacturer.includes('Raymarine')) return 'chart-plotter';
  if (manufacturer.includes('FLIR'))      return 'camera';
  
  // AV & CONTROL SYSTEMS
  if (manufacturer.includes('Crestron'))  return 'av-control';
  if (manufacturer.includes('Savant'))    return 'av-control';
  if (manufacturer.includes('Control4'))  return 'av-control';
  if (manufacturer.includes('AMX'))       return 'av-control';
  if (manufacturer.includes('Denon'))     return 'av-receiver';
  if (manufacturer.includes('Yamaha'))    return 'av-receiver';
  if (manufacturer.includes('Samsung TV')) return 'tv';
  if (manufacturer.includes('LG TV'))     return 'tv';
  if (manufacturer.includes('Apple TV'))  return 'tv';
  if (manufacturer.includes('Sony'))      return 'tv';
  if (manufacturer.includes('Chromecast')) return 'tv';
  if (manufacturer.includes('Sonos'))     return 'speaker';
  if (manufacturer.includes('Bose'))      return 'speaker';
  if (manufacturer.includes('Harman'))    return 'speaker';
  if (manufacturer.includes('Bang'))      return 'speaker';
  
  // CREW/GUEST DEVICES
  if (manufacturer.includes('Apple'))     return 'phone';
  if (manufacturer.includes('Samsung Mobile')) return 'phone';
  if (manufacturer.includes('HTC'))       return 'phone';
  if (manufacturer.includes('Nokia'))     return 'phone';
  if (manufacturer.includes('BlackBerry')) return 'phone';
  if (manufacturer.includes('Raspberry Pi')) return 'laptop';
  if (manufacturer.includes('Intel'))     return 'laptop';
  if (manufacturer.includes('Microsoft')) return 'laptop';
  if (manufacturer.includes('QEMU'))      return 'laptop';
  
  // OFFICE & UTILITY
  if (manufacturer.includes('Xerox'))     return 'printer';
  if (manufacturer.includes('HP'))        return 'printer';
  if (manufacturer.includes('Brother'))   return 'printer';
  if (manufacturer.includes('Canon'))     return 'printer';
  if (manufacturer.includes('Ricoh'))     return 'printer';
  if (manufacturer.includes('Synology'))  return 'nas';
  if (manufacturer.includes('Buffalo'))   return 'nas';
  if (manufacturer.includes('Seagate'))   return 'nas';
  
  return 'unknown';
}

// ── Port-based refinement (for unknown devices) ──────────────────

function isPortOpen(ip: string, port: number, timeoutMs = PORT_SCAN_TIMEOUT_MS): Promise<boolean> {
  return new Promise(resolve => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);

    const done = (open: boolean) => {
      socket.destroy();
      resolve(open);
    };

    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));

    socket.connect(port, ip);
  });
}

export async function classifyByPorts(ip: string, fallback: DeviceType = 'unknown'): Promise<DeviceType> {
  const probePorts = [554, 37777, 5000, 5001, 9100, 631, 445, 139, 22, 8291, 8728, 80, 443];
  const checks = await Promise.all(probePorts.map(async port => ({ port, open: await isPortOpen(ip, port) })));
  const open = new Set(checks.filter(c => c.open).map(c => c.port));

  if (open.has(554)) return 'camera';
  if (open.has(37777)) return 'nvr';
  if (open.has(9100) || open.has(631)) return 'printer';
  if (open.has(8291) || open.has(8728)) return 'router';
  if (open.has(5000) || open.has(5001)) return 'av-control';
  if (open.has(445) && open.has(139)) return 'nas';
  if (open.has(22) && !open.has(80) && !open.has(443)) return 'server';

  return fallback;
}

async function lookupHostLabel(ip: string): Promise<string | undefined> {
  const mdnsName = ENABLE_MDNS_ENRICHMENT ? await lookupMdnsHostLabel(ip) : undefined;
  if (mdnsName) return mdnsName;

  const timeout = new Promise<undefined>(resolve => setTimeout(() => resolve(undefined), HOSTNAME_LOOKUP_TIMEOUT_MS));
  const query = reverse(ip)
    .then(names => names[0])
    .catch(() => undefined);

  const hostname = await Promise.race([query, timeout]);
  if (!hostname) return undefined;

  const clean = hostname.trim();
  if (!clean) return undefined;

  // Keep labels concise and useful in row cards.
  return clean.endsWith('.local') ? clean.slice(0, -6) : clean;
}

async function lookupMdnsHostLabel(ip: string): Promise<string | undefined> {
  // Basic guard against malformed input in shell command usage.
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip)) return undefined;

  // Query multicast DNS PTR record directly. If dig is unavailable or no mDNS response,
  // this fails fast and we fall back to reverse DNS.
  try {
    const { stdout } = await execAsync(
      `dig +time=1 +tries=1 +short -x ${ip} @224.0.0.251 -p 5353`,
      { timeout: HOSTNAME_LOOKUP_TIMEOUT_MS }
    );
    const first = stdout
      .split('\n')
      .map(line => line.trim())
      .find(Boolean);
    if (!first) return undefined;

    const normalized = first.replace(/\.$/, '');
    return normalized.endsWith('.local') ? normalized.slice(0, -6) : normalized;
  } catch {
    return undefined;
  }
}

// ── ARP cache reader ──────────────────────────────────────────────

// Returns true for addresses that should never appear as managed devices
function isJunkAddress(ip: string, mac: string): boolean {
  if (mac === 'FF:FF:FF:FF:FF:FF') return true;          // broadcast MAC
  if (ip.endsWith('.255'))          return true;          // subnet broadcast
  if (ip.startsWith('224.') || ip.startsWith('239.')) return true; // multicast
  if (ip.startsWith('169.254.'))    return true;          // link-local / APIPA
  return false;
}

async function readArpCache(): Promise<{ ip: string; mac: string }[]> {
  // Linux: read /proc/net/arp directly (no exec needed)
  try {
    const content = readFileSync('/proc/net/arp', 'utf-8');
    return content
      .split('\n')
      .slice(1) // skip header line
      .map(line => {
        const parts = line.trim().split(/\s+/);
        // Flags: 0x2 = complete entry; skip 0x0 (incomplete) and broadcast
        if (parts.length < 4 || parts[2] !== '0x2') return null;
        if (parts[3] === '00:00:00:00:00:00')        return null;
        const entry = { ip: parts[0], mac: parts[3].toUpperCase() };
        if (isJunkAddress(entry.ip, entry.mac))      return null;
        return entry;
      })
      .filter((e): e is { ip: string; mac: string } => e !== null);
  } catch {
    // macOS / fallback: parse `arp -an` output
    try {
      const { stdout } = await execAsync('arp -an');
      return stdout
        .split('\n')
        .map(line => {
          const match = line.match(/\(([^)]+)\).*?([\da-f]{1,2}(?::[:\da-f]{1,2}){5})/i);
          if (!match) return null;
          const entry = { ip: match[1], mac: match[2].toUpperCase() };
          if (isJunkAddress(entry.ip, entry.mac)) return null;
          return entry;
        })
        .filter((e): e is { ip: string; mac: string } => e !== null);
    } catch {
      console.warn('[Scanner] Could not read ARP cache');
      return [];
    }
  }
}

// ── Ping ──────────────────────────────────────────────────────────

function pingHost(ip: string, timeoutMs = 1500): Promise<boolean> {
  return new Promise(resolve => {
    const args = process.platform === 'win32'
      ? ['-n', '1', '-w', String(timeoutMs), ip]
      : ['-c', '1', '-W', '1', ip];
    const proc = spawn('ping', args, { stdio: 'ignore' });
    const timer = setTimeout(() => { proc.kill(); resolve(false); }, timeoutMs + 500);
    proc.on('close', code => { clearTimeout(timer); resolve(code === 0); });
    proc.on('error', ()   => { clearTimeout(timer); resolve(false); });
  });
}

// Check external internet reachability + measure latency
export async function checkInternetConnectivity(): Promise<{ reachable: boolean; latencyMs: number }> {
  const start     = Date.now();
  const reachable = await pingHost('8.8.8.8', 3000);
  return { reachable, latencyMs: Date.now() - start };
}

// ── Main scan ─────────────────────────────────────────────────────

export async function scanNetwork(subnet: string = '192.168.1'): Promise<{
  newDevices:     Device[];
  updatedDevices: Device[];
  activeSubnet?: string;
  configuredSubnetSeen?: boolean;
}> {
  return scanNetworkWithOptions({ mode: 'fixed', subnet });
}

export type ScanSubnetMode = 'auto' | 'fixed' | 'all';

export interface ScanNetworkOptions {
  mode?: ScanSubnetMode;
  subnet?: string;
  allowedSubnets?: string[];
}

function subnetFromIp(ip: string): string | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  return `${parts[0]}.${parts[1]}.${parts[2]}`;
}

function normalizeSubnet(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  const raw = value.trim();
  if (!raw) return undefined;
  const cleaned = raw.endsWith('.0/24') ? raw.slice(0, -5) : raw;
  const parts = cleaned.split('.');
  if (parts.length !== 3) return undefined;
  if (parts.some(p => Number.isNaN(Number(p)) || Number(p) < 0 || Number(p) > 255)) return undefined;
  return cleaned;
}

export async function scanNetworkWithOptions(options: ScanNetworkOptions = {}): Promise<{
  newDevices:     Device[];
  updatedDevices: Device[];
  activeSubnet?: string;
  configuredSubnetSeen?: boolean;
}> {
  const mode: ScanSubnetMode = options.mode ?? 'auto';
  const configuredSubnet = normalizeSubnet(options.subnet);
  const allowedSubnets = (options.allowedSubnets ?? [])
    .map(normalizeSubnet)
    .filter((s): s is string => Boolean(s));

  console.log(`[Scanner] Scanning network (mode=${mode}${configuredSubnet ? `, subnet=${configuredSubnet}.0/24` : ''})…`);
  const newDevices:     Device[] = [];
  const updatedDevices: Device[] = [];

  // 1. Read ARP cache to find recently-active devices
  const arpEntries = await readArpCache();
  console.log(`[Scanner] ARP entries (raw): ${arpEntries.length}`);
  const configuredSubnetSeen = configuredSubnet
    ? arpEntries.some(entry => entry.ip.startsWith(`${configuredSubnet}.`))
    : undefined;

  // Select active subnet scope for this cycle.
  let activeSubnet: string | undefined;
  let scopedArpEntries = arpEntries;

  if (mode === 'fixed' && configuredSubnet) {
    activeSubnet = configuredSubnet;
    scopedArpEntries = arpEntries.filter(entry => entry.ip.startsWith(`${configuredSubnet}.`));
  } else if (mode === 'auto') {
    const subnetCounts = new Map<string, number>();
    for (const entry of arpEntries) {
      const subnet = subnetFromIp(entry.ip);
      if (!subnet) continue;
      if (allowedSubnets.length > 0 && !allowedSubnets.includes(subnet)) continue;
      subnetCounts.set(subnet, (subnetCounts.get(subnet) ?? 0) + 1);
    }

    const ranked = [...subnetCounts.entries()].sort((a, b) => b[1] - a[1]);
    const discoveredPrimary = ranked[0]?.[0];

    // If a configured subnet is present in ARP data, prefer it; otherwise use discovered primary.
    activeSubnet = configuredSubnet && subnetCounts.has(configuredSubnet) ? configuredSubnet : discoveredPrimary;
    if (activeSubnet) {
      scopedArpEntries = arpEntries.filter(entry => entry.ip.startsWith(`${activeSubnet}.`));
    }
  } else if (mode === 'all' && allowedSubnets.length > 0) {
    scopedArpEntries = arpEntries.filter(entry => {
      const subnet = subnetFromIp(entry.ip);
      return Boolean(subnet && allowedSubnets.includes(subnet));
    });
  }

  if (activeSubnet) {
    console.log(`[Scanner] Active subnet: ${activeSubnet}.0/24 (${scopedArpEntries.length} entries)`);
  } else {
    console.log(`[Scanner] Active subnet: all discovered (${scopedArpEntries.length} entries)`);
  }

  // 2. Ping each ARP entry to verify reachability
  const results = await Promise.all(
    scopedArpEntries.map(async entry => ({
      ...entry,
      reachable: await pingHost(entry.ip),
    }))
  );

  // 3. Upsert into DB
  for (const result of results) {
    const existing = db.getDeviceByMac(result.mac);

    if (existing) {
      const newStatus = result.reachable ? 'online' : 'offline';
      if (existing.status !== newStatus) {
        const updated = db.updateDeviceStatus(result.mac, newStatus);
        if (updated) {
          updatedDevices.push(updated);
          console.log(`[Scanner] ${updated.name}: ${existing.status} → ${newStatus}`);
        }
      }
    } else {
      const manufacturer = getManufacturer(result.mac);
      const manufacturerType = guessDeviceType(result.mac);
      let refinedType = manufacturerType;
      if (ENABLE_PORT_CLASSIFICATION && manufacturerType === 'unknown' && result.reachable) {
        refinedType = await classifyByPorts(result.ip, manufacturerType);
      }

      let discoveredName = `Device ${result.ip}`;
      if (ENABLE_HOSTNAME_ENRICHMENT) {
        const hostLabel = await lookupHostLabel(result.ip);
        if (hostLabel) discoveredName = hostLabel;
      }

      const device: Device = {
        id:           uuidv4(),
        name:         discoveredName,
        type:         refinedType,
        status:       result.reachable ? 'online' : 'offline',
        ip:           result.ip,
        mac:          result.mac,
        lastSeen:     new Date().toISOString(),
        manufacturer,
      };
      db.upsertDevice(device);
      newDevices.push(device);
      console.log(`[Scanner] New: ${device.ip} (${device.mac}) — ${device.type}`);
    }
  }

  // 4. Mark devices absent from this scan as offline if unseen for >5 min.
  // In scoped modes, only evaluate absence for devices in the active/included subnet scope.
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const seenMacs = new Set(results.map(r => r.mac));

  const isDeviceInOfflineScope = (deviceIp: string): boolean => {
    if (mode === 'fixed' || mode === 'auto') {
      if (!activeSubnet) return true;
      return deviceIp.startsWith(`${activeSubnet}.`);
    }
    if (mode === 'all' && allowedSubnets.length > 0) {
      return allowedSubnets.some(subnet => deviceIp.startsWith(`${subnet}.`));
    }
    return true;
  };

  for (const device of db.getDevices()) {
    if (!isDeviceInOfflineScope(device.ip)) continue;
    if (!seenMacs.has(device.mac) && device.status === 'online' && device.lastSeen < fiveMinutesAgo) {
      const updated = db.updateDeviceStatus(device.mac, 'offline');
      if (updated) updatedDevices.push(updated);
    }
  }

  // 5. Recompute network health
  db.recomputeNetworkHealth();
  console.log(`[Scanner] Done — ${newDevices.length} new, ${updatedDevices.length} updated.`);
  return { newDevices, updatedDevices, activeSubnet, configuredSubnetSeen };
}

// Update internet status record from a connectivity check result
export function updateInternetStatus(reachable: boolean, latencyMs: number): InternetStatus {
  const existing = db.getInternetStatus();
  const status: InternetStatus = {
    status:       reachable ? (latencyMs > 150 ? 'slow' : 'good') : 'down',
    provider:     existing?.provider ?? 'Starlink',
    downloadMbps: existing?.downloadMbps ?? 0,
    uploadMbps:   existing?.uploadMbps ?? 0,
    latencyMs,
    uptime:       existing?.uptime ?? '0%',
  };
  db.setInternetStatus(status);
  return status;
}
