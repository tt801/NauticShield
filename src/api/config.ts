// Agent URL config.
// Override in .env.local:   VITE_AGENT_URL=http://192.168.0.125:3000
//                           VITE_CLOUD_API_URL=https://api.nauticshield.io
//
// When both are set the app tries the local agent first (fast LAN).
// If unreachable it falls back to the cloud API automatically.
function readEnvString(key: string) {
	const value = import.meta.env[key] as string | undefined;
	if (typeof value !== 'string') return undefined;

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

export const AGENT_URL     = readEnvString('VITE_AGENT_URL') ?? 'http://vessel-agent.local:3000';
export const CLOUD_API_URL = readEnvString('VITE_CLOUD_API_URL') ?? 'https://nautic-shield.vercel.app';
export const VESSEL_ID     = readEnvString('VITE_VESSEL_ID') ?? '';
export const AGENT_WS_URL  = AGENT_URL.replace(/^http/, 'ws');
export const API_TIMEOUT   = 4_000; // ms before trying cloud fallback
