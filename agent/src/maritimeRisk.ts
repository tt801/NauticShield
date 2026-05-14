/// <reference types="node" />
import net from 'net';

import * as db from './db';
import type { Device } from './types';

export interface GnssInputSample {
  timestamp?: string;
  lat: number;
  lon: number;
  sogKnots?: number;
  cogDeg?: number;
  satelliteCount?: number;
  source?: string;
}

export interface GnssAnomaly {
  kind: 'improbable_jump' | 'satellite_drop' | 'heading_speed_mismatch';
  severity: 'critical' | 'warning';
  detail: string;
  at: string;
}

export interface EdgeExposureFinding {
  deviceId: string;
  deviceName: string;
  ip: string;
  port: number;
  protocol: 'tcp';
  severity: 'critical' | 'warning';
  reason: string;
}

export interface RogueDeviceFinding {
  deviceId: string;
  deviceName: string;
  ip: string;
  severity: 'critical' | 'warning';
  reason: string;
}

export interface MaritimeRiskSnapshot {
  generatedAt: string;
  riskScore: number;
  gnss: {
    sampleCount: number;
    anomalies: GnssAnomaly[];
    latestSampleAt?: string;
    profileMode: 'auto' | 'anchor' | 'underway';
  };
  edgeExposure: {
    scannedDevices: number;
    findings: EdgeExposureFinding[];
    lastScannedAt?: string;
  };
  rogueActivity: {
    monitoredDevices: number;
    findings: RogueDeviceFinding[];
  };
}

type GnssProfileName = 'anchor' | 'underway';
type GnssProfileMode = 'auto' | GnssProfileName;

interface GnssThresholdProfile {
  maxKnots: number;
  maxJumpNm: number;
  minSatellites: number;
  satDropTrigger: number;
  stationarySogLt: number;
  mismatchImpliedKnotsGt: number;
}

const GNSS_PROFILE_MODE = (process.env.GNSS_PROFILE_MODE ?? 'auto') as GnssProfileMode;
const GNSS_ANCHOR_SOG_THRESHOLD = parseFloat(process.env.GNSS_ANCHOR_SOG_THRESHOLD ?? '2.5');
const GNSS_ANOMALY_LOOKBACK_MINUTES = parseInt(process.env.GNSS_ANOMALY_LOOKBACK_MINUTES ?? '1', 10);

const GNSS_ANCHOR_PROFILE: GnssThresholdProfile = {
  maxKnots: parseFloat(process.env.GNSS_ANCHOR_MAX_SPEED_KNOTS ?? '28'),
  maxJumpNm: parseFloat(process.env.GNSS_ANCHOR_MAX_POSITION_JUMP_NM ?? '0.7'),
  minSatellites: parseInt(process.env.GNSS_ANCHOR_MIN_SATELLITES ?? '5', 10),
  satDropTrigger: parseInt(process.env.GNSS_ANCHOR_SATELLITE_DROP_TRIGGER ?? '4', 10),
  stationarySogLt: parseFloat(process.env.GNSS_ANCHOR_STATIONARY_SOG_LT ?? '1.8'),
  mismatchImpliedKnotsGt: parseFloat(process.env.GNSS_ANCHOR_MISMATCH_KNOTS_GT ?? '12'),
};

const GNSS_UNDERWAY_PROFILE: GnssThresholdProfile = {
  maxKnots: parseFloat(process.env.GNSS_UNDERWAY_MAX_SPEED_KNOTS ?? '75'),
  maxJumpNm: parseFloat(process.env.GNSS_UNDERWAY_MAX_POSITION_JUMP_NM ?? '9.0'),
  minSatellites: parseInt(process.env.GNSS_UNDERWAY_MIN_SATELLITES ?? '4', 10),
  satDropTrigger: parseInt(process.env.GNSS_UNDERWAY_SATELLITE_DROP_TRIGGER ?? '5', 10),
  stationarySogLt: parseFloat(process.env.GNSS_UNDERWAY_STATIONARY_SOG_LT ?? '1.2'),
  mismatchImpliedKnotsGt: parseFloat(process.env.GNSS_UNDERWAY_MISMATCH_KNOTS_GT ?? '30'),
};

const EDGE_SCAN_INTERVAL_MS = parseInt(process.env.EDGE_SCAN_INTERVAL_MS ?? '300000', 10);
const EDGE_TIMEOUT_MS = parseInt(process.env.EDGE_PORT_TIMEOUT_MS ?? '280', 10);

const EDGE_PORTS: Array<{ port: number; severity: 'critical' | 'warning'; reason: string }> = [
  { port: 23, severity: 'critical', reason: 'Telnet management is exposed' },
  { port: 21, severity: 'warning', reason: 'FTP service is exposed' },
  { port: 80, severity: 'warning', reason: 'HTTP management interface is exposed' },
  { port: 8080, severity: 'warning', reason: 'Alternate HTTP management interface is exposed' },
  { port: 8291, severity: 'warning', reason: 'MikroTik WinBox management port is exposed' },
  { port: 8728, severity: 'warning', reason: 'MikroTik API management port is exposed' },
  { port: 7547, severity: 'warning', reason: 'CWMP/TR-069 remote management port is exposed' },
];

let edgeCache: {
  scannedDevices: number;
  findings: EdgeExposureFinding[];
  lastScannedAt?: string;
} = {
  scannedDevices: 0,
  findings: [],
};

let edgeScanInFlight: Promise<void> | null = null;

function haversineNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const km = 6371 * c;
  return km * 0.539957;
}

function isTcpPortOpen(host: string, port: number, timeoutMs = EDGE_TIMEOUT_MS): Promise<boolean> {
  return new Promise(resolve => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (open: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(open);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, host);
  });
}

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map(p => parseInt(p, 10));
  if (parts.length !== 4 || parts.some(n => Number.isNaN(n) || n < 0 || n > 255)) return false;
  if (parts[0] === 10) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  return false;
}

function evaluateRogueDeviceActivity(devices: Device[]): RogueDeviceFinding[] {
  const findings: RogueDeviceFinding[] = [];

  for (const device of devices) {
    if (device.status !== 'online') continue;
    const normalizedType = (device.type ?? 'unknown').toLowerCase();

    if (normalizedType === 'unknown' && !device.blocked) {
      findings.push({
        deviceId: device.id,
        deviceName: device.name,
        ip: device.ip,
        severity: 'warning',
        reason: 'Unclassified device is active on the network and not isolated.',
      });
    }

    if (!isPrivateIpv4(device.ip)) {
      findings.push({
        deviceId: device.id,
        deviceName: device.name,
        ip: device.ip,
        severity: 'critical',
        reason: 'Device reports a non-private IP; possible rogue bridge, NAT bypass, or scan artifact.',
      });
    }

    if ((device.blocked ?? false) && device.status === 'online') {
      findings.push({
        deviceId: device.id,
        deviceName: device.name,
        ip: device.ip,
        severity: 'warning',
        reason: 'Device is marked blocked but still appears online; verify enforcement at the edge.',
      });
    }
  }

  return findings.slice(0, 10);
}

function evaluateGnssAnomalies(samplesNewestFirst: db.GnssSample[]): GnssAnomaly[] {
  const anomalies: GnssAnomaly[] = [];
  const samples = [...samplesNewestFirst].reverse();

  const profileForPair = (prev: db.GnssSample, curr: db.GnssSample): { name: GnssProfileName; cfg: GnssThresholdProfile } => {
    const fixedProfile = GNSS_PROFILE_MODE === 'anchor' || GNSS_PROFILE_MODE === 'underway'
      ? GNSS_PROFILE_MODE
      : null;
    const pairProfile: GnssProfileName = fixedProfile
      ?? (Math.max(prev.sogKnots, curr.sogKnots) < GNSS_ANCHOR_SOG_THRESHOLD ? 'anchor' : 'underway');
    return {
      name: pairProfile,
      cfg: pairProfile === 'anchor' ? GNSS_ANCHOR_PROFILE : GNSS_UNDERWAY_PROFILE,
    };
  };

  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1];
    const curr = samples[i];
    const prevTs = Date.parse(prev.timestamp);
    const currTs = Date.parse(curr.timestamp);
    if (Number.isNaN(prevTs) || Number.isNaN(currTs) || currTs <= prevTs) continue;

    const dtHours = (currTs - prevTs) / 3_600_000;
    const distanceNm = haversineNm(prev.lat, prev.lon, curr.lat, curr.lon);
    const inferredKnots = distanceNm / dtHours;
    const { name: profileName, cfg } = profileForPair(prev, curr);
    const reacquiringGnss = prev.satelliteCount < cfg.minSatellites && curr.satelliteCount >= cfg.minSatellites;

    if (!reacquiringGnss && distanceNm >= cfg.maxJumpNm && inferredKnots > cfg.maxKnots) {
      anomalies.push({
        kind: 'improbable_jump',
        severity: 'critical',
        at: curr.timestamp,
        detail: `Position jump ${distanceNm.toFixed(2)}nm over ${Math.max(dtHours * 60, 1).toFixed(1)} min implies ${inferredKnots.toFixed(1)}kt (${profileName} profile).`,
      });
    }

    const satDrop = prev.satelliteCount - curr.satelliteCount;
    if (satDrop >= cfg.satDropTrigger && curr.satelliteCount < cfg.minSatellites) {
      anomalies.push({
        kind: 'satellite_drop',
        severity: 'warning',
        at: curr.timestamp,
        detail: `Satellite lock dropped by ${satDrop} (now ${curr.satelliteCount}) on ${profileName} profile. Verify antenna line-of-sight and interference.`,
      });
    }

    const sog = Math.max(curr.sogKnots, 0);
    const stationary = sog < cfg.stationarySogLt;
    if (!reacquiringGnss && stationary && curr.cogDeg > 1 && inferredKnots > cfg.mismatchImpliedKnotsGt) {
      anomalies.push({
        kind: 'heading_speed_mismatch',
        severity: 'warning',
        at: curr.timestamp,
        detail: `Reported SOG ${sog.toFixed(1)}kt while position implies ${inferredKnots.toFixed(1)}kt movement (${profileName} profile).`,
      });
    }
  }

  const lookbackMs = Math.max(1, GNSS_ANOMALY_LOOKBACK_MINUTES) * 60_000;
  const nowMs = Date.now();
  const freshAnomalies = anomalies
    .filter(a => {
      const ts = Date.parse(a.at);
      if (Number.isNaN(ts)) return true;
      return (nowMs - ts) <= lookbackMs;
    });

  const latestSampleAt = samplesNewestFirst[0]?.timestamp;
  const latestSampleAnomalies = latestSampleAt
    ? freshAnomalies.filter(a => a.at === latestSampleAt)
    : [];

  return latestSampleAnomalies.slice(-6);
}

async function runEdgeScan(devices: Device[]): Promise<void> {
  if (edgeScanInFlight) {
    await edgeScanInFlight;
    return;
  }

  edgeScanInFlight = (async () => {
    const candidateDevices = devices
      .filter(d => d.status === 'online' && ['router', 'firewall', 'access-point', 'switch'].includes(d.type))
      .slice(0, 6);

    const findings: EdgeExposureFinding[] = [];
    for (const device of candidateDevices) {
      for (const portDef of EDGE_PORTS) {
        const open = await isTcpPortOpen(device.ip, portDef.port);
        if (!open) continue;
        findings.push({
          deviceId: device.id,
          deviceName: device.name,
          ip: device.ip,
          port: portDef.port,
          protocol: 'tcp',
          severity: portDef.severity,
          reason: portDef.reason,
        });
      }
    }

    edgeCache = {
      scannedDevices: candidateDevices.length,
      findings,
      lastScannedAt: new Date().toISOString(),
    };
  })();

  try {
    await edgeScanInFlight;
  } finally {
    edgeScanInFlight = null;
  }
}

export function ingestGnssSample(input: GnssInputSample): db.GnssSample {
  const timestamp = input.timestamp && !Number.isNaN(Date.parse(input.timestamp))
    ? input.timestamp
    : new Date().toISOString();

  const sample = db.addGnssSample({
    timestamp,
    lat: input.lat,
    lon: input.lon,
    sogKnots: input.sogKnots ?? 0,
    cogDeg: input.cogDeg ?? 0,
    satelliteCount: input.satelliteCount ?? 0,
    source: input.source ?? 'manual',
  });

  db.trimOldGnssSamples(48);
  return sample;
}

export function listRecentGnssSamples(limit = 60): db.GnssSample[] {
  return db.getRecentGnssSamples(limit);
}

export async function evaluateMaritimeRisk(devices: Device[], forceEdgeScan = false): Promise<MaritimeRiskSnapshot> {
  const samples = db.getRecentGnssSamples(80);
  const anomalies = evaluateGnssAnomalies(samples);
  const rogueFindings = evaluateRogueDeviceActivity(devices);

  const now = Date.now();
  const shouldRunEdge = forceEdgeScan || !edgeCache.lastScannedAt || (now - Date.parse(edgeCache.lastScannedAt)) > EDGE_SCAN_INTERVAL_MS;
  if (shouldRunEdge) {
    await runEdgeScan(devices);
  }

  const criticalCount =
    anomalies.filter(a => a.severity === 'critical').length +
    edgeCache.findings.filter(f => f.severity === 'critical').length +
    rogueFindings.filter(f => f.severity === 'critical').length;
  const warningCount =
    anomalies.filter(a => a.severity === 'warning').length +
    edgeCache.findings.filter(f => f.severity === 'warning').length +
    rogueFindings.filter(f => f.severity === 'warning').length;
  const riskScore = Math.max(0, Math.min(100, 100 - criticalCount * 22 - warningCount * 8));

  return {
    generatedAt: new Date().toISOString(),
    riskScore,
    gnss: {
      sampleCount: samples.length,
      anomalies,
      latestSampleAt: samples[0]?.timestamp,
      profileMode: GNSS_PROFILE_MODE,
    },
    edgeExposure: {
      scannedDevices: edgeCache.scannedDevices,
      findings: edgeCache.findings,
      lastScannedAt: edgeCache.lastScannedAt,
    },
    rogueActivity: {
      monitoredDevices: devices.length,
      findings: rogueFindings,
    },
  };
}
