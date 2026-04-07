import { Router } from 'express';
import * as db from '../db';

const router = Router();

router.get('/', (_req, res) => {
  res.json(db.getDevices());
});

router.get('/:id', (req, res) => {
  const device = db.getDeviceById(req.params.id);
  if (!device) return res.status(404).json({ error: 'Device not found' });
  res.json(device);
});

export default router;
