import { Router } from 'express';
import { broadcast } from '../broadcaster';
import * as db from '../db';

const router = Router();

// ── Action registry ───────────────────────────────────────────────
// On real vessel hardware each handler would call the appropriate
// network-management API (UniFi controller, smart PoE switch, Starlink
// local API over 192.168.100.1/api, etc.).  The stubs below simulate
// realistic async latency so the frontend state machine works correctly.

interface ActionDef {
  label:   string;
  execute: (params?: Record<string, string>) => Promise<void>;
}

const ACTIONS: Record<string, ActionDef> = {
  'reboot-starlink': {
    label: 'Reboot Starlink dish',
    async execute() {
      // Real: POST http://192.168.100.1/SpaceX.API.Device.Device/Handle
      //       body: { request: { rebootDevice: {} } }
      await sleep(2000);
    },
  },
  'restart-device': {
    label: 'Power-cycle a device via smart PoE switch',
    async execute() {
      // Real: PUT https://<unifi-host>/api/s/default/rest/device/<mac>
      //       body: { port_overrides: [{ port_idx: n, poe_mode: 'off' }] }
      await sleep(1500);
    },
  },
  'block-device': {
    label: 'Block an unknown device at the controller',
    async execute() {
      // Real: POST https://<unifi-host>/api/s/default/cmd/stamgr
      //       body: { cmd: 'block-sta', mac: '<mac>' }
      await sleep(800);
    },
  },
  'lte-failover': {
    label: 'Force failover to LTE connection',
    async execute() {
      // Real: use nmcli / ip route to prefer LTE interface
      await sleep(1200);
    },
  },
};

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// POST /api/actions/:action
router.post('/:action', async (req, res) => {
  const def = ACTIONS[req.params.action];
  if (!def) {
    return res.status(404).json({ error: `Unknown action: ${req.params.action}` });
  }

  try {
    await def.execute(req.body as Record<string, string> | undefined);

    // Broadcast updated device list so the frontend refreshes
    for (const device of db.getDevices()) {
      broadcast({ type: 'device:update', data: device });
    }

    res.json({ success: true, message: `${def.label} completed successfully.` });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
