import fs from 'fs';
import path from 'path';

export interface BootstrapConfig {
  vesselId: string;
  vesselName: string | null;
  cloudSyncUrl: string;
  cloudApiKey: string;
  relayUrl: string | null;
  relaySecret: string | null;
  provisionedAt: string;
}

const CONFIG_PATH = process.env.BOOTSTRAP_CONFIG_PATH ?? path.resolve(process.cwd(), 'data/bootstrap-config.json');

function readConfigValue(value: string | undefined | null, fallback: string | null = '') {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  return fallback ?? '';
}

function readPersistedConfig(): BootstrapConfig | null {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return null;
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    return JSON.parse(raw) as BootstrapConfig;
  } catch {
    return null;
  }
}

export function writeBootstrapConfig(config: BootstrapConfig) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

export function getAgentConfig() {
  const persisted = readPersistedConfig();

  return {
    vesselId: readConfigValue(process.env.VESSEL_ID, persisted?.vesselId ?? 'unknown'),
    vesselName: readConfigValue(process.env.VESSEL_NAME, persisted?.vesselName ?? null),
    cloudSyncUrl: readConfigValue(process.env.CLOUD_SYNC_URL, persisted?.cloudSyncUrl ?? ''),
    cloudApiKey: readConfigValue(process.env.CLOUD_API_KEY, persisted?.cloudApiKey ?? ''),
    relayUrl: readConfigValue(process.env.RELAY_URL, persisted?.relayUrl ?? ''),
    relaySecret: readConfigValue(process.env.RELAY_SECRET, persisted?.relaySecret ?? ''),
  };
}