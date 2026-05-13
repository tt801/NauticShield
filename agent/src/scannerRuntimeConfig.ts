import fs from 'fs';
import path from 'path';
import type { ScanSubnetMode } from './scanner';

export interface ScannerRuntimeConfig {
  scanMode: ScanSubnetMode;
  subnet?: string;
  allowedSubnets: string[];
  warnAfterCycles: number;
}

interface PersistedScannerRuntimeConfig {
  scanMode?: string;
  subnet?: string;
  allowedSubnets?: string[];
  warnAfterCycles?: number;
}

const CONFIG_PATH =
  process.env.SCANNER_CONFIG_PATH ??
  path.resolve(process.cwd(), 'data/scanner-config.json');

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

function normalizeMode(value: string | undefined | null): ScanSubnetMode {
  const raw = (value ?? '').trim().toLowerCase();
  if (raw === 'fixed' || raw === 'all') return raw;
  return 'auto';
}

function normalizeAllowedSubnets(value: string[] | undefined | null): string[] {
  if (!value || value.length === 0) return [];
  return value
    .map(normalizeSubnet)
    .filter((v): v is string => Boolean(v));
}

function parseAllowedSubnetsFromEnv(value: string | undefined): string[] {
  if (!value) return [];
  return normalizeAllowedSubnets(value.split(',').map(v => v.trim()).filter(Boolean));
}

function readPersistedConfig(): PersistedScannerRuntimeConfig | null {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return null;
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    return JSON.parse(raw) as PersistedScannerRuntimeConfig;
  } catch {
    return null;
  }
}

function writePersistedConfig(config: ScannerRuntimeConfig): void {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function buildInitialConfig(): ScannerRuntimeConfig {
  const persisted = readPersistedConfig();

  const envMode = normalizeMode(process.env.SCAN_SUBNET_MODE);
  const envSubnet = normalizeSubnet(process.env.SUBNET);
  const envAllowedSubnets = parseAllowedSubnetsFromEnv(process.env.SCAN_ALLOWED_SUBNETS);
  const envWarn = Math.max(1, parseInt(process.env.SUBNET_MISS_WARN_CYCLES ?? '3', 10));

  const mode = normalizeMode(persisted?.scanMode ?? envMode);
  const subnet = mode === 'fixed' ? normalizeSubnet(persisted?.subnet ?? envSubnet) : undefined;
  const allowedSubnets = normalizeAllowedSubnets(persisted?.allowedSubnets ?? envAllowedSubnets);
  const warnAfterCycles = Math.max(1, Number(persisted?.warnAfterCycles ?? envWarn));

  return {
    scanMode: mode,
    subnet,
    allowedSubnets,
    warnAfterCycles,
  };
}

let runtimeConfig = buildInitialConfig();

export function getScannerRuntimeConfig(): ScannerRuntimeConfig {
  return {
    ...runtimeConfig,
    allowedSubnets: [...runtimeConfig.allowedSubnets],
  };
}

export function updateScannerRuntimeConfig(
  patch: Partial<ScannerRuntimeConfig>
): ScannerRuntimeConfig {
  const nextMode = patch.scanMode ? normalizeMode(patch.scanMode) : runtimeConfig.scanMode;

  const next: ScannerRuntimeConfig = {
    scanMode: nextMode,
    // Auto mode should never retain a stale manual subnet override.
    subnet:
      nextMode !== 'fixed'
        ? undefined
        : patch.subnet !== undefined
          ? normalizeSubnet(patch.subnet)
          : runtimeConfig.subnet,
    allowedSubnets:
      nextMode === 'auto'
        ? []
        : patch.allowedSubnets !== undefined
        ? normalizeAllowedSubnets(patch.allowedSubnets)
        : runtimeConfig.allowedSubnets,
    warnAfterCycles:
      patch.warnAfterCycles !== undefined
        ? Math.max(1, Number(patch.warnAfterCycles) || 1)
        : runtimeConfig.warnAfterCycles,
  };

  runtimeConfig = next;
  writePersistedConfig(runtimeConfig);
  return getScannerRuntimeConfig();
}
