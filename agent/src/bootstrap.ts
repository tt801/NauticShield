import { getAgentConfig, writeBootstrapConfig } from './config';

const BOOTSTRAP_URL = process.env.BOOTSTRAP_URL?.replace(/\/$/, '');
const BOOTSTRAP_TOKEN = process.env.BOOTSTRAP_TOKEN?.trim();

export async function bootstrapAgent() {
  const config = getAgentConfig();
  const hasProvisionedCloud = config.cloudApiKey && config.cloudSyncUrl && config.vesselId !== 'unknown';
  const hasProvisionedRelay = config.relayUrl && config.relaySecret;

  if (hasProvisionedCloud && hasProvisionedRelay) {
    return;
  }
  if (!BOOTSTRAP_URL || !BOOTSTRAP_TOKEN) {
    return;
  }

  const res = await fetch(`${BOOTSTRAP_URL}/api/vessels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bootstrapToken: BOOTSTRAP_TOKEN }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Bootstrap failed: HTTP ${res.status} ${text.slice(0, 120)}`);
  }

  const bundle = await res.json() as {
    vesselId: string;
    vesselName: string | null;
    cloudSyncUrl: string;
    cloudApiKey: string;
    relayUrl: string | null;
    relaySecret: string | null;
    provisionedAt: string;
  };

  writeBootstrapConfig(bundle);
  console.log(`[bootstrap] Provisioned vessel ${bundle.vesselId}`);
}