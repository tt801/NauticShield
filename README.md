# NauticShield
Nautical Tech Services

## Deployment

### Cloud API

1. Set the environment variables in [cloud/.env.example](cloud/.env.example) on the Vercel cloud project.
2. `cd cloud && npm install && npm run build`
3. Deploy the `cloud/` project to Vercel.
4. Confirm the scheduled report cron appears in Vercel and set `RESEND_API_KEY` plus `REPORTS_FROM_EMAIL` before expecting automatic delivery.

### Vessel Agent

1. Copy the values from [agent/.env.example](agent/.env.example) into the mini PC agent `.env`.
2. For plug-and-play shipping, generate a bootstrap token from the app Settings page and set only `BOOTSTRAP_URL` and `BOOTSTRAP_TOKEN` before first boot.
3. Start the agent with `cd agent && npm install && npm run build` or your existing Docker/systemd wrapper.
4. After first successful bootstrap, the agent persists cloud credentials in `agent/data/bootstrap-config.json`.

### Guest Network Enforcement

Guest network settings are now persisted and can be enforced on OpenWrt-style routers over SSH.

Required agent env vars:

- `ROUTER_PLATFORM=openwrt`
- `ROUTER_HOST`
- `ROUTER_SSH_USER`
- `ROUTER_SSH_KEY_PATH`
- `ROUTER_GUEST_WIFI_SECTION`
- `ROUTER_GUEST_BRIDGE`

Current behavior:

- Applies guest SSID, password, and enable/disable state through `uci`.
- Rebuilds an `NS_GUEST_FILTER` iptables chain for blocked clients.
- Treats pending devices as blocked when `ROUTER_ENFORCE_PENDING=1`.
- Captive portal state is stored by NauticShield but still needs router-specific portal wiring.

### Plug-and-Play Flow

1. Register the vessel in Settings > Cloud Sync.
2. Generate a one-time bootstrap token in Settings > Cloud Sync.
3. Put `BOOTSTRAP_URL` and `BOOTSTRAP_TOKEN` on the shipped mini PC.
4. On first boot the agent exchanges the token for vessel ID, cloud sync key, and relay credentials.
5. Subsequent sync cycles also pull the latest guest network policy from the cloud and apply it onboard.
