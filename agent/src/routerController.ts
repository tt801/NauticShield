import { execFile } from 'child_process';
import { promisify } from 'util';
import type { Device } from './types';
import type { GuestNetworkSettings } from './db';

const execFileAsync = promisify(execFile);

export interface RouterApplyResult {
  platform: string;
  status: 'applied' | 'disabled' | 'error';
  message: string;
  appliedAt: string;
}

function shellEscape(value: string) {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function routerPlatform() {
  return (process.env.ROUTER_PLATFORM ?? 'none').trim().toLowerCase();
}

async function applyOpenWrt(settings: GuestNetworkSettings, devices: Device[]): Promise<RouterApplyResult> {
  const host = process.env.ROUTER_HOST?.trim();
  const user = process.env.ROUTER_SSH_USER?.trim() ?? 'root';
  const keyPath = process.env.ROUTER_SSH_KEY_PATH?.trim();
  const wifiSection = process.env.ROUTER_GUEST_WIFI_SECTION?.trim() ?? 'guest';
  const guestBridge = process.env.ROUTER_GUEST_BRIDGE?.trim() ?? 'br-guest';
  const enforcePending = process.env.ROUTER_ENFORCE_PENDING !== '0';

  if (!host) {
    return {
      platform: 'openwrt',
      status: 'error',
      message: 'ROUTER_HOST is not configured for OpenWrt sync.',
      appliedAt: new Date().toISOString(),
    };
  }

  const blockedMacs = devices
    .filter(device => settings.accessMap[device.id] === 'blocked' || (enforcePending && settings.accessMap[device.id] === 'pending'))
    .map(device => device.mac.toUpperCase());

  const commands = [
    `uci set wireless.${wifiSection}.disabled='${settings.wifiEnabled ? '0' : '1'}'`,
    `uci set wireless.${wifiSection}.ssid=${shellEscape(settings.ssid)}`,
  ];

  if (settings.wifiPass.trim()) {
    commands.push(`uci set wireless.${wifiSection}.encryption='psk2'`);
    commands.push(`uci set wireless.${wifiSection}.key=${shellEscape(settings.wifiPass)}`);
  } else {
    commands.push(`uci set wireless.${wifiSection}.encryption='none'`);
    commands.push(`uci -q delete wireless.${wifiSection}.key`);
  }

  commands.push(`iptables -N NS_GUEST_FILTER 2>/dev/null || true`);
  commands.push(`iptables -F NS_GUEST_FILTER`);
  commands.push(`iptables -D FORWARD -i ${shellEscape(guestBridge)} -j NS_GUEST_FILTER 2>/dev/null || true`);
  commands.push(`iptables -I FORWARD 1 -i ${shellEscape(guestBridge)} -j NS_GUEST_FILTER`);
  blockedMacs.forEach(mac => {
    commands.push(`iptables -A NS_GUEST_FILTER -m mac --mac-source ${shellEscape(mac)} -j DROP`);
  });
  commands.push(`uci commit wireless`);
  commands.push(`wifi reload || wifi`);

  const args = ['-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=no'];
  if (keyPath) {
    args.push('-i', keyPath);
  }
  args.push(`${user}@${host}`, commands.join(' && '));

  await execFileAsync('ssh', args, { timeout: 20_000 });

  const portalNote = settings.portalEnabled
    ? ' Captive portal state is stored by NauticShield but must still be wired to the router portal stack.'
    : '';

  return {
    platform: 'openwrt',
    status: 'applied',
    message: `Applied guest SSID and ${blockedMacs.length} client rule(s) to OpenWrt.${portalNote}`,
    appliedAt: new Date().toISOString(),
  };
}

export async function applyGuestNetworkSettings(settings: GuestNetworkSettings, devices: Device[]): Promise<RouterApplyResult> {
  const platform = routerPlatform();
  if (platform === 'none') {
    return {
      platform: 'none',
      status: 'disabled',
      message: 'Router sync is disabled. Settings were stored locally only.',
      appliedAt: new Date().toISOString(),
    };
  }

  if (platform === 'openwrt') {
    return applyOpenWrt(settings, devices);
  }

  return {
    platform,
    status: 'error',
    message: `Unsupported router platform: ${platform}`,
    appliedAt: new Date().toISOString(),
  };
}