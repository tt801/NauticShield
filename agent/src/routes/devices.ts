import { Router } from 'express';
import * as db from '../db';
import { broadcast } from '../broadcaster';

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

export default router;
