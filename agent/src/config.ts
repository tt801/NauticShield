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
    vesselId: process.env.VESSEL_ID ?? persisted?.vesselId ?? 'unknown',
    vesselName: process.env.VESSEL_NAME ?? persisted?.vesselName ?? null,
    cloudSyncUrl: process.env.CLOUD_SYNC_URL ?? persisted?.cloudSyncUrl ?? '',
    cloudApiKey: process.env.CLOUD_API_KEY ?? persisted?.cloudApiKey ?? '',
    relayUrl: process.env.RELAY_URL ?? persisted?.relayUrl ?? '',
    relaySecret: process.env.RELAY_SECRET ?? persisted?.relaySecret ?? '',
  };
}