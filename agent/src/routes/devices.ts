import { Router } from 'express';
import * as db from '../db';
import { broadcast } from '../broadcaster';
import { blockDevice, unblockDevice } from '../routerController';

const router = Router();

router.get('/', (_req, res) => {
  res.json(db.getDevices());
});

router.get('/:id', (req, res) => {
  const device = db.getDeviceById(req.params.id);
  if (!device) return res.status(404).json({ error: 'Device not found' });
  res.json(device);
});

router.patch('/:id', (req, res) => {
  const { name, type, location } = req.body as { name?: string; type?: string; location?: string };
  if (!name && !type && !location) {
    return res.status(400).json({ error: 'Provide at least one of: name, type, location' });
  }
  const existing = db.getDeviceById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Device not found' });

  const updated = db.renameDevice(
    req.params.id,
    name ?? existing.name,
    type  ?? existing.type,
    location !== undefined ? location : existing.location,
  );
  if (updated) broadcast({ type: 'device:update', data: updated });
  res.json(updated);
});

// ── Device Blocking ───────────────────────────────────────────────

/**
 * POST /devices/:mac/block
 * Block a device at the router level and mark it in the database.
 */
router.post('/:mac/block', async (req, res) => {
  const { mac } = req.params;
  const { reason } = req.body as { reason?: string };
  
  try {
    // Apply block at router
    const routerResult = await blockDevice(mac);
    
    // Update database
    const updated = db.setDeviceBlocked(mac, true, reason ?? 'Blocked via NauticShield');
    if (!updated) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    // Broadcast update
    broadcast({ type: 'device:update', data: updated });
    
    res.json({ 
      success: true, 
      device: updated, 
      router: routerResult 
    });
  } catch (err) {
    res.status(500).json({ error: `Failed to block device: ${String(err)}` });
  }
});

/**
 * POST /devices/:mac/unblock
 * Unblock a device at the router level and update the database.
 */
router.post('/:mac/unblock', async (req, res) => {
  const { mac } = req.params;
  
  try {
    // Apply unblock at router
    const routerResult = await unblockDevice(mac);
    
    // Update database
    const updated = db.setDeviceBlocked(mac, false);
    if (!updated) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    // Broadcast update
    broadcast({ type: 'device:update', data: updated });
    
    res.json({ 
      success: true, 
      device: updated, 
      router: routerResult 
    });
  } catch (err) {
    res.status(500).json({ error: `Failed to unblock device: ${String(err)}` });
  }
});

export default router;
