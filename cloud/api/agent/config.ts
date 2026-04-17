import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyVesselApiKey } from '../../lib/auth';
import { supabase } from '../../lib/supabase';

type GuestNetworkSettings = {
  wifiEnabled: boolean;
  portalEnabled: boolean;
  ssid: string;
  wifiPass: string;
  splashType: 'tos' | 'click' | 'none';
  accessMap: Record<string, 'approved' | 'blocked' | 'pending'>;
  bandwidthMap: Record<string, string>;
  lastSpeedTest: { dl: number; ul: number; ping: number; testedAt: string } | null;
  updatedAt: string;
};

const DEFAULT_GUEST_NETWORK_SETTINGS: GuestNetworkSettings = {
  wifiEnabled: true,
  portalEnabled: true,
  ssid: 'Aurora Guest',
  wifiPass: 'Yacht2026!',
  splashType: 'tos',
  accessMap: {},
  bandwidthMap: {},
  lastSpeedTest: null,
  updatedAt: '',
};

function normalizeGuestNetworkSettings(value: unknown): GuestNetworkSettings {
  if (!value || typeof value !== 'object') return DEFAULT_GUEST_NETWORK_SETTINGS;
  const source = value as Partial<GuestNetworkSettings>;
  return {
    wifiEnabled: typeof source.wifiEnabled === 'boolean' ? source.wifiEnabled : true,
    portalEnabled: typeof source.portalEnabled === 'boolean' ? source.portalEnabled : true,
    ssid: typeof source.ssid === 'string' && source.ssid.trim() ? source.ssid : 'Aurora Guest',
    wifiPass: typeof source.wifiPass === 'string' && source.wifiPass.trim() ? source.wifiPass : 'Yacht2026!',
    splashType: source.splashType === 'click' || source.splashType === 'none' ? source.splashType : 'tos',
    accessMap: source.accessMap && typeof source.accessMap === 'object' ? source.accessMap : {},
    bandwidthMap: source.bandwidthMap && typeof source.bandwidthMap === 'object' ? source.bandwidthMap : {},
    lastSpeedTest: source.lastSpeedTest && typeof source.lastSpeedTest === 'object' ? source.lastSpeedTest : null,
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : '',
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const vessel = await verifyVesselApiKey(req);
  if (!vessel) return res.status(401).json({ error: 'Unauthorized' });

  const { data } = await supabase
    .from('audit_log')
    .select('metadata')
    .eq('org_id', vessel.org_id)
    .eq('resource', vessel.id)
    .eq('action', 'guest.network.updated')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const metadata = (data?.metadata ?? null) as Record<string, unknown> | null;
  return res.json({
    guestNetwork: normalizeGuestNetworkSettings(metadata?.settings),
    fetchedAt: new Date().toISOString(),
  });
}