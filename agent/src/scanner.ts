import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import { promisify } from 'util';
import { exec } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import type { Device, DeviceType, InternetStatus } from './types';
import * as db from './db';

const execAsync = promisify(exec);

// ── OUI lookup (MAC prefix → manufacturer) ────────────────────────
// Extend this table with your vessel's known device MACs.

const OUI_MAP: Record<string, string> = {
  'A4:C3:F0': 'Apple',      'B8:27:EB': 'Raspberry Pi', 'DC:A6:32': 'Raspberry Pi',
  'B8:E8:56': 'Apple',      'F0:18:98': 'Apple',         'AC:DE:48': 'Apple',
  'E0:65:31': 'Samsung',    'C0:EE:FB': 'Samsung',       'D2:AF:4B': 'Samsung',
  'F6:91:3D': 'LG',         'E4:70:2C': 'LG',
  '06:F7:8C': 'SpaceX',
  'B0:BE:76': 'Ubiquiti',   '78:8A:20': 'Ubiquiti',      '24:A4:3C': 'Ubiquiti',
  '00:50:F2': 'Microsoft',  'B8:85:84': 'Intel',
};

function getManufacturer(mac: string): string | undefined {
  return OUI_MAP[mac.slice(0, 8).toUpperCase()];
}

function guessDeviceType(mac: string): DeviceType {
  const manufacturer = getManufacturer(mac) ?? '';
  if (manufacturer === 'SpaceX')    return 'router';
  if (manufacturer === 'Ubiquiti')  return 'router';
  if (manufacturer === 'Apple')     return 'phone';
  if (manufacturer === 'Samsung')   return 'tv';
  if (manufacturer === 'LG')        return 'tv';
  return 'unknown';
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
}> {
  console.log(`[Scanner] Scanning ${subnet}.0/24…`);
  const newDevices:     Device[] = [];
  const updatedDevices: Device[] = [];

  // 1. Read ARP cache to find recently-active devices
  const arpEntries = await readArpCache();
  console.log(`[Scanner] ARP entries: ${arpEntries.length}`);

  // 2. Ping each ARP entry to verify reachability
  const results = await Promise.all(
    arpEntries.map(async entry => ({
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
      const device: Device = {
        id:           uuidv4(),
        name:         `Device ${result.ip}`,
        type:         guessDeviceType(result.mac),
        status:       result.reachable ? 'online' : 'offline',
        ip:           result.ip,
        mac:          result.mac,
        lastSeen:     new Date().toISOString(),
        manufacturer: getManufacturer(result.mac),
      };
      db.upsertDevice(device);
      newDevices.push(device);
      console.log(`[Scanner] New: ${device.ip} (${device.mac}) — ${device.type}`);
    }
  }

  // 4. Mark devices absent from this scan as offline if unseen for >5 min
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const seenMacs = new Set(results.map(r => r.mac));
  for (const device of db.getDevices()) {
    if (!seenMacs.has(device.mac) && device.status === 'online' && device.lastSeen < fiveMinutesAgo) {
      const updated = db.updateDeviceStatus(device.mac, 'offline');
      if (updated) updatedDevices.push(updated);
    }
  }

  // 5. Recompute network health
  db.recomputeNetworkHealth();
  console.log(`[Scanner] Done — ${newDevices.length} new, ${updatedDevices.length} updated.`);
  return { newDevices, updatedDevices };
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
