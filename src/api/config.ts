// Agent URL config.
// Override in .env.local:   VITE_AGENT_URL=http://192.168.0.125:3000
//                           VITE_CLOUD_API_URL=https://api.nauticshield.io
//
// When both are set the app tries the local agent first (fast LAN).
// If unreachable it falls back to the cloud API automatically.
export const AGENT_URL     = (import.meta.env.VITE_AGENT_URL     as string | undefined) ?? 'http://vessel-agent.local:3000';
export const CLOUD_API_URL = (import.meta.env.VITE_CLOUD_API_URL as string | undefined) ?? '';
export const VESSEL_ID     = (import.meta.env.VITE_VESSEL_ID     as string | undefined) ?? '';
export const AGENT_WS_URL  = AGENT_URL.replace(/^http/, 'ws');
export const API_TIMEOUT   = 4_000; // ms before trying cloud fallback
