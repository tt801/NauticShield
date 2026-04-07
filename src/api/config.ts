// Agent URL config.
// Override in .env.local:   VITE_AGENT_URL=http://192.168.1.10:3000
export const AGENT_URL    = (import.meta.env.VITE_AGENT_URL as string | undefined) ?? 'http://vessel-agent.local:3000';
export const AGENT_WS_URL = AGENT_URL.replace(/^http/, 'ws');
export const API_TIMEOUT  = 5_000; // ms before falling back to mock
